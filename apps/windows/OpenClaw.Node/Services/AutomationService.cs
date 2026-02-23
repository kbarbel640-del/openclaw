using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace OpenClaw.Node.Services
{
    public sealed class AutomationService
    {
        public sealed class WindowInfo
        {
            public long Handle { get; set; }
            public string Title { get; set; } = string.Empty;
            public string Process { get; set; } = string.Empty;
            public bool IsFocused { get; set; }
        }

        public Task<WindowInfo[]> ListWindowsAsync()
        {
            if (!OperatingSystem.IsWindows())
            {
                return Task.FromResult(Array.Empty<WindowInfo>());
            }

            var windows = new List<WindowInfo>();
            var foreground = GetForegroundWindow();

            EnumWindows((hWnd, _) =>
            {
                if (!IsWindowVisible(hWnd)) return true;
                var length = GetWindowTextLength(hWnd);
                if (length <= 0) return true;

                var sb = new StringBuilder(length + 1);
                _ = GetWindowText(hWnd, sb, sb.Capacity);
                var title = sb.ToString().Trim();
                if (string.IsNullOrWhiteSpace(title)) return true;

                GetWindowThreadProcessId(hWnd, out var pid);
                var processName = string.Empty;
                try
                {
                    if (pid > 0)
                    {
                        processName = Process.GetProcessById((int)pid).ProcessName;
                    }
                }
                catch
                {
                    // ignore process lookup issues
                }

                windows.Add(new WindowInfo
                {
                    Handle = hWnd.ToInt64(),
                    Title = title,
                    Process = processName,
                    IsFocused = hWnd == foreground,
                });

                return true;
            }, IntPtr.Zero);

            return Task.FromResult(windows.ToArray());
        }

        public Task<bool> FocusWindowAsync(long? handle, string? titleContains)
        {
            if (!OperatingSystem.IsWindows())
            {
                return Task.FromResult(false);
            }

            var target = ResolveWindow(handle, titleContains);
            if (target == IntPtr.Zero)
            {
                return Task.FromResult(false);
            }

            _ = ShowWindow(target, SW_RESTORE);
            var ok = SetForegroundWindow(target);
            return Task.FromResult(ok);
        }

        public async Task<bool> TypeTextAsync(string text)
        {
            if (string.IsNullOrEmpty(text)) return false;
            if (!OperatingSystem.IsWindows()) return false;

            var escaped = EscapeForSendKeys(text);
            return await RunSendKeysScriptAsync($"[System.Windows.Forms.SendKeys]::SendWait('{escaped}')");
        }

        public async Task<bool> SendKeyAsync(string key)
        {
            if (string.IsNullOrWhiteSpace(key)) return false;
            if (!OperatingSystem.IsWindows()) return false;

            var sendKeysToken = ConvertKeyToSendKeysToken(key);
            if (string.IsNullOrWhiteSpace(sendKeysToken))
            {
                return false;
            }

            return await RunSendKeysScriptAsync($"[System.Windows.Forms.SendKeys]::SendWait('{sendKeysToken}')");
        }

        private static async Task<bool> RunSendKeysScriptAsync(string body)
        {
            var script = $"Add-Type -AssemblyName System.Windows.Forms; {body}";
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                UseShellExecute = false,
                RedirectStandardError = true,
                RedirectStandardOutput = true,
                CreateNoWindow = true,
            };
            psi.ArgumentList.Add("-NoProfile");
            psi.ArgumentList.Add("-Command");
            psi.ArgumentList.Add(script);

            try
            {
                using var p = new Process { StartInfo = psi };
                p.Start();
                await p.WaitForExitAsync();
                return p.ExitCode == 0;
            }
            catch
            {
                return false;
            }
        }

        private static string EscapeForSendKeys(string text)
        {
            return text
                .Replace("{", "{{}")
                .Replace("}", "{}}")
                .Replace("+", "{+}")
                .Replace("^", "{^}")
                .Replace("%", "{%}")
                .Replace("~", "{~}")
                .Replace("(", "{(}")
                .Replace(")", "{)}")
                .Replace("[", "{[}")
                .Replace("]", "{]}")
                .Replace("'", "''");
        }

        private static string? ConvertKeyToSendKeysToken(string key)
        {
            var parts = key.Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length == 0) return null;

            var mods = new StringBuilder();
            for (var i = 0; i < parts.Length - 1; i++)
            {
                var m = parts[i].ToLowerInvariant();
                if (m is "ctrl" or "control") mods.Append('^');
                else if (m is "alt") mods.Append('%');
                else if (m is "shift") mods.Append('+');
            }

            var keyPart = parts[^1].ToLowerInvariant();
            var main = keyPart switch
            {
                "enter" => "{ENTER}",
                "tab" => "{TAB}",
                "esc" or "escape" => "{ESC}",
                "space" => " ",
                "up" => "{UP}",
                "down" => "{DOWN}",
                "left" => "{LEFT}",
                "right" => "{RIGHT}",
                "delete" => "{DELETE}",
                "backspace" => "{BACKSPACE}",
                _ => ConvertFunctionOrChar(keyPart),
            };

            return string.IsNullOrWhiteSpace(main) ? null : mods + main;
        }

        private static string? ConvertFunctionOrChar(string key)
        {
            if (key.Length == 1)
            {
                return key;
            }

            if (key.Length <= 3 && key.StartsWith("f", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(key[1..], out var fn) && fn is >= 1 and <= 24)
            {
                return $"{{F{fn}}}";
            }

            return null;
        }

        private static IntPtr ResolveWindow(long? handle, string? titleContains)
        {
            if (handle.HasValue && handle.Value != 0)
            {
                return new IntPtr(handle.Value);
            }

            if (string.IsNullOrWhiteSpace(titleContains))
            {
                return IntPtr.Zero;
            }

            IntPtr found = IntPtr.Zero;
            EnumWindows((hWnd, _) =>
            {
                if (!IsWindowVisible(hWnd)) return true;
                var length = GetWindowTextLength(hWnd);
                if (length <= 0) return true;

                var sb = new StringBuilder(length + 1);
                _ = GetWindowText(hWnd, sb, sb.Capacity);
                var title = sb.ToString();
                if (title.Contains(titleContains, StringComparison.OrdinalIgnoreCase))
                {
                    found = hWnd;
                    return false;
                }

                return true;
            }, IntPtr.Zero);

            return found;
        }

        private const int SW_RESTORE = 9;

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    }
}
