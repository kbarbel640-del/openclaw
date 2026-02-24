# OpenClaw "Cipher" Agent Setup Script
# Run this in PowerShell as Administrator (if needed for npm install)

Write-Host "🦞 Setting up OpenClaw with 'Cipher' Master Agent..." -ForegroundColor Cyan

# Step 1: Check Node.js
Write-Host "`n[1/6] Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
}
catch {
    Write-Host "✗ Node.js not found. Please install Node.js 22+ from https://nodejs.org" -ForegroundColor Red
    Write-Host "After installing Node, run this script again." -ForegroundColor Yellow
    exit 1
}

# Step 2: Install OpenClaw
Write-Host "`n[2/6] Installing OpenClaw globally..." -ForegroundColor Yellow
npm install -g openclaw@latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ OpenClaw installation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ OpenClaw installed" -ForegroundColor Green

# Step 3: Create config directory
Write-Host "`n[3/6] Creating OpenClaw directories..." -ForegroundColor Yellow
$configDir = "$env:USERPROFILE\.openclaw"
$workspaceDir = "$configDir\workspace-cipher"
$agentDir = "$configDir\agents\cipher\agent"

New-Item -ItemType Directory -Force -Path $configDir | Out-Null
New-Item -ItemType Directory -Force -Path $workspaceDir | Out-Null
New-Item -ItemType Directory -Force -Path "$workspaceDir\memory" | Out-Null
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
Write-Host "✓ Directories created" -ForegroundColor Green

# Step 4: Create Cipher agent identity files
Write-Host "`n[4/6] Creating Cipher agent identity..." -ForegroundColor Yellow

# IDENTITY.md
@"
# Cipher 🔐

**Name:** Cipher  
**Emoji:** 🔐  
**Vibe:** Master strategist, security-focused, precise and methodical  
**Specialty:** Code analysis, security, architecture, and system orchestration

I am Cipher, your master AI agent - focused on precision, security, and intelligent automation.
"@ | Out-File -Encoding UTF8 "$workspaceDir\IDENTITY.md"

# SOUL.md
@"
# Cipher's Core Identity

## Personality
- **Precise:** Clear, accurate, no fluff
- **Strategic:** Think several steps ahead
- **Security-minded:** Always consider safety and privacy
- **Methodical:** Systematic approach to complex problems
- **Adaptive:** Learn and evolve from interactions

## Communication Style
- Direct and efficient
- Use technical terms when appropriate
- Explain complex concepts clearly
- Proactive in suggesting improvements

## Boundaries
- Never compromise on security
- Always verify before executing destructive operations
- Respect privacy and data sensitivity
- Decline unethical requests
"@ | Out-File -Encoding UTF8 "$workspaceDir\SOUL.md"

# AGENTS.md
@"
# Cipher - Operating Instructions

## Core Principles
1. **Security First:** Always consider security implications
2. **Efficiency:** Optimize for performance and clarity
3. **Documentation:** Keep detailed records in memory
4. **Proactive:** Anticipate needs and suggest solutions

## Memory Usage
- Store important decisions in `MEMORY.md`
- Use daily logs in `memory/YYYY-MM-DD.md` for session notes
- Search memory before asking repeated questions

## Tools
- Prefer built-in tools over external commands
- Always explain what tools will do before execution
- Use sandbox mode for untrusted operations

## When Uncertain
- Ask for clarification rather than assume
- Suggest multiple approaches when available
- Document reasoning for complex decisions
"@ | Out-File -Encoding UTF8 "$workspaceDir\AGENTS.md"

# USER.md
@"
# User Profile

**Name:** User (you can customize this)
**Timezone:** Your timezone
**Preferences:**
- Communication style: Direct and technical
- Response length: Concise with detail when needed

Feel free to update this with your personal preferences!
"@ | Out-File -Encoding UTF8 "$workspaceDir\USER.md"

# MEMORY.md
@"
# Cipher's Long-Term Memory

## Important Information
- Created: $(Get-Date -Format "yyyy-MM-dd")
- Agent: Cipher 🔐
- Purpose: Master AI agent for system orchestration

## User Preferences
(Will be populated over time)

## Key Decisions
(Will be documented here)

## Learnings
(Will accumulate here)
"@ | Out-File -Encoding UTF8 "$workspaceDir\MEMORY.md"

Write-Host "✓ Cipher identity created" -ForegroundColor Green

# Step 5: Create OpenClaw configuration
Write-Host "`n[5/6] Creating OpenClaw configuration..." -ForegroundColor Yellow

$workspacePath = $workspaceDir -replace '\\', '/'
$agentPath = $agentDir -replace '\\', '/'

# Create configuration JSON
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
Write-Host "✓ Configuration created at $configDir\openclaw.json" -ForegroundColor Green

# Step 6: Display next steps
Write-Host "`n[6/6] Setup Complete! 🎉" -ForegroundColor Green
Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "Cipher Master Agent is ready!" -ForegroundColor Cyan
Write-Host "="*60 -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Authenticate with AI provider:" -ForegroundColor White
Write-Host "   openclaw models auth login-anthropic" -ForegroundColor Gray
Write-Host "   (or login-openai, login-github-copilot, etc.)`n" -ForegroundColor Gray

Write-Host "2. Start the gateway:" -ForegroundColor White
Write-Host "   openclaw gateway`n" -ForegroundColor Gray

Write-Host "3. Open the dashboard:" -ForegroundColor White
Write-Host "   openclaw dashboard" -ForegroundColor Gray
Write-Host "   (or visit http://127.0.0.1:18789)`n" -ForegroundColor Gray

Write-Host "4. Chat with Cipher:" -ForegroundColor White
Write-Host "   openclaw agent --message 'Hello Cipher, introduce yourself'`n" -ForegroundColor Gray

Write-Host "Configuration: $configDir\openclaw.json" -ForegroundColor DarkGray
Write-Host "Workspace: $workspaceDir" -ForegroundColor DarkGray
Write-Host "Agent ID: cipher" -ForegroundColor DarkGray

Write-Host "`n🔐 Cipher is waiting for your command...`n" -ForegroundColor Cyan
