param(
    [string]$Root = (Convert-Path "."),
    [switch]$DryRun
)

$planPath = Join-Path $Root 'restructure-plan.json'
if (-not (Test-Path $planPath)) { Write-Error "Plan not found: $planPath"; exit 1 }

$plan = Get-Content $planPath | ConvertFrom-Json
$actions = @()

foreach ($item in $plan) {
    if (-not $item.wouldMove) { continue }

    $shimPath = Join-Path $Root $item.src
    $targetPath = Join-Path $item.dest $item.src

    if (-not (Test-Path $targetPath)) {
        $actions += [PSCustomObject]@{src = $item.src; result = 'missing-target'; target = $targetPath }
        continue
    }

    if ($DryRun) {
        $actions += [PSCustomObject]@{src = $item.src; action = 'would-create-symlink'; target = $targetPath }
        continue
    }

    # Remove any existing shim (file or symlink)
    if (Test-Path $shimPath) { Remove-Item -Path $shimPath -Force -Recurse }

    try {
        New-Item -ItemType SymbolicLink -Path $shimPath -Target $targetPath -Force -ErrorAction Stop | Out-Null
        $actions += [PSCustomObject]@{src = $item.src; action = 'symlink-created'; target = $targetPath }
    }
    catch {
        # Symlink failed (likely permissions); fall back to copy
        try {
            Copy-Item -Path $targetPath -Destination $shimPath -Recurse -Force -ErrorAction Stop
            $actions += [PSCustomObject]@{src = $item.src; action = 'copied'; target = $targetPath }
        }
        catch {
            $err = $_ | Out-String
            $actions += [PSCustomObject]@{src = $item.src; action = 'failed'; error = $err }
        }
    }
}

# Print summary
$actions | Sort-Object action, src | Format-Table -AutoSize
Write-Host "\nTotal shims processed: $($actions.Count)"

if ($actions | Where-Object { $_.action -eq 'failed' }) {
    Write-Warning "Some shims failed to create; inspect output above."
}

Write-Host "Done."
