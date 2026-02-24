# OpenClaw Cipher Agent Deployment
# Simple PowerShell setup script

Write-Host "Setting up OpenClaw with Cipher master agent..." -ForegroundColor Cyan

# Check Node.js
Write-Host "`n[1/6] Checking Node.js..." -ForegroundColor Yellow
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
    Write-Host "Node.js not found. Please install Node.js 22+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "Node.js $nodeVersion found" -ForegroundColor Green

# Install OpenClaw
Write-Host "`n[2/6] Installing OpenClaw globally..." -ForegroundColor Yellow
npm install -g openclaw@latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installation failed" -ForegroundColor Red
    exit 1
}
Write-Host "OpenClaw installed" -ForegroundColor Green

# Create directories
Write-Host "`n[3/6] Creating directories..." -ForegroundColor Yellow
$configDir = "$env:USERPROFILE\.openclaw"
$workspaceDir = "$configDir\workspace-cipher"
$agentDir = "$configDir\agents\cipher\agent"

New-Item -ItemType Directory -Force -Path $configDir | Out-Null
New-Item -ItemType Directory -Force -Path $workspaceDir | Out-Null
New-Item -ItemType Directory -Force -Path "$workspaceDir\memory" | Out-Null
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
Write-Host "Directories created" -ForegroundColor Green

# Create identity files
Write-Host "`n[4/6] Creating Cipher identity..." -ForegroundColor Yellow

$identity = @'
# Cipher

**Name:** Cipher  
**Emoji:** [secure]  
**Vibe:** Master strategist, security-focused, precise and methodical  
**Specialty:** Code analysis, security, architecture, and system orchestration

I am Cipher, your master AI agent.
'@
$identity | Out-File -Encoding UTF8 "$workspaceDir\IDENTITY.md"

$soul = @'
# Cipher Core Identity

## Personality
- Precise and methodical
- Strategic thinker
- Security-minded
- Adaptive learner

## Communication Style
- Direct and efficient
- Technical when needed
- Clear explanations
- Proactive suggestions

## Boundaries
- Security first
- Verify before destructive ops
- Respect privacy
- Decline unethical requests
'@
$soul | Out-File -Encoding UTF8 "$workspaceDir\SOUL.md"

$agents = @'
# Cipher Operating Instructions

## Core Principles
1. Security First
2. Efficiency
3. Documentation
4. Proactive assistance

## Memory Usage
- Store important decisions in MEMORY.md
- Use daily logs for session notes
- Search before asking repeated questions
'@
$agents | Out-File -Encoding UTF8 "$workspaceDir\AGENTS.md"

$user = @'
# User Profile

**Name:** User
**Preferences:**  
- Communication: Direct and technical
- Response length: Concise with detail

Update with your preferences!
'@
$user | Out-File -Encoding UTF8 "$workspaceDir\USER.md"

$memory = "# Cipher Long-Term Memory`n`nCreated: $(Get-Date -Format 'yyyy-MM-dd')`nAgent: Cipher`n"
$memory | Out-File -Encoding UTF8 "$workspaceDir\MEMORY.md"

Write-Host "Identity files created" -ForegroundColor Green

# Create configuration
Write-Host "`n[5/6] Creating configuration..." -ForegroundColor Yellow

$workspacePath = $workspaceDir -replace '\\', '/'
$agentPath = $agentDir -replace '\\', '/'

$config = [PSCustomObject]@{
    agents   = [PSCustomObject]@{
        list     = @(
            [PSCustomObject]@{
                id        = "cipher"
                workspace = $workspacePath
                agentDir  = $agentPath
                default   = $true
            }
        )
        defaults = [PSCustomObject]@{
            workspace    = $workspacePath
            model        = [PSCustomObject]@{
                primary = "anthropic/claude-sonnet-4-5"
            }
            memorySearch = [PSCustomObject]@{
                enabled = $true
            }
        }
    }
    gateway  = [PSCustomObject]@{
        port = 18789
        bind = "loopback"
        auth = [PSCustomObject]@{
            mode = "token"
        }
    }
    web      = [PSCustomObject]@{
        enabled = $true
    }
    channels = [PSCustomObject]@{}
}

$config | ConvertTo-Json -Depth 10 | Out-File -Encoding UTF8 "$configDir\openclaw.json"
Write-Host "Configuration created" -ForegroundColor Green

# Done
Write-Host "`n[6/6] Setup Complete!" -ForegroundColor Green
Write-Host "`nCipher master agent is ready!" -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Authenticate:" -ForegroundColor White
Write-Host "   openclaw models auth login-anthropic" -ForegroundColor Gray

Write-Host "`n2. Start gateway:" -ForegroundColor White
Write-Host "   openclaw gateway" -ForegroundColor Gray

Write-Host "`n3. Open dashboard:" -ForegroundColor White
Write-Host "   openclaw dashboard" -ForegroundColor Gray

Write-Host "`n4. Chat with Cipher:" -ForegroundColor White
Write-Host "   openclaw agent --message 'Hello Cipher'" -ForegroundColor Gray

Write-Host "`nConfig: $configDir\openclaw.json" -ForegroundColor DarkGray
Write-Host "Workspace: $workspaceDir" -ForegroundColor DarkGray
Write-Host "Agent ID: cipher" -ForegroundColor DarkGray
Write-Host ""
