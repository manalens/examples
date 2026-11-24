using UnrealBuildTool;

public class ManalensExampleTarget : TargetRules
{
	public ManalensExampleTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("ManalensExample");
	}
}
