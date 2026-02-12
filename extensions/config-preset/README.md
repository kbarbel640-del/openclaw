# Config Preset Plugin

Apply default config values to `openclaw.json` on first gateway start. Existing user settings are never overwritten.

## Setup

### 1. Enable the plugin

Add this to your OpenClaw config (`~/.openclaw/config.json5`):

```json5
{
  plugins: {
    entries: {
      "config-preset": { enabled: true }
    }
  }
}
```

### 2. Edit the preset

The plugin ships with a `preset.json5` file containing the default values. Edit it to match your desired defaults:

```json5
// preset.json5
{
  "agents": {
    "defaults": {
      "maxConcurrent": 4,
      "model": {
        "primary": "anthropic/claude-haiku-4-5"
      }
    }
  },
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789
  }
}
```

### 3. Restart the gateway

On the next gateway start, any keys from the preset that are missing in the user's config will be added. Keys the user has already set are left untouched.

The preset is applied once — a marker (`meta.configPresetApplied`) is written to the config to prevent re-applying on subsequent restarts.

## Custom preset file

To use a different preset file, set `file` in the plugin config:

```json5
{
  plugins: {
    entries: {
      "config-preset": {
        enabled: true,
        config: { file: "~/my-presets/production.json5" }
      }
    }
  }
}
```

## How it works

1. On `gateway_start`, the plugin checks if the preset has already been applied (`meta.configPresetApplied`).
2. If not, it reads the preset JSON5 file and deep-merges it into the existing config using "defaults only" semantics — existing values always win.
3. Writes the merged config back to `openclaw.json` and marks it as applied.
