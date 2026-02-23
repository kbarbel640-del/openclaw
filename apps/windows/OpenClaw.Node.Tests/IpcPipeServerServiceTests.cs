using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using OpenClaw.Node.Services;
using Xunit;

namespace OpenClaw.Node.Tests
{
    public class IpcPipeServerServiceTests
    {
        [Fact]
        public async Task IpcPing_ShouldReturnOkPayload_OnWindows()
        {
            if (!OperatingSystem.IsWindows())
            {
                // Service is intentionally disabled off Windows.
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"1\",\"method\":\"ipc.ping\",\"params\":{}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean());
            Assert.Equal("1", root.GetProperty("id").GetString());
            var payload = root.GetProperty("payload");
            Assert.True(payload.GetProperty("ok").GetBoolean());
            Assert.Equal("test-ver", payload.GetProperty("version").GetString());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task UnknownMethod_ShouldReturnMethodNotFound()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"2\",\"method\":\"ipc.nope\",\"params\":{}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.False(root.GetProperty("ok").GetBoolean());
            Assert.Equal("2", root.GetProperty("id").GetString());
            var err = root.GetProperty("error");
            Assert.Equal("METHOD_NOT_FOUND", err.GetProperty("code").GetString());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcPing_WithAuthEnabled_RequiresToken()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver", authToken: "secret");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"3\",\"method\":\"ipc.ping\",\"params\":{}}");
            var badLine = await reader.ReadLineAsync(cts.Token);
            Assert.False(string.IsNullOrWhiteSpace(badLine));
            using (var badDoc = JsonDocument.Parse(badLine!))
            {
                var root = badDoc.RootElement;
                Assert.False(root.GetProperty("ok").GetBoolean());
                Assert.Equal("UNAUTHORIZED", root.GetProperty("error").GetProperty("code").GetString());
            }

            await writer.WriteLineAsync("{\"id\":\"4\",\"method\":\"ipc.ping\",\"authToken\":\"secret\",\"params\":{}}");
            var goodLine = await reader.ReadLineAsync(cts.Token);
            Assert.False(string.IsNullOrWhiteSpace(goodLine));
            using (var goodDoc = JsonDocument.Parse(goodLine!))
            {
                var root = goodDoc.RootElement;
                Assert.True(root.GetProperty("ok").GetBoolean());
                Assert.Equal("4", root.GetProperty("id").GetString());
            }

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcWindowList_ShouldReturnWindowsArray()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"5\",\"method\":\"ipc.window.list\",\"params\":{}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean());
            var payload = root.GetProperty("payload");
            Assert.True(payload.TryGetProperty("windows", out var windows));
            Assert.Equal(JsonValueKind.Array, windows.ValueKind);

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcInputType_MissingText_ShouldReturnBadRequest()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"6\",\"method\":\"ipc.input.type\",\"params\":{}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.False(root.GetProperty("ok").GetBoolean());
            Assert.Equal("BAD_REQUEST", root.GetProperty("error").GetProperty("code").GetString());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcWindowFocus_MissingTarget_ShouldReturnBadRequest()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"7\",\"method\":\"ipc.window.focus\",\"params\":{}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.False(root.GetProperty("ok").GetBoolean());
            Assert.Equal("BAD_REQUEST", root.GetProperty("error").GetProperty("code").GetString());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcWindowRect_MissingTarget_ShouldReturnBadRequest()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"8\",\"method\":\"ipc.window.rect\",\"params\":{}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.False(root.GetProperty("ok").GetBoolean());
            Assert.Equal("BAD_REQUEST", root.GetProperty("error").GetProperty("code").GetString());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcInputKey_MissingKey_ShouldReturnBadRequest()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"9\",\"method\":\"ipc.input.key\",\"params\":{}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.False(root.GetProperty("ok").GetBoolean());
            Assert.Equal("BAD_REQUEST", root.GetProperty("error").GetProperty("code").GetString());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcInputClick_MissingCoordinates_ShouldReturnBadRequest()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"10\",\"method\":\"ipc.input.click\",\"params\":{}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.False(root.GetProperty("ok").GetBoolean());
            Assert.Equal("BAD_REQUEST", root.GetProperty("error").GetProperty("code").GetString());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcInputScroll_MissingDelta_ShouldReturnBadRequest()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"11\",\"method\":\"ipc.input.scroll\",\"params\":{}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.False(root.GetProperty("ok").GetBoolean());
            Assert.Equal("BAD_REQUEST", root.GetProperty("error").GetProperty("code").GetString());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcInputClickRelative_MissingTarget_ShouldReturnBadRequest()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"12\",\"method\":\"ipc.input.click.relative\",\"params\":{\"offsetX\":1,\"offsetY\":1}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.False(root.GetProperty("ok").GetBoolean());
            Assert.Equal("BAD_REQUEST", root.GetProperty("error").GetProperty("code").GetString());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcDevUpdate_DryRun_ShouldReturnOkWithoutGitOrBuildSideEffects()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            var repoPath = Directory.GetCurrentDirectory().Replace("\\", "\\\\");
            await writer.WriteLineAsync($"{{\"id\":\"13\",\"method\":\"ipc.dev.update\",\"params\":{{\"repoPath\":\"{repoPath}\",\"branch\":\"windows_companion_app\",\"build\":true,\"dryRun\":true}}}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean());
            var payload = root.GetProperty("payload");
            Assert.True(payload.GetProperty("ok").GetBoolean());
            Assert.True(payload.GetProperty("dryRun").GetBoolean());
            Assert.False(payload.GetProperty("built").GetBoolean());
            Assert.Equal(JsonValueKind.Array, payload.GetProperty("steps").ValueKind);
            Assert.Equal(0, payload.GetProperty("steps").GetArrayLength());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcDevRestart_DryRun_ShouldReturnScheduledFalseWithoutKillingProcess()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"14\",\"method\":\"ipc.dev.restart\",\"params\":{\"delayMs\":1200,\"dryRun\":true}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean());
            var payload = root.GetProperty("payload");
            Assert.True(payload.GetProperty("ok").GetBoolean());
            Assert.True(payload.GetProperty("dryRun").GetBoolean());
            Assert.False(payload.GetProperty("scheduled").GetBoolean());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcRequestTimeout_ShouldReturnTimeoutError_ForSlowMethod()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(5000, cts.Token);

            using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

            await writer.WriteLineAsync("{\"id\":\"15\",\"method\":\"ipc.test.sleep\",\"params\":{\"sleepMs\":400,\"timeoutMs\":120}}");
            var line = await reader.ReadLineAsync(cts.Token);

            Assert.False(string.IsNullOrWhiteSpace(line));
            using var doc = JsonDocument.Parse(line!);
            var root = doc.RootElement;
            Assert.False(root.GetProperty("ok").GetBoolean());
            Assert.Equal("TIMEOUT", root.GetProperty("error").GetProperty("code").GetString());

            cts.Cancel();
            await svc.StopAsync();
        }

        [Fact]
        public async Task IpcPing_ShouldHandleConcurrentClients()
        {
            if (!OperatingSystem.IsWindows())
            {
                return;
            }

            var pipeName = "openclaw.node.test." + Guid.NewGuid().ToString("N");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            using var svc = new IpcPipeServerService(pipeName, version: "test-ver");
            svc.Start(cts.Token);

            const int clients = 8;
            var tasks = new Task[clients];
            for (var i = 0; i < clients; i++)
            {
                var id = i;
                tasks[i] = Task.Run(async () =>
                {
                    await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
                    await client.ConnectAsync(5000, cts.Token);

                    using var reader = new StreamReader(client, Encoding.UTF8, false, 4096, leaveOpen: true);
                    await using var writer = new StreamWriter(client, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };

                    await writer.WriteLineAsync($"{{\"id\":\"c{id}\",\"method\":\"ipc.ping\",\"params\":{{}}}}");
                    var line = await reader.ReadLineAsync(cts.Token);

                    Assert.False(string.IsNullOrWhiteSpace(line));
                    using var doc = JsonDocument.Parse(line!);
                    var root = doc.RootElement;
                    Assert.True(root.GetProperty("ok").GetBoolean());
                    Assert.Equal($"c{id}", root.GetProperty("id").GetString());
                }, cts.Token);
            }

            await Task.WhenAll(tasks);

            cts.Cancel();
            await svc.StopAsync();
        }
    }
}
