# Mission Control — Internal Agent Dashboard

**Purpose:** Visual dashboard for managing DBH Ventures AI agents
**Status:** Specification
**Date:** 2026-01-30

---

## Overview

A web-based dashboard for Steve (orchestrator) to manage persistent sub-agents. Provides visibility into agent status, task queues, outputs, and role documentation.

---

## Core Features

### 1. Agent Registry

Left sidebar showing all registered agents:

```
┌─────────────────────────────┐
│ AGENTS                   12 │
├─────────────────────────────┤
│ 🔍 Scout      ● WORKING     │
│    Research Agent           │
│                             │
│ 💻 Builder    ○ STANDBY     │
│    Development Agent        │
│                             │
│ 📝 Scribe     ● WORKING     │
│    Content Writer           │
│                             │
│ 📊 Analyst    ○ STANDBY     │
│    Data/Financial           │
│                             │
│ 🎨 Canvas     ○ STANDBY     │
│    Design Agent             │
│                             │
│ 🔒 Sentinel   ● WORKING     │
│    Security/QA              │
└─────────────────────────────┘
```

**Agent properties:**
- Name (emoji + title)
- Role/specialty
- Status: WORKING | STANDBY | ERROR
- Type badge: SPC (Specialist) | LEAD | INT (Internal)
- Last active timestamp

### 2. Task Queue (Per Agent)

Center panel showing selected agent's tasks:

```
┌──────────────────────────────────────────────────────────────┐
│ SCOUT'S TASKS                                                │
├──────────────┬──────────────┬──────────────────────────────┤
│ ● INBOX (3)  │ ● ASSIGNED   │ ● IN PROGRESS (1)            │
├──────────────┴──────────────┴──────────────────────────────┤
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 🔄 Omega Foundation Market Research                   │   │
│ │ Priority: HIGH • Started: 9:03 AM • ETA: 15 min      │   │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░ 70%               │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ INBOX:                                                       │
│ ○ MeshGuard competitor analysis                              │
│ ○ SaveState GitHub Action research                           │
│ ○ Alpha School pricing deep dive                             │
└──────────────────────────────────────────────────────────────┘
```

**Task properties:**
- Title
- Priority (LOW | MEDIUM | HIGH | URGENT)
- Status (INBOX | ASSIGNED | IN_PROGRESS | COMPLETE | FAILED)
- Progress percentage
- Start time, ETA, elapsed
- Source (manual | cron | triggered)

### 3. Output/Documentation Panel

Right panel showing agent outputs and playbooks:

```
┌─────────────────────────────────────────────────────────────────┐
│ DOCUMENTATION                                              ✕    │
├─────────────────────────────────────────────────────────────────┤
│ 📄 DOCUMENTS                                                    │
│                                                                 │
│ 📖 Role Playbook: Research Specialist                          │
│    PROTOCOL • Updated 3 minutes ago                             │
│                                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📁 STANDALONE (12)                                              │
│                                                                 │
│ 📋 Omega Foundation Research                   • 5 min ago      │
│ 📋 SaveState Launch Review                     • 1 day ago      │
│ 📋 MeshGuard SOC 2 Checklist                  • 1 day ago      │
│ 📋 Alpha School Analysis                       • 10 min ago     │
└─────────────────────────────────────────────────────────────────┘
```

**Document types:**
- Role Playbooks (persistent instructions for each agent)
- Research Reports
- Analysis Documents
- Checklists
- Meeting Notes

### 4. Top Stats Bar

