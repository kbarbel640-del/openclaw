# Agent Detail Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an expandable right-side agent detail panel that unifies agent viewing, creation, and editing into a single component with BDI cognitive state management.

**Architecture:** A new Lit `html` template view (`agent-detail-panel.ts`) rendered conditionally in `app-render.ts` alongside the existing content area. Uses the existing gateway-based controller pattern for data fetching (`agents.files.*`, `agent.identity.get`). Panel state (open/expanded/mode) is managed via `AppViewState`. CSS handles panel ↔ fullwidth transition with fixed header/footer and scrollable middle.

**Tech Stack:** Lit 3 (html templates), TypeScript, CSS custom properties, Vite 7

**Design Doc:** `docs/plans/2026-02-23-agent-detail-panel-design.md`

---

## Task 1: Add Panel State to AppViewState

**Files:**

- Modify: `ui/src/ui/app-view-state.ts`
- Modify: `ui/src/ui/ui-types.ts`

**Step 1: Add panel types to ui-types.ts**

Add at end of file:

```typescript
export type AgentDetailPanelMode = "view" | "edit" | "create";

export type AgentDetailPanelState = {
  open: boolean;
  expanded: boolean;
  mode: AgentDetailPanelMode;
  agentId: string | null;
  activeSection: string | null;
  avatarPreview: string | null;
};
```

**Step 2: Add default panel state to app-view-state.ts**

Add the `agentDetailPanel` field to `AppViewState` type and its default value wherever defaults are initialized. The default is:

```typescript
agentDetailPanel: {
  open: false,
  expanded: false,
  mode: "view" as const,
  agentId: null,
  activeSection: null,
  avatarPreview: null,
},
```

**Step 3: Commit**

```bash
git add ui/src/ui/app-view-state.ts ui/src/ui/ui-types.ts
git commit -m "feat(ui): add agent detail panel state types"
```

---

## Task 2: Create Panel CSS Styles

**Files:**

- Create: `ui/src/styles/agent-detail-panel.css`
- Modify: `ui/src/main.ts` (import the new stylesheet)

**Step 1: Create the stylesheet**

Create `ui/src/styles/agent-detail-panel.css`:

```css
/* ===========================================
   Agent Detail Panel
   =========================================== */

/* --- Panel (docked right side) --- */
.agent-detail-panel {
  position: relative;
  width: 420px;
  min-width: 420px;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  background: var(--surface);
  transition: all 0.3s var(--ease-out);
  z-index: 50;
}

/* --- Expanded (full-width overlay) --- */
.agent-detail-panel--expanded {
  position: fixed;
  inset: 50px;
  width: auto;
  min-width: auto;
  border-left: none;
  border-radius: 12px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
  z-index: 200;
}

/* --- Overlay scrim behind expanded panel --- */
.agent-detail-scrim {
  display: none;
}

.agent-detail-scrim--visible {
  display: block;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 150;
  animation: scrim-fade-in 0.2s ease-out;
}

@keyframes scrim-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* --- Fixed Header --- */
.agent-detail-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.agent-detail-header__info {
  flex: 1;
  min-width: 0;
}

.agent-detail-header__name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-detail-header__role {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.agent-detail-header__actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* --- Scrollable Content --- */
.agent-detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

/* --- Fixed Footer --- */
.agent-detail-footer {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.agent-detail-footer__meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.agent-detail-footer__actions {
  display: flex;
  gap: 8px;
}

/* --- Avatar (2x size, clickable) --- */
.agent-detail-avatar {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
}

.agent-detail-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.agent-detail-avatar__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 0.15s ease;
  color: #fff;
  font-size: 0.7rem;
}

.agent-detail-avatar:hover .agent-detail-avatar__overlay {
  opacity: 1;
}

.agent-detail-avatar__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  font-size: 1.4rem;
  font-weight: 600;
}

/* --- Collapsible Section (Accordion) --- */
.agent-section {
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
}

.agent-section__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text);
  font-weight: 600;
  font-size: 0.9rem;
  text-align: left;
}

.agent-section__toggle:hover {
  background: var(--hover);
}

.agent-section__chevron {
  transition: transform 0.2s ease;
  width: 16px;
  height: 16px;
}

.agent-section--open .agent-section__chevron {
  transform: rotate(90deg);
}

.agent-section__body {
  display: none;
  padding: 0 16px 16px;
}

.agent-section--open .agent-section__body {
  display: block;
}

/* --- Markdown editor area --- */
.agent-file-editor {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.6;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text);
  resize: vertical;
}

.agent-file-editor:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

/* --- Chat input z-index override when panel expanded --- */
.chat-input-bar--above-panel {
  z-index: 300 !important;
  position: fixed !important;
  bottom: 0;
  left: 0;
  right: 0;
}

/* --- KV grid for config display --- */
.agent-kv-grid {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 8px 12px;
  font-size: 0.85rem;
}

.agent-kv-grid .label {
  color: var(--text-muted);
  font-weight: 500;
}

.agent-kv-grid .value {
  color: var(--text);
  word-break: break-word;
}

/* --- Status badge --- */
.agent-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.agent-status-badge--active {
  background: var(--success-bg);
  color: var(--success);
}

.agent-status-badge--default {
  background: var(--accent-bg);
  color: var(--accent);
}
```

