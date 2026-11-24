using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

/// <summary>
/// Builds a desktop player for this machine into Build/, for the smoke test:
///
///   Unity -batchmode -nographics -quit -projectPath . -executeMethod BuildDemo.Build -logFile -
///
/// The game needs no scene content (ExampleGame starts by itself), so the
/// build uses an empty scene that this method creates.
/// </summary>
public static class BuildDemo
{
    const string ScenePath = "Assets/Scenes/Main.unity";

    [MenuItem("Manalens/Build demo player")]
    public static void Build()
    {
        if (!File.Exists(ScenePath))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, ScenePath);
        }

        BuildTarget target;
        string output;
        switch (Application.platform)
        {
            case RuntimePlatform.OSXEditor: target = BuildTarget.StandaloneOSX; output = "Build/with-unity.app"; break;
            case RuntimePlatform.WindowsEditor: target = BuildTarget.StandaloneWindows64; output = "Build/with-unity.exe"; break;
            case RuntimePlatform.LinuxEditor: target = BuildTarget.StandaloneLinux64; output = "Build/with-unity.x86_64"; break;
            default: throw new NotSupportedException(Application.platform.ToString());
        }

        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            target = target,
            locationPathName = output,
            options = BuildOptions.None,
        });
        Debug.Log($"BuildDemo: {report.summary.result} {output}");
        if (Application.isBatchMode) EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
    }
}
