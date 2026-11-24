#pragma once

#include "CoreMinimal.h"
#include "Containers/Ticker.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "ExampleGameSubsystem.generated.h"

class UManalensSubsystem;

/**
 * The game code of this example. Each function calls the Manalens plugin, the
 * way your own gameplay code would. With -ManalensDemo on the command line,
 * it calls them once and quits.
 */
UCLASS()
class UExampleGameSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	/** The player answered the consent prompt. */
	UFUNCTION(BlueprintCallable, Category = "Example")
	void OnConsentAnswered(bool bAccepted);

	/** The player signed in to your account system. */
	UFUNCTION(BlueprintCallable, Category = "Example")
	void OnSignedIn(const FString& PlayerId);

	UFUNCTION(BlueprintCallable, Category = "Example")
	void OnLevelStart(int32 Level);

	UFUNCTION(BlueprintCallable, Category = "Example")
	void OnLevelComplete(int32 Level, int32 Score);

	UFUNCTION(BlueprintCallable, Category = "Example")
	void OnSaveFailed(int32 Slot);

private:
	UFUNCTION()
	void HandleFlushed(int32 Sent, bool bOk);

	UFUNCTION()
	void HandleSendFailed(int32 Status, int32 Dropped);

	bool DemoTick(float DeltaTime);

	UPROPERTY()
	TObjectPtr<UManalensSubsystem> Manalens;

	FTSTicker::FDelegateHandle DemoHandle;
	double DemoTime = 0.0;
	int32 DemoStep = 0;
};
