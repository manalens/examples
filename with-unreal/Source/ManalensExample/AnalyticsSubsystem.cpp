#include "AnalyticsSubsystem.h"

#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Misc/CommandLine.h"
#include "CoreGlobals.h"
#include "Misc/DateTime.h"
#include "Misc/FileHelper.h"
#include "Misc/Guid.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

DEFINE_LOG_CATEGORY_STATIC(LogManalens, Log, All);

namespace
{
#if PLATFORM_WINDOWS
	const TCHAR* Platform = TEXT("windows");
#elif PLATFORM_MAC
	const TCHAR* Platform = TEXT("macos");
#elif PLATFORM_LINUX
	const TCHAR* Platform = TEXT("linux");
#elif PLATFORM_ANDROID
	const TCHAR* Platform = TEXT("android");
#elif PLATFORM_IOS
	const TCHAR* Platform = TEXT("ios");
#else
	const TCHAR* Platform = TEXT("other");
#endif

	// Manalens accepts only RFC 4122 UUIDs. FGuid makes 128 random bits: set the
	// version digit (4) and the variant digit, so the ID is a valid version 4 UUID.
	FString NewUuid()
	{
		FString Id = FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphensLower);
		Id[14] = TEXT('4');
		Id[19] = TEXT('a');
		return Id;
	}

	int64 SecondsBetween(const FDateTime& From, const FDateTime& To)
	{
		return To.ToUnixTimestamp() - From.ToUnixTimestamp();
	}

	// A batch has 1 to 50 events. Flush() sends early at 20 queued events.
	constexpr int32 MaxBatch = 50;
	constexpr int32 FlushAt = 20;
	constexpr int64 IdleSeconds = 30 * 60;
	constexpr int64 MaxSessionSeconds = 24 * 60 * 60;
}

void UAnalyticsSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	// Command line values win over Config/DefaultGame.ini.
	FParse::Value(FCommandLine::Get(), TEXT("ManalensEndpoint="), Endpoint);
	FParse::Value(FCommandLine::Get(), TEXT("ManalensKey="), PublishableKey);
	Endpoint.RemoveFromEnd(TEXT("/"));

	bEnabled = !Endpoint.IsEmpty() && !PublishableKey.IsEmpty();
#if WITH_EDITOR
	if (GIsEditor && !bSendInEditor) bEnabled = false; // keep editor runs out of reports
#endif
	if (!PublishableKey.IsEmpty() && !PublishableKey.StartsWith(TEXT("mana_pk_")))
	{
		// A Secret key or an API key in a game build can be read by every player.
		UE_LOG(LogManalens, Error, TEXT("PublishableKey must be a Publishable key (mana_pk_...). No events are sent."));
		bEnabled = false;
	}
	if (!bEnabled)
	{
		UE_LOG(LogManalens, Display, TEXT("Manalens is off: set Endpoint and PublishableKey in Config/DefaultGame.ini."));
		return;
	}

	// One anonymous_id for each install, saved in the Saved folder. A new ID on
	// every launch would make every session a new player.
	const FString IdFile = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("Manalens"), TEXT("anonymous_id.txt"));
	const FString FirstOpenFile = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("Manalens"), TEXT("first_open_at.txt"));
	const FDateTime Time = FDateTime::UtcNow();
	FString FirstOpenAt;
	const bool bFirstOpen = !FFileHelper::LoadFileToString(AnonymousId, *IdFile) || AnonymousId.Len() != 36;
	if (bFirstOpen)
	{
		AnonymousId = NewUuid();
		FFileHelper::SaveStringToFile(AnonymousId, *IdFile);
	}
	if (bFirstOpen || !FFileHelper::LoadFileToString(FirstOpenAt, *FirstOpenFile))
	{
		FirstOpenAt = Time.ToIso8601();
		FFileHelper::SaveStringToFile(FirstOpenAt, *FirstOpenFile);
	}

	StartSession(Time);
	TSharedPtr<FJsonObject> Open = MakeShared<FJsonObject>();
	Open->SetBoolField(TEXT("is_first_open"), bFirstOpen);
	Open->SetStringField(TEXT("first_open_at"), FirstOpenAt);
	Enqueue(TEXT("track"), TEXT("game_open"), Open, Time);
	Flush();

	TickHandle = FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateUObject(this, &UAnalyticsSubsystem::OnTick), FlushIntervalSeconds);

	if (FParse::Param(FCommandLine::Get(), TEXT("ManalensDemo"))) RunDemo();
}

