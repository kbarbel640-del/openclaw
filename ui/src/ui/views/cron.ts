import { html, nothing } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import type { CronFieldErrors, CronFieldKey } from "../controllers/cron.ts";
import { formatRelativeTimestamp, formatMs } from "../format.ts";
import { pathForTab } from "../navigation.ts";
import { formatCronSchedule, formatNextRun } from "../presenter.ts";
import type { ChannelUiMetaEntry, CronJob, CronRunLogEntry, CronStatus } from "../types.ts";
import type {
  CronDeliveryStatus,
  CronJobsEnabledFilter,
  CronRunScope,
  CronRunsStatusValue,
  CronJobsSortBy,
  CronRunsStatusFilter,
  CronSortDir,
} from "../types.ts";
import type { CronFormState } from "../ui-types.ts";
import { t } from "../../i18n/index.ts";

export type CronProps = {
  basePath: string;
  loading: boolean;
  jobsLoadingMore: boolean;
  status: CronStatus | null;
  jobs: CronJob[];
  jobsTotal: number;
  jobsHasMore: boolean;
  jobsQuery: string;
  jobsEnabledFilter: CronJobsEnabledFilter;
  jobsSortBy: CronJobsSortBy;
  jobsSortDir: CronSortDir;
  error: string | null;
  busy: boolean;
  form: CronFormState;
  fieldErrors: CronFieldErrors;
  canSubmit: boolean;
  editingJobId: string | null;
  channels: string[];
  channelLabels?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  runsJobId: string | null;
  runs: CronRunLogEntry[];
  runsTotal: number;
  runsHasMore: boolean;
  runsLoadingMore: boolean;
  runsScope: CronRunScope;
  runsStatuses: CronRunsStatusValue[];
  runsDeliveryStatuses: CronDeliveryStatus[];
  runsStatusFilter: CronRunsStatusFilter;
  runsQuery: string;
  runsSortDir: CronSortDir;
  agentSuggestions: string[];
  modelSuggestions: string[];
  thinkingSuggestions: string[];
  timezoneSuggestions: string[];
  deliveryToSuggestions: string[];
  onFormChange: (patch: Partial<CronFormState>) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onEdit: (job: CronJob) => void;
  onClone: (job: CronJob) => void;
  onCancelEdit: () => void;
  onToggle: (job: CronJob, enabled: boolean) => void;
  onRun: (job: CronJob) => void;
  onRemove: (job: CronJob) => void;
  onLoadRuns: (jobId: string) => void;
  onLoadMoreJobs: () => void;
  onJobsFiltersChange: (patch: {
    cronJobsQuery?: string;
    cronJobsEnabledFilter?: CronJobsEnabledFilter;
    cronJobsSortBy?: CronJobsSortBy;
    cronJobsSortDir?: CronSortDir;
  }) => void | Promise<void>;
  onLoadMoreRuns: () => void;
  onRunsFiltersChange: (patch: {
    cronRunsScope?: CronRunScope;
    cronRunsStatuses?: CronRunsStatusValue[];
    cronRunsDeliveryStatuses?: CronDeliveryStatus[];
    cronRunsStatusFilter?: CronRunsStatusFilter;
    cronRunsQuery?: string;
    cronRunsSortDir?: CronSortDir;
  }) => void | Promise<void>;
};

const getRunStatusOptions = (): Array<{ value: CronRunsStatusValue; label: string }> => [
  { value: "ok", label: t("cron.status.ok") },
  { value: "error", label: t("cron.status.error") },
  { value: "skipped", label: t("cron.status.skipped") },
];

const getRunDeliveryOptions = (): Array<{ value: CronDeliveryStatus; label: string }> => [
  { value: "delivered", label: t("cron.status.delivered") },
  { value: "not-delivered", label: t("cron.status.notDelivered") },
  { value: "unknown", label: t("common.unknown") },
  { value: "not-requested", label: t("cron.status.notRequested") },
];

function toggleSelection<T extends string>(selected: T[], value: T, checked: boolean): T[] {
  const set = new Set(selected);
  if (checked) {
    set.add(value);
  } else {
    set.delete(value);
  }
  return Array.from(set);
}

function summarizeSelection(selectedLabels: string[], allLabelKey: string) {
  if (selectedLabels.length === 0) {
    return t(allLabelKey as any);
  }
  if (selectedLabels.length <= 2) {
    return selectedLabels.join(", ");
  }
  return `${selectedLabels[0]} +${selectedLabels.length - 1}`;
}

function buildChannelOptions(props: CronProps): string[] {
  const options = ["last", ...props.channels.filter(Boolean)];
  const current = props.form.deliveryChannel?.trim();
  if (current && !options.includes(current)) {
    options.push(current);
  }
  const seen = new Set<string>();
  return options.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function resolveChannelLabel(props: CronProps, channel: string): string {
  if (channel === "last") {
    return t("cron.form.channelLast") || "last";
  }
  const meta = props.channelMeta?.find((entry) => entry.id === channel);
  if (meta?.label) {
    return meta.label;
  }
  return props.channelLabels?.[channel] ?? channel;
}

function renderRunFilterDropdown(params: {
  id: string;
  title: string;
  summary: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
  onClear: () => void;
}) {
  return html`
    <div class="field cron-filter-dropdown" data-filter=${params.id}>
      <span>${params.title}</span>
      <details class="cron-filter-dropdown__details">
        <summary class="btn cron-filter-dropdown__trigger">
          <span>${params.summary}</span>
        </summary>
        <div class="cron-filter-dropdown__panel">
          <div class="cron-filter-dropdown__list">
            ${params.options.map(
              (option) => html`
                <label class="cron-filter-dropdown__option">
                  <input
                    type="checkbox"
                    value=${option.value}
                    .checked=${params.selected.includes(option.value)}
                    @change=${(event: Event) => {
                      const target = event.target as HTMLInputElement;
                      params.onToggle(option.value, target.checked);
                    }}
                  />
                  <span>${option.label}</span>
                </label>
              `,
            )}
          </div>
          <div class="row">
            <button class="btn" type="button" @click=${params.onClear}>${t("cron.actions.clear")}</button>
          </div>
        </div>
      </details>
    </div>
  `;
}

function renderSuggestionList(id: string, options: string[]) {
  const clean = Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)));
  if (clean.length === 0) {
    return nothing;
  }
  return html`<datalist id=${id}>
    ${clean.map((value) => html`<option value=${value}></option> `)}
  </datalist>`;
}

