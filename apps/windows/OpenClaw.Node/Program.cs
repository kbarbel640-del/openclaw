using System;
using System.Threading;
using System.Threading.Tasks;
using OpenClaw.Node.Protocol;
using OpenClaw.Node.Services;
using OpenClaw.Node.Tray;
using System.Collections.Generic;
using System.IO;
using System.Diagnostics;
using System.Text.Json;

namespace OpenClaw.Node
{
    class Program
    {
        static async Task Main(string[] args)
        {
            var startedAtUtc = DateTimeOffset.UtcNow;
            Console.WriteLine("OpenClaw Node for Windows starting...");

            string url = ResolveGatewayUrl(args);
            string token = ResolveGatewayToken(args);
            if (string.IsNullOrWhiteSpace(token))
            {
                Console.WriteLine("[FATAL] Missing gateway token. Set OPENCLAW_GATEWAY_TOKEN or pass --gateway-token <token>.");
                return;
            }

            var trayEnabled = HasArg(args, "--tray");

            var connectParams = new ConnectParams
            {
                MinProtocol = Constants.GatewayProtocolVersion,
                MaxProtocol = Constants.GatewayProtocolVersion,
                Role = "node",
                Client = new Dictionary<string, object>
                {
                    { "id", "node-host" },
                    { "displayName", Environment.MachineName },
                    { "platform", "windows" },
                    { "mode", "node" },
                    { "version", "dev" },
                    { "instanceId", Guid.NewGuid().ToString() },
                    { "deviceFamily", "Windows" }
                },
                Caps = new List<string> { "screenRecording", "notifications", "microphone" },
                Locale = "en-US",
                UserAgent = Environment.OSVersion.VersionString,
                Scopes = new List<string>(),
                Commands = new List<string> { "system.run", "system.which", "system.notify", "dev.update", "dev.restart", "dev.screenshot", "screen.list", "screen.record", "camera.list", "camera.snap", "window.list", "window.focus", "window.rect", "input.type", "input.key", "input.click", "input.scroll", "input.click.relative", "ui.find", "ui.click", "ui.type" },
                Permissions = new Dictionary<string, object>()
            };

            using var cts = new CancellationTokenSource();
            var restartRequested = false;

            var executor = new NodeCommandExecutor();
            var core = new CoreMethodService(startedAtUtc);
            using var ipc = new IpcPipeServerService(version: "dev", authToken: token);
            using var connection = new GatewayConnection(url, token, connectParams);
            using var discovery = new DiscoveryService(connectParams, url);
            var trayStatus = new TrayStatusBroadcaster();
            var reconnectStartedAtUtc = (DateTimeOffset?)null;
            long? lastReconnectMs = null;

            void SetTray(NodeRuntimeState state, string message)
            {
                trayStatus.Set(state, message, core.PendingPairCount, lastReconnectMs);
            }

            ITrayHost? trayHost = null;

            if (trayEnabled)
            {
                trayHost = OperatingSystem.IsWindows()
                    ? new WindowsNotifyIconTrayHost(
                        log: msg => Console.WriteLine(msg),
                        onOpenLogs: () => OpenLogsFolder(),
                        onRestart: () => { restartRequested = true; cts.Cancel(); },
                        onExit: () => cts.Cancel(),
                        onCopyDiagnostics: () => CopyDiagnosticsToClipboard(BuildDiagnostics(startedAtUtc, url, trayStatus.Current, core.PendingPairCount, lastReconnectMs)))
                    : new NoOpTrayHost(msg => Console.WriteLine(msg));
            }

            connection.OnLog += msg =>
            {
                Console.WriteLine(msg);
                if (msg.Contains("Reconnecting in", StringComparison.OrdinalIgnoreCase))
                {
                    reconnectStartedAtUtc ??= DateTimeOffset.UtcNow;
                    SetTray(NodeRuntimeState.Reconnecting, msg);
                }
            };
            connection.OnConnected += () =>
            {
                Console.WriteLine("[INFO] Connected to Gateway.");
                if (reconnectStartedAtUtc.HasValue)
                {
                    lastReconnectMs = (long)(DateTimeOffset.UtcNow - reconnectStartedAtUtc.Value).TotalMilliseconds;
                    reconnectStartedAtUtc = null;
                }
                SetTray(NodeRuntimeState.Connected, "Connected to Gateway");
                _ = discovery.TriggerAnnounceAsync("gateway-connected", CancellationToken.None);
            };
            connection.OnDisconnected += () =>
            {
                Console.WriteLine("[INFO] Disconnected from Gateway.");
                reconnectStartedAtUtc = DateTimeOffset.UtcNow;
                SetTray(NodeRuntimeState.Disconnected, "Disconnected from Gateway");
            };
            ipc.OnLog += msg => Console.WriteLine(msg);
            discovery.OnLog += msg => Console.WriteLine(msg);
            connection.OnEventReceived += evt =>
            {
                if (core.HandleGatewayEvent(evt))
                {
                    Console.WriteLine($"[PAIR] pending request event handled: {evt.Event}");
                    SetTray(trayStatus.Current.State, trayStatus.Current.Message);
                }
            };

            connection.OnNodeInvoke += async req =>
            {
                Console.WriteLine($"[INVOKE] Received bridge command: {req.Command}");
                return await executor.ExecuteAsync(req);
            };

            // Register Method Handlers (Core)
            connection.RegisterMethodHandler("status", core.HandleStatusAsync);
            connection.RegisterMethodHandler("health", core.HandleHealthAsync);
            connection.RegisterMethodHandler("set-heartbeats", core.HandleSetHeartbeatsAsync);
            connection.RegisterMethodHandler("system-event", core.HandleSystemEventAsync);
            connection.RegisterMethodHandler("channels.status", core.HandleChannelsStatusAsync);
            connection.RegisterMethodHandler("config.get", core.HandleConfigGetAsync);
            connection.RegisterMethodHandler("config.schema", core.HandleConfigSchemaAsync);
            connection.RegisterMethodHandler("config.set", core.HandleConfigSetAsync);
            connection.RegisterMethodHandler("config.patch", core.HandleConfigPatchAsync);
            connection.RegisterMethodHandler("node.pair.list", core.HandleNodePairListAsync);
            connection.RegisterMethodHandler("node.pair.approve", core.HandleNodePairApproveAsync);
            connection.RegisterMethodHandler("node.pair.reject", core.HandleNodePairRejectAsync);
            connection.RegisterMethodHandler("device.pair.list", core.HandleDevicePairListAsync);
            connection.RegisterMethodHandler("device.pair.approve", core.HandleDevicePairApproveAsync);
            connection.RegisterMethodHandler("device.pair.reject", core.HandleDevicePairRejectAsync);

            if (trayHost != null)
            {
                trayStatus.OnStatusChanged += snapshot =>
                {
                    _ = trayHost.UpdateAsync(snapshot, CancellationToken.None);
                };
            }

            Console.CancelKeyPress += (s, e) =>
            {
                Console.WriteLine("Shutting down...");
                e.Cancel = true;
                cts.Cancel();
            };

            try
            {
                if (trayHost != null)
                {
                    await trayHost.StartAsync(cts.Token);
                    SetTray(NodeRuntimeState.Starting, "Starting node runtime");
                }

                discovery.Start(cts.Token);
                ipc.Start(cts.Token);
                var runTask = connection.StartAsync(cts.Token);
                await runTask;
            }
            catch (TaskCanceledException) { }
            catch (Exception ex)
            {
                Console.WriteLine($"[FATAL] {ex.Message}");
            }
            finally
            {
                connection.Stop();
                await discovery.StopAsync();
                await ipc.StopAsync();

                if (trayHost != null)
                {
                    SetTray(NodeRuntimeState.Stopped, "Node runtime stopped");
                    await trayHost.StopAsync();
                }

                if (restartRequested)
                {
                    TryScheduleSelfRestart();
                }
            }
        }

