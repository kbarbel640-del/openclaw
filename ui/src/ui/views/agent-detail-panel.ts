import { html, nothing } from "lit";
import { icons } from "../icons.ts";
import type { AgentIdentityResult, AgentsFilesListResult, GatewayAgentRow } from "../types.ts";
import type { AgentDetailPanelMode, AgentDetailPanelState } from "../ui-types.ts";
import { renderAgentSection } from "./agent-detail-section.ts";
import { normalizeAgentLabel, resolveAgentAvatarUrl } from "./agents-utils.ts";

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
  agent: GatewayAgentRow | null;
  agentIdentity: AgentIdentityResult | null;
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
  onDelete?: () => void;
};

export function renderAgentDetailPanel(props: AgentDetailPanelProps) {
  const { panelState, agent, agentIdentity } = props;

  if (!panelState.open) {
    return nothing;
  }

  const isExpanded = panelState.expanded;
  const isEdit = panelState.mode === "edit" || panelState.mode === "create";
  const agentName = agentIdentity?.name || (agent ? normalizeAgentLabel(agent) : "New Agent");
  const agentAvatar = panelState.avatarPreview || resolveAgentAvatarUrl(agent ?? {}, agentIdentity);
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
          ${
            agentAvatar
              ? html`<img src="${agentAvatar}" alt="${agentName}" />`
              : html`<div class="agent-detail-avatar__fallback">
                ${agentName.charAt(0).toUpperCase()}
              </div>`
          }
          <div class="agent-detail-avatar__overlay">${icons.image}</div>
        </div>
        <div class="agent-detail-header__info">
          <div class="agent-detail-header__name">${agentName}</div>
          <div class="agent-detail-header__role">
            ${
              isDefault
                ? html`
                    <span class="agent-status-badge agent-status-badge--default">Default</span>
                  `
                : nothing
            }
            ${
              agent?.id
                ? html`<span style="font-family:var(--font-mono);font-size:0.75rem"
                  >${agent.id}</span
                >`
                : nothing
            }
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
            ${isExpanded ? icons.panelLeftClose : icons.externalLink}
          </button>
          <button class="btn btn--sm" type="button" @click=${props.onClose} title="Close">
            ${icons.x}
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
                    <span style="color:var(--muted);font-weight:400">(${file.name})</span>
                  </div>
                  <div style="font-size:0.75rem;color:var(--muted);margin-bottom:8px">
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
          ${agent?.id ? html`<code>${agent.id}</code>` : nothing}
          ${(() => {
            const files = props.filesList?.files;
            if (!files || files.length === 0) {
              return nothing;
            }
            const latest = files.reduce(
              (max: number | undefined, f: { updatedAtMs?: number }) =>
                f.updatedAtMs && f.updatedAtMs > (max ?? 0) ? f.updatedAtMs : max,
              0 as number | undefined,
            );
            if (!latest) {
              return nothing;
            }
            const date = new Date(latest);
            return html` &middot; <span title="${date.toISOString()}">Modified ${date.toLocaleDateString()}</span>`;
          })()}
        </div>
        <div class="agent-detail-footer__actions">
          ${
            agent && panelState.mode !== "create" && props.onDelete
              ? html`<button class="btn btn--sm danger" type="button" @click=${props.onDelete}>Delete</button>`
              : nothing
          }
          ${
            isEdit
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
              `
          }
        </div>
      </div>
    </div>
  `;
}

function renderIdentitySection(props: AgentDetailPanelProps) {
  const { agentIdentity, agent } = props;

  return html`
    <div class="agent-kv-grid">
      <div class="label">Name</div>
      <div class="value">${agentIdentity?.name ?? agent?.id ?? "-"}</div>
      <div class="label">Agent ID</div>
      <div class="value mono">${agent?.id ?? "-"}</div>
      <div class="label">Workspace</div>
      <div class="value mono">${props.filesList?.workspace ?? "-"}</div>
      <div class="label">Avatar</div>
      <div class="value">${agentIdentity?.avatar ? "Custom" : "Default"}</div>
    </div>
  `;
}

function renderFileEditor(props: AgentDetailPanelProps, fileName: string, editable: boolean) {
  const content = props.fileDrafts[fileName] ?? props.fileContents[fileName] ?? "";
  const isDirty =
    props.fileDrafts[fileName] !== undefined &&
    props.fileDrafts[fileName] !== (props.fileContents[fileName] ?? "");

  if (!editable) {
    return content
      ? html`<pre
          style="white-space:pre-wrap;font-size:0.8rem;line-height:1.5;color:var(--text);margin:0;max-height:400px;overflow-y:auto"
        >${content}</pre>`
      : html`
          <div style="color: var(--muted); font-size: 0.8rem; font-style: italic">
            File not found or empty
          </div>
        `;
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
      ${
        isDirty
          ? html`
            <div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end">
              <button
                class="btn btn--sm"
                type="button"
                @click=${() => props.onFileReset(fileName)}
              >
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
          : nothing
      }
    </div>
  `;
}

function renderConfigSection(props: AgentDetailPanelProps) {
  const { configForm, agent } = props;
  if (!configForm || !agent) {
    return html`
      <div style="color: var(--muted); font-size: 0.85rem">No config loaded</div>
    `;
  }

  const agentKey = `agents.${agent.id}`;
  const agentConfig = (configForm[agentKey] ?? {}) as Record<string, unknown>;
  const modelRaw = agentConfig["model"] ?? configForm["model"];
  const model =
    typeof modelRaw === "string" ? modelRaw : modelRaw != null ? JSON.stringify(modelRaw) : "-";
  const commitmentRaw = agentConfig["commitmentStrategy"];
  const commitment = typeof commitmentRaw === "string" ? commitmentRaw : "open-minded";
  const skills = Array.isArray(agentConfig["skills"]) ? (agentConfig["skills"] as unknown[]) : null;

  return html`
    <div class="agent-kv-grid">
      <div class="label">Primary Model</div>
      <div class="value mono">${model}</div>
      <div class="label">Skills Filter</div>
      <div class="value">${skills ? `${skills.length} selected` : "All skills"}</div>
      <div class="label">Commitment Strategy</div>
      <div class="value">${commitment}</div>
    </div>
  `;
}
