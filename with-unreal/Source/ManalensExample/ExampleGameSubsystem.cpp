#include "ExampleGameSubsystem.h"

#include "ManalensSubsystem.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

DEFINE_LOG_CATEGORY_STATIC(LogManalensExample, Log, All);

void UExampleGameSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	// The plugin starts itself from Project Settings > Plugins > Manalens.
	// It sends session_start, and game_open after consent.
	Manalens = Collection.InitializeDependency<UManalensSubsystem>();
	if (Manalens)
	{
		Manalens->OnFlushed.AddDynamic(this, &UExampleGameSubsystem::HandleFlushed);
		Manalens->OnSendFailed.AddDynamic(this, &UExampleGameSubsystem::HandleSendFailed);
	}
	if (FParse::Param(FCommandLine::Get(), TEXT("ManalensDemo")))
	{
		DemoHandle = FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateUObject(this, &UExampleGameSubsystem::DemoTick), 0.0f);
	}
}

void UExampleGameSubsystem::Deinitialize()
{
	FTSTicker::GetCoreTicker().RemoveTicker(DemoHandle);
	Super::Deinitialize();
}

void UExampleGameSubsystem::OnConsentAnswered(bool bAccepted)
{
	// true starts tracking. false deletes the anonymous ID and every unsent event.
	Manalens->SetConsent(bAccepted);
}

void UExampleGameSubsystem::OnSignedIn(const FString& PlayerId)
{
	Manalens->Identify(PlayerId, { { TEXT("difficulty"), TEXT("normal") } }, {}, {});
}

void UExampleGameSubsystem::OnLevelStart(int32 Level)
{
	Manalens->Track(TEXT("level_start"), {}, { { TEXT("level"), Level } }, {});
}

void UExampleGameSubsystem::OnLevelComplete(int32 Level, int32 Score)
{
	Manalens->Track(TEXT("level_complete"), {}, { { TEXT("level"), Level }, { TEXT("score"), Score } }, { { TEXT("perfect"), Score >= 1000 } });
}

void UExampleGameSubsystem::OnSaveFailed(int32 Slot)
{
	FManalensErrorOptions Options;
	Options.Severity = EManalensSeverity::Critical;
	Options.ErrorType = TEXT("SaveFailed");
	Options.bHandled = true;
	Options.Properties.Add(TEXT("slot"), FString::FromInt(Slot));
	Manalens->TrackError(FString::Printf(TEXT("Save failed for slot %d"), Slot), Options);
}

void UExampleGameSubsystem::HandleFlushed(int32 Sent, bool bOk)
{
	UE_LOG(LogManalensExample, Display, TEXT("MANALENS_SEND ok=%s events=%d"), bOk ? TEXT("true") : TEXT("false"), Sent);
}

void UExampleGameSubsystem::HandleSendFailed(int32 Status, int32 Dropped)
{
	UE_LOG(LogManalensExample, Warning, TEXT("MANALENS_DROPPED status=%d events=%d"), Status, Dropped);
}

bool UExampleGameSubsystem::DemoTick(float DeltaTime)
{
	DemoTime += DeltaTime;
	if (!Manalens || !Manalens->IsActive())
	{
		UE_LOG(LogManalensExample, Error, TEXT("MANALENS_DEMO inactive: set PublishableKey and Endpoint"));
		FPlatformMisc::RequestExit(false, TEXT("ManalensDemo"));
		return false;
	}
	if (DemoStep == 0 && DemoTime >= 0.5)
	{
		DemoStep = 1;
		OnConsentAnswered(true);
		OnSignedIn(TEXT("player-demo-1"));
		OnLevelStart(3);
		OnLevelComplete(3, 1200);
		OnSaveFailed(2);
		Manalens->Flush();
	}
	else if (DemoStep == 1 && DemoTime >= 3.0)
	{
		UE_LOG(LogManalensExample, Display, TEXT("MANALENS_DEMO done anonymous_id=%s"), *Manalens->GetAnonymousId());
		// A normal quit: the plugin sends session_end and the rest of the queue.
		FPlatformMisc::RequestExit(false, TEXT("ManalensDemo"));
		return false;
	}
	return true;
}
