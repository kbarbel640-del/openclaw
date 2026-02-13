Add-Type -Name Window -Namespace Win32 -MemberDefinition @'
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
'@

$SW_MINIMIZE = 6
$SW_HIDE = 0

$process = Get-Process terminal64 -ErrorAction SilentlyContinue

if ($process) {
    # Hide window (0 = hide, 6 = minimize)
    $result = [Win32.Window]::ShowWindow($process.MainWindowHandle, $SW_HIDE)
    if ($result) {
        Write-Host "✅ MT5 window hidden" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Failed to hide MT5 window, trying to minimize..." -ForegroundColor Yellow
        $result = [Win32.Window]::ShowWindow($process.MainWindowHandle, $SW_MINIMIZE)
        if ($result) {
            Write-Host "✅ MT5 window minimized" -ForegroundColor Green
        }
    }
} else {
    Write-Host "❌ MT5 process not found" -ForegroundColor Red
}
