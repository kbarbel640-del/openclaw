using System;
using System.Threading;
using System.Threading.Tasks;
using OpenClaw.Node.Protocol;
using OpenClaw.Node.Services;
using System.Collections.Generic;
using System.IO;
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
                Commands = new List<string> { "system.run", "system.which", "system.notify", "screen.list", "screen.record", "camera.list", "camera.snap", "window.list", "window.focus", "input.type", "input.key" },
                Permissions = new Dictionary<string, object>()
            };

            var executor = new NodeCommandExecutor();
            var core = new CoreMethodService(startedAtUtc);
            using var connection = new GatewayConnection(url, token, connectParams);

            connection.OnLog += msg => Console.WriteLine(msg);
            connection.OnConnected += () => Console.WriteLine("[INFO] Connected to Gateway.");
            connection.OnDisconnected += () => Console.WriteLine("[INFO] Disconnected from Gateway.");
            connection.OnEventReceived += evt =>
            {
                if (core.HandleGatewayEvent(evt))
                {
                    Console.WriteLine($"[PAIR] pending request event handled: {evt.Event}");
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

            using var cts = new CancellationTokenSource();
            
            Console.CancelKeyPress += (s, e) =>
            {
                Console.WriteLine("Shutting down...");
                e.Cancel = true;
                cts.Cancel();
            };

            try
            {
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
