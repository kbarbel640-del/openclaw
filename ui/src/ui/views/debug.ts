import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type { EventLogEntry } from "../app-events.ts";
import { getUiLocale } from "../format.ts";
import { formatEventPayload } from "../presenter.ts";

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
    critical > 0
      ? t("debugUi.securityCritical", { count: String(critical) })
      : warn > 0
        ? t("debugUi.securityWarnings", { count: String(warn) })
        : t("debugUi.securityNoCritical");

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">${t("debugUi.snapshotsTitle")}</div>
            <div class="card-sub">${t("debugUi.snapshotsSubtitle")}</div>
          </div>
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? t("debugUi.refreshing") : t("common.refresh")}
          </button>
        </div>
        <div class="stack" style="margin-top: 12px;">
          <div>
            <div class="muted">${t("debugUi.status")}</div>
            ${
              securitySummary
                ? html`<div class="callout ${securityTone}" style="margin-top: 8px;">
                  ${t("debugUi.securityAuditPrefix")} ${securityLabel}${
                    info > 0 ? t("debugUi.securityInfoSuffix", { count: String(info) }) : ""
                  }.
                  ${t("debugUi.securityAuditRunForDetails", {
                    command: "openclaw security audit --deep",
                  })}
                </div>`
                : nothing
            }
            <pre class="code-block">${JSON.stringify(props.status ?? {}, null, 2)}</pre>
          </div>
          <div>
            <div class="muted">${t("debugUi.health")}</div>
            <pre class="code-block">${JSON.stringify(props.health ?? {}, null, 2)}</pre>
          </div>
          <div>
            <div class="muted">${t("debugUi.lastHeartbeat")}</div>
            <pre class="code-block">${JSON.stringify(props.heartbeat ?? {}, null, 2)}</pre>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${t("debugUi.manualRpcTitle")}</div>
        <div class="card-sub">${t("debugUi.manualRpcSubtitle")}</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>${t("debugUi.method")}</span>
            <input
              .value=${props.callMethod}
              @input=${(e: Event) => props.onCallMethodChange((e.target as HTMLInputElement).value)}
              placeholder=${t("debugUi.methodPlaceholder")}
            />
          </label>
          <label class="field">
            <span>${t("debugUi.paramsJson")}</span>
            <textarea
              .value=${props.callParams}
              @input=${(e: Event) =>
                props.onCallParamsChange((e.target as HTMLTextAreaElement).value)}
              rows="6"
            ></textarea>
          </label>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button class="btn primary" @click=${props.onCall}>${t("debugUi.call")}</button>
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
            ? html`<pre class="code-block" style="margin-top: 12px;">${props.callResult}</pre>`
            : nothing
        }
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${t("debugUi.modelsTitle")}</div>
      <div class="card-sub">${t("debugUi.modelsSubtitle")}</div>
      <pre class="code-block" style="margin-top: 12px;">${JSON.stringify(
        props.models ?? [],
        null,
        2,
      )}</pre>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${t("debugUi.eventLogTitle")}</div>
      <div class="card-sub">${t("debugUi.eventLogSubtitle")}</div>
      ${
        props.eventLog.length === 0
          ? html`
              <div class="muted" style="margin-top: 12px">${t("debugUi.noEvents")}</div>
            `
          : html`
            <div class="list" style="margin-top: 12px;">
              ${props.eventLog.map(
                (evt) => html`
                  <div class="list-item">
                    <div class="list-main">
                      <div class="list-title">${evt.event}</div>
                      <div class="list-sub">${new Date(evt.ts).toLocaleTimeString(getUiLocale())}</div>
                    </div>
                    <div class="list-meta">
                      <pre class="code-block">${formatEventPayload(evt.payload)}</pre>
                    </div>
                  </div>
                `,
              )}
            </div>
          `
      }
    </section>
  `;
}
