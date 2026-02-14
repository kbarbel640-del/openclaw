import { html, nothing } from "lit";
import type { EventLogEntry } from "../app-events.ts";
import { formatEventPayload } from "../presenter.ts";
import { renderJsonBlock } from "./json-renderer.ts";

export type DebugProps = {
  loading: boolean;
  status: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  models: unknown[];
  heartbeat: unknown;
  eventLog: EventLogEntry[];
  callMethod: string;
  callParams: string;
  callResult: string | null;
  callError: string | null;
  onCallMethodChange: (next: string) => void;
  onCallParamsChange: (next: string) => void;
  onRefresh: () => void;
  onCall: () => void;
};

type SnapshotEntry = {
  name: string;
  icon: string;
  keyCount: number;
  data: unknown;
};

let selectedSnapshot: string | null = null;

function countKeys(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  if (Array.isArray(data)) return data.length;
  return Object.keys(data).length;
}

function buildSnapshots(props: DebugProps): SnapshotEntry[] {
  return [
    { name: "Status", icon: "📊", keyCount: countKeys(props.status), data: props.status ?? {} },
    { name: "Health", icon: "💚", keyCount: countKeys(props.health), data: props.health ?? {} },
    { name: "Heartbeat", icon: "💓", keyCount: countKeys(props.heartbeat), data: props.heartbeat ?? {} },
    { name: "Models", icon: "🤖", keyCount: Array.isArray(props.models) ? props.models.length : 0, data: props.models ?? [] },
  ];
}

export function renderDebug(props: DebugProps) {
  const securityAudit =
    props.status && typeof props.status === "object"
      ? (props.status as { securityAudit?: { summary?: Record<string, number> } }).securityAudit
      : null;
  const securitySummary = securityAudit?.summary ?? null;
  const critical = securitySummary?.critical ?? 0;
  const warn = securitySummary?.warn ?? 0;
  const info = securitySummary?.info ?? 0;
  const securityTone = critical > 0 ? "danger" : warn > 0 ? "warn" : "success";
  const securityLabel =
    critical > 0 ? `${critical} critical` : warn > 0 ? `${warn} warnings` : "No critical issues";

  const snapshots = buildSnapshots(props);
  const activeSnapshot = snapshots.find((s) => s.name === selectedSnapshot) ?? null;

  // Trigger re-render hack via callback
  const requestUpdate = () => props.onCallMethodChange(props.callMethod);

  return html`
    ${
      securitySummary
        ? html`<div class="callout ${securityTone}" style="margin-bottom: 12px;">
          Security audit: ${securityLabel}${info > 0 ? ` · ${info} info` : ""}. Run
          <span class="mono">openclaw security audit --deep</span> for details.
        </div>`
        : nothing
    }

    <section class="grid grid-cols-2">
      <div class="card" style="padding: 0;">
        <div class="row" style="justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border);">
          <div>
            <div class="card-title">Snapshots</div>
            <div class="card-sub">Status, health, heartbeat, and models.</div>
          </div>
          <button class="btn btn--sm" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <div class="logs-split ${activeSnapshot ? "logs-split--open" : ""}">
          <div style="flex: 1; min-width: 0;">
            <div class="debug-snapshot-header">
              <div class="debug-snapshot-cell" style="flex: 0 0 36px;"></div>
              <div class="debug-snapshot-cell" style="flex: 1;">Name</div>
              <div class="debug-snapshot-cell" style="flex: 0 0 80px; text-align: right;">Keys</div>
            </div>
            ${snapshots.map(
              (snap) => html`
                <div class="debug-snapshot-row ${selectedSnapshot === snap.name ? "selected" : ""}"
                  @click=${() => { selectedSnapshot = selectedSnapshot === snap.name ? null : snap.name; requestUpdate(); }}>
                  <div style="flex: 0 0 36px; text-align: center;">${snap.icon}</div>
                  <div style="flex: 1; font-weight: 500;">${snap.name}</div>
                  <div class="mono" style="flex: 0 0 80px; text-align: right; color: var(--muted);">${snap.keyCount}</div>
                </div>
              `,
            )}
          </div>
          ${activeSnapshot ? html`
            <div class="log-detail" style="max-height: none;">
              <div class="log-detail-header">
                <div class="card-title" style="font-size: 13px;">${activeSnapshot.icon} ${activeSnapshot.name}</div>
                <button class="btn btn--sm" @click=${() => { selectedSnapshot = null; requestUpdate(); }}>✕</button>
              </div>
              <div style="padding: 10px 14px;">
                ${renderJsonBlock(activeSnapshot.data)}
              </div>
            </div>
          ` : nothing}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Manual RPC</div>
        <div class="card-sub">Send a raw gateway method with JSON params.</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>Method</span>
            <input
              .value=${props.callMethod}
              @input=${(e: Event) => props.onCallMethodChange((e.target as HTMLInputElement).value)}
              placeholder="system-presence"
            />
          </label>
          <label class="field">
            <span>Params (JSON)</span>
            <textarea
              .value=${props.callParams}
              @input=${(e: Event) =>
                props.onCallParamsChange((e.target as HTMLTextAreaElement).value)}
              rows="6"
            ></textarea>
          </label>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button class="btn primary" @click=${props.onCall}>Call</button>
        </div>
        ${
          props.callError
            ? html`<div class="callout danger" style="margin-top: 12px;">
              ${props.callError}
            </div>`
            : nothing
        }
        ${
          props.callResult
            ? html`<div style="margin-top: 12px;">${renderJsonBlock(props.callResult)}</div>`
            : nothing
        }
      </div>
    </section>

    <section class="card" style="margin-top: 18px; padding: 0;">
      <div style="padding: 12px 14px; border-bottom: 1px solid var(--border);">
        <div class="card-title">Event Log</div>
        <div class="card-sub">Latest gateway events.</div>
      </div>
      ${
        props.eventLog.length === 0
          ? html`<div class="muted" style="padding: 12px 14px;">No events yet.</div>`
          : html`
            <div class="debug-snapshot-header">
              <div class="debug-snapshot-cell" style="flex: 0 0 90px;">Time</div>
              <div class="debug-snapshot-cell" style="flex: 1;">Event</div>
            </div>
            ${props.eventLog.map(
              (evt) => html`
                <div class="debug-snapshot-row" style="cursor: default;">
                  <div class="mono" style="flex: 0 0 90px; color: var(--muted); font-size: 11px;">${new Date(evt.ts).toLocaleTimeString()}</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 500; font-size: 12px;">${evt.event}</div>
                    <div style="margin-top: 4px;">${renderJsonBlock(evt.payload)}</div>
                  </div>
                </div>
              `,
            )}
          `
      }
    </section>
  `;
}
