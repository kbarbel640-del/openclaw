using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using OpenClaw.Node.Protocol;

namespace OpenClaw.Node.Services
{
    public class NodeCommandExecutor
    {
        public async Task<BridgeInvokeResponse> ExecuteAsync(BridgeInvokeRequest request)
        {
            try
            {
                return request.Command switch
                {
                    "system.notify" => HandleSystemNotify(request),
                    "system.which" => await HandleSystemWhichAsync(request),
                    "system.run" => await HandleSystemRunAsync(request),
                    "screen.record" => await HandleScreenRecordAsync(request),
                    "camera.list" => await HandleCameraListAsync(request),
                    "camera.snap" => await HandleCameraSnapAsync(request),
                    _ => new BridgeInvokeResponse
                    {
                        Id = request.Id,
                        Ok = false,
                        Error = new OpenClawNodeError
                        {
                            Code = OpenClawNodeErrorCode.InvalidRequest,
                            Message = $"Unsupported command: {request.Command}"
                        }
                    }
                };
            }
            catch (Exception ex)
            {
                return new BridgeInvokeResponse
                {
                    Id = request.Id,
                    Ok = false,
                    Error = new OpenClawNodeError
                    {
                        Code = OpenClawNodeErrorCode.Unavailable,
                        Message = ex.Message
                    }
                };
            }
        }

        private BridgeInvokeResponse HandleSystemNotify(BridgeInvokeRequest request)
        {
            var root = ParseParams(request.ParamsJSON);
            var title = root?.TryGetProperty("title", out var t) == true ? t.GetString() : null;
            var body = root?.TryGetProperty("body", out var b) == true ? b.GetString() : null;

            Console.WriteLine($"[NOTIFY] {title ?? "(no title)"}: {body ?? ""}");
            return new BridgeInvokeResponse
            {
                Id = request.Id,
                Ok = true,
                PayloadJSON = JsonSerializer.Serialize(new { ok = true })
            };
        }

        private async Task<BridgeInvokeResponse> HandleSystemWhichAsync(BridgeInvokeRequest request)
        {
            var root = ParseParams(request.ParamsJSON);
            var command = root?.TryGetProperty("command", out var c) == true ? c.GetString() : null;
            if (string.IsNullOrWhiteSpace(command))
            {
                return new BridgeInvokeResponse
                {
                    Id = request.Id,
                    Ok = false,
                    Error = new OpenClawNodeError
                    {
                        Code = OpenClawNodeErrorCode.InvalidRequest,
                        Message = "system.which requires params.command"
                    }
                };
            }

            var whichProgram = OperatingSystem.IsWindows() ? "where" : "which";
            var result = await RunProcessAsync(whichProgram, command);

            var payload = new
            {
                ok = result.ExitCode == 0,
                found = result.ExitCode == 0,
                path = result.StdOut.Trim(),
                stderr = result.StdErr.Trim(),
            };

            return new BridgeInvokeResponse
            {
                Id = request.Id,
                Ok = result.ExitCode == 0,
                PayloadJSON = JsonSerializer.Serialize(payload),
                Error = result.ExitCode == 0
                    ? null
                    : new OpenClawNodeError
                    {
                        Code = OpenClawNodeErrorCode.Unavailable,
                        Message = string.IsNullOrWhiteSpace(result.StdErr)
                            ? $"command not found: {command}"
                            : result.StdErr.Trim()
                    }
            };
        }

