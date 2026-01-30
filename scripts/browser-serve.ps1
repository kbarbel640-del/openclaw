$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $repoRoot ".env"

if (!(Test-Path $envFile)) {
  throw "Missing .env at $envFile (expected CLAWDBOT_BROWSER_CONTROL_TOKEN)."
}

$tokenLine = Get-Content $envFile | Where-Object { $_ -match "^CLAWDBOT_BROWSER_CONTROL_TOKEN=" } | Select-Object -First 1
if (-not $tokenLine) {
  throw "CLAWDBOT_BROWSER_CONTROL_TOKEN is missing in $envFile."
}

$token = $tokenLine.Substring("CLAWDBOT_BROWSER_CONTROL_TOKEN=".Length).Trim()
if (-not $token) {
  throw "CLAWDBOT_BROWSER_CONTROL_TOKEN is empty in $envFile."
}

$env:CLAWDBOT_BROWSER_CONTROL_TOKEN = $token

Set-Location $repoRoot

$spec = $env:CLAWDBOT_NPX_PACKAGE
if ([string]::IsNullOrWhiteSpace($spec)) {
  $spec = "clawdbot@latest"
}

npm exec --yes --package=$spec -- clawdbot browser serve --bind 127.0.0.1 --port 18791
