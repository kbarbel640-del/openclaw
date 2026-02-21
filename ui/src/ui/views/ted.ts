import { html, nothing } from "lit";
import type {
  TedJobCardImpactPreview,
  TedIntakeRecommendation,
  TedJobCardDetail,
  TedKpiSuggestion,
  TedPolicyDocument,
  TedPolicyImpactPreview,
  TedPolicyKey,
  TedSourceDocument,
  TedWorkbenchSnapshot,
} from "../types.ts";

export type TedWorkbenchSection = "all" | "operate" | "build" | "govern" | "intake" | "evals";

export type TedViewProps = {
  loading: boolean;
  snapshot: TedWorkbenchSnapshot | null;
  error: string | null;
  roleCardJson: string;
  roleCardBusy: boolean;
  roleCardResult: string | null;
  roleCardError: string | null;
  proofBusyKey: string | null;
  proofResult: string | null;
  proofError: string | null;
  jobCardDetailLoading: boolean;
  jobCardDetail: TedJobCardDetail | null;
  jobCardDetailError: string | null;
  jobCardEditorMarkdown: string;
  jobCardSaveBusy: boolean;
  jobCardSaveError: string | null;
  jobCardSaveResult: string | null;
  jobCardPreviewBusy: boolean;
  jobCardPreviewError: string | null;
  jobCardPreview: TedJobCardImpactPreview | null;
  jobCardKpiSuggestBusy: boolean;
  jobCardKpiSuggestError: string | null;
  jobCardKpiSuggestion: TedKpiSuggestion | null;
  recommendationBusyId: string | null;
  recommendationError: string | null;
  intakeTitle: string;
  intakeOutcome: string;
  intakeJobFamily: string;
  intakeRiskLevel: string;
  intakeAutomationLevel: string;
  intakeBusy: boolean;
  intakeError: string | null;
  intakeRecommendation: TedIntakeRecommendation | null;
  thresholdManual: string;
  thresholdApprovalAge: string;
  thresholdTriageEod: string;
  thresholdBlockedExplainability: string;
  thresholdAcknowledgeRisk: boolean;
  thresholdBusy: boolean;
  thresholdError: string | null;
  thresholdResult: string | null;
  sourceDocLoading: boolean;
  sourceDocError: string | null;
  sourceDoc: TedSourceDocument | null;
  policyLoading: boolean;
  policyError: string | null;
  policyDoc: TedPolicyDocument | null;
  policyPreviewBusy: boolean;
  policyPreviewError: string | null;
  policyPreview: TedPolicyImpactPreview | null;
  policySaveBusy: boolean;
  policySaveError: string | null;
  policySaveResult: string | null;
  connectorAuthBusyProfile: string | null;
  connectorAuthError: string | null;
  connectorAuthResult: string | null;
  activeSection: TedWorkbenchSection;
  onRoleCardJsonChange: (value: string) => void;
  onRoleCardValidate: () => void;
  onRunProof: (proofScript: string) => void;
  onOpenJobCard: (id: string) => void;
  onRecommendationDecision: (id: string, decision: "approved" | "dismissed") => void;
  onIntakeFieldChange: (
    field: "title" | "outcome" | "job_family" | "risk_level" | "automation_level",
    value: string,
  ) => void;
  onRunIntakeRecommendation: () => void;
  onApplyIntakeExample: (example: "ops-brief" | "deal-followup" | "governance-hardening") => void;
  onThresholdFieldChange: (
    field: "manual" | "approval" | "triage" | "blocked" | "ack",
    value: string,
  ) => void;
  onApplyThresholds: () => void;
  onResetThresholds: () => void;
  onSetSection: (section: TedWorkbenchSection) => void;
  onJobCardEditorChange: (value: string) => void;
  onSaveJobCardDetail: () => void;
  onPreviewJobCardUpdate: () => void;
  onSuggestJobCardKpis: () => void;
  onApplySuggestedKpisToEditor: () => void;
  onOpenSourceDoc: (
    key: "job_board" | "promotion_policy" | "value_friction" | "interrogation_cycle",
  ) => void;
  onLoadPolicyDoc: (key: TedPolicyKey) => void;
  onPolicyConfigChange: (
    field: "objective" | "rollout_mode" | "automation_ceiling" | "operator_notes",
    value: string,
  ) => void;
  onPolicyListChange: (field: "success_checks" | "guardrails", value: string) => void;
  onPreviewPolicyUpdate: () => void;
  onSavePolicyUpdate: () => void;
  onStartConnectorAuth: (profileId: "olumie" | "everest") => void;
  onPollConnectorAuth: (profileId: "olumie" | "everest") => void;
  onRevokeConnectorAuth: (profileId: "olumie" | "everest") => void;
  onRefresh: () => void;
};

function familyLabel(family: "GOV" | "MNT" | "ING" | "LED" | "OUT"): string {
  if (family === "GOV") {
    return "Governance and Safety";
  }
  if (family === "MNT") {
    return "Reliability and Operations";
  }
  if (family === "ING") {
    return "Connectors and Intake";
  }
  if (family === "LED") {
    return "Deal and Work Ledger";
  }
  return "Outbound Drafting and Scheduling";
}

function toneForSeverity(severity: string): "" | "warn" | "danger" {
  if (severity === "critical") {
    return "danger";
  }
  if (severity === "warn") {
    return "warn";
  }
  return "";
}

function labelForJobCardStatus(status: string): string {
  if (status === "IN_PROGRESS") {
    return "In Progress";
  }
  if (status === "TODO_OR_UNKNOWN") {
    return "Not Started";
  }
  if (status === "DONE") {
    return "Complete";
  }
  if (status === "BLOCKED") {
    return "Needs Attention";
  }
  return status;
}

function toneForJobCardStatus(status: string): "" | "warn" | "danger" {
  if (status === "BLOCKED") {
    return "danger";
  }
  if (status === "IN_PROGRESS" || status === "TODO_OR_UNKNOWN") {
    return "warn";
  }
  return "";
}

function labelForConfidenceBand(band: "hold" | "watch" | "progressing" | "ready"): string {
  if (band === "ready") {
    return "Promotion Ready";
  }
  if (band === "progressing") {
    return "Building Confidence";
  }
  if (band === "watch") {
    return "Needs Monitoring";
  }
  return "Hold Promotion";
}

function toneForConfidenceBand(
  band: "hold" | "watch" | "progressing" | "ready",
): "" | "warn" | "danger" {
  if (band === "hold") {
    return "danger";
  }
  if (band === "watch") {
    return "warn";
  }
  return "";
}

function labelForSection(section: TedWorkbenchSection): string {
  if (section === "all") {
    return "All";
  }
  if (section === "operate") {
    return "Run Today";
  }
  if (section === "build") {
    return "Build and Improve";
  }
  if (section === "govern") {
    return "Safety Controls";
  }
  if (section === "intake") {
    return "Add New Work";
  }
  return "Quality Trends";
}

