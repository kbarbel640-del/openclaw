using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using MediaFoundation;
using MediaFoundation.Misc;
using MediaFoundation.ReadWrite;

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

        // MF_VERSION from mfapi.h => (MF_SDK_VERSION << 16) | MF_API_VERSION = 0x00020070
        private const int MfVersion = 0x00020070;

        private const string PlaceholderJpegBase64 = @"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a
HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIy
MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB
/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAA
AAAAAAAAAAH/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAABP/9k=";

        public async Task<CameraDeviceInfo[]> ListDevicesAsync()
        {
            if (!OperatingSystem.IsWindows())
            {
                return Array.Empty<CameraDeviceInfo>();
            }

            try
            {
                return await Task.Run(ListDevicesWithMediaFoundation);
            }
            catch
            {
                return Array.Empty<CameraDeviceInfo>();
            }
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

            // Keep non-Windows development path stable.
            if (!OperatingSystem.IsWindows())
            {
                return (PlaceholderJpegBase64, 1, 1);
            }

            try
            {
                var viaMf = await Task.Run(() => CaptureWithMediaFoundation(facing, maxWidth, quality, deviceId));
                if (!IsPlaceholder(viaMf.Base64, viaMf.Width, viaMf.Height))
                {
                    return viaMf;
                }
            }
            catch
            {
                // continue to ffmpeg fallback
            }

            try
            {
                var viaFfmpeg = await CaptureWithFfmpegAsync(facing, maxWidth, quality, deviceId);
                if (!IsPlaceholder(viaFfmpeg.Base64, viaFfmpeg.Width, viaFfmpeg.Height))
                {
                    return viaFfmpeg;
                }
            }
            catch
            {
                // fall through to stable placeholder
            }

            // Keep command path resilient even if camera stack is unavailable.
            return (PlaceholderJpegBase64, 1, 1);
        }

        private static CameraDeviceInfo[] ListDevicesWithMediaFoundation()
        {
            IMFAttributes? attributes = null;
            IMFActivate[]? devices = null;
            var started = false;

            try
            {
                MFError.ThrowExceptionForHR(MFExtern.MFStartup(MfVersion, MFStartup.Full));
                started = true;

                MFError.ThrowExceptionForHR(MFExtern.MFCreateAttributes(out attributes, 1));
                MFError.ThrowExceptionForHR(attributes.SetGUID(
                    MFAttributesClsid.MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE,
                    CLSID.MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID));

                MFError.ThrowExceptionForHR(MFExtern.MFEnumDeviceSources(attributes, out devices, out var count));
                if (count <= 0 || devices == null || devices.Length == 0)
                {
                    return Array.Empty<CameraDeviceInfo>();
                }

                return devices.Select(d =>
                {
                    var name = TryGetFriendlyName(d) ?? "Unknown Camera";
                    var id = TryGetSymbolicLink(d) ?? name;
                    var lower = name.ToLowerInvariant();
                    var position = lower.Contains("back") || lower.Contains("rear") ? "back" : "front";
                    var deviceType = lower.Contains("usb") || lower.Contains("external") ? "external" : "integrated";

                    return new CameraDeviceInfo
                    {
                        Id = id,
                        Name = name,
                        Position = position,
                        DeviceType = deviceType,
                    };
                }).ToArray();
            }
            finally
            {
                if (devices != null)
                {
                    foreach (var d in devices)
                    {
                        ReleaseCom(d);
                    }
                }

                ReleaseCom(attributes);

                if (started)
                {
                    try { MFExtern.MFShutdown(); } catch { }
                }
            }
        }

        private static (string Base64, int Width, int Height) CaptureWithMediaFoundation(
            string facing,
            int? maxWidth,
            double? quality,
            string? deviceId)
        {
            var _ = maxWidth;
            var __ = quality;

            IMFAttributes? attributes = null;
            IMFActivate[]? devices = null;
            IMFMediaSource? source = null;
            IMFSourceReader? reader = null;
            IMFMediaType? mediaType = null;
            var started = false;

            try
            {
                MFError.ThrowExceptionForHR(MFExtern.MFStartup(MfVersion, MFStartup.Full));
                started = true;

                MFError.ThrowExceptionForHR(MFExtern.MFCreateAttributes(out attributes, 1));
                MFError.ThrowExceptionForHR(attributes.SetGUID(
                    MFAttributesClsid.MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE,
                    CLSID.MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID));

                MFError.ThrowExceptionForHR(MFExtern.MFEnumDeviceSources(attributes, out devices, out var count));
                if (count <= 0 || devices == null || devices.Length == 0)
                {
                    return (PlaceholderJpegBase64, 1, 1);
                }

                var selected = SelectDevice(devices, facing, deviceId);
                if (selected == null)
                {
                    return (PlaceholderJpegBase64, 1, 1);
                }

                object? sourceObj;
                MFError.ThrowExceptionForHR(selected.ActivateObject(typeof(IMFMediaSource).GUID, out sourceObj));
                source = sourceObj as IMFMediaSource;
                if (source == null)
                {
                    return (PlaceholderJpegBase64, 1, 1);
                }

                MFError.ThrowExceptionForHR(MFExtern.MFCreateSourceReaderFromMediaSource(source, null, out reader));

                // Prefer MJPG for easy JPEG extraction, but gracefully fall back to native stream type.
                try
                {
                    MFError.ThrowExceptionForHR(MFExtern.MFCreateMediaType(out mediaType));
                    MFError.ThrowExceptionForHR(mediaType.SetGUID(MFAttributesClsid.MF_MT_MAJOR_TYPE, MFMediaType.Video));
                    MFError.ThrowExceptionForHR(mediaType.SetGUID(MFAttributesClsid.MF_MT_SUBTYPE, MFMediaType.MJPG));
                    MFError.ThrowExceptionForHR(reader.SetCurrentMediaType((int)MF_SOURCE_READER.FirstVideoStream, IntPtr.Zero, mediaType));
                }
                catch
                {
                    // Keep going with device default format.
                }

                MFError.ThrowExceptionForHR(reader.SetStreamSelection((int)MF_SOURCE_READER.FirstVideoStream, true));

                // Warm up + take a stable frame.
                for (var i = 0; i < 8; i++)
                {
                    IMFSample? sample = null;
                    try
                    {
                        var streamIndex = 0;
                        var streamFlags = 0;
                        long timestamp = 0;

                        MFError.ThrowExceptionForHR(reader.ReadSample(
                            (int)MF_SOURCE_READER.FirstVideoStream,
                            0,
                            out streamIndex,
                            out streamFlags,
                            out timestamp,
                            out sample));

                        if ((streamFlags & (int)MF_SOURCE_READER_FLAG.Error) != 0)
                        {
                            continue;
                        }

                        if (sample == null)
                        {
                            continue;
                        }

                        // Skip initial unstable frames.
                        if (i < 2)
                        {
                            continue;
                        }

                        var jpegBytes = ExtractSampleBytes(sample);
                        if (jpegBytes == null || jpegBytes.Length == 0)
                        {
                            continue;
                        }

                        if (!IsLikelyJpeg(jpegBytes))
                        {
                            continue;
                        }

                        var (width, height) = TryReadJpegDimensions(jpegBytes);
                        return (Convert.ToBase64String(jpegBytes), width > 0 ? width : 1, height > 0 ? height : 1);
                    }
                    finally
                    {
                        ReleaseCom(sample);
                    }
                }

                return (PlaceholderJpegBase64, 1, 1);
            }
            finally
            {
                ReleaseCom(mediaType);
                ReleaseCom(reader);

                if (source != null)
                {
                    try { source.Shutdown(); } catch { }
                }

                ReleaseCom(source);

                if (devices != null)
                {
                    foreach (var d in devices)
                    {
                        ReleaseCom(d);
                    }
                }

                ReleaseCom(attributes);

                if (started)
                {
                    try { MFExtern.MFShutdown(); } catch { }
                }
            }
        }

        private static IMFActivate? SelectDevice(IMFActivate[] devices, string facing, string? deviceId)
        {
            if (!string.IsNullOrWhiteSpace(deviceId))
            {
                var byId = devices.FirstOrDefault(d =>
                    string.Equals(TryGetFriendlyName(d), deviceId, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(TryGetSymbolicLink(d), deviceId, StringComparison.OrdinalIgnoreCase));
                if (byId != null) return byId;
            }

            var safeFacing = string.Equals(facing, "back", StringComparison.OrdinalIgnoreCase) ? "back" : "front";
            var hints = safeFacing == "back"
                ? new[] { "back", "rear", "external", "usb", "environment" }
                : new[] { "front", "integrated", "webcam", "face" };

            foreach (var hint in hints)
            {
                var hit = devices.FirstOrDefault(d =>
                {
                    var name = TryGetFriendlyName(d) ?? string.Empty;
                    return name.Contains(hint, StringComparison.OrdinalIgnoreCase);
                });
                if (hit != null) return hit;
            }

            return devices.Length > 0 ? devices[0] : null;
        }

        private static byte[]? ExtractSampleBytes(IMFSample sample)
        {
            IMFMediaBuffer? buffer = null;
            IntPtr ptr = IntPtr.Zero;
            try
            {
                MFError.ThrowExceptionForHR(sample.ConvertToContiguousBuffer(out buffer));
                if (buffer == null) return null;

                MFError.ThrowExceptionForHR(buffer.Lock(out ptr, out _, out var currentLength));
                if (ptr == IntPtr.Zero || currentLength <= 0) return null;

                var bytes = new byte[currentLength];
                Marshal.Copy(ptr, bytes, 0, currentLength);
                return bytes;
            }
            finally
            {
                if (buffer != null)
                {
                    try { buffer.Unlock(); } catch { }
                }

                ReleaseCom(buffer);
            }
        }

        private static string? TryGetFriendlyName(IMFActivate activate)
        {
            return TryGetAllocatedString(activate, MFAttributesClsid.MF_DEVSOURCE_ATTRIBUTE_FRIENDLY_NAME);
        }

        private static string? TryGetSymbolicLink(IMFActivate activate)
        {
            return TryGetAllocatedString(activate, MFAttributesClsid.MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_SYMBOLIC_LINK);
        }

        private static string? TryGetAllocatedString(IMFActivate activate, Guid key)
        {
            try
            {
                var hr = activate.GetAllocatedString(key, out var value, out _);
                if (hr < 0) return null;
                return value;
            }
            catch
            {
                return null;
            }
        }

        private static bool IsLikelyJpeg(byte[] bytes)
        {
            return bytes.Length >= 4 && bytes[0] == 0xFF && bytes[1] == 0xD8;
        }

        private static (int Width, int Height) TryReadJpegDimensions(byte[] bytes)
        {
            if (!IsLikelyJpeg(bytes))
            {
                return (0, 0);
            }

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

                if (marker == 0xD9 || marker == 0xDA)
                {
                    break;
                }

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

        private static async Task<(string Base64, int Width, int Height)> CaptureWithFfmpegAsync(
            string facing,
            int? maxWidth,
            double? quality,
            string? deviceId)
        {
            if (!await CommandExistsAsync("ffmpeg"))
            {
                return (PlaceholderJpegBase64, 1, 1);
            }

            var devices = ListDevicesWithMediaFoundation();
            var chosen = ChooseDeviceForFallback(devices, facing, deviceId);
            if (chosen == null)
            {
                return (PlaceholderJpegBase64, 1, 1);
            }

            var tempFile = Path.Combine(Path.GetTempPath(), $"openclaw_cam_{Guid.NewGuid():N}.jpg");
            try
            {
                var q = ToFfmpegJpegQuality(quality);
                var vf = maxWidth.HasValue && maxWidth.Value > 0
                    ? $"scale='min({maxWidth.Value},iw)':-2"
                    : null;

                var args = $"-hide_banner -loglevel error -y -f dshow -i video=\"{EscapeForDshow(chosen.Name)}\" -frames:v 1 -q:v {q}";
                if (!string.IsNullOrWhiteSpace(vf))
                {
                    args += $" -vf \"{vf}\"";
                }

                args += $" \"{tempFile}\"";

                var result = await RunProcessAsync("ffmpeg", args);
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

        private static CameraDeviceInfo? ChooseDeviceForFallback(CameraDeviceInfo[] devices, string facing, string? deviceId)
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
            return byFacing ?? devices[0];
        }

        private static bool IsPlaceholder(string base64, int width, int height)
        {
            return width <= 1 && height <= 1 && string.Equals(base64, PlaceholderJpegBase64, StringComparison.Ordinal);
        }

        private static int ToFfmpegJpegQuality(double? quality)
        {
            var q = quality ?? 0.85;
            q = Math.Clamp(q, 0.0, 1.0);
            return (int)Math.Round(31 - (q * 29)); // 2..31, lower is better
        }

        private static string EscapeForDshow(string name)
        {
            return name.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        private static async Task<bool> CommandExistsAsync(string command)
        {
            var checker = OperatingSystem.IsWindows() ? "where" : "which";
            var res = await RunProcessAsync(checker, command);
            return res.ExitCode == 0;
        }

        private static async Task<(int ExitCode, string StdOut, string StdErr)> RunProcessAsync(string fileName, string arguments)
        {
            var psi = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            };

            using var p = new Process { StartInfo = psi };
            p.Start();
            var so = await p.StandardOutput.ReadToEndAsync();
            var se = await p.StandardError.ReadToEndAsync();
            await p.WaitForExitAsync();
            return (p.ExitCode, so, se);
        }

        private static void ReleaseCom(object? obj)
        {
            if (obj == null || !OperatingSystem.IsWindows()) return;
            try
            {
                if (Marshal.IsComObject(obj))
                {
                    Marshal.FinalReleaseComObject(obj);
                }
            }
            catch
            {
                // ignore cleanup errors
            }
        }
    }
}
