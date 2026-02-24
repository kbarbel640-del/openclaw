# Run once in PowerShell if "cipher" is not recognized (e.g. profile did not load):
#   . .\scripts\cipher-run.ps1
# Then: cipher "your message"
# Or run directly: .\scripts\cipher-run.ps1 "your message"
$cipherCmd = "$env:APPDATA\npm\cipher.cmd"
if ($args.Count -gt 0) {
  & $cipherCmd @args
} else {
  function global:cipher { & $cipherCmd @args }
  Set-Alias -Name Cipher -Value cipher -Scope Global -Force 2>$null
  Write-Host "cipher is now defined for this session. Example: cipher `"wake up`"" -ForegroundColor Green
}
