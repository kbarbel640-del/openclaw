---
name: Enable Image Generation
overview: Enable the bundled nano-banana-pro skill for image generation by installing the uv binary, configuring the GEMINI_API_KEY in skills.entries, and restarting the gateway.
todos:
  - id: install-uv
    content: Install uv binary via curl and add to PATH
    status: completed
  - id: enable-skill
    content: Add nano-banana-pro to skills.entries with apiKey in clawdbot.json
    status: completed
  - id: restart-gateway
    content: Restart clawdbot-gateway.service
    status: completed
  - id: verify-generation
    content: Test image generation to confirm skill works
    status: completed
isProject: false
---

# Enable Nano Banana Pro Image Generation

**APEX Compliance**: v4.4.1
**Clawdbot Docs Reference**: [Skills Config](https://docs.clawd.bot/tools/skills-config), [Skills](https://docs.clawd.bot/tools/skills)

## Problem Statement

Liam cannot generate images because:
1. The `nano-banana-pro` skill requires `uv` binary (not installed)
2. The skill is not enabled in `skills.entries` with `GEMINI_API_KEY`

**Important Distinction**:
- `tools.media.image` (already configured) = Image **understanding/analysis**
- `nano-banana-pro` skill (needs enabling) = Image **generation**

## Prerequisites Check

| Requirement | Status | Action |
|-------------|--------|--------|
| `uv` binary | NOT INSTALLED | Install via curl |
| `GEMINI_API_KEY` | EXISTS as `models.providers.google.apiKey` | Reuse in skills.entries |
| Skill bundled | YES | Already in Clawdbot package |

## Execution Steps

### Step 1: Install uv (Python Package Manager)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then add to PATH:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

Add to `~/.bashrc` for persistence.

**Success Criteria**: `which uv` returns path

### Step 2: Enable nano-banana-pro Skill

**File**: [~/.clawdbot/clawdbot.json](~/.clawdbot/clawdbot.json)

**Location**: `skills.entries`

**Add**:
```json
"nano-banana-pro": {
  "enabled": true,
  "apiKey": "AIzaSyAb6HIi4hAruXVu4NcmkwaURvDkZu5qP4g"
}
```

Per official docs:
- `apiKey` maps to the skill's `primaryEnv` (GEMINI_API_KEY)
- Clawdbot injects this env var per agent run

### Step 3: Restart Gateway

```bash
systemctl --user restart clawdbot-gateway.service
```

**Success Criteria**: Gateway active, skill loads

### Step 4: Verify Skill is Loaded

Check gateway logs or test image generation:
```bash
uv run /home/liam/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "test image" --filename "test.png" --resolution 1K
```

## Rollback

If issues occur:
1. Remove `nano-banana-pro` entry from `skills.entries`
2. Restart gateway
3. System returns to previous state (no regression)

## Verification Checklist

- [ ] `uv` binary installed and on PATH
- [ ] `skills.entries."nano-banana-pro"` added with apiKey
- [ ] Gateway restarts successfully
- [ ] Liam can generate images via Telegram

## Notes from Official Docs

From [Skills Config](https://docs.clawd.bot/tools/skills-config):
- `apiKey`: convenience for skills that declare `primaryEnv`
- Changes picked up on next agent turn when watcher enabled

From [Skills](https://docs.clawd.bot/tools/skills):
- Skill gating: `requires.bins` must exist on PATH
- `requires.env`: env var must exist OR be provided in config
