Add-Type -Name Window -Namespace Win32 -MemberDefinition @'
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
'@

$SW_SHOW = 5
$SW_RESTORE = 9

$process = Get-Process terminal64 -ErrorAction SilentlyContinue

if ($process) {
    # Show and restore window
    $result = [Win32.Window]::ShowWindow($process.MainWindowHandle, $SW_RESTORE)
    if ($result) {
        # Bring to front
        [Win32.Window]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
        Write-Host "✅ MT5 window shown" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Failed to show MT5 window" -ForegroundColor Red
    }
} else {
    Write-Host "❌ MT5 process not found" -ForegroundColor Red
}