**Step 2: Import stylesheet in main.ts**

In `ui/src/main.ts`, add the import alongside existing style imports:

```typescript
import "./styles/agent-detail-panel.css";
```

**Step 3: Commit**

```bash
git add ui/src/styles/agent-detail-panel.css ui/src/main.ts
git commit -m "feat(ui): add agent detail panel CSS styles"
```

---

## Task 3: Create Collapsible Section Helper

**Files:**

- Create: `ui/src/ui/views/agent-detail-section.ts`

**Step 1: Create the section renderer**

```typescript
import { html, nothing } from "lit";
import { icons } from "../icons.ts";

/**
 * Render a collapsible accordion section for the agent detail panel.
 */
export function renderAgentSection(params: {
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: (id: string) => void;
  content: unknown;
  badge?: string | number | null;
}) {
  const { id, title, subtitle, open, onToggle, content, badge } = params;

  return html`
    <div class="agent-section ${open ? "agent-section--open" : ""}">
      <button class="agent-section__toggle" type="button" @click=${() => onToggle(id)}>
        <div>
          <span>${title}</span>
          ${badge != null
            ? html`<span class="agent-tab-count" style="margin-left:8px">${badge}</span>`
            : nothing}
          ${subtitle
            ? html`<div
                style="font-weight:400;font-size:0.75rem;color:var(--text-muted);margin-top:2px"
              >
                ${subtitle}
              </div>`
            : nothing}
        </div>
        <span class="agent-section__chevron">${icons.chevronRight}</span>
      </button>
      <div class="agent-section__body">${content}</div>
    </div>
  `;
}
```

**Step 2: Commit**

```bash
git add ui/src/ui/views/agent-detail-section.ts
git commit -m "feat(ui): add collapsible section helper for agent detail panel"
```

---

## Task 4: Create Avatar Upload Controller

**Files:**

- Create: `ui/src/ui/controllers/agent-avatar.ts`

**Step 1: Create the controller**

```typescript
import type { GatewayBrowserClient } from "../gateway.ts";

export type AvatarUploadState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  uploading: boolean;
  error: string | null;
  previewUrl: string | null;
};

/**
 * Trigger file picker for avatar upload.
 * Returns the selected File or null if cancelled.
 */
export function triggerAvatarPicker(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".jpg,.jpeg,.png";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files?.[0] ?? null;
      document.body.removeChild(input);
      resolve(file);
    });
    input.addEventListener("cancel", () => {
      document.body.removeChild(input);
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Read a File as a data URL for preview.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload avatar image to the agent's identity.
 * Uses the agent.identity.set gateway method.
 */
export async function uploadAgentAvatar(
  state: AvatarUploadState,
  agentId: string,
  file: File,
): Promise<boolean> {
  if (!state.client || !state.connected || state.uploading) {
    return false;
  }
  state.uploading = true;
  state.error = null;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    state.previewUrl = dataUrl;
    await state.client.request("agent.identity.set", {
      agentId,
      avatar: dataUrl,
    });
    return true;
  } catch (err) {
    state.error = String(err);
    return false;
  } finally {
    state.uploading = false;
  }
}
```

