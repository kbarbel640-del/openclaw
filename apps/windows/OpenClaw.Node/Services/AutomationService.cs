using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
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

        public sealed class UiElementInfo
        {
            public string Name { get; set; } = string.Empty;
            public string AutomationId { get; set; } = string.Empty;
            public string ControlType { get; set; } = string.Empty;
            public int Left { get; set; }
            public int Top { get; set; }
            public int Right { get; set; }
            public int Bottom { get; set; }
            public int Width => Right - Left;
            public int Height => Bottom - Top;
            public int CenterX => Left + (Width / 2);
            public int CenterY => Top + (Height / 2);
        }

        public sealed class UiFindResult
        {
            public UiElementInfo? Element { get; set; }
            public string Strategy { get; set; } = string.Empty;
            public string Reason { get; set; } = string.Empty;
            public bool Found => Element != null;
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

        public async Task<UiElementInfo?> FindUiElementAsync(long? handle, string? titleContains, string? name, string? automationId, string? controlType, int timeoutMs = 1500)
        {
            var detailed = await FindUiElementDetailedAsync(handle, titleContains, name, automationId, controlType, timeoutMs);
            return detailed.Element;
        }

        public async Task<UiFindResult> FindUiElementDetailedAsync(long? handle, string? titleContains, string? name, string? automationId, string? controlType, int timeoutMs = 1500)
        {
            if (!OperatingSystem.IsWindows())
            {
                return new UiFindResult { Reason = "not-windows" };
            }

            if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(automationId) && string.IsNullOrWhiteSpace(controlType))
            {
                return new UiFindResult { Reason = "selectors-required" };
            }

            var target = ResolveWindow(handle, titleContains);
            if (target == IntPtr.Zero)
            {
                return new UiFindResult { Reason = "window-not-found" };
            }

            var controlTypeToken = MapControlTypeToken(controlType);
            var safeName = EscapeForPowerShellSingleQuoted(name ?? string.Empty);
            var safeAutomationId = EscapeForPowerShellSingleQuoted(automationId ?? string.Empty);
            var safeControlType = EscapeForPowerShellSingleQuoted(controlTypeToken ?? string.Empty);
            var safeTimeout = Math.Clamp(timeoutMs, 200, 10000);

            var script = $@"
Add-Type -AssemblyName UIAutomationClient
$h = [IntPtr]::new({target.ToInt64()})
$root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
if (-not $root) {{
  @{{ ok = $false; reason = 'window-root-not-found' }} | ConvertTo-Json -Compress
  return
}}

$ct = $null
if ('{safeControlType}'.Length -gt 0) {{
  $ctName = [System.Windows.Automation.ControlType].GetProperty('{safeControlType}', [System.Reflection.BindingFlags]'Public,Static,IgnoreCase')
  if ($ctName) {{ $ct = $ctName.GetValue($null) }}
}}

$plans = @()
if ('{safeAutomationId}'.Length -gt 0 -and '{safeName}'.Length -gt 0 -and '{safeControlType}'.Length -gt 0 -and $ct -ne $null) {{ $plans += @{{ label='automationId+name+controlType'; a=$true; n=$true; c=$true }} }}
if ('{safeAutomationId}'.Length -gt 0 -and '{safeName}'.Length -gt 0) {{ $plans += @{{ label='automationId+name'; a=$true; n=$true; c=$false }} }}
if ('{safeAutomationId}'.Length -gt 0 -and '{safeControlType}'.Length -gt 0 -and $ct -ne $null) {{ $plans += @{{ label='automationId+controlType'; a=$true; n=$false; c=$true }} }}
if ('{safeName}'.Length -gt 0 -and '{safeControlType}'.Length -gt 0 -and $ct -ne $null) {{ $plans += @{{ label='name+controlType'; a=$false; n=$true; c=$true }} }}
if ('{safeAutomationId}'.Length -gt 0) {{ $plans += @{{ label='automationId'; a=$true; n=$false; c=$false }} }}
if ('{safeName}'.Length -gt 0) {{ $plans += @{{ label='name'; a=$false; n=$true; c=$false }} }}
if ('{safeControlType}'.Length -gt 0 -and $ct -ne $null) {{ $plans += @{{ label='controlType'; a=$false; n=$false; c=$true }} }}

if ($plans.Count -eq 0) {{
  @{{ ok = $false; reason = if ('{safeControlType}'.Length -gt 0 -and $ct -eq $null) {{ 'invalid-control-type' }} else {{ 'selectors-required' }} }} | ConvertTo-Json -Compress
  return
}}

$deadline = [DateTime]::UtcNow.AddMilliseconds({safeTimeout})
$el = $null
$matched = ''
while (-not $el -and [DateTime]::UtcNow -lt $deadline) {{
  foreach ($plan in $plans) {{
    $conds = New-Object System.Collections.Generic.List[System.Windows.Automation.Condition]
    if ($plan.n) {{
      $conds.Add((New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, '{safeName}')))
    }}
    if ($plan.a) {{
      $conds.Add((New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, '{safeAutomationId}')))
    }}
    if ($plan.c -and $ct -ne $null) {{
      $conds.Add((New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $ct)))
    }}
    if ($conds.Count -eq 0) {{ continue }}

    $cond = if ($conds.Count -eq 1) {{ $conds[0] }} else {{ New-Object System.Windows.Automation.AndCondition($conds.ToArray()) }}
    $candidate = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
    if ($candidate) {{
      $el = $candidate
      $matched = $plan.label
      break
    }}
  }}

  if (-not $el) {{ Start-Sleep -Milliseconds 100 }}
}}