        private async Task<BridgeInvokeResponse> HandleSystemRunAsync(BridgeInvokeRequest request)
        {
            var root = ParseParams(request.ParamsJSON);
            if (root == null)
            {
                return Invalid(request.Id, "system.run requires params");
            }

            ProcessResult result;

            if (root.Value.TryGetProperty("command", out var commandEl))
            {
                if (commandEl.ValueKind == JsonValueKind.Array)
                {
                    var first = true;
                    string fileName = string.Empty;
                    var args = new System.Collections.Generic.List<string>();
                    foreach (var part in commandEl.EnumerateArray())
                    {
                        var value = part.GetString() ?? string.Empty;
                        if (first)
                        {
                            fileName = value;
                            first = false;
                        }
                        else
                        {
                            args.Add(value);
                        }
                    }

                    if (string.IsNullOrWhiteSpace(fileName)) return Invalid(request.Id, "system.run command array cannot be empty");
                    result = await RunProcessAsync(fileName, args.ToArray());
                }
                else if (commandEl.ValueKind == JsonValueKind.String)
                {
                    var commandText = commandEl.GetString();
                    if (string.IsNullOrWhiteSpace(commandText)) return Invalid(request.Id, "system.run command string cannot be empty");

                    if (OperatingSystem.IsWindows())
                        result = await RunProcessAsync("cmd.exe", "/c", commandText);
                    else
                        result = await RunProcessAsync("bash", "-lc", commandText);
                }
                else
                {
                    return Invalid(request.Id, "system.run params.command must be string or string[]");
                }
            }
            else
            {
                return Invalid(request.Id, "system.run requires params.command");
            }

            var payload = new
            {
                ok = result.ExitCode == 0,
                exitCode = result.ExitCode,
                stdout = result.StdOut,
                stderr = result.StdErr,
            };

            return new BridgeInvokeResponse
            {
                Id = request.Id,
                Ok = result.ExitCode == 0,
                PayloadJSON = JsonSerializer.Serialize(payload),
                Error = result.ExitCode == 0
                    ? null
                    : new OpenClawNodeError
                    {
                        Code = OpenClawNodeErrorCode.Unavailable,
                        Message = $"system.run failed with exit code {result.ExitCode}"
                    }
            };
        }

        
        private async Task<BridgeInvokeResponse> HandleScreenRecordAsync(BridgeInvokeRequest request)
        {
            var root = ParseParams(request.ParamsJSON);

            if (root != null && root.Value.TryGetProperty("durationMs", out var durationEl) && durationEl.ValueKind != JsonValueKind.Number)
            {
                return Invalid(request.Id, "screen.record params.durationMs must be a number");
            }

            if (root != null && root.Value.TryGetProperty("fps", out var fpsEl) && fpsEl.ValueKind != JsonValueKind.Number)
            {
                return Invalid(request.Id, "screen.record params.fps must be a number");
            }

            if (root != null && root.Value.TryGetProperty("includeAudio", out var audioEl) &&
                audioEl.ValueKind != JsonValueKind.True && audioEl.ValueKind != JsonValueKind.False)
            {
                return Invalid(request.Id, "screen.record params.includeAudio must be a boolean");
            }

            if (root != null && root.Value.TryGetProperty("screenIndex", out var screenEl) && screenEl.ValueKind != JsonValueKind.Number)
            {
                return Invalid(request.Id, "screen.record params.screenIndex must be a number");
            }

            var durationMs = root != null && root.Value.TryGetProperty("durationMs", out var d) && d.ValueKind == JsonValueKind.Number
                ? d.GetInt32()
                : 10000;

            if (durationMs <= 0)
            {
                return Invalid(request.Id, "screen.record params.durationMs must be > 0");
            }

            var fps = root != null && root.Value.TryGetProperty("fps", out var f) && f.ValueKind == JsonValueKind.Number
                ? f.GetInt32()
                : 10;

            if (fps <= 0)
            {
                return Invalid(request.Id, "screen.record params.fps must be > 0");
            }

            var includeAudio = root != null && root.Value.TryGetProperty("includeAudio", out var a) &&
                               (a.ValueKind == JsonValueKind.True || a.ValueKind == JsonValueKind.False)
                ? a.GetBoolean()
                : true;

            var screenIndex = root != null && root.Value.TryGetProperty("screenIndex", out var sIdx) && sIdx.ValueKind == JsonValueKind.Number
                ? sIdx.GetInt32()
                : 0;

            if (screenIndex < 0)
            {
                return Invalid(request.Id, "screen.record params.screenIndex must be >= 0");
            }

            try
            {
                var svc = new ScreenCaptureService();
                var b64 = await svc.RecordScreenAsBase64Async(durationMs, fps, includeAudio, screenIndex);

                var payload = new
                {
                    format = "mp4",
                    base64 = b64,
                    durationMs,
                    fps,
                    screenIndex,
                    hasAudio = includeAudio
                };

                return new BridgeInvokeResponse
                {
                    Id = request.Id,
                    Ok = true,
                    PayloadJSON = JsonSerializer.Serialize(payload)
                };
            }
            catch (Exception ex)
            {
                return new BridgeInvokeResponse
                {
                    Id = request.Id,
                    Ok = false,
                    Error = new OpenClawNodeError
                    {
                        Code = OpenClawNodeErrorCode.Unavailable,
                        Message = $"Screen recording failed: {ex.Message}"
                    }
                };
            }
        }

