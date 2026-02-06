---
summary: "How prompt signing lets the agent verify its instructions are authentic"
read_when:
  - You want to understand how OpenClaw defends against prompt injection
  - You need to explain what the verify tool does
  - You are evaluating the security model for a deployment
title: "Prompt Signing"
---

# Prompt signing

Prompt injection can manipulate what an LLM _decides_ to do. If an attacker
injects "disregard previous instructions" into data an agent processes, the
agent may comply. No amount of prompt engineering reliably prevents this.

The core problem: all text is text to the model. There is no way to add
authoritative texture to plain text. System prompts, user messages, and
injected payloads all look the same.

## How signing helps

By signing instructions, OpenClaw creates an explicit trust boundary the agent
can check: **verified instructions** vs. **unsigned text**.

OpenClaw signs the system prompt templates at authoring time using
[sig](https://github.com/disreguard/sig). The agent has a `verify` tool that
cryptographically checks whether its instructions match the developer-signed
originals. If they match, the instructions are authentic. If not, something
has changed.

```
Developer signs:     "Review {{code}} for security issues."
                          |
Agent receives:      "Review {{code}} for security issues."
                          |
Agent calls verify -> gets back the signed original
                          |
Match? -> Instructions are authentic. Proceed.
```

sig signs the _template_ (with placeholders intact), not the interpolated
result. When the agent verifies, it gets back the stored signed content and
can see exactly which parts are fixed instructions and which are dynamic data.

## What it does

- **Detects modification.** If a template has been changed since signing,
  verification fails. The agent knows its instructions may have been tampered
  with.
- **Provides provenance.** Verification returns who signed the template and
  when, giving the agent context about the source of its instructions.
- **Creates an anchor.** The agent has a reliable reference point that exists
  outside the text stream. Injected text cannot make `verify()` return a
  forged result.
- **Verifies message provenance.** Owner messages from authenticated channels
  (WhatsApp, Telegram, Signal, etc.) are signed at ingestion. The agent can
  verify that a message actually came from the owner, not from someone
  impersonating them in a group chat.

## What it does not do

- **It is not a silver bullet.** There is no purely prompt-level solution to
  prompt injection. Signing reinforces a trust boundary but does not
  eliminate the risk.
- **It does not prevent the agent from reading unsigned text.** The agent
  still processes all input. Signing helps it _decide_ how much to trust
  that input.
- **It does not use cryptographic keys (v1).** The current implementation
  uses content hashing (SHA-256). Anyone with write access to `.sig/` could
  re-sign a modified file. This is fine when `.sig/` is read-only to the
  agent (the normal case).

## The verification gate

OpenClaw pairs the verify tool with a **deterministic enforcement gate** in
the tool-call pipeline. When enforcement is enabled, sensitive tools (`exec`,
`write`, `edit`, `apply_patch`, `message`, `gateway`, `sessions_spawn`,
`sessions_send`) are blocked unless the agent has called `verify` in the
current turn.

This gate runs at the orchestrator level, before plugin hooks. No injected
text can bypass it. The agent must verify its instructions before it can take
destructive or externally-visible actions.

Verification is **turn-scoped**: it resets with each new user message. This
prevents stale verification from carrying across turn boundaries where new
potentially-injected content may arrive.

## Defense in depth

Signing is most effective as one layer in a defense-in-depth strategy:

1. **Signed templates** give the agent a trust anchor
2. **The verification gate** enforces that the anchor is checked before
   sensitive actions
3. **Owner-only tools** restrict dangerous capabilities to authenticated
   senders
4. **Untrusted metadata labels** mark external content in the context
5. **SSRF guards** prevent the agent from reaching internal network resources

Each layer is deterministic and orchestrator-controlled. Together they
significantly raise the bar for prompt injection attacks, even against an
attacker who has read the source code.

## Configuration

Prompt signing is available by default (the `verify` tool is always present
for owner senders). The enforcement gate is opt-in:

```json5
{
  agents: {
    defaults: {
      sig: {
        enforceVerification: true, // block gated tools until verify is called
      },
    },
  },
}
```

See [Prompt signing reference](/reference/prompt-signing) for implementation
details and the full configuration surface.

---

_Next: [Agent Runtime](/concepts/agent)_
