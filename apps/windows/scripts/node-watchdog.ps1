param(
  [string]$RepoPath = "C:\Users\david\Documents\WORK\openclaw_source\apps\windows",
  [string]$Platform = "x64",
  [string]$Configuration = "Debug",
  [int]$PollMs = 1500,
  [string]$PauseFile = ".node-watchdog.pause",
  [string]$LogFile = "",
  [bool]$EnableTray = $true
)

$ErrorActionPreference = "Stop"

function Write-Log {
  param([string]$Message)
  $line = "[$(Get-Date -Format o)] $Message"
  Write-Host $line
  if (-not [string]::IsNullOrWhiteSpace($LogFile)) {
    Add-Content -Path $LogFile -Value $line
  }
}

function Get-GatewayConfig {
  $candidates = @(
    "$env:USERPROFILE\.openclaw\openclaw.json",
    "\\wsl.localhost\Ubuntu-24.04\home\david\.openclaw\openclaw.json"
  )

  foreach ($path in $candidates) {
    if (Test-Path $path) {
      try {
        return Get-Content $path -Raw | ConvertFrom-Json
      } catch {
        Write-Log "Failed to parse config at ${path}: $($_.Exception.Message)"
      }
    }
  }

  throw "Unable to locate OpenClaw config JSON. Checked: $($candidates -join ', ')"
}

$repoPathFull = (Resolve-Path $RepoPath).Path
$pausePath = Join-Path $repoPathFull $PauseFile
$exePath = Join-Path $repoPathFull "OpenClaw.Node\bin\$Platform\$Configuration\net8.0\OpenClaw.Node.exe"

Write-Log "Watchdog starting"
Write-Log "RepoPath=$repoPathFull"
Write-Log "ExePath=$exePath"
Write-Log "PauseFile=$pausePath"
Write-Log "EnableTray=$EnableTray"

while ($true) {
  try {
    if (Test-Path $pausePath) {
      $running = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "OpenClaw.Node.exe" -and $_.CommandLine -like "*$exePath*" }
      foreach ($proc in $running) {
        Write-Log "Pause active. Stopping PID=$($proc.ProcessId)"
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
      }
      Start-Sleep -Milliseconds $PollMs
      continue
    }

    if (-not (Test-Path $exePath)) {
      Write-Log "Node binary not found yet: $exePath"
      Start-Sleep -Milliseconds $PollMs
      continue
    }

    $running = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "OpenClaw.Node.exe" -and $_.CommandLine -like "*$exePath*" }
    if ($running) {
      Start-Sleep -Milliseconds $PollMs
      continue
    }

    $cfg = Get-GatewayConfig
    $gatewayUrl = "ws://127.0.0.1:$($cfg.gateway.port)/"
    $token = "$($cfg.gateway.auth.token)"

    if ([string]::IsNullOrWhiteSpace($token)) {
      throw "Gateway token missing in config"
    }

    Write-Log "Starting OpenClaw.Node"
    $args = @("--gateway-url", $gatewayUrl, "--gateway-token", $token)
    if ($EnableTray) {
      $args += "--tray"
    }

    $proc = Start-Process -FilePath $exePath -ArgumentList $args -PassThru
    Write-Log "Started PID=$($proc.Id) Args=$($args -join ' ')"
  }
  catch {
    Write-Log "Watchdog loop error: $($_.Exception.Message)"
  }

  Start-Sleep -Milliseconds $PollMs
}
