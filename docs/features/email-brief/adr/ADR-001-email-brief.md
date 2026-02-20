# ADR-001: Email Brief Extension — Gmail Summary via Telegram

**Status:** Accepted
**Date:** 2026-02-20
**Bounded Context:** Extensions / Gmail Integration

## Context

Users want to get email summaries directly in Telegram using commands like:

- `/email_brief` — today's email summary (default 1d)
- `/email_brief 7d` — last week
- `/email_brief from:user@company.com 3d` — from a specific sender
- `/email_brief urgent` — urgent emails with draft replies

The system runs on Cloud.ru Foundation Models (GLM-4.7, Qwen3-Coder) via `claude-code-proxy`. These models **cannot perform tool use / bash calls** — they only generate text. Therefore, traditional OpenClaw skills (which rely on the LLM invoking CLI tools like `gog`) do not work. The extension must handle all data fetching in TypeScript code and pass only text to the LLM for summarization.

Gmail access is via a **Google Service Account** with domain-wide delegation (no browser OAuth, no `gog` CLI dependency).

### Existing Infrastructure

- **`extensions/ask-agent/`** — Reference extension showing plugin registration, command handling, and response formatting.
- **`src/hooks/gmail.ts` / `src/hooks/gmail-watcher.ts`** — Existing Gmail integration using `gog` CLI + Pub/Sub. Not reusable for our case (depends on `gog` binary).
- **`extensions/llm-task/`** — Shows how to invoke `runEmbeddedPiAgent()` for LLM text generation from an extension.
- **Plugin SDK** — `api.registerCommand()` for slash commands, `ctx.config` for config access, `api.pluginConfig` for plugin-specific settings.

### Reference Prompts

