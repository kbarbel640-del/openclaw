# Cipher Agent - Authentication & First Steps

## ✅ Current Status

Your Cipher master agent is **deployed and ready**!

```
Agent: cipher (default)
Status: Ready
Workspace: ~/.openclaw/workspace-cipher
Config: ~/.openclaw/openclaw.json
```

## 📝 Complete the GitHub Copilot Authentication

The login flow requires interactive confirmation. Here's how:

### Step 1: Start the authentication process

Run this command in the openclaw directory:

```powershell
cd C:\Users\arcan_e9q9t\openclaw
node openclaw.mjs models auth login-github-copilot
```

You should see:
```
🦞 GitHub Copilot login

✓ Device code ready

◇ Authorize
│
│  Visit: https://github.com/login/device
│  Code: 3D16-AFDB
│
◇ Waiting...
```

### Step 2: Authorize on GitHub

1. **Visit:** https://github.com/login/device
2. **Enter code:** The 8-character code shown (e.g., `3D16-AFDB`)
3. **Authorize:** Click the permission confirmation button
4. **Wait:** Return to your terminal - it will complete automatically

### Step 3: Verify Authentication

After authorization completes, verify it worked:

```powershell
node openclaw.mjs models list
```

You should see available models like:
- `anthropic/claude-sonnet-4-5`
- `openai/gpt-4-1106-preview`
- `openai/gpt-4-turbo`

## 🚀 Chat with Cipher (After Auth)

Once authenticated, test Cipher:

```powershell
cd C:\Users\arcan_e9q9t\openclaw
node openclaw.mjs agent --message "Hello Cipher, introduce yourself"
```

Cipher will respond with its identity and ask how it can help!

## 🌐 Start the Full Gateway

For the web UI and persistent agent:

```powershell
node openclaw.mjs gateway
```

Then open: http://127.0.0.1:18789

Features:
- **Web Chat:** Talk to Cipher via browser
- **Dashboard:** Monitor agent status
- **Routing:** Configure multi-agent rules
- **Channels:** Connect messaging apps (optional)

## 📚 Alternative Authentication Methods

If GitHub Copilot doesn't work for you, try:

**Anthropic (Claude direct):**
```powershell
node openclaw.mjs models auth login-anthropic
```
(Requires: Anthropic API key from https://console.anthropic.com)

**OpenAI:**
```powershell
node openclaw.mjs models auth login-openai
```
(Requires: OpenAI API key from https://platform.openai.com)

## 🔧 Troubleshooting

**"Cannot find module" error:**
- Make sure you're in the `C:\Users\arcan_e9q9t\openclaw` directory
- Run: `cd C:\Users\arcan_e9q9t\openclaw` first

**Auth was canceled:**
- Just run the login command again
- Make sure to complete the device flow on GitHub before timing out

**Cipher doesn't respond:**
- Verify auth with: `node openclaw.mjs models list`
- Check credentials exist: `Get-ChildItem $env:USERPROFILE\.openclaw\credentials`
- Run: `node openclaw.mjs doctor` for diagnostics

## 📁 Key Locations

```
Config:      %USERPROFILE%\.openclaw\openclaw.json
Credentials: %USERPROFILE%\.openclaw\credentials\
Workspace:   %USERPROFILE%\.openclaw\workspace-cipher\
Sessions:    %USERPROFILE%\.openclaw\agents\cipher\sessions\
```

## ✨ Next Power Moves

After authentication:

1. **Add memory:** Cipher auto-saves important learnings in `MEMORY.md`
2. **Configure channels:** Add WhatsApp, Telegram, Discord (optional)
3. **Route messages:** Set up multi-agent bindings if needed
4. **Customize identity:** Edit `SOUL.md`, `AGENTS.md` to tweak personality

---

**Ready to talk to Cipher?** Run the auth command again and complete the GitHub device flow! 🔐
