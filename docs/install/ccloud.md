---
summary: "Run OpenClaw on Carolina Cloud with a few clicks or one CLI command"
read_when:
  - You want to run OpenClaw as easily as possible
  - You want a managed OpenClaw instance without server setup
title: "Carolina Cloud"
---

# Carolina Cloud

Goal: OpenClaw running on Carolina Cloud with zero server configuration.

Carolina Cloud handles all the infrastructure -- there is nothing to install, configure, or proxy.

## Console

1. Log in to the [Carolina Cloud console](https://carolinacloud.io)
2. Click **+ Create Instance** in the sidebar
3. Click **OpenClaw**
4. Configure resources (CPU, memory, storage)
5. Enter your Anthropic API key
6. Click **Create OpenClaw**
7. Click **Open OpenClaw** on the instance card

That's it. Your OpenClaw instance is ready to use.

## CLI

```bash
# Install the CLI if needed
curl -fsSL https://api.carolinacloud.io/static/cli/install.sh | bash

# Ensure $ANTHROPIC_API_KEY and $CCLOUD_API_KEY are set
# (you can get your Carolina Cloud API key from the console)
ccloud new openclaw --name my-assistant  # Pick any name
```

## Updating

Simply stop and restart your OpenClaw instance to trigger an auto-update (it will run `npm i -g openclaw@latest` under the hood).