**Step 2: Commit**

```bash
git add ui/src/ui/controllers/agent-avatar.ts
git commit -m "feat(ui): add avatar upload controller with file picker"
```

---

## Task 5: Create the Agent Detail Panel View

**Files:**

- Create: `ui/src/ui/views/agent-detail-panel.ts`

**Step 1: Create the main panel renderer**

This is the largest task. The panel renders:

- Fixed header with avatar, name, mode toggle, expand/close buttons
- Scrollable content with accordion sections
- Fixed footer with action buttons

```typescript
import { html, nothing } from "lit";
import type { AgentIdentityResult, AgentsFilesListResult, AgentsListResult } from "../types.ts";
import type { AgentDetailPanelMode, AgentDetailPanelState } from "../ui-types.ts";
import { icons } from "../icons.ts";
import { renderAgentSection } from "./agent-detail-section.ts";
import { normalizeAgentLabel } from "./agents-utils.ts";

/** Cognitive files from BDI runtime */
const BDI_FILES = [
  { name: "Beliefs.md", label: "Beliefs", subtitle: "Current beliefs with certainty scores" },
  { name: "Desires.md", label: "Desires", subtitle: "Desires sorted by priority" },
  { name: "Goals.md", label: "Goals", subtitle: "Goal hierarchy including sub-goals" },
  { name: "Intentions.md", label: "Intentions", subtitle: "Active/stalled/expired intentions" },
  { name: "Plans.md", label: "Plans", subtitle: "Current plans and task breakdowns" },
  { name: "Commitments.md", label: "Commitments", subtitle: "Commitment strategy" },
  { name: "Memory.md", label: "Memory", subtitle: "Agent-specific long-term memory" },
  { name: "Persona.md", label: "Persona", subtitle: "Agent persona definition" },
  { name: "Capabilities.md", label: "Capabilities", subtitle: "Skills and capabilities" },
  { name: "Learnings.md", label: "Learnings", subtitle: "Learned behaviors" },
] as const;

/** OpenClaw shared core files */
const CORE_FILES = [
  { name: "Soul.md", label: "Soul", subtitle: "Core identity and values" },
  { name: "AGENTS.md", label: "Agents", subtitle: "Session guidelines and tools" },
  { name: "Bootstrap.md", label: "Bootstrap", subtitle: "Initial setup and boot sequence" },
  { name: "Identity.md", label: "Identity", subtitle: "Personal identity metadata" },
  { name: "TOOLS.md", label: "Tools", subtitle: "Available tools documentation" },
] as const;

export type AgentDetailPanelProps = {
  panelState: AgentDetailPanelState;
  agent: AgentsListResult["agents"][number] | null;
  agentsList: AgentsListResult | null;
  identity: AgentIdentityResult | null;
  filesList: AgentsFilesListResult | null;
  fileContents: Record<string, string>;
  fileDrafts: Record<string, string>;
  fileSaving: boolean;
  filesLoading: boolean;
  configForm: Record<string, unknown> | null;
  defaultId: string | null;
  openSections: Set<string>;
  onClose: () => void;
  onToggleExpand: () => void;
  onModeChange: (mode: AgentDetailPanelMode) => void;
  onToggleSection: (id: string) => void;
  onAvatarClick: () => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileSave: (name: string) => void;
  onFileReset: (name: string) => void;
};

export function renderAgentDetailPanel(props: AgentDetailPanelProps) {
  const { panelState, agent, identity } = props;

  if (!panelState.open) {
    return nothing;
  }

  const isExpanded = panelState.expanded;
  const isEdit = panelState.mode === "edit" || panelState.mode === "create";
  const agentName = identity?.name || (agent ? normalizeAgentLabel(agent) : "New Agent");
  const agentAvatar = props.panelState.avatarPreview || identity?.avatar || null;
  const isDefault = Boolean(props.defaultId && agent?.id === props.defaultId);

  return html`
    <!-- Scrim overlay for expanded mode -->
    <div
      class="agent-detail-scrim ${isExpanded ? "agent-detail-scrim--visible" : ""}"
      @click=${props.onClose}
    ></div>

    <div class="agent-detail-panel ${isExpanded ? "agent-detail-panel--expanded" : ""}">
      <!-- Fixed Header -->
      <div class="agent-detail-header">
        <div
          class="agent-detail-avatar"
          @click=${props.onAvatarClick}
          title="Click to change avatar"
        >
          ${agentAvatar
            ? html`<img src="${agentAvatar}" alt="${agentName}" />`
            : html`<div class="agent-detail-avatar__fallback">
                ${agentName.charAt(0).toUpperCase()}
              </div>`}
          <div class="agent-detail-avatar__overlay">${icons.camera ?? html`<span>Edit</span>`}</div>
        </div>
        <div class="agent-detail-header__info">
          <div class="agent-detail-header__name">${agentName}</div>
          <div class="agent-detail-header__role">
            ${isDefault
              ? html`<span class="agent-status-badge agent-status-badge--default">Default</span>`
              : nothing}
            ${agent?.id
              ? html`<span style="font-family:var(--font-mono);font-size:0.75rem"
                  >${agent.id}</span
                >`
              : nothing}
          </div>
        </div>
        <div class="agent-detail-header__actions">
          <button
            class="btn btn--sm ${isEdit ? "primary" : ""}"
            type="button"
            @click=${() => props.onModeChange(isEdit ? "view" : "edit")}
          >
            ${isEdit ? "Viewing" : "Edit"}
          </button>
          <button
            class="btn btn--sm"
            type="button"
            @click=${props.onToggleExpand}
            title="${isExpanded ? "Collapse" : "Expand"}"
          >
            ${isExpanded ? (icons.minimize ?? "↙") : (icons.maximize ?? "↗")}
          </button>
          <button class="btn btn--sm" type="button" @click=${props.onClose} title="Close">
            ${icons.x ?? "✕"}
          </button>
        </div>
      </div>

      <!-- Scrollable Content -->
      <div class="agent-detail-content">
        <!-- A. Agent Identity & Config -->
        ${renderAgentSection({
          id: "identity",
          title: "Identity & Configuration",
          subtitle: "Agent identity, workspace, and model settings",
          open: props.openSections.has("identity"),
          onToggle: props.onToggleSection,
          content: renderIdentitySection(props),
        })}

        <!-- B. BDI Cognitive State -->
        ${BDI_FILES.map((file) =>
          renderAgentSection({
            id: `bdi-${file.name}`,
            title: file.label,
            subtitle: file.subtitle,
            open: props.openSections.has(`bdi-${file.name}`),
            onToggle: props.onToggleSection,
            content: renderFileEditor(props, file.name, isEdit),
          }),
        )}

        <!-- C. OpenClaw Core Files -->
        ${renderAgentSection({
          id: "core-files",
          title: "OpenClaw Core Files",
          subtitle: "Shared system files across all agents",
          open: props.openSections.has("core-files"),
          onToggle: props.onToggleSection,
          content: html`
            ${CORE_FILES.map(
              (file) => html`
                <div style="margin-bottom:12px">
                  <div style="font-weight:600;font-size:0.85rem;margin-bottom:4px">
                    ${file.label}
                    <span style="color:var(--text-muted);font-weight:400">(${file.name})</span>
                  </div>
                  <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">
                    ${file.subtitle}
                  </div>
                  ${renderFileEditor(props, file.name, isEdit)}
                </div>
              `,
            )}
          `,
        })}

        <!-- D. Agent Config (from agent.json / openclaw config) -->
        ${renderAgentSection({
          id: "config",
          title: "OpenClaw Agent Configuration",
          subtitle: "BDI config, model, skills, runtime settings",
          open: props.openSections.has("config"),
          onToggle: props.onToggleSection,
          content: renderConfigSection(props),
        })}
      </div>

      <!-- Fixed Footer -->
      <div class="agent-detail-footer">
        <div class="agent-detail-footer__meta">
          ${agent?.id ? html`Agent ID: <code>${agent.id}</code>` : nothing}
        </div>
        <div class="agent-detail-footer__actions">
          ${isEdit
            ? html`
                <button
                  class="btn btn--sm"
                  type="button"
                  @click=${() => props.onModeChange("view")}
                >
                  Cancel
                </button>
                <button class="btn btn--sm primary" type="button" ?disabled=${props.fileSaving}>
                  ${props.fileSaving ? "Saving…" : "Save All"}
                </button>
              `
            : html`
                <button
                  class="btn btn--sm"
                  type="button"
                  @click=${() => props.onModeChange("edit")}
                >
                  Edit Agent
                </button>
              `}
        </div>
      </div>
    </div>
  `;
}

function renderIdentitySection(props: AgentDetailPanelProps) {
  const { identity, agent, configForm } = props;
  const isEdit = props.panelState.mode === "edit" || props.panelState.mode === "create";

  return html`
    <div class="agent-kv-grid">
      <div class="label">Name</div>
      <div class="value">${identity?.name ?? agent?.id ?? "-"}</div>
      <div class="label">Agent ID</div>
      <div class="value mono">${agent?.id ?? "-"}</div>
      <div class="label">Workspace</div>
      <div class="value mono">${props.filesList?.workspace ?? "-"}</div>
      <div class="label">Avatar</div>
      <div class="value">${identity?.avatar ? "Custom" : "Default"}</div>
    </div>
  `;
}

function renderFileEditor(props: AgentDetailPanelProps, fileName: string, editable: boolean) {
  const content = props.fileDrafts[fileName] ?? props.fileContents[fileName] ?? "";
  const isDirty =
    props.fileDrafts[fileName] !== undefined &&
    props.fileDrafts[fileName] !== (props.fileContents[fileName] ?? "");

  if (!editable) {
    // Read-only rendered view
    return content
      ? html`<pre
          style="white-space:pre-wrap;font-size:0.8rem;line-height:1.5;color:var(--text);margin:0;max-height:400px;overflow-y:auto"
        >
