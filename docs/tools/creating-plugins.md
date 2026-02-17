---
summary: "Scaffold new OpenClaw plugins with openclaw plugins create"
read_when:
  - Creating a new OpenClaw plugin from scratch
  - Understanding the plugin file structure
  - Getting started with plugin development
title: "Creating Plugins"
---

# Creating plugins

The `openclaw plugins create` command scaffolds a new plugin with the correct file structure,
manifest, and TypeScript boilerplate.

## Usage

```bash
openclaw plugins create <name> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-d, --description <desc>` | Plugin description (default: `"OpenClaw plugin: <name>"`) |
| `-o, --output <dir>` | Output directory (default: `extensions/<name>`) |
| `--kind <kind>` | Plugin kind, e.g. `memory` for memory slot plugins |

### Examples

```bash
# Basic plugin
openclaw plugins create my-tool

# Plugin with description and kind
openclaw plugins create memory-redis -d "Redis-backed memory provider" --kind memory

# Custom output location
openclaw plugins create my-plugin -o ~/projects/my-plugin
```

## Generated files

The command creates three files:

```
extensions/my-tool/
├── package.json           # npm package with openclaw dev dependency
├── openclaw.plugin.json   # Plugin manifest with config schema
└── index.ts               # Entry point with register() function
```

### `package.json`

```json
{
  "name": "@openclaw/my-tool",
  "version": "0.1.0",
  "private": true,
  "description": "OpenClaw plugin: my-tool",
  "type": "module",
  "devDependencies": {
    "openclaw": "workspace:*"
  },
  "openclaw": {
    "extensions": ["./index.ts"]
  }
}
```

### `openclaw.plugin.json`

```json
{
  "id": "my-tool",
  "name": "my-tool",
  "description": "OpenClaw plugin: my-tool",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

### `index.ts`

```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

export default {
  id: "my-tool",
  name: "my-tool",
  description: "OpenClaw plugin: my-tool",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    api.logger.info("my-tool plugin loaded");

    // Register a tool:
    // api.registerTool(myTool);

    // Register a lifecycle hook:
    // api.registerHook(["agent:beforeRun"], async (ctx) => { ... });

    // Register a CLI command:
    // api.registerCli((program) => {
    //   program.command("my-command").action(() => { ... });
    // });
  },
};
```

## Next steps

After scaffolding:

1. **Enable the plugin**: `openclaw plugins enable my-tool`
2. **Add your logic** to `index.ts` using the `OpenClawPluginApi`
3. **Add config** if needed — update `openclaw.plugin.json` `configSchema` and read via `api.pluginConfig`
4. **Restart** the gateway to load the plugin

See the [plugin SDK reference](/tools/plugin) for the full `OpenClawPluginApi` surface, and
[`openclaw plugins`](/cli/plugins) for managing installed plugins.
