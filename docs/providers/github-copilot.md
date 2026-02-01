---
summary: "Sign in to GitHub Copilot from OpenClaw using the device flow"
read_when:
  - You want to use GitHub Copilot as a model provider
  - You need the `openclaw models auth login-github-copilot` flow
---
# GitHub Copilot

## What is GitHub Copilot?

GitHub Copilot is GitHub's AI coding assistant. It provides access to Copilot
models for your GitHub account and plan. OpenClaw can use Copilot as a model
provider in two different ways.

## Two ways to use Copilot in OpenClaw

### 1) Built-in GitHub Copilot provider (`github-copilot`)

Use the native device-login flow to obtain a GitHub token, then exchange it for
Copilot API tokens when OpenClaw runs. This is the **default** and simplest path
because it does not require VS Code.

### 2) Copilot Proxy plugin (`copilot-proxy`)

Use the **Copilot Proxy** VS Code extension as a local bridge. OpenClaw talks to
the proxy’s `/v1` endpoint and uses the model list you configure there. Choose
this when you already run Copilot Proxy in VS Code or need to route through it.
You must enable the plugin and keep the VS Code extension running.

Use GitHub Copilot as a model provider (`github-copilot`). The login command runs
the GitHub device flow, saves an auth profile, and updates your config to use that
profile.

## CLI setup

```bash
openclaw models auth login-github-copilot
```

You'll be prompted to visit a URL and enter a one-time code. Keep the terminal
open until it completes.

### Optional flags

```bash
openclaw models auth login-github-copilot --profile-id github-copilot:work
openclaw models auth login-github-copilot --yes
```

## SDK-based Model Discovery

OpenClaw integrates with the GitHub Copilot SDK to automatically discover models
available in your subscription. This feature requires the [GitHub Copilot CLI](https://www.npmjs.com/package/@github/copilot)
to be installed separately.

### Enable SDK discovery

Add to your config file:

```json5
{
  models: {
    copilotSdk: {
      enableModelDiscovery: true
    }
  }
}
```

When enabled, OpenClaw will:
- Query the Copilot CLI for available models
- Automatically populate your models list based on your subscription
- Include model capabilities (context window, vision support, etc.)

### Prerequisites

Install the GitHub Copilot CLI:

```bash
npm install -g @github/copilot
```

Authenticate with the CLI:

```bash
gh copilot auth login
```

### How it works

1. OpenClaw connects to the Copilot CLI via the SDK
2. Queries your subscription's available models using `listModels()`
3. Converts model metadata to OpenClaw's format
4. Merges discovered models with your config

### Fallback behavior

If SDK discovery fails (CLI not installed or auth issues):
- OpenClaw falls back to built-in model definitions
- No error is thrown; discovery is best-effort
- Check logs for discovery warnings

## Set a default model

```bash
openclaw models set github-copilot/gpt-4o
```

### Config snippet

```json5
{
  agents: { defaults: { model: { primary: "github-copilot/gpt-4o" } } }
}
```

## Notes

- Requires an interactive TTY; run it directly in a terminal.
- Copilot model availability depends on your plan; if a model is rejected, try
  another ID (for example `github-copilot/gpt-4.1`).
- The login stores a GitHub token in the auth profile store and exchanges it for a
  Copilot API token when OpenClaw runs.
- SDK discovery is optional and requires the Copilot CLI to be installed.
- Models are discovered at config load time and cached in `models.json`.

## Additional Resources

### Comprehensive Guides

- **[SDK Verification Guide](./github-copilot-sdk-verification)** - Verify that the SDK is correctly using models from your subscription
- **[Complete Usage Guide](./github-copilot-sdk-usage-guide)** - Extensive documentation on using OpenClaw with Copilot SDK
- **[Skills Extension Guide](./github-copilot-sdk-skills-guide)** - Learn how to extend OpenClaw with custom skills and capabilities

These guides cover:
- Step-by-step verification procedures
- Complete workflow examples
- Integration with messaging platforms
- Creating custom skills
- API integrations
- Best practices and troubleshooting
