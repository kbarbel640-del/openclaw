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

        public sealed class WindowRectInfo
        {
            public long Handle { get; set; }
            public int Left { get; set; }
            public int Top { get; set; }
            public int Right { get; set; }
            public int Bottom { get; set; }
            public int Width => Right - Left;
            public int Height => Bottom - Top;
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
                keybd_event((byte)VK_MENU, 0, 0, UIntPtr.Zero);
                keybd_event((byte)VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
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

        public Task<WindowRectInfo?> GetWindowRectAsync(long? handle, string? titleContains)
        {
            if (!OperatingSystem.IsWindows())
            {
                return Task.FromResult<WindowRectInfo?>(null);
            }

            var target = ResolveWindow(handle, titleContains);
            if (target == IntPtr.Zero)
            {
                return Task.FromResult<WindowRectInfo?>(null);
            }

            if (!GetWindowRect(target, out var rect))
            {
                return Task.FromResult<WindowRectInfo?>(null);
            }

            return Task.FromResult<WindowRectInfo?>(new WindowRectInfo
            {
                Handle = target.ToInt64(),
                Left = rect.Left,
                Top = rect.Top,
                Right = rect.Right,
                Bottom = rect.Bottom,
            });
        }

        public async Task<bool> ClickRelativeToWindowAsync(long? handle, string? titleContains, int offsetX, int offsetY, string button = "primary", bool doubleClick = false)
        {
            var rect = await GetWindowRectAsync(handle, titleContains);
            if (rect == null)
            {
                return false;
            }

            var absX = rect.Left + offsetX;
            var absY = rect.Top + offsetY;
            return await ClickAsync(absX, absY, button, doubleClick);
        }

        public Task<bool> TypeTextAsync(string text)
        {
            if (string.IsNullOrEmpty(text)) return Task.FromResult(false);
            if (!OperatingSystem.IsWindows()) return Task.FromResult(false);

            try
            {
                foreach (var ch in text)
                {
                    if (!SendUnicodeChar(ch))
                    {
                        return Task.FromResult(false);
                    }
                }

                return Task.FromResult(true);
            }
            catch
            {
                return Task.FromResult(false);
            }
        }

        public Task<bool> SendKeyAsync(string key)
        {
            if (string.IsNullOrWhiteSpace(key)) return Task.FromResult(false);
            if (!OperatingSystem.IsWindows()) return Task.FromResult(false);

            var parts = key.Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length == 0)
            {
                return Task.FromResult(false);
            }

            var modifiers = new List<ushort>();
            for (var i = 0; i < parts.Length - 1; i++)
            {
                var mod = MapModifierToVirtualKey(parts[i]);
                if (!mod.HasValue)
                {
                    return Task.FromResult(false);
                }

                modifiers.Add(mod.Value);
            }

            var main = MapKeyTokenToVirtualKey(parts[^1]);
            if (!main.HasValue)
            {
                return Task.FromResult(false);
            }

            try
            {
                foreach (var mod in modifiers)
                {
                    if (!SendVirtualKey(mod, keyUp: false)) return Task.FromResult(false);
                }

                if (!SendVirtualKey(main.Value, keyUp: false)) return Task.FromResult(false);
                if (!SendVirtualKey(main.Value, keyUp: true)) return Task.FromResult(false);

                for (var i = modifiers.Count - 1; i >= 0; i--)
                {
                    if (!SendVirtualKey(modifiers[i], keyUp: true)) return Task.FromResult(false);
                }

                return Task.FromResult(true);
            }
            catch
            {
                return Task.FromResult(false);
            }
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

        public Task<bool> ScrollAsync(int deltaY, int? x = null, int? y = null)
        {
            if (!OperatingSystem.IsWindows())
            {
                return Task.FromResult(false);
            }

            if (deltaY == 0)
            {
                return Task.FromResult(false);
            }

            if (x.HasValue || y.HasValue)
            {
                if (!x.HasValue || !y.HasValue)
                {
                    return Task.FromResult(false);
                }

                var screenWidth = GetSystemMetrics(SM_CXSCREEN);
                var screenHeight = GetSystemMetrics(SM_CYSCREEN);
                if (x.Value < 0 || y.Value < 0 || x.Value >= screenWidth || y.Value >= screenHeight)
                {
                    return Task.FromResult(false);
                }

                if (!SetCursorPos(x.Value, y.Value))
                {
                    return Task.FromResult(false);
                }
            }

            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, unchecked((uint)deltaY), UIntPtr.Zero);
            return Task.FromResult(true);
        }

        private static bool SendUnicodeChar(char ch)
        {
            var down = new INPUT
            {
                type = INPUT_KEYBOARD,
                U = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = 0,
                        wScan = ch,
                        dwFlags = KEYEVENTF_UNICODE,
                        time = 0,
                        dwExtraInfo = UIntPtr.Zero,
                    }
                }
            };

            var up = new INPUT
            {
                type = INPUT_KEYBOARD,
                U = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = 0,
                        wScan = ch,
                        dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time = 0,
                        dwExtraInfo = UIntPtr.Zero,
                    }
                }
            };

            var inputs = new[] { down, up };
            return SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>()) == inputs.Length;
        }

        private static bool SendVirtualKey(ushort vk, bool keyUp)
        {
            var input = new INPUT
            {
                type = INPUT_KEYBOARD,
                U = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = vk,
                        wScan = 0,
                        dwFlags = keyUp ? KEYEVENTF_KEYUP : 0,
                        time = 0,
                        dwExtraInfo = UIntPtr.Zero,
                    }
                }
            };

            var inputs = new[] { input };
            return SendInput(1, inputs, Marshal.SizeOf<INPUT>()) == 1;
        }

        private static ushort? MapModifierToVirtualKey(string token)
        {
            return token.Trim().ToLowerInvariant() switch
            {
                "ctrl" or "control" => VK_CONTROL,
                "alt" => VK_MENU,
                "shift" => VK_SHIFT,
                "win" or "meta" => VK_LWIN,
                _ => null,
            };
        }

        private static ushort? MapKeyTokenToVirtualKey(string token)
        {
            var key = token.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(key)) return null;

            return key switch
            {
                "enter" => VK_RETURN,
                "tab" => VK_TAB,
                "esc" or "escape" => VK_ESCAPE,
                "space" => VK_SPACE,
                "up" => VK_UP,
                "down" => VK_DOWN,
                "left" => VK_LEFT,
                "right" => VK_RIGHT,
                "delete" => VK_DELETE,
                "backspace" => VK_BACK,
                _ => MapSingleOrFunctionKey(key),
            };
        }

        private static ushort? MapSingleOrFunctionKey(string key)
        {
            if (key.Length == 1)
            {
                var ch = char.ToUpperInvariant(key[0]);
                if (ch is >= 'A' and <= 'Z') return ch;
                if (ch is >= '0' and <= '9') return ch;
            }

            if (key.StartsWith("f", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(key[1..], out var fn) && fn is >= 1 and <= 24)
            {
                return (ushort)(VK_F1 + (fn - 1));
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
        private const ushort VK_SHIFT = 0x10;
        private const ushort VK_CONTROL = 0x11;
        private const ushort VK_MENU = 0x12; // ALT
        private const ushort VK_RETURN = 0x0D;
        private const ushort VK_TAB = 0x09;
        private const ushort VK_ESCAPE = 0x1B;
        private const ushort VK_SPACE = 0x20;
        private const ushort VK_UP = 0x26;
        private const ushort VK_DOWN = 0x28;
        private const ushort VK_LEFT = 0x25;
        private const ushort VK_RIGHT = 0x27;
        private const ushort VK_DELETE = 0x2E;
        private const ushort VK_BACK = 0x08;
        private const ushort VK_LWIN = 0x5B;
        private const ushort VK_F1 = 0x70;

        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const uint KEYEVENTF_UNICODE = 0x0004;
        private const uint INPUT_KEYBOARD = 1;
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOMOVE = 0x0002;
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        private const uint MOUSEEVENTF_WHEEL = 0x0800;
        private const int SM_CXSCREEN = 0;
        private const int SM_CYSCREEN = 1;
        private const int SM_SWAPBUTTON = 23;
        private static readonly IntPtr HWND_TOPMOST = new(-1);
        private static readonly IntPtr HWND_NOTOPMOST = new(-2);

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT
        {
            public uint type;
            public InputUnion U;
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct InputUnion
        {
            [FieldOffset(0)]
            public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public UIntPtr dwExtraInfo;
        }

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

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

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

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