type BlockingField = {
  key: CronFieldKey;
  label: string;
  message: string;
  inputId: string;
};

function errorIdForField(key: CronFieldKey) {
  return `cron-error-${key}`;
}

function inputIdForField(key: CronFieldKey) {
  if (key === "name") {
    return "cron-name";
  }
  if (key === "scheduleAt") {
    return "cron-schedule-at";
  }
  if (key === "everyAmount") {
    return "cron-every-amount";
  }
  if (key === "cronExpr") {
    return "cron-cron-expr";
  }
  if (key === "staggerAmount") {
    return "cron-stagger-amount";
  }
  if (key === "payloadText") {
    return "cron-payload-text";
  }
  if (key === "payloadModel") {
    return "cron-payload-model";
  }
  if (key === "payloadThinking") {
    return "cron-payload-thinking";
  }
  if (key === "timeoutSeconds") {
    return "cron-timeout-seconds";
  }
  return "cron-delivery-to";
}

function fieldLabelForKey(
  key: CronFieldKey,
  form: CronFormState,
  deliveryMode: CronFormState["deliveryMode"],
) {
  if (key === "payloadText") {
    return form.payloadKind === "systemEvent" ? t("cron.form.payloadTextSystem") : t("cron.form.payloadTextAgent");
  }
  if (key === "deliveryTo") {
    return deliveryMode === "webhook" ? t("cron.form.webhookUrl") : t("cron.form.to");
  }
  const labels: Record<CronFieldKey, string> = {
    name: t("cron.form.name"),
    scheduleAt: t("cron.form.runAt"),
    everyAmount: t("cron.form.every"),
    cronExpr: t("cron.form.cronExpr"),
    staggerAmount: t("cron.form.staggerWindow"),
    payloadText: t("cron.form.payloadTextAgent"),
    payloadModel: t("cron.form.model"),
    payloadThinking: t("cron.form.thinking"),
    timeoutSeconds: t("cron.form.timeout"),
    deliveryTo: t("cron.form.to"),
  };
  return labels[key];
}

function collectBlockingFields(
  errors: CronFieldErrors,
  form: CronFormState,
  deliveryMode: CronFormState["deliveryMode"],
): BlockingField[] {
  const orderedKeys: CronFieldKey[] = [
    "name",
    "scheduleAt",
    "everyAmount",
    "cronExpr",
    "staggerAmount",
    "payloadText",
    "payloadModel",
    "payloadThinking",
    "timeoutSeconds",
    "deliveryTo",
  ];
  const fields: BlockingField[] = [];
  for (const key of orderedKeys) {
    const message = errors[key];
    if (!message) {
      continue;
    }
    fields.push({
      key,
      label: fieldLabelForKey(key, form, deliveryMode),
      message,
      inputId: inputIdForField(key),
    });
  }
  return fields;
}

function focusFormField(id: string) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  el.focus();
}

function renderFieldLabel(text: string, required = false) {
  return html`<span>
    ${text}
    ${
      required
        ? html`
            <span class="cron-required-marker" aria-hidden="true">*</span>
            <span class="cron-required-sr">${t("cron.form.required")}</span>
          `
        : nothing
    }
  </span>`;
}

