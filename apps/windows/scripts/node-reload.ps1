param(
  [string]$RepoPath = "",
  [string]$Branch = "windows_companion_app",
  [string]$Platform = "x64",
  [string]$Configuration = "Debug",
  [switch]$NoPull,
  [switch]$NoBuild,
  [switch]$StartWatchdog,
  [int]$WaitForNodeSeconds = 20
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoPath)) {
  $RepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Log { param([string]$m) Write-Host "[$(Get-Date -Format HH:mm:ss)] $m" }

$repoPathFull = (Resolve-Path $RepoPath).Path
$pausePath = Join-Path $repoPathFull ".node-watchdog.pause"
$watchdogScript = Join-Path $repoPathFull "scripts\node-watchdog.ps1"
$exePath = Join-Path $repoPathFull "OpenClaw.Node\bin\$Platform\$Configuration\net8.0\OpenClaw.Node.exe"

try {
  Log "Pausing watchdog + stopping node processes"
  Set-Content -Path $pausePath -Value "paused $(Get-Date -Format o)"

  Get-Process OpenClaw.Node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

  Push-Location $repoPathFull

  if (-not $NoPull) {
    Log "Syncing git ($Branch)"
    git fetch origin $Branch
    git checkout $Branch
    git pull --ff-only origin $Branch
  }

  if (-not $NoBuild) {
    Log "Building OpenClaw.Node"
    dotnet build OpenClaw.Node\OpenClaw.Node.csproj -p:Platform=$Platform -c $Configuration
  }

  if (-not (Test-Path $exePath)) {
    throw "Expected exe not found: $exePath"
  }

  Log "Reload prep complete"
}
finally {
  Pop-Location -ErrorAction SilentlyContinue
  if (Test-Path $pausePath) {
    Remove-Item $pausePath -Force
    Log "Watchdog unpaused"
  }
}

if ($StartWatchdog) {
  if (-not (Test-Path $watchdogScript)) {
    throw "Watchdog script not found: $watchdogScript"
  }

  $already = Get-CimInstance Win32_Process | Where-Object { $_.Name -match "powershell" -and $_.CommandLine -like "*$watchdogScript*" }
  if (-not $already) {
    Log "Starting watchdog"
    Start-Process powershell -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $watchdogScript, "-RepoPath", $repoPathFull, "-Platform", $Platform, "-Configuration", $Configuration)
  }
  else {
    Log "Watchdog already running"
  }
}

$deadline = (Get-Date).AddSeconds($WaitForNodeSeconds)
do {
  $running = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "OpenClaw.Node.exe" -and $_.CommandLine -like "*$exePath*" }
  if ($running) {
    Log "Node running (PID=$($running[0].ProcessId))"
    exit 0
  }
  Start-Sleep -Milliseconds 800
} while ((Get-Date) -lt $deadline)

Log "Node not detected yet. If watchdog isn't running, start it with:"
Log "powershell -NoProfile -ExecutionPolicy Bypass -File `"$watchdogScript`""
exit 1
