using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using ScreenRecorderLib;

namespace OpenClaw.Node.Services
{
    public class ScreenCaptureService
    {
        public sealed class ScreenDisplayInfo
        {
            public int Index { get; set; }
            public string Id { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
        }

        public sealed class ScreenRecordResult
        {
            public string Base64 { get; set; } = string.Empty;
            public string CaptureApi { get; set; } = "auto";
            public bool HardwareEncoding { get; set; }
            public bool LowLatency { get; set; }
        }

        public Task<ScreenDisplayInfo[]> ListDisplaysAsync()
        {
            if (!OperatingSystem.IsWindows())
            {
                return Task.FromResult(Array.Empty<ScreenDisplayInfo>());
            }

            try
            {
                var displays = Recorder.GetDisplays();
                if (displays == null || displays.Count == 0)
                {
                    return Task.FromResult(Array.Empty<ScreenDisplayInfo>());
                }

                var result = new ScreenDisplayInfo[displays.Count];
                for (var i = 0; i < displays.Count; i++)
                {
                    var name = displays[i].DeviceName ?? $"Display {i}";
                    result[i] = new ScreenDisplayInfo
                    {
                        Index = i,
                        Id = name,
                        Name = name,
                    };
                }

                return Task.FromResult(result);
            }
            catch
            {
                return Task.FromResult(Array.Empty<ScreenDisplayInfo>());
            }
        }

        public async Task<ScreenRecordResult> RecordScreenAsBase64Async(
            int durationMs,
            int fps,
            bool includeAudio,
            int screenIndex = 0,
            string captureApi = "auto",
            bool lowLatency = false)
        {
            if (!OperatingSystem.IsWindows())
            {
                // Dev fallback in non-Windows environments.
                return new ScreenRecordResult
                {
                    Base64 = await TakeScreenshotFallbackAsync(),
                    CaptureApi = "fallback",
                    HardwareEncoding = false,
                    LowLatency = false,
                };
            }

            durationMs = Math.Clamp(durationMs, 500, 120000);
            fps = Math.Clamp(fps, 1, 60);

            var attempts = new[]
            {
                new { Hardware = true, LowLatency = lowLatency, CaptureApi = captureApi },
                new { Hardware = false, LowLatency = lowLatency, CaptureApi = captureApi },
                new { Hardware = false, LowLatency = true, CaptureApi = "desktopduplication" }
            };

            Exception? lastError = null;
            foreach (var attempt in attempts)
            {
                try
                {
                    var b64 = await RecordSingleAttemptAsync(durationMs, fps, includeAudio, screenIndex, attempt.CaptureApi, attempt.Hardware, attempt.LowLatency);
                    return new ScreenRecordResult
                    {
                        Base64 = b64,
                        CaptureApi = string.IsNullOrWhiteSpace(attempt.CaptureApi) ? "auto" : attempt.CaptureApi,
                        HardwareEncoding = attempt.Hardware,
                        LowLatency = attempt.LowLatency,
                    };
                }
                catch (Exception ex)
                {
                    lastError = ex;
                }
            }

            throw new InvalidOperationException($"Screen recording failed after fallback attempts: {lastError?.Message}", lastError);
        }

        private static async Task<string> RecordSingleAttemptAsync(
            int durationMs,
            int fps,
            bool includeAudio,
            int screenIndex,
            string captureApi,
            bool hardwareEncoding,
            bool lowLatency)
        {
            var outputPath = Path.Combine(Path.GetTempPath(), $"openclaw_screen_record_{Guid.NewGuid():N}.mp4");
            var completion = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
            var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

            var options = RecorderOptions.Default;
            options.VideoEncoderOptions.Framerate = fps;
            options.VideoEncoderOptions.IsFixedFramerate = true;
            options.VideoEncoderOptions.IsHardwareEncodingEnabled = hardwareEncoding;
            options.VideoEncoderOptions.IsMp4FastStartEnabled = true;
            options.VideoEncoderOptions.IsLowLatencyEnabled = lowLatency;
            options.VideoEncoderOptions.Quality = 70;

            options.AudioOptions.IsAudioEnabled = includeAudio;
            options.AudioOptions.IsOutputDeviceEnabled = includeAudio;
            options.AudioOptions.IsInputDeviceEnabled = false;

            // Select display by index when possible; fallback to main monitor.
            var displays = Recorder.GetDisplays();
            if (displays != null && displays.Count > 0)
            {
                var safeIndex = Math.Clamp(screenIndex, 0, displays.Count - 1);
                options.SourceOptions = new SourceOptions();
                options.SourceOptions.RecordingSources.Add(new DisplayRecordingSource(displays[safeIndex].DeviceName));
            }
            else
            {
                options.SourceOptions = SourceOptions.MainMonitor;
            }

            TryApplyRecorderApi(options, captureApi);

            using var recorder = Recorder.CreateRecorder(options);

            recorder.OnRecordingComplete += (_, args) => completion.TrySetResult(args.FilePath);
            recorder.OnRecordingFailed += (_, args) => completion.TrySetException(new Exception(args.Error));
            recorder.OnStatusChanged += (_, args) =>
            {
                if (args.Status == RecorderStatus.Recording)
                {
                    started.TrySetResult();
                }
            };

            recorder.Record(outputPath);

            // Duration should count from the moment recording actually starts,
            // not from when Record(...) is requested.
            using (var startTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(6)))
            {
                try
                {
                    await started.Task.WaitAsync(startTimeout.Token);
                }
                catch (OperationCanceledException)
                {
                    // Fallback: if start status wasn't observed, continue anyway.
                }
            }

            await Task.Delay(durationMs);
            recorder.Stop();

            string finalizedPath;
            using (var completionTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(12)))
            {
                finalizedPath = await completion.Task.WaitAsync(completionTimeout.Token);
            }

            var fileToRead = string.IsNullOrWhiteSpace(finalizedPath) ? outputPath : finalizedPath;

            try
            {
                var bytes = await File.ReadAllBytesAsync(fileToRead);
                return Convert.ToBase64String(bytes);
            }
            finally
            {
                if (File.Exists(fileToRead))
                {
                    try { File.Delete(fileToRead); } catch { }
                }
            }
        }

        private static void TryApplyRecorderApi(RecorderOptions options, string captureApi)
        {
            if (string.IsNullOrWhiteSpace(captureApi) || string.Equals(captureApi, "auto", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            try
            {
                var prop = options.GetType().GetProperty("RecorderApi");
                if (prop == null)
                {
                    return;
                }

                var token = captureApi.Trim().ToLowerInvariant() switch
                {
                    "wgc" or "windowsgraphicscapture" => "WindowsGraphicsCapture",
                    "desktopduplication" or "desktop-duplication" or "duplication" or "dda" => "DesktopDuplication",
                    _ => captureApi.Trim(),
                };

                var enumValue = Enum.Parse(prop.PropertyType, token, ignoreCase: true);
                prop.SetValue(options, enumValue);
            }
            catch
            {
                // Keep best-effort: invalid API token should not hard-fail recording.
            }
        }

        private static Task<string> TakeScreenshotFallbackAsync()
        {
            // 1x1 transparent PNG. Keeps command path alive in non-Windows dev env.
            return Task.FromResult("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
        }
    }
}
