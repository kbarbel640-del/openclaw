using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace OpenClaw.Node.Services
{
    public class CameraCaptureService
    {
        public sealed class CameraDeviceInfo
        {
            public string Id { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string Position { get; set; } = "front";
            public string DeviceType { get; set; } = "unknown";
        }

        private const string PlaceholderJpegBase64 = @"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a
HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIy
MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB
/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAA
AAAAAAAAAAH/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAABP/9k=";

        public async Task<CameraDeviceInfo[]> ListDevicesAsync()
        {
            if (!OperatingSystem.IsWindows()) return Array.Empty<CameraDeviceInfo>();
            if (!await CommandExistsAsync("ffmpeg")) return Array.Empty<CameraDeviceInfo>();

            var result = await RunProcessAsync(
                "ffmpeg",
                "-hide_banner",
                "-f", "dshow",
                "-list_devices", "true",
                "-i", "dummy");

            if (result.ExitCode != 0 && string.IsNullOrWhiteSpace(result.StdErr) && string.IsNullOrWhiteSpace(result.StdOut))
            {
                return Array.Empty<CameraDeviceInfo>();
            }

            var text = (result.StdErr ?? string.Empty) + "\n" + (result.StdOut ?? string.Empty);
            var names = ParseDshowVideoDeviceNames(text);

            return names
                .Select(name =>
                {
                    var lower = name.ToLowerInvariant();
                    var position = (lower.Contains("back") || lower.Contains("rear")) ? "back" : "front";
                    var deviceType = (lower.Contains("usb") || lower.Contains("external")) ? "external" : "integrated";
                    return new CameraDeviceInfo
                    {
                        // ffmpeg path identifies by display name; use same value for id and name
                        Id = name,
                        Name = name,
                        Position = position,
                        DeviceType = deviceType,
                    };
                })
                .ToArray();
        }

        public async Task<(string Base64, int Width, int Height)> CaptureJpegAsBase64Async(
            string facing,
            int? maxWidth,
            double? quality,
            int? delayMs,
            string? deviceId)
        {
            var clampedDelay = Math.Clamp(delayMs ?? 0, 0, 10000);
            if (clampedDelay > 0) await Task.Delay(clampedDelay);

            if (!OperatingSystem.IsWindows())
            {
                return (PlaceholderJpegBase64, 1, 1);
            }

            var devices = await ListDevicesAsync();
            var selected = SelectDevice(devices, facing, deviceId);
            if (selected == null)
            {
                return (PlaceholderJpegBase64, 1, 1);
            }

            if (!await CommandExistsAsync("ffmpeg"))
            {
                return (PlaceholderJpegBase64, 1, 1);
            }

            var tempFile = Path.Combine(Path.GetTempPath(), $"openclaw_cam_{Guid.NewGuid():N}.jpg");

            try
            {
                var q = ToFfmpegJpegQuality(quality);

                var args = new List<string>
                {
                    "-hide_banner",
                    "-loglevel", "error",
                    "-y",
                    "-f", "dshow",
                    "-i", $"video={selected.Name}",
                    "-frames:v", "1",
                    "-q:v", q.ToString()
                };

                if (maxWidth.HasValue && maxWidth.Value > 0)
                {
                    args.Add("-vf");
                    args.Add($"scale='min({maxWidth.Value},iw)':-2");
                }

                args.Add(tempFile);

                var result = await RunProcessAsync("ffmpeg", args.ToArray());
                if (result.ExitCode != 0 || !File.Exists(tempFile))
                {
                    return (PlaceholderJpegBase64, 1, 1);
                }

                var bytes = await File.ReadAllBytesAsync(tempFile);
                if (!IsLikelyJpeg(bytes))
                {
                    return (PlaceholderJpegBase64, 1, 1);
                }

                var (width, height) = TryReadJpegDimensions(bytes);
                return (Convert.ToBase64String(bytes), Math.Max(width, 1), Math.Max(height, 1));
            }
            finally
            {
                try
                {
                    if (File.Exists(tempFile)) File.Delete(tempFile);
                }
                catch
                {
                    // ignore cleanup errors
                }
            }
        }

        private static CameraDeviceInfo? SelectDevice(CameraDeviceInfo[] devices, string facing, string? deviceId)
        {
            if (devices.Length == 0) return null;

            if (!string.IsNullOrWhiteSpace(deviceId))
            {
                var exact = devices.FirstOrDefault(d =>
                    string.Equals(d.Id, deviceId, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(d.Name, deviceId, StringComparison.OrdinalIgnoreCase));
                if (exact != null) return exact;
            }

            var desiredFacing = string.Equals(facing, "back", StringComparison.OrdinalIgnoreCase) ? "back" : "front";
            var byFacing = devices.FirstOrDefault(d => string.Equals(d.Position, desiredFacing, StringComparison.OrdinalIgnoreCase));
            if (byFacing != null) return byFacing;

            return devices[0];
        }

        private static string[] ParseDshowVideoDeviceNames(string output)
        {
            var lines = output.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
            var names = new List<string>();
            var inVideoSection = false;
            var quoted = new Regex("\"([^\"]+)\"", RegexOptions.Compiled);

            foreach (var line in lines)
            {
                if (line.Contains("DirectShow video devices", StringComparison.OrdinalIgnoreCase))
                {
                    inVideoSection = true;
                    continue;
                }

                if (inVideoSection && line.Contains("DirectShow audio devices", StringComparison.OrdinalIgnoreCase))
                {
                    break;
                }

                if (!inVideoSection) continue;

                var m = quoted.Match(line);
                if (!m.Success) continue;

                var name = m.Groups[1].Value.Trim();
                if (string.IsNullOrWhiteSpace(name)) continue;
                if (names.Any(x => string.Equals(x, name, StringComparison.OrdinalIgnoreCase))) continue;

                names.Add(name);
            }

            return names.ToArray();
        }

        private static int ToFfmpegJpegQuality(double? quality)
        {
            var q = quality ?? 0.85;
            q = Math.Clamp(q, 0.0, 1.0);
            return (int)Math.Round(31 - (q * 29)); // 2..31, lower is better
        }

        private static bool IsLikelyJpeg(byte[] bytes)
        {
            return bytes.Length >= 4 && bytes[0] == 0xFF && bytes[1] == 0xD8;
        }

        private static (int Width, int Height) TryReadJpegDimensions(byte[] bytes)
        {
            if (!IsLikelyJpeg(bytes)) return (0, 0);

            var i = 2;
            while (i + 9 < bytes.Length)
            {
                if (bytes[i] != 0xFF)
                {
                    i++;
                    continue;
                }

                var marker = bytes[i + 1];
                i += 2;

                if (marker == 0xD9 || marker == 0xDA) break;
                if (i + 1 >= bytes.Length) break;

                var len = (bytes[i] << 8) + bytes[i + 1];
                if (len < 2 || i + len > bytes.Length) break;

                if (marker is 0xC0 or 0xC1 or 0xC2 or 0xC3 or 0xC5 or 0xC6 or 0xC7 or 0xC9 or 0xCA or 0xCB or 0xCD or 0xCE or 0xCF)
                {
                    if (i + 7 >= bytes.Length) break;
                    var height = (bytes[i + 3] << 8) + bytes[i + 4];
                    var width = (bytes[i + 5] << 8) + bytes[i + 6];
                    return (width, height);
                }

                i += len;
            }

            return (0, 0);
        }

        private static async Task<bool> CommandExistsAsync(string command)
        {
            var checker = OperatingSystem.IsWindows() ? "where" : "which";
            var res = await RunProcessAsync(checker, command);
            return res.ExitCode == 0;
        }

        private static async Task<(int ExitCode, string StdOut, string StdErr)> RunProcessAsync(string fileName, params string[] args)
        {
            var psi = new ProcessStartInfo
            {
                FileName = fileName,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            };

            foreach (var arg in args) psi.ArgumentList.Add(arg);

            using var p = new Process { StartInfo = psi };
            p.Start();
            var so = await p.StandardOutput.ReadToEndAsync();
            var se = await p.StandardError.ReadToEndAsync();
            await p.WaitForExitAsync();
            return (p.ExitCode, so, se);
        }
    }
}
