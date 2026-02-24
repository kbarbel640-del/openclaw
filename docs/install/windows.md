---
summary: "Deploy OpenClaw on Windows and run it with PowerShell"
read_when:
  - Installing or running OpenClaw on Windows
  - You want copy-paste PowerShell commands
title: "Windows (PowerShell)"
---

# Windows (PowerShell)

Deploy OpenClaw on Windows and use these PowerShell commands to get started.

## Deploy options

### Option 1: Installer (recommended)

One-line install from the website (installs Node if needed, then runs onboarding):

```powershell
irm https://openclaw.ai/install.ps1 | iex
```

Install only (no onboarding):

```powershell
& ([scriptblock]::Create((irm -useb https://openclaw.ai/install.ps1))) -NoOnboard
```

### Option 2: Global npm install

If you already have Node 22+:

```powershell
npm install -g openclaw@latest
```

Then run onboarding (see [Start using](#start-using) below).

### Option 3: From source (development)

From a repo clone, install deps and build. Full build requires WSL or Git Bash for the A2UI bundle step; you can still run the CLI after a TypeScript-only build:

```powershell
cd C:\path\to\openclaw
npx pnpm install
npx tsdown --no-clean
node --import tsx scripts/write-plugin-sdk-entry-dts.ts 2>$null
node --import tsx scripts/copy-hook-metadata.ts
node --import tsx scripts/copy-export-html-templates.ts
node --import tsx scripts/write-build-info.ts
node --import tsx scripts/write-cli-compat.ts
```

Run the CLI from the repo:

```powershell
node openclaw.mjs --help
# or: npx pnpm openclaw --help  (triggers build if dist is stale)
```

<Note>
For a full from-source build including the Canvas A2UI bundle on Windows, use WSL2 and follow the Linux instructions in [From source](/install#from-source).
</Note>

## Start using

After install, run these in PowerShell.

### 1. Onboarding (first-time setup)

```powershell
openclaw onboard --install-daemon
```

The wizard configures auth, gateway, and optional channels. On Windows, the daemon option may install a user-level service if supported; otherwise run the gateway manually (step 3).

### 2. Verify install

```powershell
openclaw --version
openclaw doctor
```

### 3. Start the gateway

If you did **not** install the daemon, start the gateway in a terminal (keep it open):

```powershell
openclaw gateway run --port 18789 --verbose
```

If the daemon is installed:

```powershell
openclaw gateway status
```

### 4. Open the Control UI

```powershell
openclaw dashboard
```

Opens the web UI in your browser. You can chat there without configuring a channel.

### 5. Send a message (after pairing a channel)

```powershell
openclaw message send --to <phone-or-id> --message "Hello from OpenClaw"
```

### 6. Run the agent (one turn)

```powershell
openclaw agent --message "Ship checklist" --thinking high
```

### 7. Check channel status

```powershell
openclaw status
openclaw channels status
```

### 8. Other useful commands

```powershell
openclaw config set gateway.mode local
openclaw models list
openclaw plugins list
openclaw help
```

## PATH: `openclaw` not found

If PowerShell does not find `openclaw`, add the global npm bin directory to your user PATH:

```powershell
$npmPrefix = npm prefix -g
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$npmPrefix", "User")
```

Close and reopen PowerShell, then run `openclaw --version` again.

## Docs

- [Getting started](/start/getting-started)
- [Onboarding wizard](/start/wizard)
- [Install index](/install)
