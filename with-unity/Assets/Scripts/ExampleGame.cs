using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using ManalensSdk;

/// <summary>
/// Manalens Unity example. It starts by itself in any scene (no scene setup):
/// press Play in the editor, or run a build.
///
/// The key and the endpoint come from, in this order:
///   1. command-line arguments: --publishable-key=mana_pk_... --endpoint=URL
///   2. environment variables: MANALENS_PUBLISHABLE_KEY, MANALENS_ENDPOINT
///   3. the constants below (put your values here for a shipped game)
///
/// --demo sends a set of events without input, waits for the send, logs one
/// line "MANALENS_DEMO {json}" and quits with code 0 (all sent) or 1. The smoke
/// test runs it in a batch-mode player.
/// </summary>
public class ExampleGame : MonoBehaviour
{
    // The project Publishable key (mana_pk_...). It is safe in a game build.
    // Never put a Secret key (mana_sk_) or an API key in a game build.
    const string PublishableKey = "";
    // The collector URL, without /v0/events.
    const string Endpoint = "http://127.0.0.1:3101";
    const string WebsiteUrl = "https://example.com/wiki";

    int _level = 1;
    int _attempt = 1;
    int _score;
    string _status = "";
    string _error;
    Dictionary<string, string> _args;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        var host = new GameObject("ExampleGame");
        DontDestroyOnLoad(host);
        host.AddComponent<ExampleGame>();
    }

    void Awake()
    {
        _args = UserArgs();
        var publishableKey = Setting("publishable-key", "MANALENS_PUBLISHABLE_KEY", PublishableKey);
        var endpoint = Setting("endpoint", "MANALENS_ENDPOINT", Endpoint);
        var demo = _args.ContainsKey("demo");
        if (publishableKey == "" || endpoint == "")
        {
            _error = "Set the Publishable key and the endpoint. See README.md.";
            Debug.LogError(_error);
            if (demo) Application.Quit(1);
            return;
        }

        Manalens.SendFailed += (status, dropped) => Debug.LogWarning($"Manalens dropped {dropped} events (HTTP {status})");

        // Init() sends session_start and game_open (is_first_open, first_open_at).
        // The platform and engine ("unity") are set for you. Play mode sends
        // events too: Build is "dev" in the editor, so you can filter them out.
        var started = Manalens.Init(new ManalensOptions
        {
            PublishableKey = publishableKey,
            Endpoint = endpoint,
            Build = Application.isEditor ? "dev" : "1",
            Storefront = "itch",
            Debug = _args.ContainsKey("debug"),
            // The demo calls Shutdown() itself, and waits longer for the last
            // send than a player would.
            HandleQuit = !demo,
            QuitTimeoutSeconds = demo ? 5 : 2,
        });
        if (!started)
        {
            _error = "Manalens.Init() failed. See the Console.";
            if (demo) Application.Quit(1);
            return;
        }

        if (demo) StartCoroutine(Demo());
        else LevelStart();
    }

    // Game events, with the names of the event conventions ----------------------

    void LevelStart()
    {
        Manalens.Track("level_start", new Dictionary<string, object> { ["level"] = _level, ["attempt"] = _attempt });
        _status = $"Level {_level}, attempt {_attempt}";
    }

    void LevelComplete()
    {
        _score += 100 * _level;
        Manalens.Track("level_complete", new Dictionary<string, object> { ["level"] = _level, ["attempt"] = _attempt, ["score"] = _score });
        _level++;
        _attempt = 1;
        LevelStart();
    }

    void LevelFail()
    {
        Manalens.Track("level_fail", new Dictionary<string, object> { ["level"] = _level, ["attempt"] = _attempt, ["score"] = _score });
        _attempt++;
        LevelStart();
    }

    void GetCoins()
    {
        // An in-game resource: "source" when the player gains it, "sink" when spent.
        Manalens.Track("resource", new Dictionary<string, object> { ["flow"] = "source", ["currency"] = "coins", ["amount"] = 50, ["item"] = "daily_bonus" });
        _status = "Sent resource";
    }

    void ReportError()
    {
        // A handled error. Unhandled exceptions and Debug.LogError are sent for you.
        try
        {
            throw new InvalidOperationException("Save failed");
        }
        catch (Exception exception)
        {
            Manalens.TrackError(exception, new TrackErrorOptions { ErrorType = "SaveFailed", Severity = "error" });
        }
        _status = "Sent error";
    }

    void SignIn()
    {
        // Identify() attaches your own player ID (for example from your login).
        Manalens.Identify("player_42", new Dictionary<string, object> { ["plan"] = "free" });
        _status = "Identified as player_42";
    }

    void OpenWebsite()
    {
        // LinkUrl() adds mana_hid, so the website's web SDK joins this player.
        Application.OpenURL(Manalens.LinkUrl(WebsiteUrl));
    }

    IEnumerator Demo()
    {
        // Flushed(count, ok) tells the result of each send.
        int sendsOk = 0, eventsSent = 0, sendsFailed = 0;
        Manalens.Flushed += (count, ok) =>
        {
            if (ok) { sendsOk++; eventsSent += count; }
            else sendsFailed++;
        };
        var player = $"unity_demo_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        LevelStart();
        LevelComplete();
        LevelFail();
        GetCoins();
        ReportError();
        Manalens.Identify(player, new Dictionary<string, object> { ["plan"] = "free" });
        var link = Manalens.LinkUrl(WebsiteUrl);
        // Shutdown() sends session_end and flushes for at most QuitTimeoutSeconds.
        yield return Manalens.Shutdown();
        var left = Manalens.QueueSize;
        var json = "{"
            + $"\"anonymous_id\":\"{Manalens.AnonymousId}\",\"user_id\":\"{player}\",\"queue_left\":{left},"
            + $"\"sends_ok\":{sendsOk},\"events_sent\":{eventsSent},\"sends_failed\":{sendsFailed},"
            + $"\"link_has_handoff\":{(link.Contains("mana_hid=") ? "true" : "false")}"
            + "}";
        Debug.Log("MANALENS_DEMO " + json);
        Application.Quit(left == 0 && sendsFailed == 0 && sendsOk > 0 ? 0 : 1);
    }

    // UI (IMGUI, so the example needs no scene or prefab) ------------------------

    void OnGUI()
    {
        GUILayout.BeginArea(new Rect(24, 24, 320, Screen.height - 48));
        GUILayout.Label(_error ?? _status);
        if (_error == null && !_args.ContainsKey("demo"))
        {
            if (GUILayout.Button("Complete level")) LevelComplete();
            if (GUILayout.Button("Fail level")) LevelFail();
            if (GUILayout.Button("Get coins (resource)")) GetCoins();
            if (GUILayout.Button("Report an error")) ReportError();
            if (GUILayout.Button("Sign in (identify)")) SignIn();
            if (GUILayout.Button("Open the website (LinkUrl)")) OpenWebsite();
        }
        GUILayout.EndArea();
    }

    // Settings -------------------------------------------------------------------

    static Dictionary<string, string> UserArgs()
    {
        var args = new Dictionary<string, string>();
        foreach (var arg in Environment.GetCommandLineArgs())
        {
            if (!arg.StartsWith("--")) continue;
            var parts = arg.Substring(2).Split(new[] { '=' }, 2);
            args[parts[0]] = parts.Length > 1 ? parts[1] : "true";
        }
        return args;
    }

    string Setting(string arg, string env, string fallback)
    {
        if (_args.TryGetValue(arg, out var value)) return value;
        var fromEnv = Environment.GetEnvironmentVariable(env);
        return string.IsNullOrEmpty(fromEnv) ? fallback : fromEnv;
    }
}