function sectionFocus(section: TedWorkbenchSection): { title: string; subtitle: string } {
  if (section === "operate") {
    return {
      title: "Operate: Run Today",
      subtitle: "Review today’s decisions, blockers, and immediate actions.",
    };
  }
  if (section === "build") {
    return {
      title: "Build: Improve the System",
      subtitle: "Open work items, run proof checks, and inspect implementation details.",
    };
  }
  if (section === "govern") {
    return {
      title: "Govern: Safety and Approval",
      subtitle: "Control risk thresholds, approvals, and explainability.",
    };
  }
  if (section === "intake") {
    return {
      title: "Intake: Add New Work",
      subtitle: "Capture a new job and get a safe starter configuration.",
    };
  }
  if (section === "evals") {
    return {
      title: "Evals: Quality Trends",
      subtitle: "Track KPI and proof trajectories before promotions.",
    };
  }
  return {
    title: "All Views: Full Console",
    subtitle: "See the complete Ted operating picture in one place.",
  };
}

function humanizeRecommendationId(id: string): string {
  if (id === "blocked-job-cards") {
    return "Blocked work items";
  }
  if (id === "ted-sidecar-unhealthy") {
    return "Ted runtime health issue";
  }
  if (id === "steady-state") {
    return "Steady state";
  }
  if (id === "job-cards-not-found") {
    return "Job-card source missing";
  }
  if (id === "missing-kpi-signals") {
    return "Missing KPI signals";
  }
  return id.replaceAll("-", " ");
}

function labelForPolicyKey(key: TedPolicyKey): string {
  if (key === "job_board") {
    return "Job Board Policy";
  }
  if (key === "promotion_policy") {
    return "Promotion Policy";
  }
  return "Value and Friction Gates";
}

function toneForRiskDirection(direction: "safer" | "riskier" | "neutral"): "" | "warn" | "danger" {
  if (direction === "riskier") {
    return "danger";
  }
  if (direction === "neutral") {
    return "warn";
  }
  return "";
}

function toneForIntegrationStatus(
  status: "connected" | "needs_auth" | "misconfigured" | "error",
): "" | "warn" | "danger" {
  if (status === "connected") {
    return "";
  }
  if (status === "needs_auth") {
    return "warn";
  }
  return "danger";
}