export function renderCron(props: CronProps) {
  const isEditing = Boolean(props.editingJobId);
  const isAgentTurn = props.form.payloadKind === "agentTurn";
  const isCronSchedule = props.form.scheduleKind === "cron";
  const channelOptions = buildChannelOptions(props);
  const selectedJob =
    props.runsJobId == null ? undefined : props.jobs.find((job) => job.id === props.runsJobId);
  const selectedRunTitle =
    props.runsScope === "all"
      ? t("cron.runs.allJobs")
      : (selectedJob?.name ?? props.runsJobId ?? `(${t("cron.runs.selectJob")})`);
  const runs = props.runs;
  const runStatusOptions = getRunStatusOptions();
  const runDeliveryOptions = getRunDeliveryOptions();
  const selectedStatusLabels = runStatusOptions.filter((option) =>
    props.runsStatuses.includes(option.value),
  ).map((option) => option.label);
  const selectedDeliveryLabels = runDeliveryOptions.filter((option) =>
    props.runsDeliveryStatuses.includes(option.value),
  ).map((option) => option.label);
  const statusSummary = summarizeSelection(selectedStatusLabels, "cron.runs.allStatuses");
  const deliverySummary = summarizeSelection(selectedDeliveryLabels, "cron.runs.allDelivery");
  const supportsAnnounce =
    props.form.sessionTarget === "isolated" && props.form.payloadKind === "agentTurn";
  const selectedDeliveryMode =
    props.form.deliveryMode === "announce" && !supportsAnnounce ? "none" : props.form.deliveryMode;
  const blockingFields = collectBlockingFields(props.fieldErrors, props.form, selectedDeliveryMode);
  const blockedByValidation = !props.busy && blockingFields.length > 0;
  const submitDisabledReason =
    blockedByValidation && !props.canSubmit
      ? t("cron.validation.fixFields", { count: String(blockingFields.length) })
      : "";
  return html`
    <section class="card cron-summary-strip">
      <div class="cron-summary-strip__left">
        <div class="cron-summary-item">
          <div class="cron-summary-label">${t("cron.summary.enabled")}</div>
          <div class="cron-summary-value">
            <span class=${`chip ${props.status?.enabled ? "chip-ok" : "chip-danger"}`}>
              ${props.status ? (props.status.enabled ? t("cron.summary.yes") : t("cron.summary.no")) : t("common.na")}
            </span>
          </div>
        </div>
        <div class="cron-summary-item">
          <div class="cron-summary-label">${t("cron.summary.jobs")}</div>
          <div class="cron-summary-value">${props.status?.jobs ?? t("common.na")}</div>
        </div>
        <div class="cron-summary-item cron-summary-item--wide">
          <div class="cron-summary-label">${t("cron.summary.nextWake")}</div>
          <div class="cron-summary-value">${formatNextRun(props.status?.nextWakeAtMs ?? null)}</div>
        </div>
      </div>
      <div class="cron-summary-strip__actions">
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? t("cron.summary.refreshing") : t("cron.summary.refresh")}
        </button>
        ${props.error ? html`<span class="muted">${props.error}</span>` : nothing}
      </div>
    </section>

    <section class="cron-workspace">
      <div class="cron-workspace-main">
        <section class="card">
          <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div>
              <div class="card-title">${t("cron.jobs.title")}</div>
              <div class="card-sub">${t("cron.jobs.subtitle")}</div>
            </div>
            <div class="muted">${props.jobs.length} shown of ${props.jobsTotal}</div>
          </div>
          <div class="filters" style="margin-top: 12px;">
            <label class="field cron-filter-search">
              <span>${t("cron.jobs.search")}</span>
              <input
                .value=${props.jobsQuery}
                placeholder="${t("cron.jobs.searchPlaceholder")}"
                @input=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsQuery: (e.target as HTMLInputElement).value,
                  })}
              />
            </label>
            <label class="field">
              <span>${t("cron.jobs.enabledFilter")}</span>
              <select
                .value=${props.jobsEnabledFilter}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsEnabledFilter: (e.target as HTMLSelectElement)
                      .value as CronJobsEnabledFilter,
                  })}
              >
                <option value="all">${t("cron.jobs.all")}</option>
                <option value="enabled">${t("cron.jobs.enabled")}</option>
                <option value="disabled">${t("cron.jobs.disabled")}</option>
              </select>
            </label>
            <label class="field">
              <span>${t("cron.jobs.sort")}</span>
              <select
                .value=${props.jobsSortBy}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsSortBy: (e.target as HTMLSelectElement).value as CronJobsSortBy,
                  })}
              >
                <option value="nextRunAtMs">${t("cron.jobs.nextRun")}</option>
                <option value="updatedAtMs">${t("cron.jobs.recentlyUpdated")}</option>
                <option value="name">${t("cron.jobs.name")}</option>
              </select>
            </label>
            <label class="field">
              <span>${t("cron.jobs.direction")}</span>
              <select
                .value=${props.jobsSortDir}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsSortDir: (e.target as HTMLSelectElement).value as CronSortDir,
                  })}
              >
                <option value="asc">${t("cron.jobs.ascending")}</option>
                <option value="desc">${t("cron.jobs.descending")}</option>
              </select>
            </label>
          </div>
          ${
            props.jobs.length === 0
              ? html`
                  <div class="muted" style="margin-top: 12px">${t("cron.jobs.noMatching")}</div>
                `
              : html`
                  <div class="list" style="margin-top: 12px;">
                    ${props.jobs.map((job) => renderJob(job, props))}
                  </div>
                `
          }
          ${
            props.jobsHasMore
              ? html`
                  <div class="row" style="margin-top: 12px">
                    <button
                      class="btn"
                      ?disabled=${props.loading || props.jobsLoadingMore}
                      @click=${props.onLoadMoreJobs}
                    >
                      ${props.jobsLoadingMore ? t("cron.jobs.loadingMore") : t("cron.jobs.loadMore")}
                    </button>
                  </div>
                `
              : nothing
          }
        </section>

        <section class="card">
          <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div>
              <div class="card-title">${t("cron.runs.title")}</div>
              <div class="card-sub">
                ${
                  props.runsScope === "all"
                    ? t("cron.runs.subtitleAll")
                    : t("cron.runs.subtitleJob", { job: selectedRunTitle })
                }
              </div>
            </div>
            <div class="muted">${runs.length} shown of ${props.runsTotal}</div>
          </div>
          <div class="cron-run-filters">
            <div class="cron-run-filters__row cron-run-filters__row--primary">
              <label class="field">
                <span>${t("cron.runs.scope")}</span>
                <select
                  .value=${props.runsScope}
                  @change=${(e: Event) =>
                    props.onRunsFiltersChange({
                      cronRunsScope: (e.target as HTMLSelectElement).value as CronRunScope,
                    })}
                >
                  <option value="all">${t("cron.runs.allJobs")}</option>
                  <option value="job" ?disabled=${props.runsJobId == null}>${t("cron.runs.selectedJob")}</option>
                </select>
              </label>
              <label class="field cron-run-filter-search">
                <span>${t("cron.runs.search")}</span>
                <input
                  .value=${props.runsQuery}
                  placeholder="${t("cron.runs.searchPlaceholder")}"
                  @input=${(e: Event) =>
                    props.onRunsFiltersChange({
                      cronRunsQuery: (e.target as HTMLInputElement).value,
                    })}
                />
              </label>
              <label class="field">
                <span>${t("cron.runs.sort")}</span>
                <select
                  .value=${props.runsSortDir}
                  @change=${(e: Event) =>
                    props.onRunsFiltersChange({
                      cronRunsSortDir: (e.target as HTMLSelectElement).value as CronSortDir,
                    })}
                >
                  <option value="desc">${t("cron.runs.newestFirst")}</option>
                  <option value="asc">${t("cron.runs.oldestFirst")}</option>
                </select>
              </label>
            </div>
            <div class="cron-run-filters__row cron-run-filters__row--secondary">
              ${renderRunFilterDropdown({
                id: "status",
                title: t("cron.runs.status"),
                summary: statusSummary,
                options: runStatusOptions,
                selected: props.runsStatuses,
                onToggle: (value, checked) => {
                  const next = toggleSelection(
                    props.runsStatuses,
                    value as CronRunsStatusValue,
                    checked,
                  );
                  void props.onRunsFiltersChange({ cronRunsStatuses: next });
                },
                onClear: () => {
                  void props.onRunsFiltersChange({ cronRunsStatuses: [] });
                },
              })}
              ${renderRunFilterDropdown({
                id: "delivery",
                title: t("cron.runs.delivery"),
                summary: deliverySummary,
                options: runDeliveryOptions,
                selected: props.runsDeliveryStatuses,
                onToggle: (value, checked) => {
                  const next = toggleSelection(
                    props.runsDeliveryStatuses,
                    value as CronDeliveryStatus,
                    checked,
                  );
                  void props.onRunsFiltersChange({ cronRunsDeliveryStatuses: next });
                },
                onClear: () => {
                  void props.onRunsFiltersChange({ cronRunsDeliveryStatuses: [] });
                },
              })}
            </div>
          </div>
          ${
            props.runsScope === "job" && props.runsJobId == null
              ? html`
                  <div class="muted" style="margin-top: 12px">${t("cron.runs.selectJob")}</div>
                `
              : runs.length === 0
                ? html`
                    <div class="muted" style="margin-top: 12px">${t("cron.runs.noMatching")}</div>
                  `
                : html`
                    <div class="list" style="margin-top: 12px;">
                      ${runs.map((entry) => renderRun(entry, props.basePath))}
                    </div>
                  `
          }
          ${
            (props.runsScope === "all" || props.runsJobId != null) && props.runsHasMore
              ? html`
                  <div class="row" style="margin-top: 12px">
                    <button
                      class="btn"
                      ?disabled=${props.runsLoadingMore}
                      @click=${props.onLoadMoreRuns}
                    >
                      ${props.runsLoadingMore ? t("cron.runs.loadingMore") : t("cron.runs.loadMore")}
                    </button>
                  </div>
                `
              : nothing
          }
        </section>
      </div>

      <section class="card cron-workspace-form">
        <div class="card-title">${isEditing ? t("cron.form.editJob") : t("cron.form.newJob")}</div>
        <div class="card-sub">
          ${isEditing ? t("cron.form.subtitleEdit") : t("cron.form.subtitleNew")}
        </div>
        <div class="cron-form">
          <div class="cron-required-legend">
            <span class="cron-required-marker" aria-hidden="true">*</span> ${t("cron.form.required")}
          </div>
          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cron.form.basics")}</div>
            <div class="cron-form-section__sub">${t("cron.form.basicsSub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field">
                ${renderFieldLabel(t("cron.form.name"), true)}
                <input
                  id="cron-name"
                  .value=${props.form.name}
                  placeholder="${t("cron.form.namePlaceholder")}"
                  aria-invalid=${props.fieldErrors.name ? "true" : "false"}
                  aria-describedby=${ifDefined(
                    props.fieldErrors.name ? errorIdForField("name") : undefined,
                  )}
                  @input=${(e: Event) =>
                    props.onFormChange({ name: (e.target as HTMLInputElement).value })}
                />
                ${renderFieldError(props.fieldErrors.name, errorIdForField("name"))}
              </label>
              <label class="field">
                <span>${t("cron.form.description")}</span>
                <input
                  .value=${props.form.description}
                  placeholder="${t("cron.form.descriptionPlaceholder")}"
                  @input=${(e: Event) =>
                    props.onFormChange({ description: (e.target as HTMLInputElement).value })}
                />
              </label>
              <label class="field">
                ${renderFieldLabel("Agent ID")}
                <input
                  id="cron-agent-id"
                  .value=${props.form.agentId}
                  list="cron-agent-suggestions"
                  ?disabled=${props.form.clearAgent}
                  @input=${(e: Event) =>
                    props.onFormChange({ agentId: (e.target as HTMLInputElement).value })}
                  placeholder="main or ops"
                />
                <div class="cron-help">
                  Start typing to pick a known agent, or enter a custom one.
                </div>
              </label>
              <label class="field checkbox cron-checkbox cron-checkbox-inline">
                <input
                  type="checkbox"
                  .checked=${props.form.enabled}
                  @change=${(e: Event) =>
                    props.onFormChange({ enabled: (e.target as HTMLInputElement).checked })}
                />
                <span class="field-checkbox__label">${t("cron.form.enabled")}</span>
              </label>
            </div>
          </section>

          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cron.form.schedule")}</div>
            <div class="cron-form-section__sub">${t("cron.form.scheduleSub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field cron-span-2">
                ${renderFieldLabel(t("cron.form.scheduleKind"))}
                <select
                  id="cron-schedule-kind"
                  .value=${props.form.scheduleKind}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      scheduleKind: (e.target as HTMLSelectElement)
                        .value as CronFormState["scheduleKind"],
                    })}
                >
                  <option value="every">${t("cron.form.every")}</option>
                  <option value="at">${t("cron.form.at")}</option>
                  <option value="cron">${t("cron.form.cron")}</option>
                </select>
              </label>
            </div>
            ${renderScheduleFields(props)}
          </section>

          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cron.form.execution")}</div>
            <div class="cron-form-section__sub">${t("cron.form.executionSub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field">
                ${renderFieldLabel(t("cron.form.session"))}
                <select
                  id="cron-session-target"
                  .value=${props.form.sessionTarget}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      sessionTarget: (e.target as HTMLSelectElement)
                        .value as CronFormState["sessionTarget"],
                    })}
                >
                  <option value="main">${t("cron.form.sessionMain")}</option>
                  <option value="isolated">${t("cron.form.sessionIsolated")}</option>
                </select>
                <div class="cron-help">${t("cron.form.sessionHelp")}</div>
              </label>
              <label class="field">
                ${renderFieldLabel(t("cron.form.wakeMode"))}
                <select
                  id="cron-wake-mode"
                  .value=${props.form.wakeMode}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      wakeMode: (e.target as HTMLSelectElement).value as CronFormState["wakeMode"],
                    })}
                >
                  <option value="now">${t("cron.form.wakeNow")}</option>
                  <option value="next-heartbeat">${t("cron.form.wakeNext")}</option>
                </select>
                <div class="cron-help">${t("cron.form.wakeModeHelp")}</div>
              </label>
              <label class="field ${isAgentTurn ? "" : "cron-span-2"}">
                ${renderFieldLabel(t("cron.form.payloadKind"))}
                <select
                  id="cron-payload-kind"
                  .value=${props.form.payloadKind}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      payloadKind: (e.target as HTMLSelectElement)
                        .value as CronFormState["payloadKind"],
                    })}
                >
                  <option value="systemEvent">${t("cron.form.payloadSystem")}</option>
                  <option value="agentTurn">${t("cron.form.payloadAgent")}</option>
                </select>
                <div class="cron-help">
                  ${
                    props.form.payloadKind === "systemEvent"
                      ? t("cron.form.payloadHelpSystem")
                      : t("cron.form.payloadHelpAgent")
                  }
                </div>
              </label>
              ${
                isAgentTurn
                  ? html`
                      <label class="field">
                        ${renderFieldLabel(t("cron.form.timeout"))}
                        <input
                          id="cron-timeout-seconds"
                          .value=${props.form.timeoutSeconds}
                          placeholder="${t("cron.form.timeoutPlaceholder")}"
                          aria-invalid=${props.fieldErrors.timeoutSeconds ? "true" : "false"}
                          aria-describedby=${ifDefined(
                            props.fieldErrors.timeoutSeconds
                              ? errorIdForField("timeoutSeconds")
                              : undefined,
                          )}
                          @input=${(e: Event) =>
                            props.onFormChange({
                              timeoutSeconds: (e.target as HTMLInputElement).value,
                            })}
                        />
                        <div class="cron-help">
                          ${t("cron.form.timeoutHelp")}
                        </div>
                        ${renderFieldError(
                          props.fieldErrors.timeoutSeconds,
                          errorIdForField("timeoutSeconds"),
                        )}
                      </label>
                    `
                  : nothing
              }
            </div>
            <label class="field cron-span-2">
              ${renderFieldLabel(
                props.form.payloadKind === "systemEvent"
                  ? t("cron.form.payloadTextSystem")
                  : t("cron.form.payloadTextAgent"),
                true,
              )}
              <textarea
                id="cron-payload-text"
                .value=${props.form.payloadText}
                aria-invalid=${props.fieldErrors.payloadText ? "true" : "false"}
                aria-describedby=${ifDefined(
                  props.fieldErrors.payloadText ? errorIdForField("payloadText") : undefined,
                )}
                @input=${(e: Event) =>
                  props.onFormChange({
                    payloadText: (e.target as HTMLTextAreaElement).value,
                  })}
                rows="4"
              ></textarea>
              ${renderFieldError(props.fieldErrors.payloadText, errorIdForField("payloadText"))}
            </label>
          </section>

          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cron.form.delivery")}</div>
            <div class="cron-form-section__sub">${t("cron.form.deliverySub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field ${selectedDeliveryMode === "none" ? "cron-span-2" : ""}">
                ${renderFieldLabel(t("cron.form.deliveryMode"))}
                <select
                  id="cron-delivery-mode"
                  .value=${selectedDeliveryMode}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      deliveryMode: (e.target as HTMLSelectElement)
                        .value as CronFormState["deliveryMode"],
                    })}
                >
                  ${
                    supportsAnnounce
                      ? html`
                          <option value="announce">${t("cron.form.deliveryAnnounce")}</option>
                        `
                      : nothing
                  }
                  <option value="webhook">${t("cron.form.deliveryWebhook")}</option>
                  <option value="none">${t("cron.form.deliveryNone")}</option>
                </select>
                <div class="cron-help">${t("cron.form.deliveryHelp")}</div>
              </label>
              ${
                selectedDeliveryMode !== "none"
                  ? html`
                      <label class="field ${selectedDeliveryMode === "webhook" ? "cron-span-2" : ""}">
                        ${renderFieldLabel(selectedDeliveryMode === "webhook" ? t("cron.form.webhookUrl") : t("cron.form.channel"), selectedDeliveryMode === "webhook")}
                        ${
                          selectedDeliveryMode === "webhook"
                            ? html`
                                <input
                                  id="cron-delivery-to"
                                  .value=${props.form.deliveryTo}
                                  list="cron-delivery-to-suggestions"
                                  aria-invalid=${props.fieldErrors.deliveryTo ? "true" : "false"}
                                  aria-describedby=${ifDefined(
                                    props.fieldErrors.deliveryTo
                                      ? errorIdForField("deliveryTo")
                                      : undefined,
                                  )}
                                  @input=${(e: Event) =>
                                    props.onFormChange({
                                      deliveryTo: (e.target as HTMLInputElement).value,
                                    })}
                                  placeholder="${t("cron.form.webhookUrlPlaceholder")}"
                                />
                              `
                            : html`
                                <select
                                  id="cron-delivery-channel"
                                  .value=${props.form.deliveryChannel || "last"}
                                  @change=${(e: Event) =>
                                    props.onFormChange({
                                      deliveryChannel: (e.target as HTMLSelectElement).value,
                                    })}
                                >
                                  ${channelOptions.map(
                                    (channel) =>
                                      html`<option value=${channel}>
                                        ${resolveChannelLabel(props, channel)}
                                      </option>`,
                                  )}
                                </select>
                              `
                        }
                        ${
                          selectedDeliveryMode === "announce"
                            ? html`
                                <div class="cron-help">${t("cron.form.channelHelp")}</div>
                              `
                            : html`
                                <div class="cron-help">${t("cron.form.webhookHelp")}</div>
                              `
                        }
                      </label>
                      ${
                        selectedDeliveryMode === "announce"
                          ? html`
                              <label class="field cron-span-2">
                                ${renderFieldLabel(t("cron.form.to"))}
                                <input
                                  id="cron-delivery-to"
                                  .value=${props.form.deliveryTo}
                                  list="cron-delivery-to-suggestions"
                                  @input=${(e: Event) =>
                                    props.onFormChange({
                                      deliveryTo: (e.target as HTMLInputElement).value,
                                    })}
                                  placeholder="${t("cron.form.toPlaceholder")}"
                                />
                                <div class="cron-help">${t("cron.form.toHelp")}</div>
                              </label>
                            `
                          : nothing
                      }
                      ${
                        selectedDeliveryMode === "webhook"
                          ? renderFieldError(
                              props.fieldErrors.deliveryTo,
                              errorIdForField("deliveryTo"),
                            )
                          : nothing
                      }
                    `
                  : nothing
              }
            </div>
          </section>

          <details class="cron-advanced">
            <summary class="cron-advanced__summary">${t("cron.form.advanced")}</summary>
            <div class="cron-help">
              ${t("cron.form.advancedSub")}
            </div>
            <div class="form-grid cron-form-grid">
              <label class="field checkbox cron-checkbox">
                <input
                  type="checkbox"
                  .checked=${props.form.deleteAfterRun}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      deleteAfterRun: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="field-checkbox__label">${t("cron.form.deleteAfterRun")}</span>
                <div class="cron-help">${t("cron.form.deleteAfterRunHelp")}</div>
              </label>
              <label class="field checkbox cron-checkbox">
                <input
                  type="checkbox"
                  .checked=${props.form.clearAgent}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      clearAgent: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="field-checkbox__label">${t("cron.form.clearAgent")}</span>
                <div class="cron-help">${t("cron.form.clearAgentHelp")}</div>
              </label>
              ${
                isCronSchedule
                  ? html`
                      <label class="field checkbox cron-checkbox cron-span-2">
                        <input
                          type="checkbox"
                          .checked=${props.form.scheduleExact}
                          @change=${(e: Event) =>
                            props.onFormChange({
                              scheduleExact: (e.target as HTMLInputElement).checked,
                            })}
                        />
                        <span class="field-checkbox__label">${t("cron.form.exactTiming")}</span>
                        <div class="cron-help">${t("cron.form.exactTimingHelp")}</div>
                      </label>
                      <div class="cron-stagger-group cron-span-2">
                        <label class="field">
                          ${renderFieldLabel(t("cron.form.staggerWindow"))}
                          <input
                            id="cron-stagger-amount"
                            .value=${props.form.staggerAmount}
                            ?disabled=${props.form.scheduleExact}
                            aria-invalid=${props.fieldErrors.staggerAmount ? "true" : "false"}
                            aria-describedby=${ifDefined(
                              props.fieldErrors.staggerAmount
                                ? errorIdForField("staggerAmount")
                                : undefined,
                            )}
                            @input=${(e: Event) =>
                              props.onFormChange({
                                staggerAmount: (e.target as HTMLInputElement).value,
                              })}
                            placeholder="30"
                          />
                          ${renderFieldError(
                            props.fieldErrors.staggerAmount,
                            errorIdForField("staggerAmount"),
                          )}
                        </label>
                        <label class="field">
                          <span>${t("cron.form.staggerUnit")}</span>
                          <select
                            .value=${props.form.staggerUnit}
                            ?disabled=${props.form.scheduleExact}
                            @change=${(e: Event) =>
                              props.onFormChange({
                                staggerUnit: (e.target as HTMLSelectElement)
                                  .value as CronFormState["staggerUnit"],
                              })}
                          >
                            <option value="seconds">${t("cron.form.seconds")}</option>
                            <option value="minutes">${t("cron.form.minutes")}</option>
                          </select>
                        </label>
                      </div>
                    `
                  : nothing
              }
              ${
                isAgentTurn
                  ? html`
                      <label class="field">
                        ${renderFieldLabel(t("cron.form.model"))}
                        <input
                          id="cron-payload-model"
                          .value=${props.form.payloadModel}
                          list="cron-model-suggestions"
                          @input=${(e: Event) =>
                            props.onFormChange({
                              payloadModel: (e.target as HTMLInputElement).value,
                            })}
                          placeholder="${t("cron.form.modelPlaceholder")}"
                        />
                        <div class="cron-help">
                          ${t("cron.form.modelHelp")}
                        </div>
                      </label>
                      <label class="field">
                        ${renderFieldLabel(t("cron.form.thinking"))}
                        <input
                          id="cron-payload-thinking"
                          .value=${props.form.payloadThinking}
                          list="cron-thinking-suggestions"
                          @input=${(e: Event) =>
                            props.onFormChange({
                              payloadThinking: (e.target as HTMLInputElement).value,
                            })}
                          placeholder="${t("cron.form.thinkingPlaceholder")}"
                        />
                        <div class="cron-help">${t("cron.form.thinkingHelp")}</div>
                      </label>
                    `
                  : nothing
              }
              ${
                selectedDeliveryMode !== "none"
                  ? html`
                      <label class="field checkbox cron-checkbox cron-span-2">
                        <input
                          type="checkbox"
                          .checked=${props.form.deliveryBestEffort}
                          @change=${(e: Event) =>
                            props.onFormChange({
                              deliveryBestEffort: (e.target as HTMLInputElement).checked,
                            })}
                        />
                        <span class="field-checkbox__label">${t("cron.form.bestEffort")}</span>
                        <div class="cron-help">${t("cron.form.bestEffortHelp")}</div>
                      </label>
                    `
                  : nothing
              }
            </div>
          </details>
        </div>
        ${
          blockedByValidation
            ? html`
                <div class="cron-form-status" role="status" aria-live="polite">
                  <div class="cron-form-status__title">${t("cron.validation.cantAdd")}</div>
                  <div class="cron-help">${t("cron.validation.fillRequired")}</div>
                  <ul class="cron-form-status__list">
                    ${blockingFields.map(
                      (field) => html`
                        <li>
                          <button
                            type="button"
                            class="cron-form-status__link"
                            @click=${() => focusFormField(field.inputId)}
                          >
                            ${field.label}: ${field.message}
                          </button>
                        </li>
                      `,
                    )}
                  </ul>
                </div>
              `
            : nothing
        }
        <div class="row cron-form-actions">
          <button class="btn primary" ?disabled=${props.busy || !props.canSubmit} @click=${props.onAdd}>
            ${props.busy ? t("cron.jobs.loadingMore") : isEditing ? t("cron.actions.saveChanges") : t("cron.actions.addJob")}
          </button>
          ${
            submitDisabledReason
              ? html`<div class="cron-submit-reason" aria-live="polite">${submitDisabledReason}</div>`
              : nothing
          }
          ${
            isEditing
              ? html`
                  <button class="btn" ?disabled=${props.busy} @click=${props.onCancelEdit}>
                    ${t("cron.actions.cancel")}
                  </button>
                `
              : nothing
          }
        </div>
      </section>
    </section>

    ${renderSuggestionList("cron-agent-suggestions", props.agentSuggestions)}
    ${renderSuggestionList("cron-model-suggestions", props.modelSuggestions)}
    ${renderSuggestionList("cron-thinking-suggestions", props.thinkingSuggestions)}
    ${renderSuggestionList("cron-tz-suggestions", props.timezoneSuggestions)}
    ${renderSuggestionList("cron-delivery-to-suggestions", props.deliveryToSuggestions)}
  `;
}