        private async Task<BridgeInvokeResponse> HandleCameraListAsync(BridgeInvokeRequest request)
        {
            try
            {
                var svc = new CameraCaptureService();
                var devices = await svc.ListDevicesAsync();

                var payload = new
                {
                    devices
                };

                return new BridgeInvokeResponse
                {
                    Id = request.Id,
                    Ok = true,
                    PayloadJSON = JsonSerializer.Serialize(payload)
                };
            }
            catch (Exception ex)
            {
                return new BridgeInvokeResponse
                {
                    Id = request.Id,
                    Ok = false,
                    Error = new OpenClawNodeError
                    {
                        Code = OpenClawNodeErrorCode.Unavailable,
                        Message = $"Camera list failed: {ex.Message}"
                    }
                };
            }
        }

        private async Task<BridgeInvokeResponse> HandleCameraSnapAsync(BridgeInvokeRequest request)
        {
            var root = ParseParams(request.ParamsJSON);

            var facing = root != null && root.Value.TryGetProperty("facing", out var f) && f.ValueKind == JsonValueKind.String
                ? (f.GetString() ?? "front")
                : "front";

            if (!string.Equals(facing, "front", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(facing, "back", StringComparison.OrdinalIgnoreCase))
            {
                return Invalid(request.Id, "camera.snap params.facing must be 'front' or 'back'");
            }

            if (root != null && root.Value.TryGetProperty("format", out var formatEl) && formatEl.ValueKind == JsonValueKind.String)
            {
                var format = formatEl.GetString();
                if (!string.IsNullOrWhiteSpace(format) && !string.Equals(format, "jpg", StringComparison.OrdinalIgnoreCase))
                {
                    return Invalid(request.Id, "camera.snap params.format must be 'jpg'");
                }
            }

            var maxWidth = root != null && root.Value.TryGetProperty("maxWidth", out var w) && w.ValueKind == JsonValueKind.Number
                ? w.GetInt32()
                : (int?)null;

            if (maxWidth.HasValue && maxWidth.Value <= 0)
            {
                return Invalid(request.Id, "camera.snap params.maxWidth must be > 0");
            }

            var quality = root != null && root.Value.TryGetProperty("quality", out var q) && q.ValueKind == JsonValueKind.Number
                ? q.GetDouble()
                : (double?)null;

            if (quality.HasValue && (quality.Value < 0 || quality.Value > 1))
            {
                return Invalid(request.Id, "camera.snap params.quality must be between 0 and 1");
            }

            var delayMs = root != null && root.Value.TryGetProperty("delayMs", out var d) && d.ValueKind == JsonValueKind.Number
                ? d.GetInt32()
                : (int?)null;

            var deviceId = root != null && root.Value.TryGetProperty("deviceId", out var id) && id.ValueKind == JsonValueKind.String
                ? id.GetString()
                : null;

            try
            {
                var svc = new CameraCaptureService();
                var (base64, width, height) = await svc.CaptureJpegAsBase64Async(facing.ToLowerInvariant(), maxWidth, quality, delayMs, deviceId);

                var payload = new
                {
                    format = "jpg",
                    base64,
                    width,
                    height
                };

                return new BridgeInvokeResponse
                {
                    Id = request.Id,
                    Ok = true,
                    PayloadJSON = JsonSerializer.Serialize(payload)
                };
            }
            catch (Exception ex)
            {
                return new BridgeInvokeResponse
                {
                    Id = request.Id,
                    Ok = false,
                    Error = new OpenClawNodeError
                    {
                        Code = OpenClawNodeErrorCode.Unavailable,
                        Message = $"Camera snap failed: {ex.Message}"
                    }
                };
            }
        }

        private static BridgeInvokeResponse Invalid(string id, string message) => new()
        {
            Id = id,
            Ok = false,
            Error = new OpenClawNodeError
            {
                Code = OpenClawNodeErrorCode.InvalidRequest,
                Message = message
            }
        };

        private static JsonElement? ParseParams(string? paramsJson)
        {
            if (string.IsNullOrWhiteSpace(paramsJson)) return null;
            using var doc = JsonDocument.Parse(paramsJson);
            return doc.RootElement.Clone();
        }

        private static async Task<ProcessResult> RunProcessAsync(string fileName, params string[] args)
        {
            var psi = new ProcessStartInfo
            {
                FileName = fileName,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            foreach (var arg in args) psi.ArgumentList.Add(arg);

            using var process = new Process { StartInfo = psi };
            process.Start();
            var stdOutTask = process.StandardOutput.ReadToEndAsync();
            var stdErrTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();

            return new ProcessResult
            {
                ExitCode = process.ExitCode,
                StdOut = await stdOutTask,
                StdErr = await stdErrTask,
            };
        }

        private class ProcessResult
        {
            public int ExitCode { get; set; }
            public string StdOut { get; set; } = string.Empty;
            public string StdErr { get; set; } = string.Empty;
        }
    }
}
