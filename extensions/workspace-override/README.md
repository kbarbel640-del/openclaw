# Workspace Override Plugin

Override the default agent workspace documents (AGENTS.md, SOUL.md, TOOLS.md, etc.) with your own versions, without editing the originals.

## Setup

### 1. Enable the plugin

Add this to your OpenClaw config (`~/.openclaw/config.json5`):

```json5
{
  plugins: {
    entries: {
      "workspace-override": { enabled: true }
    }
  }
}
```

### 2. Edit the override files

The plugin ships with an `overrides/` folder that is used by default. Edit or add any of these files inside it:

- `AGENTS.md` — agent behavior rules
- `SOUL.md` — personality and tone
- `TOOLS.md` — tool usage guidance
- `IDENTITY.md` — agent identity
- `USER.md` — user information (sample included)
- `HEARTBEAT.md` — heartbeat prompt

Only files present in the folder are overridden. Missing files keep their defaults.

### 3. Restart the gateway

Config changes require a gateway restart. Overrides are read fresh at the start of each agent run.

## Custom overrides directory

To use a different directory instead of the bundled `overrides/` folder, set `dir` in the plugin config:

```json5
{
  plugins: {
    entries: {
      "workspace-override": {
        enabled: true,
        config: { dir: "~/my-custom-rules" }
      }
    }
  }
}
```

## How it works

Before each agent run, the plugin scans the overrides directory for known filenames. Any files found are injected into the agent's context with a note that they take precedence over the originals in Project Context.
