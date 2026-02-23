using System;
using System.IO;
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

        public async Task<string> RecordScreenAsBase64Async(int durationMs, int fps, bool includeAudio, int screenIndex = 0)
        {
            if (!OperatingSystem.IsWindows())
            {
                // Dev fallback in non-Windows environments.
                return await TakeScreenshotFallbackAsync();
            }

            durationMs = Math.Clamp(durationMs, 500, 120000);
            fps = Math.Clamp(fps, 1, 60);

            var outputPath = Path.Combine(Path.GetTempPath(), $"openclaw_screen_record_{Guid.NewGuid():N}.mp4");
            var completion = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);

            var options = RecorderOptions.Default;
            options.VideoEncoderOptions.Framerate = fps;
            options.VideoEncoderOptions.IsFixedFramerate = true;
            options.VideoEncoderOptions.IsHardwareEncodingEnabled = true;
            options.VideoEncoderOptions.IsMp4FastStartEnabled = true;

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

            using var recorder = Recorder.CreateRecorder(options);

            recorder.OnRecordingComplete += (_, args) => completion.TrySetResult(args.FilePath);
            recorder.OnRecordingFailed += (_, args) => completion.TrySetException(new Exception(args.Error));

            recorder.Record(outputPath);
            await Task.Delay(durationMs);
            recorder.Stop();

            var finalizedPath = await completion.Task;
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

        private static Task<string> TakeScreenshotFallbackAsync()
        {
            // 1x1 transparent PNG. Keeps command path alive in non-Windows dev env.
            return Task.FromResult("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
        }
    }
}
