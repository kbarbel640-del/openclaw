# Luna for SME — Commercial Product Plan

## Context

We're packaging the Luna system as a commercial product for SMEs on Mac. Customers get a pre-configured Mac Mini OR install via DMG. They interact **only through the Luna Dashboard** — never the CLI or config files. The dashboard needs to go from read-only monitoring to a full management interface.

## What We're Building

**Product**: "Luna for SME" — AI agent workforce for small businesses
**Delivery**: DMG installer + optional pre-configured Mac Mini
**Customer experience**: Open browser → setup wizard → configure agents → start working

---

## Phase 1: MVP (6 weeks) — Minimum to Start Selling

### Week 1-2: Config Write Layer + Provider Setup

**New file: `luna-dashboard/lib/configWriter.ts`** — Safe config mutation engine

- Read/write `~/.openclaw/openclaw.json` with atomic writes (write to .tmp, rename)
- Auto-backup before every write (keep last 5 backups)
- Config validation before write (reuse types from `src/config/types.openclaw.ts`)
- File locking to prevent concurrent corruption
- Never expose full API keys in responses (mask as `sk-...xxxx`)

**New API routes:**

```
POST /api/config/providers          — add LLM provider
PUT  /api/config/providers/[id]     — update provider
DELETE /api/config/providers/[id]   — remove provider
POST /api/config/providers/[id]/test — test connection, list models
GET  /api/config/providers/[id]/models — discover available models
```

**New page: `/providers`**

- Cards for each configured provider (Ollama, OpenAI, Anthropic, etc.)
- Add provider form: type dropdown → URL/API key → Test Connection → Save
- Model discovery list per provider
- Writes to `models.providers` + `auth.profiles` in config

**Key reuse:**

- `luna-dashboard/lib/gatewayRpc.ts` — config read pattern
- `src/config/types.models.ts` — ModelProviderConfig type
- `src/config/types.auth.ts` — AuthProfileConfig type

---

### Week 2-3: Agent CRUD + Templates

**New API routes:**

```
GET  /api/config/agents             — list agents from config
POST /api/config/agents             — create agent (from template or custom)
PUT  /api/config/agents/[id]        — update agent config
DELETE /api/config/agents/[id]      — delete agent (block "main"/Luna)
GET  /api/config/agents/templates   — list 5 SME templates
```

**Create agent writes:**

1. Append to `agents.list[]` in openclaw.json
2. Create `~/.openclaw/agents/{id}/` directory
3. Write `IDENTITY.md` from template
4. Create `sessions/` subdirectory
5. Gateway picks up on next session start (config-reload classifies as "noop")

**New page: `/agents` (enhance existing)**

- Agent grid with status badges (reuse existing `AgentCard.tsx`)
- "Create Agent" button → opens dialog
- Template picker: 5 SME cards to choose from
- Edit button per agent → model, role, skills, identity
- Delete button (disabled for Luna)
- Luna locked — always shows, cannot delete

**5 SME Agent Templates** (stored in `luna-dashboard/lib/agentTemplates.ts`):

| Template           | Icon | Role                                                   |
| ------------------ | ---- | ------------------------------------------------------ |
| Customer Support   | 🎧   | Handle inquiries, resolve issues, manage tickets       |
| Sales Assistant    | 💼   | Qualify leads, draft proposals, manage follow-ups      |
| Operations Manager | ⚙️   | Monitor workflows, track inventory, optimize processes |
| HR & Admin         | 📋   | Draft documents, manage schedules, handle onboarding   |
| Social Media       | 📱   | Create content, schedule posts, analyze engagement     |

**Key reuse:**

- `luna-dashboard/lib/agents.ts` — existing filesystem agent reading
- `src/config/types.agents.ts` — AgentConfig type definition
- `luna-dashboard/components/AgentCard.tsx` — extend with edit/delete buttons

---

### Week 3-4: First-Time Setup Wizard

**New page: `/setup` (dedicated layout, no sidebar)**

| Step               | Content                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| 1. Welcome         | Product intro, "Let's get started"                                            |
| 2. LLM Provider    | Choose Ollama/OpenAI/Anthropic → enter URL or key → test → pick default model |
| 3. Agent Templates | Toggle which SME templates to deploy (all on by default)                      |
| 4. Channels        | Optional: connect Telegram/WhatsApp/Slack (skippable)                         |
| 5. Brain           | Confirm Brain MCP status, create workspace                                    |
| 6. Complete        | Summary → "Open Dashboard"                                                    |

