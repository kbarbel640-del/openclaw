---
summary: "Architecture and configuration for prompt signing and the verification gate"
read_when:
  - You need to understand the prompt signing implementation
  - You want to configure the verification gate or customize gated tools
  - You are debugging verification failures or signing issues
title: "Prompt Signing Reference"
---

# Prompt signing reference

This document covers the architecture of OpenClaw's prompt signing system:
template signing, the verify tool, message signing, the verification gate,
and session security state.

For the conceptual overview, see [Prompt signing](/concepts/prompt-signing).

## Components

```
Build time:
  Developer signs templates -> .sig/sigs/llm/prompts/*.sig.json

Runtime (per turn):
  User message arrives
    -> resetVerification(sessionKey, turnId)
    -> signMessage() if sender is owner
    -> Agent runs, calls verify tool
    -> setVerified(sessionKey, turnId)
    -> Gated tools now unblocked for this turn
```

### Template files

System prompt sections are stored as text files in `llm/prompts/`. Each file
corresponds to a section of the system prompt (identity, safety, tooling,
etc.) and may contain `{{placeholder}}` tokens for dynamic interpolation.

Templates are signed with [sig](https://github.com/disreguard/sig) and the
signatures are stored in `.sig/sigs/llm/prompts/`. The `.sig/config.json`
configures the template engine (`jinja`) and signing identity (`openclaw`).

**Signing templates:**

```bash
sig sign llm/prompts/*.txt --by openclaw
```

**Checking signature status:**

```bash
sig check
```

### Template loading

`src/agents/prompt-templates.ts` provides synchronous template loading with
in-memory caching:

- `loadTemplate(name)` — load a template file from `llm/prompts/`
- `interpolate(template, data)` — replace `{{placeholder}}` tokens
- `loadAndInterpolate(name, data)` — load and interpolate in one step

### The verify tool

The `verify` tool (`src/agents/tools/sig-verify-tool.ts`) is an owner-only
tool that provides two verification modes:

**Template verification** (default):

- Call `verify` with no arguments to verify all signed templates
- Call `verify` with `file: "identity.txt"` to verify a specific template
- Returns `allVerified`, per-template results with the original signed
  content (placeholders visible), signer identity, and timestamp
- On successful verification, marks the session as verified for the
  current turn

**Message verification:**

- Call `verify` with `message: "<signatureId>"` to verify a signed message
- Returns the original content and provenance metadata if valid
- Signature IDs follow the format `<sessionId>:<channel>:<messageId>`

The tool resolves the project root lazily (on first call) since
`findProjectRoot` is async.

### Message signing

`src/agents/message-signing.ts` signs owner messages at ingestion time using
the sig `ContentStore`. Each session gets its own in-memory store that
persists across turns within the session.

When `senderIsOwner` is true and a `senderId` is available, the runner signs
the inbound message with an identity string built from the sender info
(e.g., `owner:+1234567890:whatsapp`).

Message signature IDs are namespaced as `<sessionId>:<channel>:<messageId>`
to avoid collisions across channels.

### Session security state

`src/agents/session-security-state.ts` tracks per-session, per-turn
verification status.

- `resetVerification(sessionId, turnId)` — called at the start of each turn;
  sets status to `unverified`
- `setVerified(sessionId, turnId)` — called by the verify tool after
  successful template verification
- `isVerified(sessionId, turnId)` — checked by the verification gate

State is in-memory and turn-scoped. A new user message generates a new
`turnId` (UUID), which invalidates the previous turn's verification.

### The verification gate

`src/agents/sig-verification-gate.ts` implements the deterministic check that
runs in the `before_tool_call` hook pipeline.

**Execution order in `pi-tools.before-tool-call.ts`:**

1. **Verification gate** (runs first, cannot be overridden)
2. Plugin `before_tool_call` hooks (run second)

The gate checks:

1. Is enforcement enabled? (`agents.defaults.sig.enforceVerification`)
2. Is this a gated tool?
3. Is the session verified for this turn?

If the tool is gated and the session is not verified, the gate returns a
block with an actionable message instructing the agent to call `verify`
first.

**Default gated tools:**

`exec`, `write`, `edit`, `apply_patch`, `message`, `gateway`,
`sessions_spawn`, `sessions_send`

## Configuration

```json5
{
  agents: {
    defaults: {
      sig: {
        // Enable the verification gate (default: false)
        enforceVerification: true,

        // Override the default gated tool set (optional)
        gatedTools: ["exec", "write", "edit", "message"],
      },
    },
  },
}
```

| Key                                       | Type     | Default     | Description                               |
| ----------------------------------------- | -------- | ----------- | ----------------------------------------- |
| `agents.defaults.sig.enforceVerification` | boolean  | `false`     | Block gated tools until verify is called  |
| `agents.defaults.sig.gatedTools`          | string[] | (see above) | Override which tools require verification |

## Integration with tool policy

The `verify` tool is registered in `OWNER_ONLY_TOOL_NAMES`. Non-owner
senders do not see the tool and are not subject to the verification gate
(they already have restricted tool access via `applyOwnerOnlyToolPolicy`).

The tool is added to the tools array in `createOpenClawCodingTools` before
the owner-only policy is applied, so it is available to owner senders
regardless of other tool policy filters.

## Runner integration

In `src/agents/pi-embedded-runner/run/attempt.ts`, at the start of each
embedded run:

1. A `turnId` is generated (`crypto.randomUUID()`)
2. Verification is reset for the session
3. A `MessageSigningContext` is created or retrieved for the session
4. If the sender is the owner, the inbound message is signed
5. `messageSigning` and `turnId` are passed to `createOpenClawCodingTools`,
   which threads them to the verify tool and the hook context

## File map

| File                                           | Role                                    |
| ---------------------------------------------- | --------------------------------------- |
| `llm/prompts/*.txt`                            | Signed system prompt templates          |
| `.sig/config.json`                             | sig project config                      |
| `.sig/sigs/llm/prompts/`                       | Template signatures (auto-generated)    |
| `src/agents/prompt-templates.ts`               | Template loading and interpolation      |
| `src/agents/tools/sig-verify-tool.ts`          | The verify tool                         |
| `src/agents/message-signing.ts`                | Owner message signing                   |
| `src/agents/session-security-state.ts`         | Turn-scoped verification state          |
| `src/agents/sig-verification-gate.ts`          | The deterministic gate                  |
| `src/agents/pi-tools.before-tool-call.ts`      | Gate insertion point                    |
| `src/agents/pi-tools.ts`                       | Tool registration and context threading |
| `src/agents/tool-policy.ts`                    | Owner-only tool set                     |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Runner integration                      |

## Security model

sig v1 uses content hashing (SHA-256), not cryptographic signatures with
keys. This means:

- **Modification detection:** if a template changes, verification fails
- **Provenance:** who signed it and when
- **Not forgery-resistant:** anyone with write access to `.sig/` can re-sign

For the standard deployment (developer signs at authoring time, agent
verifies at runtime, `.sig/` is read-only to the agent), content hashing
is sufficient. The agent cannot write to `.sig/` and cannot forge
verification results.

The verification gate is orchestrator-level and deterministic. It cannot be
bypassed by prompt injection because it runs in the tool-call pipeline code,
not in the prompt.
