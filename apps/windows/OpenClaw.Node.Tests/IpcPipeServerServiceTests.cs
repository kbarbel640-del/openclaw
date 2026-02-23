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
    }
}