void UAnalyticsSubsystem::Deinitialize()
{
	FTSTicker::GetCoreTicker().RemoveTicker(TickHandle);
	if (bEnabled)
	{
		EndSession();
		// This last request can be lost when the process exits. See the README
		// for a queue on disk.
		InFlight.Reset();
		Flush();
	}
	Super::Deinitialize();
}

bool UAnalyticsSubsystem::OnTick(float DeltaSeconds)
{
	Flush();
	return true; // keep ticking
}

void UAnalyticsSubsystem::StartSession(const FDateTime& Time)
{
	SessionId = NewUuid(); // a new ID for each session, never the anonymous_id
	SessionStart = Time;
	LastActivity = Time;
	Enqueue(TEXT("track"), TEXT("session_start"), nullptr, Time);
}

void UAnalyticsSubsystem::EndSession()
{
	// The session ends at its last activity, in its own session_id.
	TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
	Props->SetNumberField(TEXT("duration_s"), static_cast<double>(SecondsBetween(SessionStart, LastActivity)));
	Enqueue(TEXT("track"), TEXT("session_end"), Props, LastActivity);
}

void UAnalyticsSubsystem::Track(const FString& Event, TSharedPtr<FJsonObject> Props)
{
	if (!bEnabled) return;
	const FDateTime Time = FDateTime::UtcNow();
	// A new session after 30 minutes without events, and when the session is 24 hours old.
	if (SecondsBetween(LastActivity, Time) > IdleSeconds || SecondsBetween(SessionStart, Time) > MaxSessionSeconds)
	{
		EndSession();
		StartSession(Time);
	}
	LastActivity = Time;
	Enqueue(TEXT("track"), Event, Props, Time);
	if (Queue.Num() >= FlushAt) Flush();
}

void UAnalyticsSubsystem::LevelStart(int32 Level, int32 Attempt)
{
	TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
	Props->SetNumberField(TEXT("level"), Level);
	Props->SetNumberField(TEXT("attempt"), Attempt);
	Track(TEXT("level_start"), Props);
}

void UAnalyticsSubsystem::LevelEnd(int32 Level, int32 Attempt, int32 Score, bool bCompleted)
{
	TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
	Props->SetNumberField(TEXT("level"), Level);
	Props->SetNumberField(TEXT("attempt"), Attempt);
	Props->SetNumberField(TEXT("score"), Score);
	Track(bCompleted ? TEXT("level_complete") : TEXT("level_fail"), Props);
}

void UAnalyticsSubsystem::TrackError(const FString& Message, const FString& ErrorType, const FString& Severity)
{
	// Keep personal data (paths with user names, emails) out of the message.
	TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
	Props->SetStringField(TEXT("severity"), Severity);
	Props->SetStringField(TEXT("message"), Message.Left(200));
	Props->SetStringField(TEXT("error_type"), ErrorType);
	Props->SetBoolField(TEXT("handled"), true);
	Props->SetStringField(TEXT("fingerprint"), ErrorType + TEXT(":") + Message.Left(80));
	Track(TEXT("error"), Props);
}

void UAnalyticsSubsystem::Identify(const FString& InUserId)
{
	if (!bEnabled || InUserId.IsEmpty()) return;
	UserId = InUserId.Left(255);
	// An identify event has a user_id and traits, and no event name. Later
	// events carry the user_id too.
	Enqueue(TEXT("identify"), FString(), nullptr, FDateTime::UtcNow(), UserId);
	Flush();
}

