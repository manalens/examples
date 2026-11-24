using UnrealBuildTool;

public class ManalensExample : ModuleRules
{
	public ManalensExample(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });
		// The analytics subsystem sends events with the HTTP module and builds the body with Json.
		PrivateDependencyModuleNames.AddRange(new string[] { "HTTP", "Json" });
	}
}
