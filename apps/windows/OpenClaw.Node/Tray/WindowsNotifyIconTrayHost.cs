using System;
using System.Diagnostics;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;

namespace OpenClaw.Node.Tray
{
    public sealed class WindowsNotifyIconTrayHost : ITrayHost
    {
        private readonly Action<string>? _log;
        private readonly Action? _onOpenLogs;
        private readonly Action? _onRestart;
        private readonly Action? _onExit;

        private readonly TaskCompletionSource<bool> _startedTcs = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource<bool> _stoppedTcs = new(TaskCreationOptions.RunContinuationsAsynchronously);

        private Thread? _uiThread;
        private SynchronizationContext? _uiContext;

        private object? _notifyIcon;
        private MethodInfo? _appExitThread;

        public WindowsNotifyIconTrayHost(Action<string>? log = null, Action? onOpenLogs = null, Action? onRestart = null, Action? onExit = null)
        {
            _log = log;
            _onOpenLogs = onOpenLogs;
            _onRestart = onRestart;
            _onExit = onExit;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            if (!OperatingSystem.IsWindows())
            {
                _log?.Invoke("[TRAY] Windows tray host skipped: non-Windows runtime.");
                return;
            }

            if (_uiThread != null) return;

            _uiThread = new Thread(UiMain)
            {
                IsBackground = true,
                Name = "OpenClawTrayUI"
            };
            _uiThread.SetApartmentState(ApartmentState.STA);
            _uiThread.Start();

            using var reg = cancellationToken.Register(() => _ = StopAsync());
            await _startedTcs.Task.WaitAsync(cancellationToken);
        }

        public Task UpdateAsync(TrayStatusSnapshot snapshot, CancellationToken cancellationToken)
        {
            if (_notifyIcon == null || _uiContext == null) return Task.CompletedTask;

            _uiContext.Post(_ =>
            {
                try
                {
                    SetProperty(_notifyIcon, "Text", ToNotifyIconText($"OpenClaw: {snapshot.Message}"));
                }
                catch (Exception ex)
                {
                    _log?.Invoke($"[TRAY] Update failed: {ex.Message}");
                }
            }, null);

            return Task.CompletedTask;
        }

        public async Task StopAsync()
        {
            if (_uiThread == null)
            {
                return;
            }

            try
            {
                if (_uiContext != null)
                {
                    _uiContext.Post(_ =>
                    {
                        try
                        {
                            _appExitThread?.Invoke(null, null);
                        }
                        catch (Exception ex)
                        {
                            _log?.Invoke($"[TRAY] ExitThread failed: {ex.Message}");
                        }
                    }, null);
                }
                else
                {
                    _appExitThread?.Invoke(null, null);
                }
            }
            catch
            {
                // no-op
            }

            await _stoppedTcs.Task;
            _uiThread = null;
        }