**Detection:** Check if `models.providers` is empty → redirect to `/setup`
**Middleware:** `luna-dashboard/middleware.ts` handles redirect logic
**Completion:** Sets `wizard.lastRunAt` in config

---

### Week 4-5: Settings + Navigation Restructure

**Settings enhancement:**

- Gateway status (port, bind, restart button)
- Brain MCP connection status + URL config
- System diagnostics

**New navigation for SME** (simplify from 12 items to 7):

```
Dashboard  → /overview
Agents     → /agents        (NEW)
Skills     → /skills        (Phase 2, hidden for now)
Providers  → /providers     (NEW)
Channels   → /channels
Health     → /health
Settings   → /settings
```

Power-user pages (OMS, Governance, Memory Audit, etc.) behind "Show Advanced" toggle.

---

### Week 5-6: DMG Packaging

**New scripts:**

- `scripts/package-sme-installer.sh` — Produces Luna-for-SME.dmg
- `scripts/sme-first-run.sh` — First-run setup (install Node.js, openclaw CLI, Brain MCP)
- LaunchAgent plists for: gateway, Brain MCP, dashboard

**First-run flow:**

1. DMG installs OpenClaw.app → Applications
2. First launch: `sme-first-run.sh` installs dependencies
3. Creates `~/.openclaw/` directory structure
4. Installs + starts gateway LaunchAgent
5. Installs + starts Brain MCP LaunchAgent
6. Starts dashboard on :4000
7. Opens browser to `http://localhost:4000/setup`

---

## Phase 2: Polish + Tier 2 Features (Weeks 7-10)

### Skills/SOP Management UI

**New page: `/skills`**

- List all skills with status (active, disabled, missing requirements)
- **Form wizard** (beginners): name → description → instructions → triggers → preview → save
  - Generates valid `SKILL.md` with YAML frontmatter
  - Writes to `~/.openclaw/skills/{name}/SKILL.md`