${content}</pre
        >`
      : html`<div style="color:var(--text-muted);font-size:0.8rem;font-style:italic">
          File not found or empty
        </div>`;
  }

  return html`
    <div>
      <textarea
        class="agent-file-editor"
        .value=${content}
        @input=${(e: Event) =>
          props.onFileDraftChange(fileName, (e.target as HTMLTextAreaElement).value)}
        placeholder="Enter content for ${fileName}..."
      ></textarea>
      ${isDirty
        ? html`
            <div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end">
              <button class="btn btn--sm" type="button" @click=${() => props.onFileReset(fileName)}>
                Revert
              </button>
              <button
                class="btn btn--sm primary"
                type="button"
                ?disabled=${props.fileSaving}
                @click=${() => props.onFileSave(fileName)}
              >
                ${props.fileSaving ? "Saving…" : "Save"}
              </button>
            </div>
          `
        : nothing}
    </div>
  `;
}

function renderConfigSection(props: AgentDetailPanelProps) {
  const { configForm, agent } = props;
  if (!configForm || !agent) {
    return html`<div style="color:var(--text-muted);font-size:0.85rem">No config loaded</div>`;
  }

  // Extract agent-specific config
  const agentKey = `agents.${agent.id}`;
  const agentConfig = (configForm[agentKey] ?? {}) as Record<string, unknown>;
  const model = agentConfig.model ?? configForm["model"] ?? "-";
  const skills = Array.isArray(agentConfig.skills) ? agentConfig.skills : null;

  return html`
    <div class="agent-kv-grid">
      <div class="label">Primary Model</div>
      <div class="value mono">${String(model)}</div>
      <div class="label">Skills Filter</div>
      <div class="value">${skills ? `${skills.length} selected` : "All skills"}</div>
      <div class="label">Commitment Strategy</div>
      <div class="value">${String(agentConfig.commitmentStrategy ?? "open-minded")}</div>
    </div>
  `;
}
```

