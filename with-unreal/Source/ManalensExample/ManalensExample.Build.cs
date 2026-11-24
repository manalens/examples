using UnrealBuildTool;

public class ManalensExample : ModuleRules
{
	public ManalensExample(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });
		// The Manalens plugin (Plugins/Manalens). Add it to your own module's Build.cs.
		PrivateDependencyModuleNames.Add("Manalens");
	}
}
