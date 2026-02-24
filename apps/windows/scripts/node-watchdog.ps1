param(
  [string]$RepoPath = "",
  [string]$Platform = "x64",
  [string]$Configuration = "Debug",
  [int]$PollMs = 1500,
  [string]$PauseFile = ".node-watchdog.pause",
  [string]$LogFile = "",
  [bool]$EnableTray = $true
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoPath)) {
  $RepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Write-Log {
  param([string]$Message)
  $line = "[$(Get-Date -Format o)] $Message"
  Write-Host $line
  if (-not [string]::IsNullOrWhiteSpace($LogFile)) {
    Add-Content -Path $LogFile -Value $line
  }
}

function Get-RunningNodeProcesses {
  param([string]$ExePath)

  $target = $ExePath.ToLowerInvariant()
  return @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "OpenClaw.Node.exe" -and (
      ($_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant() -eq $target) -or
      ($_.CommandLine -and $_.CommandLine -like "*$ExePath*")
    )
  })
}

function Get-GatewayConfig {
  $wslUser = if ($env:OPENCLAW_WSL_USER) { $env:OPENCLAW_WSL_USER } else { $env:USERNAME.ToLowerInvariant() }
  $wslDistro = if ($env:OPENCLAW_WSL_DISTRO) {
    $env:OPENCLAW_WSL_DISTRO
  } else {
    try {
      # Attempt to auto-detect default WSL distro
      $default = (wsl.exe --list --verbose | Select-String "\*").ToString().Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)[1]
      if (-not [string]::IsNullOrWhiteSpace($default)) {
        $default
      } else {
        "Ubuntu-24.04"
      }
    } catch {
      "Ubuntu-24.04"
    }
  }

  $candidates = @(
    "$env:USERPROFILE\.openclaw\openclaw.json",
    "\\wsl.localhost\$wslDistro\home\$wslUser\.openclaw\openclaw.json"
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
$trayExePath = Join-Path $repoPathFull "OpenClaw.Node\bin\$Platform\$Configuration\net8.0-windows\OpenClaw.Node.exe"
$headlessExePath = Join-Path $repoPathFull "OpenClaw.Node\bin\$Platform\$Configuration\net8.0\OpenClaw.Node.exe"
$childLogPath = Join-Path $repoPathFull "node-watchdog-child.log"
$childErrLogPath = Join-Path $repoPathFull "node-watchdog-child.err.log"

Write-Log "Watchdog starting"
Write-Log "RepoPath=$repoPathFull"
Write-Log "TrayExePath=$trayExePath"
Write-Log "HeadlessExePath=$headlessExePath"
Write-Log "PauseFile=$pausePath"
Write-Log "EnableTray=$EnableTray"
Write-Log "ChildLog=$childLogPath"
Write-Log "ChildErrLog=$childErrLogPath"

while ($true) {
  try {
    $effectiveEnableTray = $EnableTray
    $exePath = $headlessExePath

    if ($EnableTray -and (Test-Path $trayExePath)) {
      $exePath = $trayExePath
    }
    elseif ($EnableTray -and -not (Test-Path $trayExePath)) {
      Write-Log "Tray build not found yet ($trayExePath). Falling back to headless target."
      $effectiveEnableTray = $false
    }

    if (Test-Path $pausePath) {
      $running = Get-RunningNodeProcesses -ExePath $exePath
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

    $running = Get-RunningNodeProcesses -ExePath $exePath
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
    Add-Content -Path $childLogPath -Value "`n===== START $(Get-Date -Format o) ====="
    Add-Content -Path $childErrLogPath -Value "`n===== START $(Get-Date -Format o) ====="

    $args = @("--gateway-url", $gatewayUrl, "--gateway-token", $token)
    if ($effectiveEnableTray) {
      $args += "--tray"
    }

    $proc = Start-Process -FilePath $exePath -ArgumentList $args -PassThru -RedirectStandardOutput $childLogPath -RedirectStandardError $childErrLogPath
    Write-Log "Started PID=$($proc.Id) Args=$($args -join ' ')"

    Start-Sleep -Milliseconds 400
    $proc.Refresh()
    if ($proc.HasExited) {
      Write-Log "Node exited immediately. ExitCode=$($proc.ExitCode). See child logs: $childLogPath | $childErrLogPath"
    }
  }
  catch {
    Write-Log "Watchdog loop error: $($_.Exception.Message)"
  }

  Start-Sleep -Milliseconds $PollMs
}