- **Markdown editor** (power users): raw SKILL.md editor with syntax highlighting + live preview
- Enable/disable per agent (writes to agent's `skills[]` array in config)
- Delete skill (archive to `~/.openclaw/skills/.archived/`)

**New API routes:**

```
GET/POST    /api/config/skills          — list/create
GET/PUT/DEL /api/config/skills/[name]   — read/update/delete
PUT         /api/config/skills/[name]/agents — toggle per agent
```

### Cron Scheduler UI

**New section in `/settings/cron`**

- List scheduled jobs with next-run time, last-run status
- Create job: pick agent → set cron expression (with human-readable presets: hourly, daily, weekly) → set message/task → save
- Enable/disable toggle per job
- Writes to `cron.jobs[]` in config

**New API routes:**

```
GET/POST    /api/config/cron            — list/create jobs
PUT/DELETE  /api/config/cron/[id]       — update/delete job
```

### Tool Allowlists (in Agent Edit)

Add to agent edit dialog:

- "Tools" tab → checkboxes for available tools (MCP tools, built-in tools)
- Allow/block list toggle per tool
- Writes to `agents.list[].tools.allow` / `agents.list[].tools.block`

### Channel Setup UI

- Telegram: bot token input + test
- WhatsApp: QR code pairing
- Slack: OAuth flow

### Agent Chat History

- Session transcript viewer per agent (`~/.openclaw/agents/{id}/sessions/*.jsonl`)
- Search across sessions
- Export conversation as text/PDF

### Hooks/Webhooks UI

**New section in `/settings/hooks`**

- List configured hooks with event type and target
- Create hook: event dropdown → URL/script → test → save
- Writes to `hooks[]` in config

---

## Phase 3: Hardware (Weeks 11-14)

### Pre-configured Mac Mini

- Provisioning script: installs everything, deploys templates
- Customer opens browser → sees setup wizard (personalize step only)
- Network/WiFi setup UI in dashboard
- Remote management option (Tailscale)

---

## Phase 4: Premium Features (Post-launch)

- Cloud sync for Brain memory
- Multi-user auth with roles (admin, viewer, operator)
- Usage analytics + billing dashboard
- Marketplace for community skills/templates
- Remote access via Tailscale auto-setup

---

## Architecture Diagram

```
Customer's Mac
┌─────────────────────────────────────────────────┐
│                                                 │
│  Browser → Luna Dashboard (:4000)               │
│              │                                  │
│              ├─ /api/config/* → configWriter.ts  │
│              │                  ↓               │
│              │     ~/.openclaw/openclaw.json     │
│              │                  ↓ (file watch)  │
│              ├─ WebSocket → Gateway (:18789)    │
│              │               ↓                  │
│              │         Agent Runtime            │
│              │          ├─ Luna (locked)         │
│              │          ├─ Customer Support      │
│              │          ├─ Sales Assistant       │
│              │          └─ ...                   │
│              │               ↓                  │
│              │         Brain MCP (:8081)         │
│              │         (local vector DB)         │
│              │               ↓                  │
│              └─ Channels (Telegram, WhatsApp...) │
│                                                 │
│  LLM: Customer's Ollama / OpenAI / Anthropic    │
└─────────────────────────────────────────────────┘
```

---

## Desktop App vs Web Dashboard — Recommendation: Stay Web

**Recommendation: Web dashboard (Next.js) — no desktop app for MVP or near-term.**

| Factor         | Web Dashboard                     | Desktop App (Electron/Tauri)         |
| -------------- | --------------------------------- | ------------------------------------ |
| Dev effort     | Already built, extend it          | 3-6 weeks new shell + packaging      |
| Updates        | Deploy new build, refresh browser | App Store review OR custom updater   |
| Cross-platform | Works on any Mac browser          | Need to build/sign/notarize per arch |
| Customer UX    | Bookmark `localhost:4000`         | Native .app in Dock                  |
| Offline        | Works (all local)                 | Works (all local)                    |
| System access  | Via gateway API (already built)   | Same — still calls gateway API       |

**Why web wins for SME:**

- Customers already have a browser. Zero extra install friction.
- The gateway + Brain + dashboard all run locally — there's no cloud dependency. The "web" dashboard is actually a local app.
- Desktop wrapper adds build/packaging/signing complexity with no functional benefit (we're not using native APIs — no menubar, no notifications, no file system access beyond what the gateway already provides).
- The existing macOS app (`OpenClaw.app`) already handles the native menubar/LaunchAgent role. Adding a second native app creates confusion.

**Future option**: If customers demand a Dock icon, wrap the dashboard in a lightweight Tauri shell (Phase 4). This is <1 week since the web UI is already complete. Not worth doing now.

---

## Full OpenClaw Feature Inventory for Dashboard

These are ALL features in the OpenClaw config system that need dashboard exposure, organized by priority.

### Tier 1: Critical for MVP (included in Phase 1)

| Feature                | Config Location                       | Dashboard UI                            |
| ---------------------- | ------------------------------------- | --------------------------------------- |
| **LLM Providers**      | `models.providers[]`                  | `/providers` — add/edit/delete/test     |
| **Model Selection**    | `models.default`, agent `model`       | Provider page + agent edit              |
| **Agent CRUD**         | `agents.list[]` + filesystem          | `/agents` — create/edit/delete          |
| **Agent Identity**     | `~/.openclaw/agents/{id}/IDENTITY.md` | Agent edit dialog — textarea            |
| **Agent Routing**      | `agents.list[].bindings[]`            | Agent edit — channel assignment         |
| **Allowlists/Pairing** | `agents.list[].allowlist`, `pairing`  | Agent edit — who can talk to this agent |
| **Auth Profiles**      | `auth.profiles[]`                     | `/providers` — key management (masked)  |
| **Gateway Status**     | gateway health endpoint               | `/settings` — status + restart          |

### Tier 2: Important for Phase 2

| Feature                | Config Location                      | Dashboard UI                                      |
| ---------------------- | ------------------------------------ | ------------------------------------------------- |
| **Skills/SOPs**        | `~/.openclaw/skills/{name}/SKILL.md` | `/skills` — form wizard + editor                  |
| **Cron Scheduler**     | `cron.jobs[]` in config              | `/settings/cron` — schedule recurring agent tasks |
| **Heartbeat Config**   | `heartbeat` in config                | `/settings` — uptime monitoring interval          |
| **Session Management** | `~/.openclaw/agents/{id}/sessions/`  | `/agents/{id}/sessions` — view transcripts        |
| **Tool Allowlists**    | `agents.list[].tools.allow/block`    | Agent edit — which tools each agent can use       |
| **Channel Setup**      | channel-specific config sections     | `/channels` — Telegram/WhatsApp/Slack             |
| **Memory/Brain**       | Brain MCP workspaces                 | `/brain` — view memories, manage workspaces       |
| **Hooks/Webhooks**     | `hooks[]` in config                  | `/settings/hooks` — event triggers                |
| **Task Lists**         | OMS task system                      | `/tasks` — view/manage agent task queues          |

### Tier 3: Advanced (Phase 3-4, behind "Show Advanced")

| Feature                  | Config Location               | Dashboard UI                               |
| ------------------------ | ----------------------------- | ------------------------------------------ |
| **Sandbox Config**       | `sandbox` settings            | Advanced settings — code execution sandbox |
| **Compaction/Pruning**   | `compaction` settings         | Advanced — conversation memory management  |
| **Media Models**         | `media.models` config         | Advanced — image/audio model config        |
| **System Prompt Editor** | agent system prompt templates | Advanced — raw prompt editing              |
| **Plugin Management**    | `extensions/` directory       | Advanced — install/enable/disable plugins  |
| **Subagent Policies**    | agent spawn/delegation rules  | Advanced — multi-agent orchestration       |
| **Governance Rules**     | OMS governance config         | Advanced — approval workflows              |
| **Auto-reply Pipeline**  | `autoReply` config            | Advanced — response filtering/routing      |
| **Diagnostics**          | `openclaw doctor` results     | `/health` — system health checks           |
| **Log Viewer**           | gateway + agent logs          | `/health/logs` — real-time log tail        |
| **Network/Proxy**        | proxy, bind, port settings    | Advanced settings                          |
| **Rate Limiting**        | per-provider rate limits      | Advanced — API usage controls              |

### What Customers Should NEVER See

These stay CLI/config-only — too dangerous or irrelevant for SME dashboard:

- Raw `openclaw.json` editor (use structured forms instead)
- Gateway binary management / LaunchAgent plists
- Node.js/runtime configuration
- Git operations / version control
- Developer debugging tools
- Internal agent session IDs / raw JSONL logs
- Encryption keys / raw auth tokens

### Impact on Phase Plan

- **Phase 1 already covers Tier 1** ✅
- **Phase 2 needs expansion**: Add cron UI, hooks UI, tool allowlists to agent edit, session viewer
- **Tier 3 goes behind "Show Advanced" toggle** — available but not in the default SME navigation

---

## Key Technical Decisions

1. **Web dashboard, not desktop app** — Browser-based UI at localhost:4000; no Electron/Tauri wrapper needed (gateway already handles native concerns via macOS app)
2. **Config writes are safe** — gateway's `config-reload.ts` classifies agent/model/skill changes as "noop" (picked up on next session start, no restart needed)
3. **API keys stored separately** — in `auth-profiles.json`, never in openclaw.json; dashboard masks keys in responses
4. **Luna is immutable** — "main" agent cannot be deleted through dashboard API
5. **Templates live in code** — not on disk; `luna-dashboard/lib/agentTemplates.ts` defines the 5 SME templates
6. **Skills are filesystem-based** — dashboard writes SKILL.md files directly; gateway's skill watcher auto-reloads
7. **34 features identified, 3 tiers** — Tier 1 in MVP, Tier 2 in Phase 2, Tier 3 behind "Show Advanced" toggle
8. **Cron/hooks/tools in Phase 2** — not MVP-critical but important for stickiness

## Critical Files to Modify

| File                                       | Change                                    |
| ------------------------------------------ | ----------------------------------------- |
| `luna-dashboard/lib/configWriter.ts`       | **NEW** — config read/write/backup engine |
| `luna-dashboard/lib/agentTemplates.ts`     | **NEW** — 5 SME agent templates           |
| `luna-dashboard/lib/skillWriter.ts`        | **NEW** (Phase 2) — skill CRUD            |
| `luna-dashboard/app/api/config/**`         | **NEW** — all config write API routes     |
| `luna-dashboard/app/providers/page.tsx`    | **NEW** — LLM provider management         |
| `luna-dashboard/app/agents/page.tsx`       | **MODIFY** — add CRUD UI                  |
| `luna-dashboard/app/setup/**`              | **NEW** — first-time wizard               |
| `luna-dashboard/app/skills/page.tsx`       | **NEW** (Phase 2) — skill management      |
| `luna-dashboard/components/Navigation.tsx` | **MODIFY** — restructure for SME          |
| `luna-dashboard/components/AgentCard.tsx`  | **MODIFY** — add edit/delete buttons      |
| `luna-dashboard/middleware.ts`             | **MODIFY** — setup wizard redirect        |
| `luna-dashboard/app/settings/page.tsx`     | **MODIFY** — enhance settings             |
| `scripts/package-sme-installer.sh`         | **NEW** — DMG packaging                   |

## Verification

After each week:

1. Fresh `~/.openclaw/` directory → dashboard redirects to `/setup`
2. Complete wizard → providers + agents created in config
3. Create agent from template → appears in dashboard + filesystem
4. Edit agent model → config updated, gateway picks up
5. Delete agent → removed from config + archived on disk
6. Add OpenAI provider → test connection succeeds → models listed
7. Full DMG install on clean Mac → wizard → working agents