function renderScheduleFields(props: CronProps) {
  const form = props.form;
  if (form.scheduleKind === "at") {
    return html`
      <label class="field cron-span-2" style="margin-top: 12px;">
        ${renderFieldLabel(t("cron.form.runAt"), true)}
        <input
          id="cron-schedule-at"
          type="datetime-local"
          .value=${form.scheduleAt}
          aria-invalid=${props.fieldErrors.scheduleAt ? "true" : "false"}
          aria-describedby=${ifDefined(
            props.fieldErrors.scheduleAt ? errorIdForField("scheduleAt") : undefined,
          )}
          @input=${(e: Event) =>
            props.onFormChange({
              scheduleAt: (e.target as HTMLInputElement).value,
            })}
        />
        ${renderFieldError(props.fieldErrors.scheduleAt, errorIdForField("scheduleAt"))}
      </label>
    `;
  }
  if (form.scheduleKind === "every") {
    return html`
      <div class="form-grid cron-form-grid" style="margin-top: 12px;">
        <label class="field">
          ${renderFieldLabel(t("cron.form.every"), true)}
          <input
            id="cron-every-amount"
            .value=${form.everyAmount}
            aria-invalid=${props.fieldErrors.everyAmount ? "true" : "false"}
            aria-describedby=${ifDefined(
              props.fieldErrors.everyAmount ? errorIdForField("everyAmount") : undefined,
            )}
            @input=${(e: Event) =>
              props.onFormChange({
                everyAmount: (e.target as HTMLInputElement).value,
              })}
            placeholder="${t("cron.form.everyPlaceholder")}"
          />
          ${renderFieldError(props.fieldErrors.everyAmount, errorIdForField("everyAmount"))}
        </label>
        <label class="field">
          <span>${t("cron.form.unit")}</span>
          <select
            .value=${form.everyUnit}
            @change=${(e: Event) =>
              props.onFormChange({
                everyUnit: (e.target as HTMLSelectElement).value as CronFormState["everyUnit"],
              })}
          >
            <option value="minutes">${t("cron.form.minutes")}</option>
            <option value="hours">${t("cron.form.hours")}</option>
            <option value="days">${t("cron.form.days")}</option>
          </select>
        </label>
      </div>
    `;
  }
  return html`
    <div class="form-grid cron-form-grid" style="margin-top: 12px;">
      <label class="field">
        ${renderFieldLabel(t("cron.form.cronExpr"), true)}
        <input
          id="cron-cron-expr"
          .value=${form.cronExpr}
          aria-invalid=${props.fieldErrors.cronExpr ? "true" : "false"}
          aria-describedby=${ifDefined(
            props.fieldErrors.cronExpr ? errorIdForField("cronExpr") : undefined,
          )}
          @input=${(e: Event) =>
            props.onFormChange({ cronExpr: (e.target as HTMLInputElement).value })}
          placeholder="${t("cron.form.cronExprPlaceholder")}"
        />
        ${renderFieldError(props.fieldErrors.cronExpr, errorIdForField("cronExpr"))}
      </label>
      <label class="field">
        <span>${t("cron.form.timezone")}</span>
        <input
          .value=${form.cronTz}
          list="cron-tz-suggestions"
          @input=${(e: Event) =>
            props.onFormChange({ cronTz: (e.target as HTMLInputElement).value })}
          placeholder="${t("cron.form.timezonePlaceholder")}"
        />
        <div class="cron-help">${t("cron.form.timezoneHelp")}</div>
      </label>
      <div class="cron-help cron-span-2">${t("cron.form.jitterHint")}</div>
    </div>
  `;
}

