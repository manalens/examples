using UnrealBuildTool;

public class ManalensExampleEditorTarget : TargetRules
{
	public ManalensExampleEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("ManalensExample");
	}
}