export function renderTed(props: TedViewProps) {
  const snapshot = props.snapshot;
  const healthTone = snapshot?.sidecar.healthy ? "ok" : "warn";
  const healthText = snapshot?.sidecar.healthy ? "Healthy" : "Unhealthy";
  const section = props.activeSection;
  const showOperate = section === "all" || section === "operate";
  const showBuild = section === "all" || section === "build";
  const showGovern = section === "all" || section === "govern";
  const showIntake = section === "all" || section === "intake";
  const showEvals = section === "all" || section === "evals";
  const focus = sectionFocus(section);
  const familyCounts = snapshot
    ? snapshot.job_cards.cards.reduce<Record<string, number>>((acc, card) => {
        acc[card.family] = (acc[card.family] ?? 0) + 1;
        return acc;
      }, {})
    : {};
  const detailConfidence =
    snapshot && props.jobCardDetail
      ? snapshot.job_cards.cards.find((card) => card.id === props.jobCardDetail?.id)
          ?.promotion_confidence
      : null;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Ted Operations Console</div>
          <div class="card-sub">
            Run today’s work, review decisions, and keep operations safe.
          </div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      ${
        props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing
      }

      <div class="row" style="gap: 8px; flex-wrap: wrap; margin-top: 12px;">
        ${(["all", "operate", "build", "govern", "intake", "evals"] as TedWorkbenchSection[]).map(
          (candidate) => html`
            <button
              class="btn btn--sm ${props.activeSection === candidate ? "active" : ""}"
              aria-pressed=${props.activeSection === candidate ? "true" : "false"}
              title=${`Switch to ${labelForSection(candidate)} view`}
              @click=${() => props.onSetSection(candidate)}
            >
              ${labelForSection(candidate)}
            </button>
          `,
        )}
      </div>

      <div class="card" style="margin-top: 12px; margin-bottom: 0;">
        <div class="card-title">${focus.title}</div>
        <div class="card-sub">${focus.subtitle}</div>
      </div>

      ${
        snapshot
          ? html`
              <div class="stat-grid" style="margin-top: 14px;">
                <div class="stat">
                  <div class="stat-label">Sidecar</div>
                  <div class="stat-value ${healthTone}">${healthText}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Job Cards Total</div>
                  <div class="stat-value">${snapshot.job_cards.total}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Done</div>
                  <div class="stat-value ok">${snapshot.job_cards.done}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Blocked</div>
                  <div class="stat-value ${snapshot.job_cards.blocked > 0 ? "warn" : "ok"}">
                    ${snapshot.job_cards.blocked}
                  </div>
                </div>
              </div>

              ${
                showOperate
                  ? html`<div class="grid grid-cols-2" style="margin-top: 16px;">
                <div class="card" style="margin: 0;">
                  <div class="card-title">Daily Friction Limits</div>
                  <div class="list" style="margin-top: 10px;">
                    <div class="list-item"><div class="list-main"><div class="list-title">Manual work per day</div></div><div class="list-meta mono"><= ${snapshot.friction_kpis.manual_minutes_per_day_max}m</div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Oldest pending decision</div></div><div class="list-meta mono"><= ${snapshot.friction_kpis.approval_queue_oldest_minutes_max}m</div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Unresolved triage at EOD</div></div><div class="list-meta mono"><= ${snapshot.friction_kpis.unresolved_triage_eod_max}</div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Blocked items without reason</div></div><div class="list-meta mono">${snapshot.friction_kpis.blocked_actions_missing_explainability_max}</div></div>
                  </div>
                </div>

                <div class="card" style="margin: 0;">
                  <div class="card-title">Source Documents</div>
                  <div class="muted" style="margin-top: 6px;">
                    Job cards source:
                    <span class="mono"
                      >${snapshot.data_sources.job_cards_dir ?? "not discovered"}</span
                    >
                  </div>
                  <div class="list" style="margin-top: 10px;">
                    <div class="list-item">
                      <div class="list-main"><div class="list-title">Job Board</div></div>
                      <div class="list-meta">
                        <div class="mono">${snapshot.references.job_board}</div>
                        <button class="btn ghost mono" style="margin-top: 6px;" @click=${() => props.onOpenSourceDoc("job_board")}>Open</button>
                      </div>
                    </div>
                    <div class="list-item">
                      <div class="list-main"><div class="list-title">Promotion Policy</div></div>
                      <div class="list-meta">
                        <div class="mono">${snapshot.references.promotion_policy}</div>
                        <button class="btn ghost mono" style="margin-top: 6px;" @click=${() => props.onOpenSourceDoc("promotion_policy")}>Open</button>
                      </div>
                    </div>
                    <div class="list-item">
                      <div class="list-main"><div class="list-title">Value and Friction Gates</div></div>
                      <div class="list-meta">
                        <div class="mono">${snapshot.references.value_friction}</div>
                        <button class="btn ghost mono" style="margin-top: 6px;" @click=${() => props.onOpenSourceDoc("value_friction")}>Open</button>
                      </div>
                    </div>
                    <div class="list-item">
                      <div class="list-main"><div class="list-title">Council Interrogation Cycle</div></div>
                      <div class="list-meta">
                        <div class="mono">${snapshot.references.interrogation_cycle}</div>
                        <button class="btn ghost mono" style="margin-top: 6px;" @click=${() => props.onOpenSourceDoc("interrogation_cycle")}>Open</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>`
                  : nothing
              }

              ${
                showOperate && props.sourceDoc
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Document Viewer</div>
                      <div class="card-sub">Read key SDD source docs without leaving Ted.</div>
                      <div class="muted mono" style="margin-top: 8px;">${props.sourceDoc.path}</div>
                      <pre class="mono" style="margin-top: 10px; max-height: 260px; overflow: auto; white-space: pre-wrap;">${props.sourceDoc.content}</pre>
                    </div>`
                  : nothing
              }
              ${
                showOperate && props.sourceDocLoading
                  ? html`
                      <div class="muted" style="margin-top: 10px">Loading document…</div>
                    `
                  : nothing
              }
              ${
                showOperate && props.sourceDocError
                  ? html`<div class="callout danger" style="margin-top: 10px;">${props.sourceDocError}</div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="grid grid-cols-2" style="margin-top: 16px;">
                      <div class="card" style="margin: 0;">
                        <div class="card-title">Operator Workflow (Clint View)</div>
                        <div class="card-sub">Where work is reviewed, approved, and progressed.</div>
                        <div class="list" style="margin-top: 10px;">
                          <div class="list-item">
                            <div class="list-main">
                              <div class="list-title">Primary approval surface</div>
                              <div class="list-sub mono">${snapshot.operator_flow.primary_approval_surface}</div>
                            </div>
                          </div>
                          <div class="list-item">
                            <div class="list-main">
                              <div class="list-title">Secondary fallback surface</div>
                              <div class="list-sub mono">${snapshot.operator_flow.secondary_approval_surface}</div>
                            </div>
                          </div>
                          <div class="list-item">
                            <div class="list-main">
                              <div class="list-title">Draft review path</div>
                              <div class="list-sub mono">${snapshot.operator_flow.draft_review_surface}</div>
                            </div>
                          </div>
                        </div>
                        <div class="muted" style="margin-top: 8px;">
                          ${snapshot.operator_flow.notes.join(" ")}
                        </div>
                      </div>

                      <div class="card" style="margin: 0;">
                        <div class="card-title">Integration Health</div>
                        <div class="card-sub">
                          M365 profile status and sign-in actions for Ted-managed workflows.
                        </div>
                        <div class="list" style="margin-top: 10px;">
                          ${snapshot.integrations.m365_profiles.map(
                            (profile) => html`<div class="list-item">
                              <div class="list-main">
                                <div class="list-title">${profile.profile_id}</div>
                                <div class="list-sub">scopes: ${profile.delegated_scopes_count} | auth store: ${profile.auth_store ?? "n/a"}</div>
                              </div>
                              <div class="list-meta">
                                <span class="pill ${toneForIntegrationStatus(profile.status)}">${profile.status}</span>
                                <div class="muted" style="margin-top: 6px; max-width: 320px;">${profile.next_step}</div>
                                ${profile.last_error ? html`<div class="muted mono" style="margin-top: 6px;">${profile.last_error}</div>` : nothing}
                                <div class="row" style="gap: 6px; margin-top: 8px; justify-content: flex-end;">
                                  <button
                                    class="btn ghost btn--sm"
                                    ?disabled=${props.connectorAuthBusyProfile !== null}
                                    @click=${() => props.onStartConnectorAuth(profile.profile_id as "olumie" | "everest")}
                                  >
                                    ${
                                      props.connectorAuthBusyProfile === profile.profile_id
                                        ? "Starting..."
                                        : "Start sign-in"
                                    }
                                  </button>
                                  <button
                                    class="btn ghost btn--sm"
                                    ?disabled=${props.connectorAuthBusyProfile !== null}
                                    @click=${() => props.onPollConnectorAuth(profile.profile_id as "olumie" | "everest")}
                                  >
                                    ${
                                      props.connectorAuthBusyProfile === profile.profile_id
                                        ? "Checking..."
                                        : "Check sign-in"
                                    }
                                  </button>
                                  <button
                                    class="btn ghost btn--sm"
                                    ?disabled=${props.connectorAuthBusyProfile !== null}
                                    @click=${() => props.onRevokeConnectorAuth(profile.profile_id as "olumie" | "everest")}
                                  >
                                    ${
                                      props.connectorAuthBusyProfile === profile.profile_id
                                        ? "Revoking..."
                                        : "Revoke"
                                    }
                                  </button>
                                </div>
                              </div>
                            </div>`,
                          )}
                        </div>
                        ${
                          props.connectorAuthError
                            ? html`<div class="callout danger" style="margin-top: 10px;">${props.connectorAuthError}</div>`
                            : nothing
                        }
                        ${
                          props.connectorAuthResult
                            ? html`<pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.connectorAuthResult}</pre>`
                            : nothing
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">Delivery Speed Controls (Advanced)</div>
                <div class="card-sub">
                  Move faster only when you choose to accept higher risk. Lower limits are safer; higher limits unlock more automation sooner.
                </div>
                ${
                  snapshot.threshold_controls.relaxed
                    ? html`<div class="callout warn" style="margin-top: 10px;">
                        Warnings: ${snapshot.threshold_controls.warnings.join(" ")}
                      </div>`
                    : nothing
                }
                <div class="grid grid-cols-2" style="margin-top: 10px;">
                  <label>
                    <div class="card-sub">Max manual work/day (minutes)</div>
                    <input
                      class="input"
                      .value=${props.thresholdManual}
                      @input=${(event: Event) =>
                        props.onThresholdFieldChange(
                          "manual",
                          (event.currentTarget as HTMLInputElement).value,
                        )}
                    />
                  </label>
                  <label>
                    <div class="card-sub">Max oldest pending decision (minutes)</div>
                    <input
                      class="input"
                      .value=${props.thresholdApprovalAge}
                      @input=${(event: Event) =>
                        props.onThresholdFieldChange(
                          "approval",
                          (event.currentTarget as HTMLInputElement).value,
                        )}
                    />
                  </label>
                </div>
                <div class="grid grid-cols-2" style="margin-top: 10px;">
                  <label>
                    <div class="card-sub">Max unresolved triage at end of day</div>
                    <input
                      class="input"
                      .value=${props.thresholdTriageEod}
                      @input=${(event: Event) =>
                        props.onThresholdFieldChange(
                          "triage",
                          (event.currentTarget as HTMLInputElement).value,
                        )}
                    />
                  </label>
                  <label>
                    <div class="card-sub">Max blocked items without reason</div>
                    <input
                      class="input"
                      .value=${props.thresholdBlockedExplainability}
                      @input=${(event: Event) =>
                        props.onThresholdFieldChange(
                          "blocked",
                          (event.currentTarget as HTMLInputElement).value,
                        )}
                    />
                  </label>
                </div>
                <label class="row" style="margin-top: 10px;">
                  <input
                    type="checkbox"
                    .checked=${props.thresholdAcknowledgeRisk}
                    @change=${(event: Event) =>
                      props.onThresholdFieldChange(
                        "ack",
                        String((event.currentTarget as HTMLInputElement).checked),
                      )}
                  />
                  <span class="muted"
                    >I understand this can deliver value faster, but with more risk.</span
                  >
                </label>
                <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 10px;">
                  <button
                    class="btn ghost"
                    ?disabled=${props.thresholdBusy}
                    @click=${props.onResetThresholds}
                  >
                    Reset Safe Defaults
                  </button>
                  <button
                    class="btn"
                    ?disabled=${props.thresholdBusy}
                    @click=${props.onApplyThresholds}
                  >
                    ${props.thresholdBusy ? "Applying..." : "Apply Changes"}
                  </button>
                </div>
                ${
                  props.thresholdError
                    ? html`<div class="callout danger" style="margin-top: 10px;">${props.thresholdError}</div>`
                    : nothing
                }
                ${
                  props.thresholdResult
                    ? html`<pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.thresholdResult}</pre>`
                    : nothing
                }
                <div class="card" style="margin-top: 12px; margin-bottom: 0;">
                  <div class="card-title">What Unlocks as Quality Improves</div>
                  <div class="list" style="margin-top: 8px;">
                    <div class="list-item"><div class="list-main"><div class="list-title">Stage 1 - Daily value now</div><div class="list-sub">Briefs, draft queue, and governed approvals.</div></div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Stage 2 - Safer data handling</div><div class="list-sub">Stronger entity separation, provenance checks, and audience controls.</div></div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Stage 3 - Better decisions</div><div class="list-sub">Confidence routing and contradiction detection with citations.</div></div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Stage 4 - Resilience</div><div class="list-sub">Pause/resume catch-up and rate-limit protection.</div></div></div>
                    <div class="list-item"><div class="list-main"><div class="list-title">Stage 5 - Governed learning</div><div class="list-sub">Measured improvement loops with no silent behavior drift.</div></div></div>
                  </div>
                </div>
              </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Policy Center</div>
                      <div class="card-sub">
                        Configure policy safely with preview before save.
                      </div>
                      <div class="row" style="gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                        ${(
                          ["job_board", "promotion_policy", "value_friction"] as TedPolicyKey[]
                        ).map(
                          (key) => html`<button
                            class="btn btn--sm ${props.policyDoc?.key === key ? "active" : ""}"
                            @click=${() => props.onLoadPolicyDoc(key)}
                          >
                            ${labelForPolicyKey(key)}
                          </button>`,
                        )}
                      </div>
                      ${
                        props.policyLoading
                          ? html`
                              <div class="muted" style="margin-top: 10px">Loading policy…</div>
                            `
                          : nothing
                      }
                      ${
                        props.policyError
                          ? html`<div class="callout danger" style="margin-top: 10px;">${props.policyError}</div>`
                          : nothing
                      }
                      ${
                        props.policyDoc
                          ? html`<div style="margin-top: 10px;">
                              <div class="muted mono">${props.policyDoc.path}</div>
                              <div class="grid grid-cols-2" style="margin-top: 10px;">
                                <label>
                                  <div class="card-sub">Objective</div>
                                  <input
                                    class="input"
                                    .value=${props.policyDoc.config.objective}
                                    @input=${(event: Event) =>
                                      props.onPolicyConfigChange(
                                        "objective",
                                        (event.currentTarget as HTMLInputElement).value,
                                      )}
                                  />
                                </label>
                                <label>
                                  <div class="card-sub">Rollout mode</div>
                                  <select
                                    class="input"
                                    .value=${props.policyDoc.config.rollout_mode}
                                    @change=${(event: Event) =>
                                      props.onPolicyConfigChange(
                                        "rollout_mode",
                                        (event.currentTarget as HTMLSelectElement).value,
                                      )}
                                  >
                                    <option value="conservative">Conservative</option>
                                    <option value="balanced">Balanced</option>
                                    <option value="aggressive">Aggressive</option>
                                  </select>
                                </label>
                              </div>
                              <div class="grid grid-cols-2" style="margin-top: 10px;">
                                <label>
                                  <div class="card-sub">Automation ceiling</div>
                                  <select
                                    class="input"
                                    .value=${props.policyDoc.config.automation_ceiling}
                                    @change=${(event: Event) =>
                                      props.onPolicyConfigChange(
                                        "automation_ceiling",
                                        (event.currentTarget as HTMLSelectElement).value,
                                      )}
                                  >
                                    <option value="draft-only">Draft only</option>
                                    <option value="approval-first">Approval first</option>
                                    <option value="limited-auto">Limited auto</option>
                                  </select>
                                </label>
                                <label>
                                  <div class="card-sub">Success checks (one per line)</div>
                                  <textarea
                                    class="input"
                                    style="width: 100%; min-height: 90px;"
                                    .value=${props.policyDoc.config.success_checks.join("\n")}
                                    @input=${(event: Event) =>
                                      props.onPolicyListChange(
                                        "success_checks",
                                        (event.currentTarget as HTMLTextAreaElement).value,
                                      )}
                                  ></textarea>
                                </label>
                              </div>
                              <div class="grid grid-cols-2" style="margin-top: 10px;">
                                <label>
                                  <div class="card-sub">Guardrails (one per line)</div>
                                  <textarea
                                    class="input"
                                    style="width: 100%; min-height: 90px;"
                                    .value=${props.policyDoc.config.guardrails.join("\n")}
                                    @input=${(event: Event) =>
                                      props.onPolicyListChange(
                                        "guardrails",
                                        (event.currentTarget as HTMLTextAreaElement).value,
                                      )}
                                  ></textarea>
                                </label>
                                <label>
                                  <div class="card-sub">Operator notes</div>
                                  <textarea
                                    class="input"
                                    style="width: 100%; min-height: 90px;"
                                    .value=${props.policyDoc.config.operator_notes}
                                    @input=${(event: Event) =>
                                      props.onPolicyConfigChange(
                                        "operator_notes",
                                        (event.currentTarget as HTMLTextAreaElement).value,
                                      )}
                                  ></textarea>
                                </label>
                              </div>
                              <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 10px;">
                                <button
                                  class="btn ghost"
                                  ?disabled=${props.policyPreviewBusy}
                                  @click=${props.onPreviewPolicyUpdate}
                                >
                                  ${props.policyPreviewBusy ? "Previewing..." : "Preview Policy Impact"}
                                </button>
                                <button
                                  class="btn"
                                  ?disabled=${props.policySaveBusy}
                                  @click=${props.onSavePolicyUpdate}
                                >
                                  ${props.policySaveBusy ? "Saving..." : "Save Policy Changes"}
                                </button>
                              </div>
                            </div>`
                          : nothing
                      }
                      ${
                        props.policyPreviewError
                          ? html`<div class="callout danger" style="margin-top: 10px;">${props.policyPreviewError}</div>`
                          : nothing
                      }
                      ${
                        props.policyPreview
                          ? html`<div class="card" style="margin-top: 10px; margin-bottom: 0;">
                              <div class="card-title">Policy Impact Preview</div>
                              <div class="muted">${props.policyPreview.impact_summary.join("; ")}</div>
                              ${
                                props.policyPreview.warnings.length > 0
                                  ? html`<div class="callout warn" style="margin-top: 8px;">
                                      ${props.policyPreview.warnings.join(" ")}
                                    </div>`
                                  : nothing
                              }
                            </div>`
                          : nothing
                      }
                      ${
                        props.policySaveError
                          ? html`<div class="callout danger" style="margin-top: 10px;">${props.policySaveError}</div>`
                          : nothing
                      }
                      ${
                        props.policySaveResult
                          ? html`<pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.policySaveResult}</pre>`
                          : nothing
                      }
                    </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Policy Change Attribution</div>
                      <div class="card-sub">
                        Every policy save is attributed to likely affected work items and expected KPI effects.
                      </div>
                      <div class="stat-grid" style="margin-top: 10px;">
                        <div class="stat">
                          <div class="stat-label">Job Board changes</div>
                          <div class="stat-value">${snapshot.policy_impacts.totals_by_policy.job_board}</div>
                        </div>
                        <div class="stat">
                          <div class="stat-label">Promotion policy changes</div>
                          <div class="stat-value">${snapshot.policy_impacts.totals_by_policy.promotion_policy}</div>
                        </div>
                        <div class="stat">
                          <div class="stat-label">Value/Friction changes</div>
                          <div class="stat-value">${snapshot.policy_impacts.totals_by_policy.value_friction}</div>
                        </div>
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.policy_impacts.recent.length === 0
                            ? html`
                                <div class="muted">No policy impact events captured yet.</div>
                              `
                            : snapshot.policy_impacts.recent.slice(0, 8).map(
                                (entry) => html`<div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title">${labelForPolicyKey(entry.policy_key)}</div>
                                    <div class="list-sub mono">${entry.ts}</div>
                                    <div class="list-sub">${entry.rationale}</div>
                                    <div class="muted" style="margin-top: 6px;">
                                      fields: ${entry.changed_fields.length > 0 ? entry.changed_fields.join(", ") : "none"}
                                    </div>
                                  </div>
                                  <div class="list-meta">
                                    <span class="pill ${toneForRiskDirection(entry.risk_direction)}">${entry.risk_direction}</span>
                                    <div class="muted mono" style="margin-top: 6px;">
                                      cards: ${entry.linked_cards.length}
                                    </div>
                                    <div class="muted" style="margin-top: 6px; max-width: 300px;">
                                      KPI effects: ${entry.expected_kpi_effects.join("; ")}
                                    </div>
                                  </div>
                                </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">Recommended Next Actions</div>
                <div class="list" style="margin-top: 10px;">
                  ${snapshot.recommendations.map(
                    (entry) => html`<div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${humanizeRecommendationId(entry.id)}</div>
                        <div class="list-sub">${entry.message}</div>
                      </div>
                      <div class="list-meta">
                        <span class="pill ${toneForSeverity(entry.severity)}">${entry.severity}</span>
                        <div class="muted mono" style="margin-top: 6px;">
                          decision: ${entry.decision}
                        </div>
                        <div class="muted" style="margin-top: 6px; max-width: 360px;">${entry.next_step}</div>
                        <div class="row" style="justify-content: flex-end; gap: 6px; margin-top: 8px;">
                          <button
                            class="btn ghost"
                            ?disabled=${props.recommendationBusyId !== null}
                            @click=${() => props.onRecommendationDecision(entry.id, "approved")}
                          >
                            ${props.recommendationBusyId === entry.id ? "Saving..." : "Accept"}
                          </button>
                          <button
                            class="btn ghost"
                            ?disabled=${props.recommendationBusyId !== null}
                            @click=${() => props.onRecommendationDecision(entry.id, "dismissed")}
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    </div>`,
                  )}
                </div>
                ${
                  props.recommendationError
                    ? html`<div class="callout danger" style="margin-top: 10px;">${props.recommendationError}</div>`
                    : nothing
                }
              </div>`
                  : nothing
              }

              ${
                showOperate
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Recommendation Outcome Learning</div>
                      <div class="card-sub">
                        Ted attributes recommendation decisions to work items and feeds this into promotion confidence.
                      </div>
                      <div class="stat-grid" style="margin-top: 10px;">
                        <div class="stat">
                          <div class="stat-label">Approved</div>
                          <div class="stat-value ok">${snapshot.recommendation_outcomes.totals.approved}</div>
                        </div>
                        <div class="stat">
                          <div class="stat-label">Dismissed</div>
                          <div class="stat-value ${snapshot.recommendation_outcomes.totals.dismissed > 0 ? "warn" : ""}">
                            ${snapshot.recommendation_outcomes.totals.dismissed}
                          </div>
                        </div>
                        <div class="stat">
                          <div class="stat-label">Pending</div>
                          <div class="stat-value">${snapshot.recommendation_outcomes.totals.pending}</div>
                        </div>
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.recommendation_outcomes.recent.length === 0
                            ? html`
                                <div class="muted">No attribution events recorded yet.</div>
                              `
                            : snapshot.recommendation_outcomes.recent.slice(0, 8).map(
                                (entry) => html`<div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title">${humanizeRecommendationId(entry.id)}</div>
                                    <div class="list-sub mono">${entry.decided_at}</div>
                                    <div class="list-sub">${entry.rationale}</div>
                                  </div>
                                  <div class="list-meta">
                                    <span class="pill ${entry.decision === "dismissed" ? "warn" : ""}">
                                      ${entry.decision}
                                    </span>
                                    <div class="muted mono" style="margin-top: 6px;">
                                      ${entry.linked_cards.length > 0 ? `cards: ${entry.linked_cards.join(", ")}` : "cards: none"}
                                    </div>
                                  </div>
                                </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showOperate || showBuild
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="row" style="justify-content: space-between; align-items: baseline;">
                  <div class="card-title">Execution Plan</div>
                  <div class="muted">
                    Family mix:
                    Governance and Safety=${familyCounts.GOV ?? 0},
                    Reliability and Operations=${familyCounts.MNT ?? 0},
                    Connectors and Intake=${familyCounts.ING ?? 0},
                    Deal and Work Ledger=${familyCounts.LED ?? 0},
                    Outbound Drafting and Scheduling=${familyCounts.OUT ?? 0}
                  </div>
                </div>
                <div class="card-sub">
                  Open a work item, see what is blocked, and run proof checks when ready.
                </div>
                <div class="list" style="margin-top: 10px;">
                  ${snapshot.job_cards.cards.slice(0, 12).map(
                    (card) => html`<div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${card.id} - ${card.title}</div>
                        <div class="list-sub">${card.operator_summary}</div>
                        <div class="list-sub mono">${card.path}</div>
                        <div class="muted" style="margin-top: 6px;">
                          deps:
                          ${card.dependencies.length > 0 ? card.dependencies.join(", ") : "none"}
                        </div>
                        <div class="muted" style="margin-top: 6px;">
                          KPI signals:
                          ${card.kpi_signals.length > 0 ? card.kpi_signals.join("; ") : "not defined yet"}
                        </div>
                      </div>
                      <div class="list-meta">
                        <span class="pill">${familyLabel(card.family)}</span>
                        <div class="muted mono" style="margin-top: 6px; text-align: right;">${card.family}</div>
                        <span class="pill ${toneForJobCardStatus(card.status)}"
                          >${labelForJobCardStatus(card.status)}</span
                        >
                        <span class="pill ${toneForConfidenceBand(card.promotion_confidence.band)}" style="margin-top: 6px;">
                          ${labelForConfidenceBand(card.promotion_confidence.band)}
                        </span>
                        <div class="muted mono" style="margin-top: 6px;">
                          promotion confidence: ${card.promotion_confidence.score}/100
                        </div>
                        <div class="muted mono" style="margin-top: 6px; max-width: 360px;">
                          ${card.proof_script ?? "No proof check linked yet"}
                        </div>
                        ${
                          card.proof_script
                            ? html`<button
                                class="btn ghost mono"
                                style="margin-top: 8px;"
                                ?disabled=${props.proofBusyKey !== null}
                                @click=${() => props.onRunProof(card.proof_script!)}
                              >
                                ${
                                  props.proofBusyKey === card.proof_script
                                    ? "Running..."
                                    : "Run proof"
                                }
                              </button>`
                            : nothing
                        }
                        <button
                          class="btn ghost mono"
                          style="margin-top: 8px;"
                          @click=${() => props.onOpenJobCard(card.id)}
                        >
                          ${
                            props.jobCardDetailLoading && props.jobCardDetail?.id === card.id
                              ? "Loading..."
                              : "View Details"
                          }
                        </button>
                      </div>
                    </div>`,
                  )}
                </div>
                ${
                  props.proofError
                    ? html`<pre class="callout danger mono" style="margin-top: 10px;">${props.proofError}</pre>`
                    : nothing
                }
                ${
                  props.proofResult
                    ? html`<pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.proofResult}</pre>`
                    : nothing
                }
              </div>`
                  : nothing
              }

              ${
                showOperate || showBuild
                  ? html`<div id="ted-job-card-detail" class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">Work Item Details</div>
                <div class="card-sub">
                  Outcome, constraints, and evidence for this specific work item.
                </div>
                ${
                  props.jobCardDetailError
                    ? html`<div class="callout danger" style="margin-top: 10px;">${props.jobCardDetailError}</div>`
                    : nothing
                }
                ${
                  props.jobCardDetail
                    ? html`
                        <div class="list" style="margin-top: 10px;">
                          <div class="list-item">
                            <div class="list-main">
                          <div class="list-title">
                                ${props.jobCardDetail.id} - ${props.jobCardDetail.title}
                              </div>
                              <div class="list-sub">${props.jobCardDetail.operator_summary}</div>
                              <div class="list-sub mono">${props.jobCardDetail.path}</div>
                            </div>
                            <div class="list-meta">
                              <span class="pill">${familyLabel(props.jobCardDetail.family)}</span>
                              <div class="muted mono" style="margin-top: 6px; text-align: right;">${props.jobCardDetail.family}</div>
                              <span class="pill ${toneForJobCardStatus(props.jobCardDetail.status)}"
                                >${labelForJobCardStatus(props.jobCardDetail.status)}</span
                              >
                            </div>
                          </div>
                        </div>
                        <div class="grid grid-cols-2" style="margin-top: 10px;">
                          <div>
                            <div class="card-sub">Outcome</div>
                            <div class="muted">${props.jobCardDetail.outcome ?? "Not specified."}</div>
                          </div>
                          <div>
                            <div class="card-sub">Dependencies</div>
                            <div class="muted">
                              ${
                                props.jobCardDetail.dependencies.length > 0
                                  ? props.jobCardDetail.dependencies.join(", ")
                                  : "none"
                              }
                            </div>
                          </div>
                        </div>
                        <div class="grid grid-cols-2" style="margin-top: 10px;">
                          <div>
                            <div class="card-sub">Non-negotiables</div>
                            <div class="muted">
                              ${
                                props.jobCardDetail.non_negotiables.length > 0
                                  ? props.jobCardDetail.non_negotiables.join("; ")
                                  : "none"
                              }
                            </div>
                          </div>
                          <div>
                            <div class="card-sub">Deliverables</div>
                            <div class="muted">
                              ${
                                props.jobCardDetail.deliverables.length > 0
                                  ? props.jobCardDetail.deliverables.join("; ")
                                  : "none"
                              }
                            </div>
                          </div>
                        </div>
                        <div class="card-sub" style="margin-top: 10px;">Proof evidence</div>
                        <div class="muted">
                          ${
                            props.jobCardDetail.proof_evidence.length > 0
                              ? props.jobCardDetail.proof_evidence.join("; ")
                              : "No execution evidence section yet."
                          }
                        </div>
                        <div class="card-sub" style="margin-top: 10px;">KPI signals for this card</div>
                        <div class="muted">
                          ${
                            props.jobCardDetail.kpi_signals.length > 0
                              ? props.jobCardDetail.kpi_signals.join("; ")
                              : "No KPI signals defined in this card yet."
                          }
                        </div>
                        ${
                          detailConfidence
                            ? html`
                                <div class="card-sub" style="margin-top: 10px;">Promotion confidence</div>
                                <div class="row" style="justify-content: space-between; margin-top: 4px;">
                                  <span class="pill ${toneForConfidenceBand(detailConfidence.band)}">${labelForConfidenceBand(detailConfidence.band)}</span>
                                  <span class="mono">${detailConfidence.score}/100</span>
                                </div>
                                <div class="muted" style="margin-top: 6px;">
                                  ${detailConfidence.drivers.join(" ")}
                                </div>
                                <div class="muted mono" style="margin-top: 6px;">
                                  recommendation outcomes: approved ${detailConfidence.recommendation_outcomes.approved}, dismissed ${detailConfidence.recommendation_outcomes.dismissed}
                                </div>
                              `
                            : nothing
                        }
                        <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 8px;">
                          <button
                            class="btn ghost"
                            ?disabled=${props.jobCardKpiSuggestBusy}
                            @click=${props.onSuggestJobCardKpis}
                          >
                            ${props.jobCardKpiSuggestBusy ? "Suggesting..." : "Suggest KPIs"}
                          </button>
                          <button
                            class="btn ghost"
                            ?disabled=${!props.jobCardKpiSuggestion}
                            @click=${props.onApplySuggestedKpisToEditor}
                          >
                            Apply Suggested KPIs to Editor
                          </button>
                        </div>
                        ${
                          props.jobCardKpiSuggestError
                            ? html`<div class="callout danger" style="margin-top: 8px;">${props.jobCardKpiSuggestError}</div>`
                            : nothing
                        }
                        ${
                          props.jobCardKpiSuggestion
                            ? html`<div class="card" style="margin-top: 8px; margin-bottom: 0;">
                                <div class="card-title">Suggested KPIs</div>
                                <div class="card-sub">${props.jobCardKpiSuggestion.rationale}</div>
                                <div class="muted" style="margin-top: 8px;">${props.jobCardKpiSuggestion.suggestions.join("; ")}</div>
                              </div>`
                            : nothing
                        }
                        <div class="card-sub" style="margin-top: 12px;">Edit Work Item</div>
                        <textarea
                          class="input mono"
                          style="width: 100%; min-height: 220px; margin-top: 8px;"
                          .value=${props.jobCardEditorMarkdown}
                          @input=${(event: Event) =>
                            props.onJobCardEditorChange(
                              (event.currentTarget as HTMLTextAreaElement).value,
                            )}
                        ></textarea>
                        <div class="row" style="justify-content: flex-end; margin-top: 8px; gap: 8px;">
                          <button
                            class="btn ghost"
                            ?disabled=${props.jobCardPreviewBusy}
                            @click=${props.onPreviewJobCardUpdate}
                          >
                            ${props.jobCardPreviewBusy ? "Analyzing..." : "Preview Impact"}
                          </button>
                          <button
                            class="btn"
                            ?disabled=${props.jobCardSaveBusy}
                            @click=${props.onSaveJobCardDetail}
                          >
                            ${props.jobCardSaveBusy ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                        ${
                          props.jobCardSaveError
                            ? html`<div class="callout danger" style="margin-top: 8px;">${props.jobCardSaveError}</div>`
                            : nothing
                        }
                        ${
                          props.jobCardPreviewError
                            ? html`<div class="callout danger" style="margin-top: 8px;">${props.jobCardPreviewError}</div>`
                            : nothing
                        }
                        ${
                          props.jobCardPreview
                            ? html`<div class="card" style="margin-top: 8px; margin-bottom: 0;">
                                <div class="card-title">Impact Preview</div>
                                <div class="card-sub">
                                  Ted checks how your edits change this work item before save.
                                </div>
                                <div class="muted" style="margin-top: 8px;">
                                  ${props.jobCardPreview.impact_summary.join("; ")}
                                </div>
                                ${
                                  props.jobCardPreview.warnings.length > 0
                                    ? html`<div class="callout warn" style="margin-top: 8px;">
                                        ${props.jobCardPreview.warnings.join(" ")}
                                      </div>`
                                    : nothing
                                }
                              </div>`
                            : nothing
                        }
                        ${
                          props.jobCardSaveResult
                            ? html`<pre class="mono" style="margin-top: 8px; white-space: pre-wrap;">${props.jobCardSaveResult}</pre>`
                            : nothing
                        }
                      `
                    : html`
                        <div class="muted" style="margin-top: 10px">Select a job card to inspect details.</div>
                      `
                }
              </div>`
                  : nothing
              }

              ${
                showIntake || showBuild
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">Create New Work Item</div>
                <div class="card-sub">
                  Describe the job and Ted will recommend a safe starting configuration.
                </div>
                <div class="row" style="gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                  <button class="btn btn--sm active" @click=${() => props.onApplyIntakeExample("ops-brief")}>
                    Example: Daily Ops Brief
                  </button>
                  <button class="btn btn--sm" @click=${() => props.onApplyIntakeExample("deal-followup")}>
                    Example: Deal Follow-up
                  </button>
                  <button class="btn btn--sm" @click=${() => props.onApplyIntakeExample("governance-hardening")}>
                    Example: Governance Hardening
                  </button>
                </div>
                <div class="grid grid-cols-2" style="margin-top: 10px;">
                  <label>
                    <div class="card-sub">Title</div>
                    <input
                      class="input"
                      .value=${props.intakeTitle}
                      @input=${(event: Event) =>
                        props.onIntakeFieldChange(
                          "title",
                          (event.currentTarget as HTMLInputElement).value,
                        )}
                    />
                  </label>
                  <label>
                    <div class="card-sub">Job Family</div>
                    <select
                      class="input"
                      .value=${props.intakeJobFamily}
                      @change=${(event: Event) =>
                        props.onIntakeFieldChange(
                          "job_family",
                          (event.currentTarget as HTMLSelectElement).value,
                        )}
                    >
                      <option value="GOV">Governance and Safety (GOV)</option>
                      <option value="MNT">Reliability and Operations (MNT)</option>
                      <option value="ING">Connectors and Intake (ING)</option>
                      <option value="LED">Deal and Work Ledger (LED)</option>
                      <option value="OUT">Outbound Drafting and Scheduling (OUT)</option>
                    </select>
                  </label>
                </div>
                <label style="display:block; margin-top: 10px;">
                  <div class="card-sub">Outcome</div>
                  <textarea
                    class="input"
                    style="width: 100%; min-height: 90px;"
                    .value=${props.intakeOutcome}
                    @input=${(event: Event) =>
                      props.onIntakeFieldChange(
                        "outcome",
                        (event.currentTarget as HTMLTextAreaElement).value,
                      )}
                  ></textarea>
                </label>
                <div class="grid grid-cols-2" style="margin-top: 10px;">
                  <label>
                    <div class="card-sub">Risk</div>
                    <select
                      class="input"
                      .value=${props.intakeRiskLevel}
                      @change=${(event: Event) =>
                        props.onIntakeFieldChange(
                          "risk_level",
                          (event.currentTarget as HTMLSelectElement).value,
                        )}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label>
                    <div class="card-sub">Automation</div>
                    <select
                      class="input"
                      .value=${props.intakeAutomationLevel}
                      @change=${(event: Event) =>
                        props.onIntakeFieldChange(
                          "automation_level",
                          (event.currentTarget as HTMLSelectElement).value,
                        )}
                    >
                      <option value="draft-only">Draft only</option>
                      <option value="approval-first">Approval first</option>
                    </select>
                  </label>
                </div>
                <div class="row" style="justify-content: flex-end; margin-top: 10px;">
                  <button
                    class="btn"
                    ?disabled=${props.intakeBusy}
                    @click=${props.onRunIntakeRecommendation}
                  >
                    ${props.intakeBusy ? "Generating..." : "Generate Recommended Setup"}
                  </button>
                </div>
                ${
                  props.intakeError
                    ? html`<div class="callout danger" style="margin-top: 10px;">${props.intakeError}</div>`
                    : nothing
                }
                ${
                  props.intakeRecommendation
                    ? html`<div class="list" style="margin-top: 10px;">
                        <div class="list-item">
                          <div class="list-main">
                            <div class="list-title">Suggested config</div>
                            <div class="list-sub">
                              priority ${props.intakeRecommendation.priority} | release
                              ${props.intakeRecommendation.release_target} | tier
                              ${props.intakeRecommendation.governance_tier}
                            </div>
                          </div>
                          <div class="list-meta mono">
                            ${props.intakeRecommendation.suggested_path}
                          </div>
                        </div>
                        <div class="list-item">
                          <div class="list-main">
                            <div class="list-title">Recommended KPIs</div>
                            <div class="list-sub">
                              ${props.intakeRecommendation.recommended_kpis.join("; ")}
                            </div>
                          </div>
                        </div>
                        <div class="list-item">
                          <div class="list-main">
                            <div class="list-title">Hard bans</div>
                            <div class="list-sub">
                              ${props.intakeRecommendation.hard_bans.join("; ")}
                            </div>
                          </div>
                        </div>
                      </div>
                      <pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.intakeRecommendation.draft_markdown}</pre>`
                    : nothing
                }
              </div>`
                  : nothing
              }

              ${
                showBuild || showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                <div class="card-title">Persona Rules Validator</div>
                <div class="card-sub">
                  Validate persona rules before using them in production.
                </div>
                <textarea
                  class="input mono"
                  style="width: 100%; min-height: 180px; margin-top: 12px;"
                  .value=${props.roleCardJson}
                  @input=${(event: Event) =>
                    props.onRoleCardJsonChange((event.currentTarget as HTMLTextAreaElement).value)}
                ></textarea>
                <div class="row" style="justify-content: flex-end; margin-top: 10px;">
                  <button
                    class="btn"
                    ?disabled=${props.roleCardBusy}
                    @click=${props.onRoleCardValidate}
                  >
                    ${props.roleCardBusy ? "Validating..." : "Validate Rules"}
                  </button>
                </div>
                ${
                  props.roleCardError
                    ? html`<pre class="callout danger mono" style="margin-top: 10px;">${props.roleCardError}</pre>`
                    : nothing
                }
                ${
                  props.roleCardResult
                    ? html`<pre class="mono" style="margin-top: 10px; white-space: pre-wrap;">${props.roleCardResult}</pre>`
                    : nothing
                }
              </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Pending Decisions</div>
                      <div class="card-sub">
                        Items that need your decision before moving forward.
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.approval_queue.length === 0
                            ? html`
                                <div class="muted">No pending approvals in queue.</div>
                              `
                            : snapshot.approval_queue.map(
                                (entry) => html`<div class="list-item">
                                <div class="list-main">
                                  <div class="list-title">${entry.id}</div>
                                  <div class="list-sub">${entry.summary}</div>
                                  <div class="muted mono" style="margin-top: 6px;">
                                    reason: ${entry.reason_code}
                                  </div>
                                </div>
                                <div class="list-meta">
                                  <span class="pill ${toneForSeverity(entry.severity)}"
                                    >${entry.status}</span
                                  >
                                  <div class="muted" style="margin-top: 6px; max-width: 360px;">
                                    ${entry.next_safe_step}
                                  </div>
                                </div>
                              </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Decision Impact Ledger</div>
                      <div class="card-sub">
                        Correlates recommendation decisions to linked work items and current promotion confidence.
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.approval_ledger.recent.length === 0
                            ? html`
                                <div class="muted">No approval ledger entries yet.</div>
                              `
                            : snapshot.approval_ledger.recent.map(
                                (entry) => html`<div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title">${entry.summary}</div>
                                    <div class="list-sub mono">
                                      ${entry.source}${
                                        entry.recommendation_id
                                          ? ` | ${entry.recommendation_id}`
                                          : ""
                                      }${entry.decided_at ? ` | ${entry.decided_at}` : ""}
                                    </div>
                                    <div class="muted mono" style="margin-top: 6px;">
                                      reason: ${entry.reason_code}
                                    </div>
                                    ${
                                      entry.linked_cards.length > 0
                                        ? html`<div class="muted" style="margin-top: 6px;">
                                            linked cards: ${entry.linked_cards.join(", ")}
                                          </div>`
                                        : nothing
                                    }
                                    ${
                                      entry.linked_card_confidence.length > 0
                                        ? html`<div class="muted" style="margin-top: 6px;">
                                            ${entry.linked_card_confidence
                                              .map(
                                                (confidence) =>
                                                  `${confidence.card_id} score ${confidence.score} (${labelForConfidenceBand(confidence.band)})`,
                                              )
                                              .join(" | ")}
                                          </div>`
                                        : nothing
                                    }
                                  </div>
                                  <div class="list-meta">
                                    <span
                                      class="pill ${
                                        entry.decision === "dismissed"
                                          ? "danger"
                                          : entry.decision === "pending"
                                            ? "warn"
                                            : ""
                                      }"
                                      >${entry.decision}</span
                                    >
                                    <div class="muted" style="margin-top: 6px; max-width: 360px;">
                                      ${entry.next_safe_step}
                                    </div>
                                    ${
                                      entry.linked_cards[0]
                                        ? html`<button
                                            class="btn ghost btn--sm"
                                            style="margin-top: 8px;"
                                            @click=${() => props.onOpenJobCard(entry.linked_cards[0])}
                                          >
                                            Open ${entry.linked_cards[0]}
                                          </button>`
                                        : nothing
                                    }
                                  </div>
                                </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showGovern
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Safety Timeline</div>
                      <div class="card-sub">
                        Recent allow/block decisions and what to do next.
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.governance_timeline_preview.length === 0
                            ? html`
                                <div class="muted">No governance events captured yet.</div>
                              `
                            : snapshot.governance_timeline_preview.map(
                                (entry) => html`<div class="list-item">
                                <div class="list-main">
                                  <div class="list-title">${entry.action}</div>
                                  <div class="list-sub mono">${entry.ts}</div>
                                  <div class="muted mono" style="margin-top: 6px;">
                                    reason: ${entry.reason_code}
                                  </div>
                                </div>
                                <div class="list-meta">
                                  <span class="pill ${entry.outcome === "blocked" ? "danger" : ""}"
                                    >${entry.outcome}</span
                                  >
                                  <div class="muted" style="margin-top: 6px; max-width: 360px;">
                                    ${entry.next_safe_step}
                                  </div>
                                </div>
                              </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showEvals
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Trend Snapshot</div>
                      <div class="card-sub">
                        Recent performance trajectory to support promotion decisions.
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.kpi_history_preview.length === 0
                            ? html`
                                <div class="muted">No KPI history entries yet.</div>
                              `
                            : snapshot.kpi_history_preview
                                .toReversed()
                                .slice(0, 12)
                                .map(
                                  (entry) => html`<div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title mono">${entry.ts}</div>
                                    <div class="list-sub">
                                      manual<=${entry.manual_minutes_per_day_max}m,
                                      approval<=${entry.approval_queue_oldest_minutes_max}m,
                                      triage<=${entry.unresolved_triage_eod_max},
                                      explainability<=${entry.blocked_actions_missing_explainability_max}
                                    </div>
                                  </div>
                                </div>`,
                                )
                        }
                      </div>
                    </div>`
                  : nothing
              }

              ${
                showEvals
                  ? html`<div class="card" style="margin-top: 16px; margin-bottom: 0;">
                      <div class="card-title">Proof Check History</div>
                      <div class="card-sub">
                        Pass/fail history from executed proof checks.
                      </div>
                      <div class="list" style="margin-top: 10px;">
                        ${
                          snapshot.eval_history_preview.length === 0
                            ? html`
                                <div class="muted">No proof runs captured yet.</div>
                              `
                            : snapshot.eval_history_preview.slice(0, 12).map(
                                (entry) => html`<div class="list-item">
                                <div class="list-main">
                                  <div class="list-title mono">${entry.proof_script}</div>
                                  <div class="list-sub mono">
                                    ${entry.ts} | exit=${entry.exit_code}
                                  </div>
                                </div>
                                <div class="list-meta">
                                  <span class="pill ${entry.ok ? "" : "danger"}"
                                    >${entry.ok ? "pass" : "fail"}</span
                                  >
                                </div>
                              </div>`,
                              )
                        }
                      </div>
                    </div>`
                  : nothing
              }
            `
          : html`
              <div class="muted" style="margin-top: 12px">No workbench data yet. Click refresh.</div>
            `
      }
    </section>
  `;
}
