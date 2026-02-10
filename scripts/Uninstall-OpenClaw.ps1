#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Uninstall OpenClaw from user storage

.DESCRIPTION
    This script completely removes OpenClaw (ClawdBot) from the current user's system.
    - Stops and removes the scheduled task
    - Removes all files and directories
    - Cleans up environment variables
    - Removes PATH entries
    - No admin privileges required

.PARAMETER KeepData
    If specified, preserves user data (state, config, logs) in C:\UserStorage\<username>\OpenClaw-Backup

.EXAMPLE
    .\Uninstall-OpenClaw.ps1
    Completely remove OpenClaw and all data

.EXAMPLE
    .\Uninstall-OpenClaw.ps1 -KeepData
    Remove OpenClaw but backup user data

.NOTES
    Designed for Azure Virtual Desktop environments
#>

param(
    [Parameter(Mandatory=$false)]
    [switch]$KeepData
)

$ErrorActionPreference = 'Continue'
$username = $env:USERNAME
$userStoragePath = "C:\UserStorage\$username"
$openclawInstallPath = Join-Path $userStoragePath "OpenClaw"
$openclawBinPath = Join-Path $openclawInstallPath "bin"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "OpenClaw Uninstallation for $username" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ==============================================================================
# Confirm uninstallation
# ==============================================================================
if (-not (Test-Path $openclawInstallPath)) {
    Write-Host "OpenClaw is not installed at: $openclawInstallPath" -ForegroundColor Yellow
    Write-Host "Nothing to uninstall." -ForegroundColor Green
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 0
}

Write-Host "This will remove OpenClaw from:" -ForegroundColor Yellow
Write-Host "  $openclawInstallPath" -ForegroundColor Cyan
Write-Host ""

if ($KeepData) {
    Write-Host "User data will be backed up to:" -ForegroundColor Yellow
    Write-Host "  $userStoragePath\OpenClaw-Backup" -ForegroundColor Cyan
    Write-Host ""
}

$response = Read-Host "Are you sure you want to uninstall OpenClaw? (Y/N)"
if ($response -notmatch "^[Yy]") {
    Write-Host "Uninstallation cancelled." -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 0
}

Write-Host ""

# ==============================================================================
# Stop and remove scheduled task
# ==============================================================================
Write-Host "Stopping OpenClaw service..." -ForegroundColor Yellow
$taskName = "OpenClaw-$username"

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    try {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
        Write-Host "Scheduled task removed" -ForegroundColor Green
    } catch {
        Write-Host "Warning: Could not remove scheduled task: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "No scheduled task found" -ForegroundColor Gray
}

# ==============================================================================
# Stop any running OpenClaw processes
# ==============================================================================
Write-Host "Stopping any running OpenClaw processes..." -ForegroundColor Yellow
$openclawProcesses = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*OpenClaw*" -or $_.CommandLine -like "*openclaw*"
}

if ($openclawProcesses) {
    foreach ($proc in $openclawProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction Stop
            Write-Host "  Stopped process: $($proc.Id)" -ForegroundColor Green
        } catch {
            Write-Host "  Warning: Could not stop process $($proc.Id): $_" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "No running processes found" -ForegroundColor Gray
}

# ==============================================================================
# Backup user data if requested
# ==============================================================================
if ($KeepData) {
    Write-Host ""
    Write-Host "Backing up user data..." -ForegroundColor Yellow

    $backupPath = Join-Path $userStoragePath "OpenClaw-Backup"
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $backupPathWithTimestamp = "$backupPath-$timestamp"

    New-Item -Path $backupPathWithTimestamp -ItemType Directory -Force | Out-Null

    $itemsToBackup = @("state", "config.json", "logs")
    foreach ($item in $itemsToBackup) {
        $sourcePath = Join-Path $openclawInstallPath $item
        if (Test-Path $sourcePath) {
            try {
                Copy-Item -Path $sourcePath -Destination $backupPathWithTimestamp -Recurse -Force -ErrorAction Stop
                Write-Host "  Backed up: $item" -ForegroundColor Green
            } catch {
                Write-Host "  Warning: Could not backup $item : $_" -ForegroundColor Yellow
            }
        }
    }

    Write-Host "Backup saved to: $backupPathWithTimestamp" -ForegroundColor Green
}

# ==============================================================================
# Remove environment variables
# ==============================================================================
Write-Host ""
Write-Host "Removing environment variables..." -ForegroundColor Yellow

$envVars = @("OPENCLAW_HOME", "OPENCLAW_STATE_DIR", "OPENCLAW_CONFIG_PATH")
foreach ($envVar in $envVars) {
    try {
        [System.Environment]::SetEnvironmentVariable($envVar, $null, "User")
        Remove-Item "Env:\$envVar" -ErrorAction SilentlyContinue
        Write-Host "  Removed: $envVar" -ForegroundColor Green
    } catch {
        Write-Host "  Warning: Could not remove $envVar : $_" -ForegroundColor Yellow
    }
}

# ==============================================================================
# Remove from PATH
# ==============================================================================
Write-Host ""
Write-Host "Removing OpenClaw from user PATH..." -ForegroundColor Yellow

$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -like "*$openclawBinPath*") {
    $newPath = ($userPath -split ';' | Where-Object { $_ -notlike "*OpenClaw*" }) -join ';'
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "Removed OpenClaw from PATH" -ForegroundColor Green
} else {
    Write-Host "OpenClaw not found in PATH" -ForegroundColor Gray
}

# ==============================================================================
# Remove installation directory
# ==============================================================================
Write-Host ""
Write-Host "Removing installation directory..." -ForegroundColor Yellow

try {
    Remove-Item -Path $openclawInstallPath -Recurse -Force -ErrorAction Stop
    Write-Host "Installation directory removed" -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not remove installation directory: $_" -ForegroundColor Yellow
    Write-Host "You may need to manually delete: $openclawInstallPath" -ForegroundColor Yellow
}

# ==============================================================================
# Clean up temp files
# ==============================================================================
Write-Host ""
Write-Host "Cleaning up temporary files..." -ForegroundColor Yellow

$tempFiles = @(
    (Join-Path $env:TEMP "openclaw-$username.tgz"),
    (Join-Path $env:TEMP "openclaw-extract-$username")
)

foreach ($tempFile in $tempFiles) {
    if (Test-Path $tempFile) {
        try {
            Remove-Item -Path $tempFile -Recurse -Force -ErrorAction Stop
            Write-Host "  Removed: $tempFile" -ForegroundColor Green
        } catch {
            Write-Host "  Warning: Could not remove $tempFile : $_" -ForegroundColor Yellow
        }
    }
}

# ==============================================================================
# Uninstallation Complete
# ==============================================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Uninstallation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if ($KeepData) {
    Write-Host "Your data has been backed up to:" -ForegroundColor Cyan
    Write-Host "  $backupPathWithTimestamp" -ForegroundColor White
    Write-Host ""
}

Write-Host "OpenClaw has been removed from your system." -ForegroundColor Green
Write-Host ""
Write-Host "Note: You may need to restart your shell or log out and back in" -ForegroundColor Yellow
Write-Host "for environment variable changes to take full effect." -ForegroundColor Yellow
Write-Host ""

Read-Host "Press Enter to close this window"