        private static string ResolveGatewayUrl(string[] args)
        {
            var fromArgs = GetArgValue(args, "--gateway-url");
            if (!string.IsNullOrWhiteSpace(fromArgs)) return fromArgs;

            var fromEnv = Environment.GetEnvironmentVariable("OPENCLAW_GATEWAY_URL");
            if (!string.IsNullOrWhiteSpace(fromEnv)) return fromEnv;

            var fromConfig = TryReadGatewayUrlFromOpenClawConfig();
            if (!string.IsNullOrWhiteSpace(fromConfig)) return fromConfig;

            return "ws://127.0.0.1:18789";
        }

        private static string ResolveGatewayToken(string[] args)
        {
            var fromArgs = GetArgValue(args, "--gateway-token");
            if (!string.IsNullOrWhiteSpace(fromArgs)) return fromArgs;

            var fromEnv = Environment.GetEnvironmentVariable("OPENCLAW_GATEWAY_TOKEN");
            if (!string.IsNullOrWhiteSpace(fromEnv)) return fromEnv;

            return TryReadGatewayTokenFromOpenClawConfig() ?? string.Empty;
        }

        private static void OpenLogsFolder()
        {
            try
            {
                var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                var dir = Path.Combine(home, ".openclaw");
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = QuoteForCmd(dir),
                    UseShellExecute = false,
                    CreateNoWindow = true
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TRAY] Open logs folder failed: {ex.Message}");
            }
        }

