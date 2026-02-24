# MABOS Agent Detail Panel — UI/UX Specification

> Design document for the expandable agent detail panel with unified view/create/edit functionality.
> Created: 2026-02-23

## Context

Project: OpenClaw MABOS (Multi-Agent Business Operating System)
Location: `/home/kingler/openclaw-mabos`
Tech stack: Lit 3 (Web Components), Vite 7, TypeScript, CSS (no Tailwind)
UI framework: Lit html templates with reactive state (signals + context)
Rendering: `ui/src/ui/app-render.ts` orchestrates all views

The current Agent view (`ui/src/ui/views/agents.ts`) uses a toolbar with
agent selector dropdown and tabbed panels (overview, files, tools, skills,
channels, cron). The agent overview panel (`agents-panels-overview.ts`) shows
workspace paths, model selection, and config.

The BDI runtime (`mabos/bdi-runtime/index.ts`) manages cognitive files per
agent: Beliefs.md, Desires.md, Goals.md, Intentions.md, Plans.md,
Commitments.md, Memory.md, Persona.md, Capabilities.md, Learnings.md.

## Requirements

### 1. Expandable Side Panel → Full-Width Mode

**Default State (Side Panel):**

- Right-side panel docked alongside the main content area
- Shows agent summary, identity, and quick-access info

**Expanded State (Full-Width):**

- Expands to fill the viewport with \`50px\` margin on all four sides
  (top, right, bottom, left)
- CSS: \`position: fixed; inset: 50px; z-index: 100;\`
- Smooth CSS transition between panel and expanded states
- Dismiss via close button or Escape key
- Background overlay/scrim behind the expanded panel

**Chat Input Z-Index in Expanded Mode:**

- The Chat Input component (\`ui/src/ui/views/chat.ts\`) must have a
  higher z-index than the expanded Agent Details panel
- Chat Input floats at the bottom, overlaying the expanded panel so
  the user can continue chatting while viewing agent details

### 2. Unified Agent Detail View (Replace Add Agent Modal)

**Remove:** Any separate modal dialog for adding/creating agents
**Replace with:** The Right Side Panel / Expanded view serves as the
single unified component for:

- Viewing agent details (read mode)
- Creating new agents (create mode)
- Editing existing agents (edit mode)

All three modes live in the same Lit component with mode-dependent rendering.

### 3. Panel Layout Structure

**Fixed Header (sticky top):**

- Agent name, role title, status badge
- Mode toggle (View / Edit)
- Expand/collapse toggle button
- Close button

**Scrollable Content (middle, \`overflow-y: auto; flex: 1\`):**

- All agent detail sections as collapsible groups (see Section 5)

**Fixed Footer (sticky bottom):**

- Action buttons: Save, Cancel, Delete (context-dependent by mode)
- Last modified timestamp

### 4. Agent Avatar

**Size:** 100% larger than current default (double the current rendered size)

**Click-to-Upload:**

- Clicking the avatar triggers a hidden \`<input type="file">\` element
- \`accept=".jpg,.jpeg,.png"\` — only JPG and PNG allowed
- On selection: preview immediately via \`FileReader\` / \`URL.createObjectURL\`
- Upload/save to the agent profile directory
- Show a camera/pencil overlay icon on \`:hover\` to indicate editability

### 5. Agent Detail Content Sections

Organized as collapsible accordion sections within the scrollable content area:

**A. Agent Identity & Role**

- Name, title, department
- Avatar (with upload per Section 4)
- Agent ID, workspace path
- Default/non-default status

**B. BDI Cognitive State (from \`mabos/bdi-runtime\` cognitive files)**
Each rendered as an editable markdown section:

- \`Beliefs.md\` — Current beliefs with certainty scores
- \`Desires.md\` — Desires sorted by priority
- \`Goals.md\` — Goals hierarchy (includes sub-goals)
- \`Intentions.md\` — Active/stalled/expired intentions
- \`Plans.md\` (aliased Task.md) — Current plans and task breakdowns
- \`Commitments.md\` — Commitment strategy and active commitments
- \`Memory.md\` — Agent-specific long-term memory
- \`Persona.md\` — Agent persona definition
- \`Capabilities.md\` (aliased Skill.md) — Agent skills and capabilities
- \`Learnings.md\` (aliased Actions.md) — Learned behaviors

**C. OpenClaw Core Files (shared across all agents)**

- \`Soul.md\` — Core identity and values
- \`AGENTS.md\` — Session guidelines and tools
- \`Bootstrap.md\` — Initial setup and boot sequence
- \`Identity.md\` — Personal identity metadata
- \`TOOLS.md\` — Available tools documentation

**D. Goals, Projects & Workflows**

- Active goals (linked from Goals.md)
- Assigned projects (from \`mabos/erp/projects/\`)
- Workflow configurations (from \`mabos/erp/workflows/\`)
- Knowledge topics related to the agent's role

**E. OpenClaw Agent Configuration**

- Agent config from \`agent.json\` manifest
- BDI config: commitment strategy, cycle frequency, reasoning methods
- Model selection (primary + fallbacks)
- Skills filter
- Runtime settings

### 6. Technical Constraints

- Use Lit \`html\` templates and \`css\` tagged literals (project convention)
- Follow existing view pattern in \`ui/src/ui/views/agents\*.ts\`
- Use existing controller pattern in \`ui/src/ui/controllers/\`
- CSS custom properties for theming (dark/light mode support)
- Leverage existing \`app-render.ts\` layout integration
- Match existing component naming: \`renderAgentDetailPanel()\` export
- File naming: kebab-case (e.g., \`agent-detail-panel.ts\`)

### 7. File Locations for New Code

- Panel view: \`ui/src/ui/views/agent-detail-panel.ts\`
- Panel styles: \`ui/src/styles/agent-detail-panel.css\`
- Avatar upload controller: \`ui/src/ui/controllers/agent-avatar.ts\`
- BDI state controller: \`ui/src/ui/controllers/agent-bdi.ts\`
- Integration point: \`ui/src/ui/app-render.ts\` (add panel to layout)
