#!/usr/bin/env pwsh
# Cipher Agent Helper Script
# Usage: cipher "Your message here"

param(
    [Parameter(Mandatory = $true, Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$MessageParts
)

$Message = ($MessageParts -join ' ').Trim()
if (-not $Message) {
    throw 'Message cannot be empty. Usage: cipher "Your message here"'
}

$repoRoot = $PSScriptRoot
if (-not $repoRoot) {
    $repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

Push-Location $repoRoot -ErrorAction SilentlyContinue

# Capture output so we can tweak the banner text for ergonomics.
$outputLines = & node openclaw.mjs agent --agent cipher --message $Message 2>&1
$nodeExitCode = $LASTEXITCODE

$hideGatewayNoise = $env:CIPHER_HIDE_GATEWAY_NOISE -eq '1'

foreach ($line in $outputLines) {
    if ($hideGatewayNoise) {
        # Optional noise reduction: hide the common gateway-fallback banner.
        if ($line -match '^(Gateway agent failed; falling back to embedded:|Gateway target: ws://|Source: local loopback|Config: |Bind: loopback)') {
            continue
        }
    }

    # Rename the CLI banner for display only (case-sensitive; avoid rewriting paths).
    $line = $line -creplace '🦞 OpenClaw', '🔐 Cipher'
    Write-Output $line
}

Pop-Location

exit $nodeExitCode