        private void UiMain()
        {
            try
            {
                var appType = Type.GetType("System.Windows.Forms.Application, System.Windows.Forms")
                    ?? throw new InvalidOperationException("System.Windows.Forms.Application not available");
                var notifyIconType = Type.GetType("System.Windows.Forms.NotifyIcon, System.Windows.Forms")
                    ?? throw new InvalidOperationException("System.Windows.Forms.NotifyIcon not available");
                var menuType = Type.GetType("System.Windows.Forms.ContextMenuStrip, System.Windows.Forms")
                    ?? throw new InvalidOperationException("System.Windows.Forms.ContextMenuStrip not available");
                var menuItemType = Type.GetType("System.Windows.Forms.ToolStripMenuItem, System.Windows.Forms")
                    ?? throw new InvalidOperationException("System.Windows.Forms.ToolStripMenuItem not available");
                var wfSyncType = Type.GetType("System.Windows.Forms.WindowsFormsSynchronizationContext, System.Windows.Forms");

                if (wfSyncType != null)
                {
                    var wfSync = Activator.CreateInstance(wfSyncType) as SynchronizationContext;
                    if (wfSync != null) SynchronizationContext.SetSynchronizationContext(wfSync);
                }

                _uiContext = SynchronizationContext.Current;

                _notifyIcon = Activator.CreateInstance(notifyIconType)
                    ?? throw new InvalidOperationException("Unable to create NotifyIcon");
                var menu = Activator.CreateInstance(menuType)
                    ?? throw new InvalidOperationException("Unable to create ContextMenuStrip");

                var openLogsItem = Activator.CreateInstance(menuItemType, "Open Logs")
                    ?? throw new InvalidOperationException("Unable to create Open Logs item");
                var restartItem = Activator.CreateInstance(menuItemType, "Restart Node")
                    ?? throw new InvalidOperationException("Unable to create Restart item");
                var exitItem = Activator.CreateInstance(menuItemType, "Exit")
                    ?? throw new InvalidOperationException("Unable to create Exit item");

                AddClickHandler(openLogsItem, () =>
                {
                    try { _onOpenLogs?.Invoke(); }
                    catch (Exception ex) { _log?.Invoke($"[TRAY] Open Logs action failed: {ex.Message}"); }
                });
                AddClickHandler(restartItem, () =>
                {
                    try { _onRestart?.Invoke(); }
                    catch (Exception ex) { _log?.Invoke($"[TRAY] Restart action failed: {ex.Message}"); }
                });
                AddClickHandler(exitItem, () =>
                {
                    try { _onExit?.Invoke(); }
                    catch (Exception ex) { _log?.Invoke($"[TRAY] Exit action failed: {ex.Message}"); }
                });

                AddMenuItem(menu, openLogsItem);
                AddMenuItem(menu, restartItem);
                AddMenuItem(menu, exitItem);

                SetProperty(_notifyIcon, "ContextMenuStrip", menu);
                SetProperty(_notifyIcon, "Icon", ResolveApplicationIcon());
                SetProperty(_notifyIcon, "Text", ToNotifyIconText("OpenClaw: Starting"));
                SetProperty(_notifyIcon, "Visible", true);

                _appExitThread = appType.GetMethod("ExitThread", BindingFlags.Public | BindingFlags.Static);
                var run = appType.GetMethod("Run", BindingFlags.Public | BindingFlags.Static, Type.DefaultBinder, Type.EmptyTypes, null)
                    ?? throw new InvalidOperationException("Application.Run() not found");

                _startedTcs.TrySetResult(true);
                _log?.Invoke("[TRAY] Windows NotifyIcon host started.");
                run.Invoke(null, null);
            }
            catch (Exception ex)
            {
                _startedTcs.TrySetException(ex);
                _log?.Invoke($"[TRAY] Failed to start: {ex.Message}");
            }
            finally
            {
                try
                {
                    if (_notifyIcon != null)
                    {
                        SetProperty(_notifyIcon, "Visible", false);
                        ( _notifyIcon as IDisposable )?.Dispose();
                    }
                }
                catch
                {
                    // no-op
                }

                _log?.Invoke("[TRAY] Windows NotifyIcon host stopped.");
                _stoppedTcs.TrySetResult(true);
            }
        }

        private static string ToNotifyIconText(string value)
        {
            var text = string.IsNullOrWhiteSpace(value) ? "OpenClaw" : value.Trim();
            return text.Length <= 63 ? text : text.Substring(0, 63);
        }

        private static void AddClickHandler(object menuItem, Action onClick)
        {
            var clickEvent = menuItem.GetType().GetEvent("Click")
                ?? throw new InvalidOperationException("ToolStripMenuItem.Click not found");
            EventHandler handler = (_, _) => onClick();
            clickEvent.AddEventHandler(menuItem, handler);
        }

        private static void AddMenuItem(object menu, object item)
        {
            var itemsProp = menu.GetType().GetProperty("Items")
                ?? throw new InvalidOperationException("ContextMenuStrip.Items not found");
            var items = itemsProp.GetValue(menu)
                ?? throw new InvalidOperationException("ContextMenuStrip.Items is null");
            var add = items.GetType().GetMethod("Add", new[] { typeof(object) })
                ?? throw new InvalidOperationException("ToolStripItemCollection.Add(object) not found");
            add.Invoke(items, new[] { item });
        }

        private static object? ResolveApplicationIcon()
        {
            var iconsType = Type.GetType("System.Drawing.SystemIcons, System.Drawing")
                ?? Type.GetType("System.Drawing.SystemIcons, System.Drawing.Common");
            var appProp = iconsType?.GetProperty("Application", BindingFlags.Public | BindingFlags.Static);
            return appProp?.GetValue(null);
        }

        private static void SetProperty(object target, string name, object? value)
        {
            var prop = target.GetType().GetProperty(name)
                ?? throw new InvalidOperationException($"Property not found: {target.GetType().Name}.{name}");
            prop.SetValue(target, value);
        }
    }
}