        private static string BuildDiagnostics(DateTimeOffset startedAtUtc, string gatewayUrl, TrayStatusSnapshot snapshot, int pendingPairs, long? lastReconnectMs)
        {
            var uptime = (long)(DateTimeOffset.UtcNow - startedAtUtc).TotalSeconds;
            var reconnectText = lastReconnectMs.HasValue ? $"{lastReconnectMs.Value}ms" : "n/a";

            return string.Join(Environment.NewLine, new[]
            {
                "OpenClaw Windows Node Diagnostics",
                $"timeUtc: {DateTimeOffset.UtcNow:O}",
                $"gatewayUrl: {gatewayUrl}",
                $"state: {snapshot.State}",
                $"message: {snapshot.Message}",
                $"pendingPairs: {pendingPairs}",
                $"lastReconnect: {reconnectText}",
                $"uptimeSeconds: {uptime}",
                $"pid: {Environment.ProcessId}"
            });
        }

        private static void CopyDiagnosticsToClipboard(string text)
        {
            if (!OperatingSystem.IsWindows())
            {
                Console.WriteLine("[TRAY] Copy diagnostics skipped on non-Windows host.");
                return;
            }

            try
            {
                var escaped = text.Replace("'", "''");
                Process.Start(new ProcessStartInfo
                {
                    FileName = "powershell",
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"Set-Clipboard -Value '{escaped}'\"",
                    UseShellExecute = false,
                    CreateNoWindow = true
                });
                Console.WriteLine("[TRAY] Diagnostics copied to clipboard.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TRAY] Copy diagnostics failed: {ex.Message}");
            }
        }

        private static void TryScheduleSelfRestart()
        {
            try
            {
                var processPath = Environment.ProcessPath;
                if (string.IsNullOrWhiteSpace(processPath))
                {
                    Console.WriteLine("[TRAY] Restart requested but process path is unavailable.");
                    return;
                }

                var args = Environment.GetCommandLineArgs();
                var argBuilder = new System.Text.StringBuilder();
                for (var i = 1; i < args.Length; i++)
                {
                    if (argBuilder.Length > 0) argBuilder.Append(' ');
                    argBuilder.Append(QuoteForCmd(args[i]));
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = $"/c timeout /t 1 /nobreak >nul && start \"\" {QuoteForCmd(processPath)} {argBuilder}",
                    UseShellExecute = false,
                    CreateNoWindow = true
                });

                Console.WriteLine("[TRAY] Restart requested by tray menu.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TRAY] Failed to schedule restart: {ex.Message}");
            }
        }

        private static string QuoteForCmd(string value)
        {
            if (string.IsNullOrEmpty(value)) return "\"\"";
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private static bool HasArg(string[] args, string key)
        {
            for (var i = 0; i < args.Length; i++)
            {
                if (args[i].Equals(key, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static string? GetArgValue(string[] args, string key)
        {
            for (var i = 0; i < args.Length - 1; i++)
            {
                if (args[i].Equals(key, StringComparison.OrdinalIgnoreCase)) return args[i + 1];
            }
            return null;
        }

        private static string? TryReadGatewayUrlFromOpenClawConfig()
        {
            var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".openclaw", "openclaw.json");
            if (!File.Exists(path)) return null;
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            if (!doc.RootElement.TryGetProperty("gateway", out var gateway)) return null;

            var port = gateway.TryGetProperty("port", out var portEl) ? portEl.GetInt32() : 18789;
            return $"ws://127.0.0.1:{port}";
        }

        private static string? TryReadGatewayTokenFromOpenClawConfig()
        {
            var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".openclaw", "openclaw.json");
            if (!File.Exists(path)) return null;
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            if (!doc.RootElement.TryGetProperty("gateway", out var gateway)) return null;
            if (!gateway.TryGetProperty("auth", out var auth)) return null;
            if (!auth.TryGetProperty("token", out var tokenEl)) return null;
            return tokenEl.GetString();
        }
    }
}