**Step 2: Commit**

```bash
git add ui/src/ui/views/agent-detail-panel.ts
git commit -m "feat(ui): create agent detail panel view with BDI sections"
```

---

## Task 6: Integrate Panel into App Layout

**Files:**

- Modify: `ui/src/ui/app-render.ts`
- Modify: `ui/src/ui/app.ts` (add state + handlers)

**Step 1: Import and render panel in app-render.ts**

In `app-render.ts`, import the panel:

```typescript
import { renderAgentDetailPanel } from "./views/agent-detail-panel.ts";
```

Inside `renderApp()`, after the `<main class="content ...">` closing tag but before the shell's closing `</div>`, add the panel render call. The panel is conditionally rendered based on `state.agentDetailPanel.open`.

**Step 2: Add panel handlers in app.ts**

Add handler methods to the app class for:

- `openAgentDetailPanel(agentId: string)` — sets `agentDetailPanel.open = true`, loads files
- `closeAgentDetailPanel()` — sets `agentDetailPanel.open = false`
- `toggleAgentDetailExpand()` — toggles `agentDetailPanel.expanded`
- `changeAgentDetailMode(mode)` — sets mode
- `toggleAgentDetailSection(id)` — toggles section in openSections set
- `handleAvatarClick()` — calls `triggerAvatarPicker()` from controller

