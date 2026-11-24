// Manalens analytics for an Unreal Engine game, over HTTP.
//
// Manalens has no Unreal SDK. This game instance subsystem does what an SDK
// would do: one anonymous ID for each install, sessions, game_open, batches of
// up to 50 events, and a retry after a network error or a 5xx, 408 or 429
// answer. It sends app events (channel app, context.app with engine unreal) to
// POST /v0/events with the Publishable key.
//
// Settings: Config/DefaultGame.ini, section [/Script/ManalensExample.AnalyticsSubsystem].
#pragma once

#include "CoreMinimal.h"
#include "Containers/Ticker.h"
#include "Dom/JsonObject.h"
#include "Interfaces/IHttpRequest.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "AnalyticsSubsystem.generated.h"

UCLASS(Config = Game)
class UAnalyticsSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	/** Queue one event with flat snake_case properties. Props can be null. */
	void Track(const FString& Event, TSharedPtr<FJsonObject> Props = nullptr);

	/** Blueprint version of Track() without properties. */
	UFUNCTION(BlueprintCallable, Category = "Analytics")
	void TrackEvent(const FString& Event) { Track(Event); }

	/** Level events with the property names of the event conventions. */
	UFUNCTION(BlueprintCallable, Category = "Analytics")
	void LevelStart(int32 Level, int32 Attempt);

	UFUNCTION(BlueprintCallable, Category = "Analytics")
	void LevelEnd(int32 Level, int32 Attempt, int32 Score, bool bCompleted);

	/** A handled error: severity is warning, error or critical. */
	UFUNCTION(BlueprintCallable, Category = "Analytics")
	void TrackError(const FString& Message, const FString& ErrorType, const FString& Severity = TEXT("error"));

	/** After the player signs in: your opaque player ID, never an email address. */
	UFUNCTION(BlueprintCallable, Category = "Analytics")
	void Identify(const FString& UserId);

	/** Send up to 50 queued events now. Also runs every FlushIntervalSeconds. */
	UFUNCTION(BlueprintCallable, Category = "Analytics")
	void Flush();

	/** The collector URL, without /v0/events. */
	UPROPERTY(Config)
	FString Endpoint;

	/** The project Publishable key (mana_pk_...). Never a Secret key or an API key. */
	UPROPERTY(Config)
	FString PublishableKey;

	UPROPERTY(Config)
	FString AppVersion = TEXT("1.0.0");

	UPROPERTY(Config)
	FString Build = TEXT("1");

	/** steam, itch, epic, gog, app_store, play or other. */
	UPROPERTY(Config)
	FString Storefront = TEXT("steam");

	/** Send events from Play in Editor too. Off by default, so editor runs stay out of reports. */
	UPROPERTY(Config)
	bool bSendInEditor = false;

	UPROPERTY(Config)
	float FlushIntervalSeconds = 10.f;

private:
	void StartSession(const FDateTime& Time);
	void EndSession();
	void Enqueue(const FString& Type, const FString& Event, TSharedPtr<FJsonObject> Props, const FDateTime& Time, const FString& UserId = FString());
	void OnSent(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bConnectedSuccessfully);
	bool OnTick(float DeltaSeconds);
	void RunDemo();

	bool bEnabled = false;
	FString AnonymousId;
	FString SessionId;
	FString UserId;
	FDateTime SessionStart;
	FDateTime LastActivity;
	TArray<TSharedPtr<FJsonValue>> Queue;
	TArray<TSharedPtr<FJsonValue>> InFlight;
	FTSTicker::FDelegateHandle TickHandle;
};
