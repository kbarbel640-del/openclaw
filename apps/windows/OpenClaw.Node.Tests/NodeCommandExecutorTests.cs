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
        public async Task CameraList_ShouldReturnDevicesArray()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "camera-list-1",
                Command = "camera.list"
            };

            var res = await executor.ExecuteAsync(req);

            Assert.True(res.Ok);
            Assert.NotNull(res.PayloadJSON);

            using var doc = JsonDocument.Parse(res.PayloadJSON!);
            var root = doc.RootElement;
            Assert.True(root.TryGetProperty("devices", out var devices));
            Assert.Equal(JsonValueKind.Array, devices.ValueKind);

            foreach (var d in devices.EnumerateArray())
            {
                Assert.True(d.TryGetProperty("id", out var id));
                Assert.Equal(JsonValueKind.String, id.ValueKind);

                Assert.True(d.TryGetProperty("name", out var name));
                Assert.Equal(JsonValueKind.String, name.ValueKind);

                Assert.True(d.TryGetProperty("position", out var position));
                Assert.Equal(JsonValueKind.String, position.ValueKind);

                Assert.True(d.TryGetProperty("deviceType", out var deviceType));
                Assert.Equal(JsonValueKind.String, deviceType.ValueKind);
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
        public async Task ScreenRecord_InvalidDuration_ShouldReturnInvalidRequest()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "screen-invalid-duration",
                Command = "screen.record",
                ParamsJSON = JsonSerializer.Serialize(new { durationMs = 0 })
            };

            var res = await executor.ExecuteAsync(req);

            Assert.False(res.Ok);
            Assert.NotNull(res.Error);
            Assert.Equal(OpenClawNodeErrorCode.InvalidRequest, res.Error!.Code);
        }

        [Fact]
        public async Task ScreenRecord_InvalidFps_ShouldReturnInvalidRequest()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "screen-invalid-fps",
                Command = "screen.record",
                ParamsJSON = JsonSerializer.Serialize(new { fps = -1 })
            };

            var res = await executor.ExecuteAsync(req);

            Assert.False(res.Ok);
            Assert.NotNull(res.Error);
            Assert.Equal(OpenClawNodeErrorCode.InvalidRequest, res.Error!.Code);
        }

        [Fact]
        public async Task ScreenRecord_InvalidIncludeAudioType_ShouldReturnInvalidRequest()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "screen-invalid-audio",
                Command = "screen.record",
                ParamsJSON = "{\"includeAudio\":\"yes\"}"
            };

            var res = await executor.ExecuteAsync(req);

            Assert.False(res.Ok);
            Assert.NotNull(res.Error);
            Assert.Equal(OpenClawNodeErrorCode.InvalidRequest, res.Error!.Code);
        }

        [Fact]
        public async Task ScreenRecord_InvalidScreenIndex_ShouldReturnInvalidRequest()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "screen-invalid-index",
                Command = "screen.record",
                ParamsJSON = JsonSerializer.Serialize(new { screenIndex = -1 })
            };

            var res = await executor.ExecuteAsync(req);

            Assert.False(res.Ok);
            Assert.NotNull(res.Error);
            Assert.Equal(OpenClawNodeErrorCode.InvalidRequest, res.Error!.Code);
        }

        [Fact]
        public async Task ScreenRecord_InvalidDurationType_ShouldReturnInvalidRequest()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "screen-invalid-duration-type",
                Command = "screen.record",
                ParamsJSON = "{\"durationMs\":\"1000\"}"
            };

            var res = await executor.ExecuteAsync(req);

            Assert.False(res.Ok);
            Assert.NotNull(res.Error);
            Assert.Equal(OpenClawNodeErrorCode.InvalidRequest, res.Error!.Code);
        }

        [Fact]
        public async Task CameraSnap_InvalidFacing_ShouldReturnInvalidRequest()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "camera-invalid-facing",
                Command = "camera.snap",
                ParamsJSON = JsonSerializer.Serialize(new { facing = "side" })
            };

            var res = await executor.ExecuteAsync(req);

            Assert.False(res.Ok);
            Assert.NotNull(res.Error);
            Assert.Equal(OpenClawNodeErrorCode.InvalidRequest, res.Error!.Code);
        }

        [Fact]
        public async Task CameraSnap_InvalidFormat_ShouldReturnInvalidRequest()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "camera-invalid-format",
                Command = "camera.snap",
                ParamsJSON = JsonSerializer.Serialize(new { format = "png" })
            };

            var res = await executor.ExecuteAsync(req);

            Assert.False(res.Ok);
            Assert.NotNull(res.Error);
            Assert.Equal(OpenClawNodeErrorCode.InvalidRequest, res.Error!.Code);
        }

        [Fact]
        public async Task CameraSnap_InvalidQuality_ShouldReturnInvalidRequest()
        {
            var executor = new NodeCommandExecutor();
            var req = new BridgeInvokeRequest
            {
                Id = "camera-invalid-quality",
                Command = "camera.snap",
                ParamsJSON = JsonSerializer.Serialize(new { quality = 1.5 })
            };

            var res = await executor.ExecuteAsync(req);

            Assert.False(res.Ok);
            Assert.NotNull(res.Error);
            Assert.Equal(OpenClawNodeErrorCode.InvalidRequest, res.Error!.Code);
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