Also add Escape key listener:

```typescript
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && this.agentDetailPanel.open) {
    if (this.agentDetailPanel.expanded) {
      this.agentDetailPanel.expanded = false;
    } else {
      this.agentDetailPanel.open = false;
    }
    this.requestUpdate();
  }
});
```

**Step 3: Modify CSS grid to accommodate panel**

In `ui/src/styles/layout.css`, add a rule for when the panel is open:

```css
.shell--detail-panel-open {
  grid-template-columns: var(--shell-nav-width) minmax(0, 1fr) 420px;
}

.shell--nav-collapsed.shell--detail-panel-open {
  grid-template-columns: 60px minmax(0, 1fr) 420px;
}
```

**Step 4: Commit**

```bash
git add ui/src/ui/app-render.ts ui/src/ui/app.ts ui/src/styles/layout.css
git commit -m "feat(ui): integrate agent detail panel into app layout"
```

---

## Task 7: Wire Chat Input Z-Index Override

**Files:**

- Modify: `ui/src/ui/views/chat.ts`
- Modify: `ui/src/styles/agent-detail-panel.css` (already has the class)

**Step 1: Add conditional class to chat input bar**

In `chat.ts`, find the chat input bar element (the `<div>` or `<form>` containing the message input and send button). Add the `chat-input-bar--above-panel` class conditionally when the agent detail panel is in expanded mode.

The chat view needs to receive `detailPanelExpanded: boolean` as a prop, then apply:

```typescript
class="chat-input-bar ${props.detailPanelExpanded ? 'chat-input-bar--above-panel' : ''}"
```

**Step 2: Pass the prop from app-render.ts**

When rendering the chat view, pass `detailPanelExpanded: state.agentDetailPanel.expanded`.

**Step 3: Commit**

```bash
git add ui/src/ui/views/chat.ts ui/src/ui/app-render.ts
git commit -m "feat(ui): chat input overlays expanded agent detail panel"
```

---

## Task 8: Add "Open Detail" Button to Agent View

**Files:**

- Modify: `ui/src/ui/views/agents.ts`

**Step 1: Add button to agents toolbar**

