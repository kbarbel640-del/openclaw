---
name: delegate
description: Delegates a prompt through the VS Code LM Proxy on maxblack, runs multiple best models in tandem, then uses Opus 4.5 to report.
invocation: user
---

# Delegate (VS Code LM Proxy)

## When to Use

- Complex problems where multiple perspectives add value
- Decisions with trade-offs (architecture, design, strategy)
- Cross-domain questions (technical + business logic)
- When you want confidence via consensus among top models
- Research tasks where breadth matters

## When NOT to Use

- **Simple factual lookups** — single model is faster and sufficient
- **Time-sensitive tasks** — delegate runs 3+ models sequentially; use direct model for speed
- **Token-constrained contexts** — delegate multiplies token usage 3-4x
- **When you already know the answer** — delegate is for exploration, not confirmation
- **Iterative debugging** — use direct model for tight feedback loops

Use the VS Code LM Proxy on maxblack to run the best-model trio in tandem, then have Opus 4.5 produce a report of what each model said.

## Default Model Set

- gemini 3 pro preview
- opus 4.5
- gpt-5.2-codex

## Script

Path:
`~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs`

The script:

- talks to the LM Proxy OpenAI/Anthropic/Claude Code compatible APIs
- runs the default model trio (or `--models`/`LM_PROXY_MODELS` overrides)
- captures each response
- sends a final Opus 4.5 report summarizing each model
- writes plain text or JSON output
- supports streaming output, tool definitions, and tool execution

## Usage (on maxblack)

```bash
ssh maxblack
node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --prompt "<task>"
```

## Quality Preference (Default)

Always optimize for best possible output over speed/cost. This is enforced by a system message prepended by the delegate script:

- Provide all relevant context, files, and background to the delegate prompt.
- Allow models to take as long as needed; do not truncate.
- Favor depth, rigor, and completeness over brevity.
- If a task is complex, expand the prompt and include supporting materials.

With overrides:

```bash
LM_PROXY_MODELS="gemini 3 pro preview,opus 4.5,gpt-5.2-codex" \
  node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --prompt "<task>"
```

Choose API type or base URL:

```bash
LM_PROXY_API=anthropic \
  node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --prompt "<task>"
```

```bash
LM_PROXY_BASE_URL=http://localhost:4000 \
  node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --prompt "<task>"
```

Equivalent flags:

```bash
node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs \
  --api anthropic --base-url http://localhost:4000 --prompt "<task>"
```

List available models:

```bash
node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --list-models
```

Stream live tokens while it runs:

```bash
node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --stream --prompt "<task>"
```

Pass tool definitions (OpenAI/Anthropic compatible JSON):

```bash
LM_PROXY_TOOLS_FILE=/path/to/tools.json \
  node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --prompt "<task>"
```

```bash
node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs \
  --tools-json '[{"type":"function","function":{"name":"ping","description":"ping tool","parameters":{"type":"object","properties":{}}}}]' \
  --prompt "<task>"
```

Optional tool choice:

```bash
LM_PROXY_TOOL_CHOICE=auto \
  node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --prompt "<task>"
```

Force a specific tool (OpenAI-style JSON):

```bash
LM_PROXY_TOOL_CHOICE='{"type":"function","function":{"name":"ping"}}' \
  node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --prompt "<task>"
```

Tool execution (opt-in via `x-exec` in the tool definition):

```json
[
  {
    "type": "function",
    "function": {
      "name": "ping",
      "description": "Ping tool",
      "parameters": { "type": "object", "properties": {} }
    },
    "x-exec": {
      "cmd": "echo",
      "args": ["pong"]
    }
  }
]
```

Tool step limit:

```bash
LM_PROXY_TOOL_MAX_STEPS=4 \
  node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --prompt "<task>"
```

JSON output to file:

```bash
node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs \
  --prompt "<task>" --json --out /tmp/delegate.json
```

## LM Proxy

LM Proxy runs on maxblack and reports:

```bash
Language Model Proxy server started (http://localhost:4000)
```

The proxy supports:

- OpenAI-compatible API: `http://localhost:4000/openai`
- Anthropic-compatible API: `http://localhost:4000/anthropic`
- Claude Code-compatible API: `http://localhost:4000/anthropic/claude`

Special model ID `vscode-lm-proxy` uses the model selected in VS Code.

The proxy supports streaming and tool usage for compatible clients; this script currently issues prompt-only requests.

## Auth

Authentication is handled by VS Code's configured providers; no extra tokens required for the proxy.