```
┌────────────────────────────────────────────────────────────────────────┐
│  ◇ MISSION CONTROL    │  9 AGENTS ACTIVE  │  3 TASKS IN QUEUE  │ 🟢 ONLINE │
│                       │                   │                    │           │
│  [SiteGPT ▼]         │  Filtering: All   │  FRI, JAN 30       │  15:16:51 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Definitions (Initial)

| Agent | Role | Specialty | Playbook |
|-------|------|-----------|----------|
| **Scout** | Research | Market research, competitive analysis, due diligence | Research methodology, source quality, citation format |
| **Builder** | Development | Code, MVPs, technical implementation | Tech stack preferences, code standards, deployment |
| **Scribe** | Content | Documentation, copywriting, reports | Tone guidelines, formatting, templates |
| **Analyst** | Data | Financial modeling, metrics, analysis | Model templates, data sources, visualization |
| **Canvas** | Design | UI/UX, brand, visual assets | Brand guidelines, design systems, tools |
| **Sentinel** | QA/Security | Testing, security review, audits | Checklists, testing protocols, compliance |

---

## Data Model

### Agent
```typescript
interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  specialty: string;
  type: 'SPC' | 'LEAD' | 'INT';
  status: 'WORKING' | 'STANDBY' | 'ERROR';
  lastActive: Date;
  playbookId: string;
  sessionKey?: string; // OpenClaw session if active
}
```

### Task
```typescript
interface Task {
  id: string;
  agentId: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'INBOX' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  eta?: Date;
  output?: {
    type: 'report' | 'code' | 'document' | 'analysis';
    path: string;
    bearNoteId?: string;
  };
  vikunjaTaskId?: number; // Link to Vikunja
}
```

### Document
```typescript
interface Document {
  id: string;
  agentId?: string;
  type: 'playbook' | 'report' | 'analysis' | 'checklist';
  title: string;
  path: string; // File path or Bear note ID
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}
```

---

## Integration Points

### OpenClaw Gateway
- Spawn sub-agent sessions with specific agent configs
- Monitor session status (active/complete/error)
- Retrieve session outputs

### Vikunja
- Sync tasks bidirectionally
- Link Mission Control tasks to Vikunja tasks
- Pull task updates

### Bear
- Store documents and reports
- Link to Bear notes for rich formatting
- Search across agent outputs

### File System
- Store playbooks in `~/clawd/agents/{agent}/PLAYBOOK.md`
- Store outputs in `~/clawd/agents/{agent}/outputs/`
- Index for search

---

## Tech Stack Options

### Option A: Simple Static Dashboard
- **Frontend:** Next.js + Tailwind (deploy to Vercel)
- **Data:** JSON files in repo + file watchers
- **Pros:** Fast to build, no backend
- **Cons:** Limited real-time updates

### Option B: Full Stack
- **Frontend:** Next.js + Tailwind
- **Backend:** API routes on Vercel
- **Database:** SQLite (local) or Neon (cloud)
- **Real-time:** WebSocket or polling
- **Pros:** Full functionality
- **Cons:** More complex

### Option C: Obsidian/Canvas Based
- Use Obsidian canvas for visual layout
- Markdown files for agent state
- **Pros:** Already have tooling
- **Cons:** Not as polished, no real-time

**Recommendation:** Start with Option A (static dashboard), evolve to Option B as needed.

---

## MVP Scope

### Phase 1: Dashboard View (Week 1)
- [ ] Agent list with status indicators
- [ ] Task list per agent (read from Vikunja)
- [ ] Document panel (read from Bear/files)
- [ ] Manual status updates

### Phase 2: Integration (Week 2)
- [ ] OpenClaw session spawning from dashboard
- [ ] Auto-update status when sessions complete
- [ ] Vikunja two-way sync
- [ ] Bear document linking

### Phase 3: Automation (Week 3)
- [ ] Scheduled agent runs (cron)
- [ ] Agent playbook execution
- [ ] Progress tracking
- [ ] Notifications (Telegram)

---

## UI Wireframe (ASCII)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ◇ MISSION CONTROL        │ 9 ACTIVE │ 3 QUEUE │ Filter: [All ▼]    │ 🟢 ONLINE │
├───────────────────┬───────────────────────────────┬──────────────────────────────┤
│                   │                               │                              │
│  AGENTS        12 │  SCOUT'S TASKS                │  DOCUMENTATION            ✕  │
│  ─────────────────│  ───────────────────────────  │  ────────────────────────────│
│                   │                               │                              │
│  🔍 Scout    ●    │  ● INBOX (3)  ● IN PROG (1)  │  📖 Role Playbook: Scout     │
│     Research      │                               │     Research Specialist      │
│                   │  ┌─────────────────────────┐  │     Updated 3 min ago        │
│  💻 Builder  ○    │  │ 🔄 Omega Research       │  │                              │
│     Dev Agent     │  │    HIGH • 70% ━━━━░░░   │  │  ─────────────────────────── │
│                   │  └─────────────────────────┘  │                              │
│  📝 Scribe   ○    │                               │  📁 OUTPUTS (12)             │
│     Content       │  INBOX:                       │                              │
│                   │  ○ MeshGuard competitors      │  📋 Omega Research Report    │
│  📊 Analyst  ○    │  ○ SaveState GitHub Action    │     5 minutes ago            │
│     Data          │  ○ Alpha School pricing       │                              │
│                   │                               │  📋 SaveState Launch Review  │
│  🎨 Canvas   ○    │                               │     1 day ago                │
│     Design        │                               │                              │
│                   │                               │  📋 MeshGuard SOC 2          │
│  🔒 Sentinel ○    │                               │     1 day ago                │
│     QA/Security   │                               │                              │
│                   │                               │                              │
└───────────────────┴───────────────────────────────┴──────────────────────────────┘
```

---

## Open Questions

1. **Persistence:** Should agents maintain memory across runs? (Probably yes)
2. **Concurrency:** Can multiple agents work simultaneously? (Yes, separate sessions)
3. **Handoffs:** Can agents delegate to each other? (Future scope)
4. **Cost tracking:** Track API costs per agent? (Nice to have)
5. **Access:** Just Steve, or also David direct access?

---

*Spec created: 2026-01-30*
*Author: Steve*
