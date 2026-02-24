param(
    [string]$Root = (Convert-Path "."),
    [switch]$DryRun
)

$planPath = Join-Path $Root 'restructure-plan.json'
if (-not (Test-Path $planPath)) { Write-Error "Plan not found: $planPath"; exit 1 }

$plan = Get-Content $planPath | ConvertFrom-Json

# Create backup dir
$timestamp = (Get-Date -Format "yyyyMMdd-HHmmss")
$backupDir = Join-Path $Root ".restructure-backup-$timestamp"
New-Item -Path $backupDir -ItemType Directory | Out-Null

$actions = @()

foreach ($item in $plan) {
    if (-not $item.wouldMove) { continue }

    $srcPath = Join-Path $Root $item.src
    if (-not (Test-Path $srcPath)) { $actions += [PSCustomObject]@{src=$item.src; status='missing'}; continue }

    $destDir = Join-Path $Root $item.target
    if (-not (Test-Path $destDir)) {
        if (-not $DryRun) { New-Item -Path $destDir -ItemType Directory | Out-Null }
        $actions += [PSCustomObject]@{src=$item.src; dest=$destDir; action='mkdir' }
    }

    $backupPath = Join-Path $backupDir $item.src
    if (-not $DryRun) {
        try {
            Copy-Item -Path $srcPath -Destination $backupPath -Recurse -Force -ErrorAction Stop
        } catch {
            $err = $_ | Out-String
            Write-Warning ("Backup failed for {0}: {1}" -f $srcPath, $err)
            $actions += [PSCustomObject]@{src=$item.src; status='backup-failed'}
            continue
        }
    } else {
        $actions += [PSCustomObject]@{src=$item.src; dest=$destDir; action='backup-dryrun'}
    }

    if (-not $DryRun) {
        try {
            Move-Item -Path $srcPath -Destination $destDir -Force -ErrorAction Stop
            $actions += [PSCustomObject]@{src=$item.src; dest=$destDir; action='moved'}
        } catch {
            $err = $_ | Out-String
            Write-Warning (("Move failed for {0} -> {1}: {2}" -f $srcPath, $destDir, $err))
            $actions += [PSCustomObject]@{src=$item.src; status='move-failed'}
        }
    }
}

# Summary
if ($DryRun) {
    Write-Host "Dry-run actions:`n"
    $actions | Format-Table -AutoSize
    Write-Host "No files were changed (dry-run)."
} else {
    Write-Host "Actions performed:`n"
    $actions | Format-Table -AutoSize
    Write-Host "\nBackup of moved items saved under: $backupDir"
}

Write-Host "\nDone."