if (-not $el) {{
  @{{ ok = $false; reason = 'not-found'; strategy = ($plans | ForEach-Object {{ $_.label }}) -join ',' }} | ConvertTo-Json -Compress
  return
}}

$rect = $el.Current.BoundingRectangle
if ($rect.IsEmpty) {{
  @{{ ok = $false; reason = 'element-bounding-rect-empty'; strategy = $matched }} | ConvertTo-Json -Compress
  return
}}

@{{
  ok = $true
  strategy = $matched
  element = @{{
    name = $el.Current.Name
    automationId = $el.Current.AutomationId
    controlType = $el.Current.ControlType.ProgrammaticName
    left = [int][Math]::Round($rect.Left)
    top = [int][Math]::Round($rect.Top)
    right = [int][Math]::Round($rect.Right)
    bottom = [int][Math]::Round($rect.Bottom)
  }}
}} | ConvertTo-Json -Compress
";

            var result = await RunPowerShellAsync(script);
            if (result.ExitCode != 0)
            {
                return new UiFindResult { Reason = string.IsNullOrWhiteSpace(result.StdErr) ? "powershell-exit-nonzero" : result.StdErr.Trim() };
            }

            var jsonLine = result.StdOut
                .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .FirstOrDefault(x => x.StartsWith("{", StringComparison.Ordinal));

            if (string.IsNullOrWhiteSpace(jsonLine))
            {
                return new UiFindResult { Reason = "no-json-output" };
            }

            try
            {
                using var doc = JsonDocument.Parse(jsonLine);
                var root = doc.RootElement;
                var ok = root.TryGetProperty("ok", out var okEl) && okEl.ValueKind == JsonValueKind.True;
                var strategy = root.TryGetProperty("strategy", out var stEl) && stEl.ValueKind == JsonValueKind.String
                    ? (stEl.GetString() ?? string.Empty)
                    : string.Empty;

                if (!ok)
                {
                    var reason = root.TryGetProperty("reason", out var rEl) && rEl.ValueKind == JsonValueKind.String
                        ? (rEl.GetString() ?? "not-found")
                        : "not-found";
                    return new UiFindResult { Reason = reason, Strategy = strategy };
                }

                if (!root.TryGetProperty("element", out var elementEl) || elementEl.ValueKind != JsonValueKind.Object)
                {
                    return new UiFindResult { Reason = "missing-element-payload", Strategy = strategy };
                }

                return new UiFindResult
                {
                    Strategy = strategy,
                    Element = new UiElementInfo
                    {
                        Name = elementEl.TryGetProperty("name", out var nEl) && nEl.ValueKind == JsonValueKind.String ? (nEl.GetString() ?? string.Empty) : string.Empty,
                        AutomationId = elementEl.TryGetProperty("automationId", out var aEl) && aEl.ValueKind == JsonValueKind.String ? (aEl.GetString() ?? string.Empty) : string.Empty,
                        ControlType = elementEl.TryGetProperty("controlType", out var cEl) && cEl.ValueKind == JsonValueKind.String ? (cEl.GetString() ?? string.Empty) : string.Empty,
                        Left = elementEl.TryGetProperty("left", out var lEl) && lEl.ValueKind == JsonValueKind.Number ? lEl.GetInt32() : 0,
                        Top = elementEl.TryGetProperty("top", out var tEl) && tEl.ValueKind == JsonValueKind.Number ? tEl.GetInt32() : 0,
                        Right = elementEl.TryGetProperty("right", out var r2El) && r2El.ValueKind == JsonValueKind.Number ? r2El.GetInt32() : 0,
                        Bottom = elementEl.TryGetProperty("bottom", out var bEl) && bEl.ValueKind == JsonValueKind.Number ? bEl.GetInt32() : 0,
                    }
                };
            }
            catch
            {
                return new UiFindResult { Reason = "invalid-json" };
            }
        }

        public async Task<bool> ClickUiElementAsync(long? handle, string? titleContains, string? name, string? automationId, string? controlType, string button = "primary", bool doubleClick = false)
        {
            var element = await FindUiElementAsync(handle, titleContains, name, automationId, controlType);
            if (element == null)
            {
                return false;
            }

            return await ClickAsync(element.CenterX, element.CenterY, button, doubleClick);
        }

        public async Task<bool> TypeIntoUiElementAsync(long? handle, string? titleContains, string? name, string? automationId, string? controlType, string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                return false;
            }

            var element = await FindUiElementAsync(handle, titleContains, name, automationId, controlType);
            if (element == null)
            {
                return false;
            }

            var clicked = await ClickAsync(element.CenterX, element.CenterY, "primary", false);
            if (!clicked)
            {
                return false;
            }

            await Task.Delay(50);
            return await TypeTextAsync(text);
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

        public async Task<bool> TypeTextAsync(string text)
        {
            if (string.IsNullOrEmpty(text)) return false;
            if (!OperatingSystem.IsWindows()) return false;

            try
            {
                var allOk = true;
                foreach (var ch in text)
                {
                    if (!SendUnicodeChar(ch))
                    {
                        allOk = false;
                        break;
                    }
                }

                if (allOk)
                {
                    return true;
                }

                // Fallback path for environments where SendInput is blocked by window/UIPI constraints.
                var escaped = EscapeForSendKeys(text);
                return await RunSendKeysScriptAsync($"[System.Windows.Forms.SendKeys]::SendWait('{escaped}')");
            }
            catch
            {
                return false;
            }
        }

        public async Task<bool> SendKeyAsync(string key)
        {
            if (string.IsNullOrWhiteSpace(key)) return false;
            if (!OperatingSystem.IsWindows()) return false;

            var parts = key.Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length == 0)
            {
                return false;
            }

            var modifiers = new List<ushort>();
            for (var i = 0; i < parts.Length - 1; i++)
            {
                var mod = MapModifierToVirtualKey(parts[i]);
                if (!mod.HasValue)
                {
                    return false;
                }

                modifiers.Add(mod.Value);
            }

            var main = MapKeyTokenToVirtualKey(parts[^1]);
            if (!main.HasValue)
            {
                return false;
            }

            try
            {
                var allOk = true;

                foreach (var mod in modifiers)
                {
                    if (!SendVirtualKey(mod, keyUp: false)) { allOk = false; break; }
                }

                if (allOk && !SendVirtualKey(main.Value, keyUp: false)) allOk = false;
                if (allOk && !SendVirtualKey(main.Value, keyUp: true)) allOk = false;

                if (allOk)
                {
                    for (var i = modifiers.Count - 1; i >= 0; i--)
                    {
                        if (!SendVirtualKey(modifiers[i], keyUp: true)) { allOk = false; break; }
                    }
                }

                if (allOk)
                {
                    return true;
                }

                // Fallback to SendKeys format for reliability in constrained desktop contexts.
                var token = ConvertKeyToSendKeysToken(key);
                if (string.IsNullOrWhiteSpace(token)) return false;
                return await RunSendKeysScriptAsync($"[System.Windows.Forms.SendKeys]::SendWait('{token}')");
            }
            catch
            {
                return false;
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

        private static async Task<bool> RunSendKeysScriptAsync(string body)
        {
            var script = $"Add-Type -AssemblyName System.Windows.Forms; {body}";
            var result = await RunPowerShellAsync(script);
            return result.ExitCode == 0;
        }

        private static async Task<PowerShellResult> RunPowerShellAsync(string script)
        {
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
                var stdoutTask = p.StandardOutput.ReadToEndAsync();
                var stderrTask = p.StandardError.ReadToEndAsync();
                await p.WaitForExitAsync();

                return new PowerShellResult
                {
                    ExitCode = p.ExitCode,
                    StdOut = await stdoutTask,
                    StdErr = await stderrTask,
                };
            }
            catch (Exception ex)
            {
                return new PowerShellResult
                {
                    ExitCode = -1,
                    StdErr = ex.Message,
                    StdOut = string.Empty,
                };
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

            if (key.StartsWith("f", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(key[1..], out var fn) && fn is >= 1 and <= 24)
            {
                return $"{{F{fn}}}";
            }

            return null;
        }

        private static string EscapeForPowerShellSingleQuoted(string value)
        {
            return (value ?? string.Empty).Replace("'", "''");
        }

        private static string? MapControlTypeToken(string? controlType)
        {
            if (string.IsNullOrWhiteSpace(controlType))
            {
                return null;
            }

            return controlType.Trim().ToLowerInvariant() switch
            {
                "button" => "Button",
                "edit" or "textbox" or "text" => "Edit",
                "checkbox" => "CheckBox",
                "combobox" => "ComboBox",
                "list" => "List",
                "listitem" => "ListItem",
                "menu" => "Menu",
                "menuitem" => "MenuItem",
                "tab" => "Tab",
                "tabitem" => "TabItem",
                "tree" => "Tree",
                "treeitem" => "TreeItem",
                "pane" => "Pane",
                "window" => "Window",
                "hyperlink" => "Hyperlink",
                "radio" or "radiobutton" => "RadioButton",
                _ => controlType.Trim(),
            };
        }

        private sealed class PowerShellResult
        {
            public int ExitCode { get; set; }
            public string StdOut { get; set; } = string.Empty;
            public string StdErr { get; set; } = string.Empty;
        }

        private sealed class UiElementPowerShellDto
        {
            public string? Name { get; set; }
            public string? AutomationId { get; set; }
            public string? ControlType { get; set; }
            public int Left { get; set; }
            public int Top { get; set; }
            public int Right { get; set; }
            public int Bottom { get; set; }
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