function renderFieldError(message?: string, id?: string) {
  if (!message) {
    return nothing;
  }
  return html`<div id=${ifDefined(id)} class="cron-help cron-error">${message}</div>`;
}

function renderJob(job: CronJob, props: CronProps) {
  const isSelected = props.runsJobId === job.id;
  const itemClass = `list-item list-item-clickable cron-job${isSelected ? " list-item-selected" : ""}`;
  const selectAnd = (action: () => void) => {
    props.onLoadRuns(job.id);
    action();
  };
  return html`
    <div class=${itemClass} @click=${() => props.onLoadRuns(job.id)}>
      <div class="list-main">
        <div class="list-title">${job.name}</div>
        <div class="list-sub">${formatCronSchedule(job)}</div>
        ${renderJobPayload(job)}
        ${job.agentId ? html`<div class="muted cron-job-agent">${t("cron.form.agentId")}: ${job.agentId}</div>` : nothing}
      </div>
      <div class="list-meta">
        ${renderJobState(job)}
      </div>
      <div class="cron-job-footer">
        <div class="chip-row cron-job-chips">
          <span class=${`chip ${job.enabled ? "chip-ok" : "chip-danger"}`}>
            ${job.enabled ? t("cron.job.enabled") : t("cron.job.disabled")}
          </span>
          <span class="chip">${job.sessionTarget}</span>
          <span class="chip">${job.wakeMode}</span>
        </div>
        <div class="row cron-job-actions">
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onEdit(job));
            }}
          >
            ${t("cron.actions.edit")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onClone(job));
            }}
          >
            Clone
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onToggle(job, !job.enabled));
            }}
          >
            ${job.enabled ? "Disable" : "Enable"}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onRun(job));
            }}
          >
            ${t("cron.actions.run")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onLoadRuns(job.id));
            }}
          >
            ${t("cron.actions.history")}
          </button>
          <button
            class="btn danger"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onRemove(job));
            }}
          >
            ${t("cron.actions.remove")}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderJobPayload(job: CronJob) {
  if (job.payload.kind === "systemEvent") {
    return html`<div class="cron-job-detail">
      <span class="cron-job-detail-label">${t("cron.job.system")}</span>
      <span class="muted cron-job-detail-value">${job.payload.text}</span>
    </div>`;
  }

  const delivery = job.delivery;
  const deliveryTarget =
    delivery?.mode === "webhook"
      ? delivery.to
        ? ` (${delivery.to})`
        : ""
      : delivery?.channel || delivery?.to
        ? ` (${delivery.channel ?? t("cron.form.channelLast")}${delivery.to ? ` -> ${delivery.to}` : ""})`
        : "";

  return html`
    <div class="cron-job-detail">
      <span class="cron-job-detail-label">${t("cron.job.prompt")}</span>
      <span class="muted cron-job-detail-value">${job.payload.message}</span>
    </div>
    ${
      delivery
        ? html`<div class="cron-job-detail">
            <span class="cron-job-detail-label">${t("cron.job.delivery")}</span>
            <span class="muted cron-job-detail-value">${delivery.mode}${deliveryTarget}</span>
          </div>`
        : nothing
    }
  `;
}

function formatStateRelative(ms?: number) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return t("common.na");
  }
  return formatRelativeTimestamp(ms);
}

function formatRunNextLabel(nextRunAtMs: number, nowMs = Date.now()) {
  const rel = formatRelativeTimestamp(nextRunAtMs);
  return nextRunAtMs > nowMs ? `Next ${rel}` : `Due ${rel}`;
}

function renderJobState(job: CronJob) {
  const status = job.state?.lastStatus ?? "n/a";
  const statusClass =
    status === "ok"
      ? "cron-job-status-ok"
      : status === "error"
        ? "cron-job-status-error"
        : status === "skipped"
          ? "cron-job-status-skipped"
          : "cron-job-status-na";
  const nextRunAtMs = job.state?.nextRunAtMs;
  const lastRunAtMs = job.state?.lastRunAtMs;

  return html`
    <div class="cron-job-state">
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">${t("cron.runs.status")}</span>
        <span class=${`cron-job-status-pill ${statusClass}`}>${status}</span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">${t("overview.stats.cronNext", { time: "" }).replace("{time}", "")}</span>
        <span class="cron-job-state-value" title=${formatMs(nextRunAtMs)}>
          ${formatStateRelative(nextRunAtMs)}
        </span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">${t("cron.form.payloadTextAgent")}</span>
        <span class="cron-job-state-value" title=${formatMs(lastRunAtMs)}>
          ${formatStateRelative(lastRunAtMs)}
        </span>
      </div>
    </div>
  `;
}

function renderRun(entry: CronRunLogEntry, basePath: string) {
  const chatUrl =
    typeof entry.sessionKey === "string" && entry.sessionKey.trim().length > 0
      ? `${pathForTab("chat", basePath)}?session=${encodeURIComponent(entry.sessionKey)}`
      : null;
  const status = entry.status ?? "unknown";
  const delivery = entry.deliveryStatus ?? "not-requested";
  const usage = entry.usage;
  const usageSummary =
    usage && typeof usage.total_tokens === "number"
      ? `${usage.total_tokens} tokens`
      : usage && typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number"
        ? `${usage.input_tokens} in / ${usage.output_tokens} out`
        : null;
  return html`
    <div class="list-item cron-run-entry">
      <div class="list-main cron-run-entry__main">
        <div class="list-title cron-run-entry__title">
          ${entry.jobName ?? entry.jobId}
          <span class="muted"> · ${status}</span>
        </div>
        <div class="list-sub cron-run-entry__summary">${entry.summary ?? entry.error ?? t("cron.runs.noSummary")}</div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${delivery}</span>
          ${entry.model ? html`<span class="chip">${entry.model}</span>` : nothing}
          ${entry.provider ? html`<span class="chip">${entry.provider}</span>` : nothing}
          ${usageSummary ? html`<span class="chip">${usageSummary}</span>` : nothing}
        </div>
      </div>
      <div class="list-meta cron-run-entry__meta">
        <div>${formatMs(entry.ts)}</div>
        ${typeof entry.runAtMs === "number" ? html`<div class="muted">${t("cron.runs.runAt")} ${formatMs(entry.runAtMs)}</div>` : nothing}
        <div class="muted">${entry.durationMs ?? 0}ms</div>
        ${
          typeof entry.nextRunAtMs === "number"
            ? html`<div class="muted">${formatRunNextLabel(entry.nextRunAtMs)}</div>`
            : nothing
        }
        ${
          chatUrl
            ? html`<div><a class="session-link" href=${chatUrl}>${t("cron.runs.openChat")}</a></div>`
            : nothing
        }
        ${entry.error ? html`<div class="muted">${entry.error}</div>` : nothing}
        ${entry.deliveryError ? html`<div class="muted">${entry.deliveryError}</div>` : nothing}
      </div>
    </div>
  `;
}