The [cloudru-vm-openclaw-demo](https://github.com/dzhechko/cloudru-vm-openclaw-demo/tree/main/skills) repository contains prompt templates for:

- `email-brief` — multi-provider inbox summary with priority layers
- `email-urgent` — urgency scoring (0-10) with bilingual keyword detection
- `gmail-brief` — Gmail-specific digest with AI summarization

These prompts inform our summarization prompt design.

## Decision

### Architecture: Plugin Extension with Direct Gmail API

Create `extensions/email-brief/` as an OpenClaw plugin extension with this architecture:

```
User (Telegram) → /email_brief [filters] [period]
    → Extension handler (TypeScript)
        → Gmail API (REST, JWT auth via Service Account)
        → Fetch messages → Extract text
        → runEmbeddedPiAgent(prompt + email text, disableTools: true)
        → Format response
    → Reply to user (Telegram markdown)
```

### Key Components

| Component       | Location                                      | Purpose                          |
| --------------- | --------------------------------------------- | -------------------------------- |
| Plugin manifest | `extensions/email-brief/openclaw.plugin.json` | Plugin registration              |
| Entry point     | `extensions/email-brief/index.ts`             | Command handler, orchestration   |
| Gmail client    | `extensions/email-brief/gmail-client.ts`      | JWT auth, Gmail API v1 calls     |
| Arg parser      | `extensions/email-brief/parse-args.ts`        | Parse filters + period from args |
| Summarizer      | `extensions/email-brief/summarize.ts`         | Build prompt, invoke LLM         |
| Tests           | `extensions/email-brief/*.test.ts`            | Unit tests with mocked Gmail API |

### Authentication: Google Service Account + JWT

```
Service Account JSON key → JWT signed with RS256
    → POST https://oauth2.googleapis.com/token
    → Access token (1h TTL, auto-refresh)
    → Gmail API calls with Bearer token
```

- Service Account key path: env `GMAIL_SERVICE_ACCOUNT_KEY_PATH` or inline JSON in `GMAIL_SERVICE_ACCOUNT_KEY`
- Impersonated user email: env `GMAIL_USER_EMAIL` or `config.plugins["email-brief"].userEmail`
- JWT scope: `https://www.googleapis.com/auth/gmail.readonly`
- No external dependencies — JWT signing via `node:crypto` (RSA-SHA256)

### Gmail API Usage

| Endpoint                                     | Purpose             | Key Params                         |
| -------------------------------------------- | ------------------- | ---------------------------------- |
| `GET /gmail/v1/users/{userId}/messages`      | List message IDs    | `q` (search query), `maxResults`   |
| `GET /gmail/v1/users/{userId}/messages/{id}` | Get message content | `format=full` or `format=metadata` |

Gmail search query construction:

- Default: `newer_than:1d in:inbox`
- With period: `newer_than:{period} in:inbox`
- With from: `newer_than:{period} from:{email} in:inbox`
- Urgent: `newer_than:{period} in:inbox is:important OR label:urgent OR subject:(срочно OR urgent OR ASAP)`

### Argument Parsing

```
/email_brief [filters...] [period]

Period: last argument matching /^\d+[hdwm]$/ (hours/days/weeks/months)
         Default: 1d

Filters:
  from:<email>   — filter by sender
  to:<email>     — filter by recipient
  urgent         — urgent/important only
  unread         — unread only (default)
  <free text>    — passed as Gmail search query
```

### LLM Summarization

Use `runEmbeddedPiAgent()` with `disableTools: true`:

- Model: from `config.plugins["email-brief"].model` or gateway default
- Prompt: system instructions (summarization format, language detection, priority tiers) + fetched email content as user message
- Output: Telegram-formatted markdown with priority sections

### Configuration

Plugin-specific config in `openclaw.json`:

```json
{
  "plugins": {
    "email-brief": {
      "userEmail": "user@company.com",
      "maxEmails": 20,
      "model": null,
      "language": "auto"
    }
  }
}
```

Environment variables:

- `GMAIL_SERVICE_ACCOUNT_KEY_PATH` — path to service account JSON key file
- `GMAIL_SERVICE_ACCOUNT_KEY` — inline JSON key (alternative)
- `GMAIL_USER_EMAIL` — impersonated email (alternative to config)

## Consequences

### Positive

- **Works with any LLM** — no tool use required; Cloud.ru FM models only generate text summaries
- **No external binary dependencies** — pure TypeScript + `node:crypto`, no `gog` or `himalaya`
- **Service Account auth** — headless, no browser, works on servers/codespaces
- **Follows existing patterns** — same plugin structure as `ask-agent`, same LLM invocation as `llm-task`
- **Flexible argument parsing** — single command covers all use cases

### Negative

- **Read-only** — cannot send/reply to emails (Service Account readonly scope). Draft creation would require additional scope and implementation.
- **Domain-wide delegation required** — Service Account must be granted delegation in Google Workspace Admin for the target user
- **Token management** — must handle JWT → access token refresh (1h TTL)
- **Message size limits** — large emails must be truncated to fit LLM context window

### Invariants

- Extension MUST NOT require bash tool calls from the LLM
- Extension MUST handle Gmail API errors gracefully (auth failure, rate limits, empty results)
- Extension MUST respect the configured `maxEmails` limit
- Extension MUST work when gateway runs with Cloud.ru FM models
- JWT signing MUST use `node:crypto` only (no npm dependencies)

### Domain Events

- `command:email_brief` — emitted when the command is invoked
- `email_brief:success` — emitted on successful summary delivery
- `email_brief:error` — emitted on failure (auth, API, LLM)

## References

- [Gmail API v1 — Messages](https://developers.google.com/gmail/api/reference/rest/v1/users.messages)
- [Google Service Account — JWT Auth](https://developers.google.com/identity/protocols/oauth2/service-account)
- `extensions/ask-agent/` — reference extension pattern
- `extensions/llm-task/` — reference LLM invocation pattern
- `src/plugins/types.ts` — `OpenClawPluginApi`, `registerCommand`
- `src/agents/pi-embedded-runner/` — `runEmbeddedPiAgent()`
- [cloudru-vm-openclaw-demo/skills](https://github.com/dzhechko/cloudru-vm-openclaw-demo/tree/main/skills) — prompt templates
