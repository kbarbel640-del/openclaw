# Agents

AI agent implementation for Moltbot. Agents are the core intelligence layer that:

- Process user messages and generate responses
- Execute tools (file operations, shell commands, browser control)
- Manage conversation context and session transcripts
- Handle multi-provider failover and auth profile rotation

## Key Files

| File | Purpose |
|------|---------|
| `pi-embedded-runner.ts` | Main agent runner (embedded Pi) |
| `pi-embedded-subscribe.ts` | Streaming subscription handler |
| `pi-embedded-helpers.ts` | Utility functions for agent execution |
| `cli-runner.ts` | CLI-based agent runner (Claude CLI, etc.) |
| `model-selection.ts` | Model selection and routing logic |
| `compaction.ts` | Context window management |

## Directories

| Directory | Purpose |
|-----------|---------|
| `tools/` | Tool implementations (exec, read, write, browser, etc.) |
| `auth-profiles/` | API key and auth profile management |
| `sandbox/` | Docker sandbox for code execution |
| `skills/` | Agent skill loading and management |
| `schema/` | Tool schema utilities |

## Agent Flow

```
User Message -> Dispatcher -> Agent Runner -> LLM Provider
                                  |
                                  v
                            Tool Execution
                                  |
                                  v
                            Response Streaming
```

## Configuration

Agent config in `~/.clawdbot/moltbot.json`:

- `agents.<id>.model` - Default model
- `agents.<id>.tools.allow` - Permitted tools
- `agents.<id>.identity` - Name, avatar, system prompt

## Auth Profiles

API keys stored in `~/.clawdbot/agents/<id>/auth-profiles.json`:

- Supports multiple providers (openai, anthropic, google, etc.)
- Automatic rotation on rate limits
- Cooldown handling

## See Also

- `src/gateway/server-methods/chat.ts` - Chat request handler
- `src/auto-reply/` - Channel auto-reply logic
- `docs/agents/` - User documentation
