param(
    [string]$Root = (Convert-Path ".")
)

# Scans the repository root and generates a dry-run restructure plan (restructure-plan.json)
# This script DOES NOT move files. It classifies top-level items into target folders and
# writes a JSON plan you can inspect before applying changes.

Write-Host "Scanning repository root: $Root`n"

$skip = @('.git', 'node_modules', 'dist')

$patterns = @(
    @{Regex = '(?i)^(AGENTS|CLAUDE|CODE CITATIONS|CHANGELOG|README|LICENSE|SECURITY|VISION|CIPHER|CONTRIBUTING|CODE|docs\.acp|appcast)'; Target = 'meta-docs' },
    @{Regex = '(?i)^(Dockerfile|docker-compose\.yml|docker-compose\.yaml|docker-setup|Dockerfile\.)'; Target = 'infra' },
    @{Regex = '(?i)\.ya?ml$|^\.github$|git-hooks|\.pre-commit|\.markdownlint|\.shellcheckrc|\.oxlintrc|\.oxfmtrc|\.swiftformat|\.swiftlint'; Target = 'ci-configs' },
    @{Regex = '(?i)^(package(-lock)?\.json|pnpm-lock\.yaml|pnpm-lock\.json|pnpm-workspace\.yaml|pyproject\.toml|tsconfig.*|vitest.*|openclaw\.(mjs|podman\.env))'; Target = 'config' },
    @{Regex = '(?i)^(apps|extensions|packages|src|assets|scripts|test|ui|vendor|skills|docs|patches|apps)$'; Target = 'keep' }
)

$plan = @()

foreach ($item in Get-ChildItem -Path $Root -Force) {
    $name = $item.Name
    if ($skip -contains $name) { continue }

    if ($name -in @('apps', 'extensions', 'packages', 'src', 'assets', 'scripts', 'test', 'ui', 'vendor', 'skills', 'docs', 'patches', '.github', 'git-hooks')) {
        $target = 'keep'
    }
    else {
        $target = $null
        foreach ($p in $patterns) {
            if ($name -match $p.Regex) { $target = $p.Target; break }
        }
        if (-not $target) { $target = 'other' }
    }

    $destDir = if ($target -eq 'keep') { $Root } else { Join-Path $Root $target }

    $plan += [PSCustomObject]@{
        src       = $name
        target    = $target
        dest      = $destDir
        wouldMove = -not ($target -eq 'keep')
    }
}

# Pretty-print plan to console
$plan | Sort-Object target, src | Format-Table -AutoSize

# Save JSON plan
$planPath = Join-Path $Root 'restructure-plan.json'
$plan | ConvertTo-Json -Depth 3 | Out-File -FilePath $planPath -Encoding UTF8

Write-Host "`nWrote plan to: $planPath`n"

Write-Host "Summary:`n"
$plan | Group-Object -Property target | ForEach-Object { $count = ($_.Group | Where-Object { $_.wouldMove } | Measure-Object).Count; Write-Host ("{0,-12} : {1}" -f $_.Name, $count) }

Write-Host "`nNext steps: review 'restructure-plan.json' and decide whether to generate/make the moves."
Write-Host "To create executable move script, run: `n  PowerShell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-restructure.ps1 -Root <repo-root>`
