---
summary: "CLI reference for `amigo config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `amigo config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `amigo configure`).

## Examples

```bash
amigo config get browser.executablePath
amigo config set browser.executablePath "/usr/bin/google-chrome"
amigo config set agents.defaults.heartbeat.every "2h"
amigo config set agents.list[0].tools.exec.node "node-id-or-name"
amigo config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
amigo config get agents.defaults.workspace
amigo config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
amigo config get agents.list
amigo config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--json` to require JSON5 parsing.

```bash
amigo config set agents.defaults.heartbeat.every "0m"
amigo config set gateway.port 19001 --json
amigo config set channels.whatsapp.groups '["*"]' --json
```

Restart the gateway after edits.
