# Fix so "cipher" runs OpenClaw's cipher (not Windows cipher.exe or a PS alias).
# Run: powershell -ExecutionPolicy Bypass -File scripts/fix-cipher-path.ps1

$npmBin = "$env:APPDATA\npm"
$cipherCmd = "$npmBin\cipher.cmd"

# 1) Add npm global bin to user PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$([regex]::Escape($npmBin))*") {
  [Environment]::SetEnvironmentVariable("Path", "$npmBin;$currentPath", "User")
  Write-Host "Added to PATH: $npmBin" -ForegroundColor Green
} else {
  Write-Host "npm bin already on PATH." -ForegroundColor Cyan
}
$env:Path = "$npmBin;$env:Path"

# 2) Add cipher function to BOTH profile files (Windows PowerShell loads CurrentUserCurrentHost)
$profileBlock = @"
# OpenClaw cipher (run fix-cipher-path.ps1 to install)
`$cipherCmd = "$$env:APPDATA\npm\cipher.cmd"
function cipher { if (Test-Path -LiteralPath `$cipherCmd) { & `$cipherCmd @args } else { node openclaw.mjs cipher @args } }
Set-Alias -Name Cipher -Value cipher -Option AllScope -Force 2>`$null
"@

foreach ($profilePath in @($PROFILE.CurrentUserAllHosts, $PROFILE.CurrentUserCurrentHost)) {
  $profileDir = Split-Path -Parent $profilePath
  if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }
  if (-not (Test-Path $profilePath)) { Set-Content -Path $profilePath -Value "" }
  $content = Get-Content -Raw -Path $profilePath -ErrorAction SilentlyContinue
  if ($content -notlike "*cipher.cmd*" -and $content -notlike "*OpenClaw cipher*") {
    Add-Content -Path $profilePath -Value $profileBlock
    Write-Host "Added cipher to: $profilePath" -ForegroundColor Green
  } else {
    Write-Host "Profile already has cipher: $profilePath" -ForegroundColor Cyan
  }
}

# 3) Test
Write-Host ""
Write-Host "Testing cipher..." -ForegroundColor Yellow
& $cipherCmd --help 2>&1 | Select-Object -First 10
Write-Host ""
Write-Host "Done. The profile now runs cipher from the repo (global install may not have cipher yet)." -ForegroundColor Green
Write-Host "  1. Open a NEW PowerShell window and run: cipher `"your message`"" -ForegroundColor White
Write-Host ""
Write-Host "If cipher is still not found (profile not loading), run this once in the session:" -ForegroundColor Yellow
Write-Host '  function cipher { $d=Get-Location; Set-Location C:\Users\arcan_e9q9t\openclaw; node openclaw.mjs cipher @args; Set-Location $d }' -ForegroundColor Gray
Write-Host ""
Write-Host "Or use the batch file:" -ForegroundColor Yellow
Write-Host '  C:\Users\arcan_e9q9t\openclaw\scripts\cipher.bat "your message"' -ForegroundColor Gray
