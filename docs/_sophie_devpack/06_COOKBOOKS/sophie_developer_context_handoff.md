# SOPHIE / MOLTBOT — DEVELOPER CONTEXT & HANDOFF (CANONICAL)

**Version:** 1.0  
**Date:** 2026-02-05  
**Owner:** Founder (Andrew)  
**Status:** Binding context unless superseded by higher-authority contracts or tests

---

## PURPOSE

This document captures **all critical context, decisions, goals, constraints, and philosophy** for the Sophie project so that **any future Claude Code session or human developer** can continue work **without relying on prior chat history**.

This is a **session-independent memory artifact**.

---

## 1. PROJECT OVERVIEW

**Sophie** is a customized build of **Moltbot / Clawdbot / OpenClaw**, designed as a **back-office AI assistant for a commercial real estate brokerage**.

She is **not a chatbot**.
She is an **agentic system with constrained authority**.

### Primary Business Objective

> **Increase listings and deal flow while reducing backend workload and operational drag.**

### Core Use Cases

- Prospect research and tracking
- Deal intake and organization
- Note capture (calls, meetings, Supernote)
- Follow-up reminders and scheduling
- Drafting (emails, outreach, internal docs)
- Marketing analysis and campaign planning
- Compliance support (file organization, audit readiness)

---

## 2. NON-NEGOTIABLE PHILOSOPHY

1. **Fail-Closed by Default**
   - Undefined behavior = denied
   - No silent fallbacks
   - No automatic external side effects

2. **Evidence Over Vibes**
   - Contracts + tests > prose
   - Repo state > chat memory
   - Golden fixtures define truth

3. **Human-in-the-Loop First**
   - Sophie proposes
   - Human approves
   - Sophie executes

4. **Autonomy Is Earned, Not Assumed**
   - Start conservative
   - Expand authority only after validation

---

## 3. CURRENT REPO STATE (AS OF HANDOFF)

**Repository Root:** `~/Documents/clawdbot`

### Bootstrap Commit

```
commit 81166aace
chore(sophie): add devpack + loop scaffolding + claude context
```

### What Has Been Done

- Canonical governance devpack created at:
  ```
  docs/_sophie_devpack/
  ```
- Authority hierarchy frozen
- Contracts defined (tools, permissions, interfaces)
- Acceptance tests written (GWT + golden fixtures)
- Security and abuse models documented
- Prompt stack contract defined
- Model routing and context policy defined
- Safe Ralph loop scaffolding created
- No product code implemented yet

### What Has NOT Been Done (By Design)

- ❌ No Kimi provider implementation
- ❌ No prompt files in `src/prompts/`
- ❌ No tool implementations
- ❌ No channel enablement (e.g., Telegram)
- ❌ No database writes
- ❌ No external side effects

---

## 4. CANONICAL DOCUMENTATION LOCATION

All authoritative documents live under:

```
docs/_sophie_devpack/
```

### Authority Order

1. **Contracts** (`02_CONTRACTS/`, `05_PROMPTS/`, `07_OPERATIONS/`)
2. **Acceptance Tests** (`03_TESTS/`)
3. **Security & Abuse** (`04_SECURITY/`)
4. **Cookbooks / PRDs** (`06_COOKBOOKS/`)
5. **Archive / WIP** (`90_ARCHIVE/`)

If documents conflict, **higher authority wins**.

---

## 5. SOPHIE AUTONOMY MODEL

### Default Autonomy Level

- **Read:** allowed
- **Draft:** allowed
- **Propose actions:** allowed
- **Execute external actions:** requires approval

### Explicit Rules

- Never send outbound communications without approval
- Never write to databases without approval
- Never execute shell/code without approval
- Never store secrets in plaintext

(See: `tool_authority_matrix.md` and `permissions_matrix.md`)

---

## 6. MEMORY MODEL (INTENT)

### Memory Types Sophie Is Allowed to Persist

- Notes (calls, meetings, Supernote-derived files)
- Companies and contacts actively being prospected or worked
- Active deals and projects
- Founder schedules and follow-ups
- Explicitly requested memories
- Successful actions and tweaks

### Memory Types Restricted or Dangerous

- Secrets / credentials
- Sensitive personal data unless explicitly approved
- Implicit preference learning without consent

**Memory policy to follow:**
See `MEMORY_AND_RETENTION_POLICY.md` (to be implemented).

---

## 7. MODEL STRATEGY

### Primary Model

- **Kimi (Moonshot)** as primary reasoning model
- Large context, non-streaming for external channels

### Local Models

- Allowed for lightweight tasks only
- Must not constrain global context policies

### Model Rules

- No silent fallback between models
- All context window rules enforced per model

(See: `model_routing_and_context_policy.md`)

---

## 8. PROMPT ARCHITECTURE

### Prompt Stack (Immutable Order)

1. Base System Prompt (hidden, immutable)
2. Agent Role Prompt (versioned)
3. Channel Policy Prompt
4. Task Instruction (ephemeral)
5. User Input

- Lower layers cannot be overridden
- Prompt injection attempts → refusal

(See: `prompt_stack_contract.md`)

---

## 9. SECURITY POSTURE

### Threats Explicitly Considered

- Prompt injection via emails/web/pages
- Token leakage in logs
- Tool escalation
- Malicious plugins / supply chain
- Misconfigured localhost trust

### Core Security Rules

- Treat all external content as untrusted
- Hash prompts in logs; never store raw
- Env vars only for secrets
- Human approval gates mandatory

(See: `04_SECURITY/` docs)

---

## 10. DEVELOPMENT PROCESS RULES

- One task per PR
- Tests and contracts updated with code
- Lint + tests must pass before merge
- Ralph loop must stop on failure

### Ralph Loop

- Script: `scripts/ralph-loop.sh`
- Reads from `TODO_QUEUE.md`
- Validates only (no auto-exec yet)

---

## 11. NEXT IMPLEMENTATION PHASE

**Start with READY tasks in:**

```
docs/_sophie_devpack/TODO_QUEUE.md
```

Recommended order:
1. Foundation doc refinements (if any)
2. Logging + redaction scaffolding
3. Kimi provider implementation
4. Prompt loader implementation
5. Tool approval gate framework

---

## 12. CHANGE CONTROL

- Contracts require explicit version bump
- Acceptance tests must be updated with behavior changes
- No breaking changes without founder approval

---

## 13. FINAL NOTE TO FUTURE CLAUDE SESSIONS

You are **not here to invent requirements**.
You are here to **execute against contracts and tests**.

If something is ambiguous:
- Stop
- Ask
- Propose options
- Wait for approval

**Sophie must never become an autonomous liability machine.**

---

**END OF CANONICAL HANDOFF DOCUMENT**

