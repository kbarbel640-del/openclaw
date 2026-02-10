# Local LLM Router — Execution Plan

> **Branch**: `claude/local-llm-router-vBKiB`
> **Goal**: Personal AI PA + coding agent with local LLM routing, multi-agent topology, self-improving error analysis
> **Stack**: Pi Agent Framework + Ollama (local) + Claude API (cloud) + TypeScript

---

## Architecture Summary

```
Input (Telegram / Terminal / Email IMAP)
  → Router (local Qwen 3B via Pi + Ollama — classifies intent)
  → Task Queue (SQLite)
  → Agents (each a Pi AgentSession with scoped tools):
      - Comms: email, drafts, messaging
      - Browser: Playwright, search, scraping, purchases
      - Coder: Pi built-in tools (read/edit/write/bash), git, deploy
      - Monitor: IMAP IDLE, cron, healthcheck, always-on
  → Persistence:
      - Sessions: Pi SessionManager (JSONL)
      - Memory: MD files (MEMORY.md + daily logs + pre-compaction flush)
      - Audit: structured append-only log
      - Error journal: captures all failures for daily analysis
  → Self-Improvement:
      - Daily analysis via expensive cloud model
      - Proposes patches to skills/config/routes
      - User approves via Telegram → auto-applied + git committed
```

---

## Extracted from OpenClaw (copy/adapt)

| Module | Source File | Effort |
|--------|------------|--------|
| Model selection + aliases | src/agents/model-selection.ts | Copy + retype |
| Model failover wrapper | src/agents/model-fallback.ts | Copy + strip auth |
| Context window guard | src/agents/context-window-guard.ts | Verbatim |
| Workspace bootstrap (MD loading) | src/agents/workspace.ts | Copy + simplify |
| Memory flush thresholds | src/auto-reply/reply/memory-flush.ts | Verbatim |
| Skill loading | Pi's loadSkillsFromDir() | Free via Pi |
| Session persistence | Pi's SessionManager | Free via Pi |
| System prompt pattern | src/agents/system-prompt.ts | Pattern only |

## Built New

| Module | Purpose |
|--------|---------|
| Router classifier | Local LLM classifies intent → agent + model |
| Task queue | SQLite job queue between router and agents |
| Agent topology | 4 fixed agents with scoped tools |
| Browser tool | Playwright + stealth |
| Email tool | imapflow + nodemailer |
| Search tool | SearXNG |
| Vault | Encrypted credential store |
| Telegram channel | grammY + approval UX |
| Email channel | IMAP IDLE listener |
| Cron scheduler | Recurring tasks |
| Error capture | Hooks on every execution point |
| Error journal | Structured JSONL failure log |
| Daily analysis | Cloud model analyses errors, proposes fixes |
| Proposal system | Diffs to skills/config, user approves via Telegram |

---

## Execution Steps

### Step 1: Scaffold Project
- Create branch
- Init TypeScript project (package.json, tsconfig.json)
- Install Pi packages (@mariozechner/pi-agent-core, pi-ai, pi-coding-agent)
- Install deps (grammY, playwright, imapflow, nodemailer, better-sqlite3)
- Create directory structure
- Create config MD files (IDENTITY.md, USER.md, TOOLS.md)
- Create models.json (Ollama local + Anthropic cloud)
- Verify Pi AgentSession works with a hello-world test

### Step 2: Extract OpenClaw Modules
- Copy + adapt model-selection.ts (parseModelRef, alias resolution)
- Copy + adapt model-fallback.ts (runWithModelFallback wrapper)
- Copy context-window-guard.ts (resolveContextWindowInfo)
- Copy + simplify workspace.ts (MD bootstrap loading)
- Copy memory-flush.ts (shouldRunMemoryFlush threshold)
- Create our own types to replace OpenClawConfig

### Step 3: Build Router + Classifier
- Create classifier.ts — Pi session with Qwen 3B via Ollama
- Structured output: { intent, confidence, complexity, tools_needed, recommended_model }
- Create routes.json config format
- Create rules.ts — match classification to route
- Create dispatcher.ts — send task to correct agent
- Confidence threshold: below X → escalate to cloud for re-classification

### Step 4: Build Agent System
- Create base-agent.ts — wraps Pi AgentSession
  - Receives task from queue
  - Creates session with scoped tools only
  - Calls model (local or cloud per route)
  - Returns result + writes to audit log
- Create agents.json config (tool scoping, model assignment)
- Create task-queue.ts (SQLite: pending/running/done/failed)
- Implement 4 agents:
  - Comms agent (email + draft tools)
  - Browser agent (Playwright + search tools)
  - Coder agent (Pi built-in tools + git + deploy)
  - Monitor agent (always-on, IMAP IDLE + cron)

### Step 5: Build Tools
- browser.ts — Playwright + stealth plugin, screenshot capture
- email.ts — imapflow (read/monitor) + nodemailer (send)
- search.ts — SearXNG HTTP API
- vault.ts — encrypted credential store (macOS Keychain or AES JSON)
- Register all via Pi's AgentTool interface

### Step 6: Build Channels
- terminal.ts — CLI input/output (basic, for calibration)
- telegram.ts — grammY bot
  - Route messages to classifier
  - Inline buttons for approvals ([Approve] [Reject] [Modify])
  - Screenshot attachments for purchase confirmation
  - Daily analysis summary messages
- email-channel.ts — IMAP IDLE → classifier (auto-categorise incoming)

### Step 7: Build Persistence
- Memory: MEMORY.md + memory/YYYY-MM-DD.md loading
- Pre-compaction flush (extracted logic)
- Audit log: structured JSONL, every tool execution
- Session storage via Pi SessionManager (free)

### Step 8: Build Error System + Self-Improvement
- Error capture hooks on every agent (tool failure, rejection, correction, timeout)
- Error journal (errors/journal.jsonl)
- Screenshot capture on browser errors
- Daily analysis agent (cron-triggered, cloud model)
  - Reads journal + previous reports + current skills/config
  - Writes analysis report (errors/analysis/YYYY-MM-DD.md)
  - Generates proposals (errors/proposals/pending/fix-NNN.md)
- Proposal application (diffs to skills/config + git commit)
- Telegram approval UX for proposals

### Step 9: Build Skills
- Skill directory structure (personal / coding / system)
- Agent-scoped skill filtering (browser agent sees browser skills only)
- Initial skills:
  - personal/tesco-order
  - personal/amazon-return
  - personal/flight-booking
  - coding/deploy-app
  - coding/review-pr
  - system/web-search
  - system/email-draft
  - system/summarize

### Step 10: Wire + Test + Harden
- End-to-end flow: Telegram → classify → route → execute → respond
- Approval flow testing (purchase with screenshot)
- Error capture → journal → analysis → proposal cycle
- Failover testing (local model down → cloud)
- Cron scheduling (recurring tasks)
- Edge cases (network down, model timeout, Tesco layout change)