In the agents toolbar row (near the Refresh button), add an "Open Detail" button that triggers `onOpenDetailPanel(selectedAgentId)`:

```typescript
<button
  class="btn btn--sm"
  type="button"
  ?disabled=${!selectedAgent}
  @click=${() => selectedAgent && props.onOpenDetailPanel(selectedAgent.id)}
>Detail Panel</button>
```

**Step 2: Add the callback to AgentsProps**

```typescript
onOpenDetailPanel: (agentId: string) => void;
```

**Step 3: Wire in app-render.ts**

Pass `onOpenDetailPanel` through to `renderAgents()` that calls `state.openAgentDetailPanel(agentId)`.

**Step 4: Commit**

```bash
git add ui/src/ui/views/agents.ts ui/src/ui/app-render.ts
git commit -m "feat(ui): add detail panel button to agents toolbar"
```

---

## Task 9: Load BDI Files on Panel Open

**Files:**

- Modify: `ui/src/ui/app.ts`

**Step 1: Auto-load agent files when panel opens**

In `openAgentDetailPanel(agentId)`, after setting state, trigger file loading:

```typescript
async openAgentDetailPanel(agentId: string) {
  this.agentDetailPanel = {
    ...this.agentDetailPanel,
    open: true,
    agentId,
    mode: "view",
    avatarPreview: null,
  };
  this.requestUpdate();

  // Load agent files and identity
  await loadAgentFiles(this, agentId);
  await loadAgentIdentity(this, agentId);

  // Load BDI cognitive file contents
  const bdiFiles = [
    "Beliefs.md", "Desires.md", "Goals.md", "Intentions.md",
    "Plans.md", "Commitments.md", "Memory.md", "Persona.md",
    "Capabilities.md", "Learnings.md",
  ];
  const coreFiles = ["Soul.md", "AGENTS.md", "Bootstrap.md", "Identity.md", "TOOLS.md"];

  for (const name of [...bdiFiles, ...coreFiles]) {
    await loadAgentFileContent(this, agentId, name);
  }

  this.requestUpdate();
}
```

**Step 2: Commit**

```bash
git add ui/src/ui/app.ts
git commit -m "feat(ui): auto-load BDI and core files on panel open"
```

---

## Task 10: Build and Verify

**Step 1: Run the build**

```bash
cd /home/kingler/openclaw-mabos && pnpm build
```

Expected: Build succeeds with no TypeScript errors.

**Step 2: Run existing tests**

```bash
pnpm test
```

Expected: All existing tests pass (no regressions).

**Step 3: Manual smoke test**

```bash
cd ui && pnpm dev
```

Open browser, navigate to Agents tab, select an agent, click "Detail Panel" button. Verify:

- Panel opens on right side
- Header shows agent name + avatar
- Accordion sections expand/collapse
- BDI file contents load and display
- Expand button transitions to fullwidth with 50px margins
- Escape key closes/collapses
- Avatar click opens file picker (jpg/png only)
- Edit mode shows textareas
- Chat input remains accessible in expanded mode

**Step 4: Commit final state**

```bash
git add -A
git commit -m "feat(ui): agent detail panel - build verified"
```

---

## Summary

| Task | Description                | Files                                   |
| ---- | -------------------------- | --------------------------------------- |
| 1    | Panel state types          | `ui-types.ts`, `app-view-state.ts`      |
| 2    | CSS styles                 | `agent-detail-panel.css`, `main.ts`     |
| 3    | Collapsible section helper | `agent-detail-section.ts`               |
| 4    | Avatar upload controller   | `agent-avatar.ts`                       |
| 5    | Panel view component       | `agent-detail-panel.ts`                 |
| 6    | Layout integration         | `app-render.ts`, `app.ts`, `layout.css` |
| 7    | Chat input z-index         | `chat.ts`, `app-render.ts`              |
| 8    | "Open Detail" button       | `agents.ts`, `app-render.ts`            |
| 9    | BDI file auto-loading      | `app.ts`                                |
| 10   | Build & verify             | All                                     |
