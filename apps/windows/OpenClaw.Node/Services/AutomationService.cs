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

            // Fast path
            if (GetForegroundWindow() == target)
            {
                return Task.FromResult(true);
            }

            if (IsIconic(target))
            {
                _ = ShowWindow(target, SW_RESTORE);
            }

            _ = ShowWindow(target, SW_SHOW);
            _ = BringWindowToTop(target);

            if (SetForegroundWindow(target) && GetForegroundWindow() == target)
            {
                return Task.FromResult(true);
            }

            // Fallback path for foreground lock constraints:
            // temporarily attach input queues and retry focus activation.
            var foreground = GetForegroundWindow();
            var currentThread = GetCurrentThreadId();
            var targetThread = GetWindowThreadProcessId(target, out _);
            var fgThread = foreground != IntPtr.Zero ? GetWindowThreadProcessId(foreground, out _) : 0;

            var attachedToTarget = false;
            var attachedToForeground = false;

            try
            {
                if (targetThread != 0 && targetThread != currentThread)
                {
                    attachedToTarget = AttachThreadInput(currentThread, targetThread, true);
                }

                if (fgThread != 0 && fgThread != currentThread)
                {
                    attachedToForeground = AttachThreadInput(currentThread, fgThread, true);
                }

                _ = BringWindowToTop(target);
                _ = SetWindowPos(target, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
                _ = SetWindowPos(target, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
                _ = SetActiveWindow(target);
                _ = SetFocus(target);
                _ = SetForegroundWindow(target);

                if (GetForegroundWindow() == target)
                {
                    return Task.FromResult(true);
                }

                // Last attempts: ALT keystroke nudge and SwitchToThisWindow fallback.
                keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
                keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                _ = SetForegroundWindow(target);
                if (GetForegroundWindow() == target)
                {
                    return Task.FromResult(true);
                }

                SwitchToThisWindow(target, true);
                return Task.FromResult(GetForegroundWindow() == target);
            }
            finally
            {
                if (attachedToForeground)
                {
                    _ = AttachThreadInput(currentThread, fgThread, false);
                }

                if (attachedToTarget)
                {
                    _ = AttachThreadInput(currentThread, targetThread, false);
                }
            }
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

        public Task<bool> ClickAsync(int x, int y, string button = "primary", bool doubleClick = false)
        {
            if (!OperatingSystem.IsWindows())
            {
                return Task.FromResult(false);
            }

            var normalizedButton = (button ?? "primary").Trim().ToLowerInvariant();
            if (normalizedButton != "left" && normalizedButton != "right" && normalizedButton != "primary" && normalizedButton != "secondary")
            {
                return Task.FromResult(false);
            }

            var screenWidth = GetSystemMetrics(SM_CXSCREEN);
            var screenHeight = GetSystemMetrics(SM_CYSCREEN);
            if (x < 0 || y < 0 || x >= screenWidth || y >= screenHeight)
            {
                return Task.FromResult(false);
            }

            if (!SetCursorPos(x, y))
            {
                return Task.FromResult(false);
            }

            var swapButtons = GetSystemMetrics(SM_SWAPBUTTON) != 0;
            var physicalButton = normalizedButton switch
            {
                "primary" => swapButtons ? "right" : "left",
                "secondary" => swapButtons ? "left" : "right",
                _ => normalizedButton,
            };

            var down = physicalButton == "right" ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN;
            var up = physicalButton == "right" ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP;

            mouse_event(down, 0, 0, 0, UIntPtr.Zero);
            mouse_event(up, 0, 0, 0, UIntPtr.Zero);
            if (doubleClick)
            {
                mouse_event(down, 0, 0, 0, UIntPtr.Zero);
                mouse_event(up, 0, 0, 0, UIntPtr.Zero);
            }

            return Task.FromResult(true);
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
        private const int SW_SHOW = 5;
        private const byte VK_MENU = 0x12; // ALT
        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOMOVE = 0x0002;
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        private const int SM_CXSCREEN = 0;
        private const int SM_CYSCREEN = 1;
        private const int SM_SWAPBUTTON = 23;
        private static readonly IntPtr HWND_TOPMOST = new(-1);
        private static readonly IntPtr HWND_NOTOPMOST = new(-2);

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
        private static extern bool BringWindowToTop(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(
            IntPtr hWnd,
            IntPtr hWndInsertAfter,
            int X,
            int Y,
            int cx,
            int cy,
            uint uFlags);

        [DllImport("user32.dll")]
        private static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

        [DllImport("user32.dll")]
        private static extern IntPtr SetFocus(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern IntPtr SetActiveWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();

        [DllImport("user32.dll")]
        private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [DllImport("user32.dll")]
        private static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

#pragma warning disable SYSLIB0003
        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
#pragma warning restore SYSLIB0003

#pragma warning disable SYSLIB0003
        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
#pragma warning restore SYSLIB0003
    }
}
