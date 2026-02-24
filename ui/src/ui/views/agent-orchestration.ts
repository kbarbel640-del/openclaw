import { html, nothing } from "lit";
import type {
  AgentOrchestrationConfig,
  OrchestrationLogEntry,
  OrchestrationLogsResult,
  OrchestrationConfigResult,
  HandoffTargetsResult,
  SharedContextListResult,
  SharedContextItem,
} from "../controllers/orchestration.ts";

export type AgentOrchestrationProps = {
  agentId: string;
  configLoading: boolean;
  configError: string | null;
  configResult: OrchestrationConfigResult | null;
  logsLoading: boolean;
  logsError: string | null;
  logsResult: OrchestrationLogsResult | null;
  handoffTargetsLoading: boolean;
  handoffTargetsError: string | null;
  handoffTargetsResult: HandoffTargetsResult | null;
  sharedContextLoading: boolean;
  sharedContextError: string | null;
  sharedContextResult: SharedContextListResult | null;
  onRefreshConfig: () => void;
  onRefreshLogs: () => void;
  onRefreshHandoffTargets: () => void;
  onRefreshSharedContext: (scope: "session" | "global") => void;
};

export function renderAgentOrchestration(props: AgentOrchestrationProps) {
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Orchestration</div>
          <div class="card-sub">Agent orchestration configuration, logs, and shared context.</div>
        </div>
      </div>

      <div style="margin-top: 24px;">
        ${renderOrchestrationConfig(props)}
        ${renderHandoffTargets(props)}
        ${renderSharedContext(props)}
        ${renderOrchestrationLogs(props)}
      </div>
    </section>
  `;
}

function renderOrchestrationConfig(props: AgentOrchestrationProps) {
  const { configLoading, configError, configResult, onRefreshConfig } = props;
  const config = configResult?.config;

  return html`
    <div class="agent-section" style="margin-bottom: 24px;">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
        <div class="label">Orchestration Configuration</div>
        <button class="btn btn--sm" ?disabled=${configLoading} @click=${onRefreshConfig}>
          ${configLoading ? "Loading…" : "Refresh"}
        </button>
      </div>

      ${
        configError
          ? html`<div class="callout danger">${configError}</div>`
          : configLoading
            ? html`<div class="muted">Loading configuration…</div>`
            : !config
              ? html`<div class="muted">No orchestration configuration found.</div>`
              : html`
                  <div class="agents-overview-grid">
                    <div class="agent-kv">
                      <div class="label">Supervisor Enabled</div>
                      <div>${config.supervisor?.enabled ? "yes" : "no"}</div>
                    </div>
                    ${
                      config.supervisor?.enabled
                        ? html`
                            <div class="agent-kv">
                              <div class="label">Default Strategy</div>
                              <div>${config.supervisor.defaultStrategy || "delegate"}</div>
                            </div>
                          `
                        : nothing
                    }
                    <div class="agent-kv">
                      <div class="label">Intents Configured</div>
                      <div>${config.intents?.length ?? 0}</div>
                    </div>
                    <div class="agent-kv">
                      <div class="label">Handoff Enabled</div>
                      <div>${config.handoff ? "yes" : "no"}</div>
                    </div>
                    ${
                      config.handoff
                        ? html`
                            <div class="agent-kv">
                              <div class="label">Transfer Context</div>
                              <div>${config.handoff.transferContext ? "yes" : "no"}</div>
                            </div>
                          `
                        : nothing
                    }
                    <div class="agent-kv">
                      <div class="label">Shared Context</div>
                      <div>${config.sharedContext?.enabled ? "enabled" : "disabled"}</div>
                    </div>
                  </div>

                  ${
                    config.intents && config.intents.length > 0
                      ? html`
                          <div style="margin-top: 16px;">
                            <div class="label" style="margin-bottom: 8px;">Configured Intents</div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                              ${config.intents.map(
                                (intent) => html`
                                  <div class="agent-kv" style="padding: 8px; background: var(--bg-subtle); border-radius: 4px;">
                                    <div class="label">${intent.id}</div>
                                    <div style="font-size: 0.875rem; margin-top: 4px;">
                                      <div>Keywords: ${intent.keywords.join(", ")}</div>
                                      <div>Categories: ${intent.categories.join(", ")}</div>
                                      ${intent.confidence ? html`<div>Min Confidence: ${intent.confidence}</div>` : nothing}
                                    </div>
                                  </div>
                                `,
                              )}
                            </div>
                          </div>
                        `
                      : nothing
                  }
                `
      }
    </div>
  `;
}

function renderHandoffTargets(props: AgentOrchestrationProps) {
  const { handoffTargetsLoading, handoffTargetsError, handoffTargetsResult, onRefreshHandoffTargets } = props;
  const targets = handoffTargetsResult?.targets ?? [];

  return html`
    <div class="agent-section" style="margin-bottom: 24px;">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
        <div class="label">Handoff Targets</div>
        <button class="btn btn--sm" ?disabled=${handoffTargetsLoading} @click=${onRefreshHandoffTargets}>
          ${handoffTargetsLoading ? "Loading…" : "Refresh"}
        </button>
      </div>

      ${
        handoffTargetsError
          ? html`<div class="callout danger">${handoffTargetsError}</div>`
          : handoffTargetsLoading
            ? html`<div class="muted">Loading handoff targets…</div>`
            : targets.length === 0
              ? html`<div class="muted">No handoff targets configured.</div>`
              : html`
                  <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${targets.map(
                      (target) => html`
                        <span
                          class="agent-pill"
                          style="background: var(--bg-subtle); padding: 4px 12px; border-radius: 12px; font-size: 0.875rem;"
                        >
                          ${target}
                        </span>
                      `,
                    )}
                  </div>
                `
      }
    </div>
  `;
}

function renderSharedContext(props: AgentOrchestrationProps) {
  const { sharedContextLoading, sharedContextError, sharedContextResult, onRefreshSharedContext } = props;
  const items = sharedContextResult?.items ?? [];
  const scope = sharedContextResult?.scope ?? "session";

  return html`
    <div class="agent-section" style="margin-bottom: 24px;">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
        <div class="label">Shared Context (${scope})</div>
        <div class="row" style="gap: 8px;">
          <button class="btn btn--sm" ?disabled=${sharedContextLoading} @click=${() => onRefreshSharedContext("session")}>
            Session
          </button>
          <button class="btn btn--sm" ?disabled=${sharedContextLoading} @click=${() => onRefreshSharedContext("global")}>
            Global
          </button>
        </div>
      </div>

      ${
        sharedContextError
          ? html`<div class="callout danger">${sharedContextError}</div>`
          : sharedContextLoading
            ? html`<div class="muted">Loading shared context…</div>`
            : items.length === 0
              ? html`<div class="muted">No shared context items found.</div>`
              : html`
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${items.map(
                      (item) => html`
                        <div class="agent-kv" style="padding: 8px; background: var(--bg-subtle); border-radius: 4px;">
                          <div class="label">${item.key}</div>
                          <div style="font-size: 0.875rem; margin-top: 4px;">
                            <div class="mono" style="word-break: break-all;">${JSON.stringify(item.value)}</div>
                            <div class="muted" style="margin-top: 4px;">
                              Updated: ${new Date(item.updatedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      `,
                    )}
                  </div>
                `
      }
    </div>
  `;
}

function renderOrchestrationLogs(props: AgentOrchestrationProps) {
  const { logsLoading, logsError, logsResult, onRefreshLogs } = props;
  const entries = logsResult?.entries ?? [];

  return html`
    <div class="agent-section">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
        <div>
          <div class="label">Communication Logs</div>
          <div class="card-sub" style="margin-top: 4px;">
            Agent-to-agent interactions and orchestration events.
          </div>
        </div>
        <button class="btn btn--sm" ?disabled=${logsLoading} @click=${onRefreshLogs}>
          ${logsLoading ? "Loading…" : "Refresh"}
        </button>
      </div>

      ${
        logsError
          ? html`<div class="callout danger">${logsError}</div>`
          : logsLoading
            ? html`<div class="muted">Loading logs…</div>`
            : entries.length === 0
              ? html`<div class="muted">No orchestration logs found.</div>`
              : html`
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${entries.map((entry) => renderLogEntry(entry))}
                  </div>
                  ${
                    logsResult && logsResult.total > entries.length
                      ? html`
                          <div class="muted" style="margin-top: 12px; text-align: center;">
                            Showing ${entries.length} of ${logsResult.total} entries
                          </div>
                        `
                      : nothing
                  }
                `
      }
    </div>
  `;
}

function renderLogEntry(entry: OrchestrationLogEntry) {
  const eventIcon = getEventIcon(entry.eventType);
  const eventLabel = getEventLabel(entry.eventType);
  const timestamp = new Date(entry.timestamp).toLocaleString();

  return html`
    <div class="agent-kv" style="padding: 12px; background: var(--bg-subtle); border-radius: 4px;">
      <div class="row" style="justify-content: space-between; margin-bottom: 8px;">
        <div class="row" style="gap: 8px; align-items: center;">
          <span style="font-size: 1.25rem;">${eventIcon}</span>
          <span class="label">${eventLabel}</span>
        </div>
        <span class="muted" style="font-size: 0.75rem;">${timestamp}</span>
      </div>

      <div style="font-size: 0.875rem; display: flex; flex-direction: column; gap: 4px;">
        ${entry.fromAgent ? html`<div>From: <span class="mono">${entry.fromAgent}</span></div>` : nothing}
        ${entry.toAgent ? html`<div>To: <span class="mono">${entry.toAgent}</span></div>` : nothing}
        ${entry.intent ? html`<div>Intent: <span class="mono">${entry.intent}</span></div>` : nothing}
        ${
          entry.confidence !== undefined
            ? html`<div>Confidence: <span class="mono">${(entry.confidence * 100).toFixed(1)}%</span></div>`
            : nothing
        }
        ${entry.contextKey ? html`<div>Context Key: <span class="mono">${entry.contextKey}</span></div>` : nothing}
        ${
          entry.details && Object.keys(entry.details).length > 0
            ? html`
                <details style="margin-top: 8px;">
                  <summary style="cursor: pointer; user-select: none;">Details</summary>
                  <pre
                    style="margin-top: 8px; padding: 8px; background: var(--bg-base); border-radius: 4px; overflow-x: auto; font-size: 0.75rem;"
                  >${JSON.stringify(entry.details, null, 2)}</pre>
                </details>
              `
            : nothing
        }
      </div>

      <div class="muted" style="font-size: 0.75rem; margin-top: 8px;">
        Run: <span class="mono">${entry.runId}</span> | Seq: ${entry.sequence}
      </div>
    </div>
  `;
}

function getEventIcon(eventType: OrchestrationLogEntry["eventType"]): string {
  switch (eventType) {
    case "handoff":
      return "🤝";
    case "delegation":
      return "📋";
    case "contextShare":
      return "💾";
    case "intentRoute":
      return "🎯";
    default:
      return "📝";
  }
}

function getEventLabel(eventType: OrchestrationLogEntry["eventType"]): string {
  switch (eventType) {
    case "handoff":
      return "Agent Handoff";
    case "delegation":
      return "Task Delegation";
    case "contextShare":
      return "Context Share";
    case "intentRoute":
      return "Intent Routing";
    default:
      return "Event";
  }
}