void UAnalyticsSubsystem::Enqueue(const FString& Type, const FString& Event, TSharedPtr<FJsonObject> Props, const FDateTime& Time, const FString& IdentifyUserId)
{
	TSharedPtr<FJsonObject> App = MakeShared<FJsonObject>();
	App->SetStringField(TEXT("platform"), Platform);
	App->SetStringField(TEXT("storefront"), Storefront);
	App->SetStringField(TEXT("app_version"), AppVersion);
	App->SetStringField(TEXT("build"), Build);
	App->SetStringField(TEXT("engine"), TEXT("unreal"));
	TSharedPtr<FJsonObject> Context = MakeShared<FJsonObject>();
	Context->SetObjectField(TEXT("app"), App);
	Context->SetStringField(TEXT("library_name"), TEXT("with-unreal"));
	Context->SetStringField(TEXT("library_version"), AppVersion);

	TSharedPtr<FJsonObject> E = MakeShared<FJsonObject>();
	E->SetStringField(TEXT("type"), Type);
	if (Type == TEXT("track")) E->SetStringField(TEXT("event"), Event);
	E->SetStringField(TEXT("channel"), TEXT("app"));
	E->SetStringField(TEXT("version"), TEXT("0.1.0"));
	E->SetStringField(TEXT("message_id"), NewUuid()); // Manalens counts each message_id once
	E->SetStringField(TEXT("anonymous_id"), AnonymousId);
	E->SetStringField(TEXT("session_id"), SessionId);
	E->SetStringField(TEXT("original_timestamp"), Time.ToIso8601()); // UTC, ends in Z
	E->SetObjectField(TEXT("context"), Context);
	if (!UserId.IsEmpty()) E->SetStringField(TEXT("user_id"), UserId);
	if (Type == TEXT("identify")) E->SetObjectField(TEXT("traits"), MakeShared<FJsonObject>());
	else E->SetObjectField(TEXT("properties"), Props.IsValid() ? Props : MakeShared<FJsonObject>());
	Queue.Add(MakeShared<FJsonValueObject>(E));
}

void UAnalyticsSubsystem::Flush()
{
	if (!bEnabled || Queue.Num() == 0 || InFlight.Num() > 0) return; // one request at a time
	const int32 Count = FMath::Min(Queue.Num(), MaxBatch);
	for (int32 Index = 0; Index < Count; ++Index) InFlight.Add(Queue[Index]);
	Queue.RemoveAt(0, Count);

	TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
	Body->SetArrayField(TEXT("events"), InFlight);
	FString Json;
	FJsonSerializer::Serialize(Body, TJsonWriterFactory<>::Create(&Json));

	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Endpoint + TEXT("/v0/events"));
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Request->SetHeader(TEXT("x-publishable-key"), PublishableKey);
	Request->SetContentAsString(Json);
	Request->OnProcessRequestComplete().BindUObject(this, &UAnalyticsSubsystem::OnSent);
	Request->ProcessRequest();
}

void UAnalyticsSubsystem::OnSent(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bConnectedSuccessfully)
{
	const int32 Status = (bConnectedSuccessfully && Response.IsValid()) ? Response->GetResponseCode() : 0;
	UE_LOG(LogManalens, Display, TEXT("MANALENS_SEND status=%d events=%d"), Status, InFlight.Num());
	// Keep the batch after a network error or a 5xx, 408 or 429 answer. The next
	// Flush() sends it again with the same message_id values. 202 is a success.
	// Another 4xx is a refusal: the same batch fails again, so drop it and log.
	if (Status == 0 || Status >= 500 || Status == 408 || Status == 429)
	{
		Queue.Insert(InFlight, 0);
	}
	else if (Status >= 400 && Response.IsValid())
	{
		UE_LOG(LogManalens, Warning, TEXT("Manalens refused a batch (%d): %s"), Status, *Response->GetContentAsString().Left(500));
	}
	InFlight.Reset();
}

void UAnalyticsSubsystem::RunDemo()
{
	// -ManalensDemo: a short set of events, then quit once the queue is sent.
	LevelStart(1, 1);
	LevelEnd(1, 1, 500, true);
	LevelStart(2, 1);
	LevelEnd(2, 1, 0, false);
	TrackError(TEXT("Demo handled error"), TEXT("DemoError"));
	Identify(TEXT("demo_player_42"));
	FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateWeakLambda(this, [this](float)
	{
		if (Queue.Num() > 0 || InFlight.Num() > 0)
		{
			Flush();
			return true;
		}
		UE_LOG(LogManalens, Display, TEXT("MANALENS_DEMO done"));
		RequestEngineExit(TEXT("Manalens demo done"));
		return false;
	}), 0.5f);
}
