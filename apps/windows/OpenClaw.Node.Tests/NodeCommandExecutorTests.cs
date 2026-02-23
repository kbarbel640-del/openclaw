using System.Text.Json;
using OpenClaw.Node.Protocol;
using OpenClaw.Node.Services;
using Xunit;

namespace OpenClaw.Node.Tests
{
    public class NodeCommandExecutorTests
    {
        [Fact]
        public async Task SystemWhich_ShouldReturnPath_ForKnownCommand()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "1",
                Command = "system.which",
                ParamsJSON = JsonSerializer.Serialize(new { command = "dotnet" })
            };

            var res = await executor.ExecuteAsync(req);

            Assert.True(res.Ok);
            Assert.NotNull(res.PayloadJSON);
        }

        [Fact]
        public async Task ScreenRecord_ShouldReturnExpectedResult_ForCurrentPlatform()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "screen-1",
                Command = "screen.record",
                ParamsJSON = JsonSerializer.Serialize(new { durationMs = 500, fps = 8, includeAudio = false, screenIndex = 0 })
            };

            var res = await executor.ExecuteAsync(req);

            if (OperatingSystem.IsWindows())
            {
                Assert.True(res.Ok);
                Assert.NotNull(res.PayloadJSON);

                using var doc = JsonDocument.Parse(res.PayloadJSON!);
                var root = doc.RootElement;
                Assert.Equal("mp4", root.GetProperty("format").GetString());
                Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("base64").GetString()));
                Assert.Equal(500, root.GetProperty("durationMs").GetInt32());
                Assert.Equal(8, root.GetProperty("fps").GetInt32());
                Assert.Equal(0, root.GetProperty("screenIndex").GetInt32());
                Assert.False(root.GetProperty("hasAudio").GetBoolean());
            }
            else
            {
                Assert.False(res.Ok);
                Assert.NotNull(res.Error);
                Assert.Equal(OpenClawNodeErrorCode.Unavailable, res.Error!.Code);
            }
        }

        [Fact]
        public async Task CameraSnap_ShouldReturnExpectedPayloadShape()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "camera-1",
                Command = "camera.snap",
                ParamsJSON = JsonSerializer.Serialize(new { facing = "front", maxWidth = 1280, quality = 0.9, delayMs = 1 })
            };

            var res = await executor.ExecuteAsync(req);

            Assert.True(res.Ok);
            Assert.NotNull(res.PayloadJSON);

            using var doc = JsonDocument.Parse(res.PayloadJSON!);
            var root = doc.RootElement;
            Assert.Equal("jpg", root.GetProperty("format").GetString());
            Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("base64").GetString()));
            Assert.True(root.GetProperty("width").GetInt32() > 0);
            Assert.True(root.GetProperty("height").GetInt32() > 0);
        }

        [Fact]
        public async Task UnknownCommand_ShouldReturnInvalidRequest()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest { Id = "2", Command = "nope.command" };

            var res = await executor.ExecuteAsync(req);

            Assert.False(res.Ok);
            Assert.NotNull(res.Error);
            Assert.Equal(OpenClawNodeErrorCode.InvalidRequest, res.Error!.Code);
        }
    }
}
