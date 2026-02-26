import { html, nothing } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { t } from "../../i18n/index.ts";
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

function getRunStatusOptions(): Array<{ value: CronRunsStatusValue; label: string }> {
  return [
    { value: "ok", label: t("common.ok") },
    { value: "error", label: t("cronUi.runStatus.error") },
    { value: "skipped", label: t("cronUi.runStatus.skipped") },
  ];
}

function getRunDeliveryOptions(): Array<{ value: CronDeliveryStatus; label: string }> {
  return [
    { value: "delivered", label: t("cronUi.deliveryStatus.delivered") },
    { value: "not-delivered", label: t("cronUi.deliveryStatus.notDelivered") },
    { value: "unknown", label: t("states.unknown") },
    { value: "not-requested", label: t("cronUi.deliveryStatus.notRequested") },
  ];
}

function toggleSelection<T extends string>(selected: T[], value: T, checked: boolean): T[] {
  const set = new Set(selected);
  if (checked) {
    set.add(value);
  } else {
    set.delete(value);
  }
  return Array.from(set);
}

function summarizeSelection(selectedLabels: string[], allLabel: string) {
  if (selectedLabels.length === 0) {
    return allLabel;
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
    return t("cronUi.channels.last");
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
            <button class="btn" type="button" @click=${params.onClear}>${t("actions.clear")}</button>
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
    return form.payloadKind === "systemEvent"
      ? t("cronUi.form.fields.mainTimelineMessage")
      : t("cronUi.form.fields.assistantTaskPrompt");
  }
  if (key === "deliveryTo") {
    return deliveryMode === "webhook"
      ? t("cronUi.form.fields.webhookUrl")
      : t("cronUi.form.fields.to");
  }
  const labels: Record<CronFieldKey, string> = {
    name: t("cronUi.form.fields.name"),
    scheduleAt: t("cronUi.form.fields.runAt"),
    everyAmount: t("cronUi.form.fields.every"),
    cronExpr: t("cronUi.form.fields.expression"),
    staggerAmount: t("cronUi.form.fields.staggerWindow"),
    payloadText: t("cronUi.form.fields.payloadText"),
    payloadModel: t("cronUi.form.fields.model"),
    payloadThinking: t("cronUi.form.fields.thinking"),
    timeoutSeconds: t("cronUi.form.fields.timeoutSeconds"),
    deliveryTo: t("cronUi.form.fields.to"),
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
            <span class="cron-required-sr">${t("cronUi.form.required")}</span>
          `
        : nothing
    }
  </span>`;
}

export function renderCron(props: CronProps) {
  const RUN_STATUS_OPTIONS = getRunStatusOptions();
  const RUN_DELIVERY_OPTIONS = getRunDeliveryOptions();
  const isEditing = Boolean(props.editingJobId);
  const isAgentTurn = props.form.payloadKind === "agentTurn";
  const isCronSchedule = props.form.scheduleKind === "cron";
  const channelOptions = buildChannelOptions(props);
  const selectedJob =
    props.runsJobId == null ? undefined : props.jobs.find((job) => job.id === props.runsJobId);
  const selectedRunTitle =
    props.runsScope === "all"
      ? t("cronUi.runs.allJobs")
      : (selectedJob?.name ?? props.runsJobId ?? `(${t("cronUi.runs.selectJob")})`);
  const runs = props.runs.toSorted((a, b) =>
    props.runsSortDir === "asc" ? a.ts - b.ts : b.ts - a.ts,
  );
  const selectedStatusLabels = RUN_STATUS_OPTIONS.filter((option) =>
    props.runsStatuses.includes(option.value),
  ).map((option) => option.label);
  const selectedDeliveryLabels = RUN_DELIVERY_OPTIONS.filter((option) =>
    props.runsDeliveryStatuses.includes(option.value),
  ).map((option) => option.label);
  const statusSummary = summarizeSelection(selectedStatusLabels, t("cronUi.runs.allStatuses"));
  const deliverySummary = summarizeSelection(selectedDeliveryLabels, t("cronUi.runs.allDelivery"));
  const supportsAnnounce =
    props.form.sessionTarget === "isolated" && props.form.payloadKind === "agentTurn";
  const selectedDeliveryMode =
    props.form.deliveryMode === "announce" && !supportsAnnounce ? "none" : props.form.deliveryMode;
  const blockingFields = collectBlockingFields(props.fieldErrors, props.form, selectedDeliveryMode);
  const blockedByValidation = !props.busy && blockingFields.length > 0;
  const submitDisabledReason =
    blockedByValidation && !props.canSubmit
      ? t("cronUi.form.fixFieldsToContinue", {
          count: String(blockingFields.length),
          noun:
            blockingFields.length === 1
              ? t("cronUi.form.fieldSingular")
              : t("cronUi.form.fieldPlural"),
        })
      : "";
  return html`
    <section class="card cron-summary-strip">
      <div class="cron-summary-strip__left">
        <div class="cron-summary-item">
          <div class="cron-summary-label">${t("common.enabled")}</div>
          <div class="cron-summary-value">
            <span class=${`chip ${props.status?.enabled ? "chip-ok" : "chip-danger"}`}>
              ${props.status ? (props.status.enabled ? t("states.yes") : t("states.no")) : t("common.na")}
            </span>
          </div>
        </div>
        <div class="cron-summary-item">
          <div class="cron-summary-label">${t("cronUi.jobs.title")}</div>
          <div class="cron-summary-value">${props.status?.jobs ?? t("common.na")}</div>
        </div>
        <div class="cron-summary-item cron-summary-item--wide">
          <div class="cron-summary-label">${t("cronUi.summary.nextWake")}</div>
          <div class="cron-summary-value">${formatNextRun(props.status?.nextWakeAtMs ?? null)}</div>
        </div>
      </div>
      <div class="cron-summary-strip__actions">
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? t("agentsUi.actions.refreshing") : t("common.refresh")}
        </button>
        ${props.error ? html`<span class="muted">${props.error}</span>` : nothing}
      </div>
    </section>

    <section class="cron-workspace">
      <div class="cron-workspace-main">
        <section class="card">
          <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div>
              <div class="card-title">${t("cronUi.jobs.title")}</div>
              <div class="card-sub">${t("cronUi.jobs.subtitle")}</div>
            </div>
            <div class="muted">
              ${t("cronUi.jobs.shownOfTotal", {
                shown: String(props.jobs.length),
                total: String(props.jobsTotal),
              })}
            </div>
          </div>
          <div class="filters" style="margin-top: 12px;">
            <label class="field cron-filter-search">
              <span>${t("cronUi.jobs.search")}</span>
              <input
                .value=${props.jobsQuery}
                placeholder=${t("cronUi.jobs.searchPlaceholder")}
                @input=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsQuery: (e.target as HTMLInputElement).value,
                  })}
              />
            </label>
            <label class="field">
              <span>${t("common.enabled")}</span>
              <select
                .value=${props.jobsEnabledFilter}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsEnabledFilter: (e.target as HTMLSelectElement)
                      .value as CronJobsEnabledFilter,
                  })}
              >
                <option value="all">${t("states.all")}</option>
                <option value="enabled">${t("common.enabled")}</option>
                <option value="disabled">${t("common.disabled")}</option>
              </select>
            </label>
            <label class="field">
              <span>${t("usageUi.sessions.sort")}</span>
              <select
                .value=${props.jobsSortBy}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsSortBy: (e.target as HTMLSelectElement).value as CronJobsSortBy,
                  })}
              >
                <option value="nextRunAtMs">${t("cronUi.jobs.sort.nextRun")}</option>
                <option value="updatedAtMs">${t("cronUi.jobs.sort.recentlyUpdated")}</option>
                <option value="name">${t("cronUi.form.fields.name")}</option>
              </select>
            </label>
            <label class="field">
              <span>${t("cronUi.jobs.direction")}</span>
              <select
                .value=${props.jobsSortDir}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsSortDir: (e.target as HTMLSelectElement).value as CronSortDir,
                  })}
              >
                <option value="asc">${t("usageUi.sort.ascending")}</option>
                <option value="desc">${t("usageUi.sort.descending")}</option>
              </select>
            </label>
          </div>
          ${
            props.jobs.length === 0
              ? html`
                  <div class="muted" style="margin-top: 12px">${t("cronUi.jobs.noMatching")}</div>
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
                      ${props.jobsLoadingMore ? t("states.loading") : t("cronUi.jobs.loadMore")}
                    </button>
                  </div>
                `
              : nothing
          }
        </section>

        <section class="card">
          <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div>
              <div class="card-title">${t("cronUi.runs.title")}</div>
              <div class="card-sub">
                ${
                  props.runsScope === "all"
                    ? t("cronUi.runs.latestAll")
                    : t("cronUi.runs.latestFor", { value: selectedRunTitle })
                }
              </div>
            </div>
            <div class="muted">
              ${t("cronUi.jobs.shownOfTotal", {
                shown: String(runs.length),
                total: String(props.runsTotal),
              })}
            </div>
          </div>
          <div class="cron-run-filters">
            <div class="cron-run-filters__row cron-run-filters__row--primary">
              <label class="field">
                <span>${t("cronUi.runs.scope")}</span>
                <select
                  .value=${props.runsScope}
                  @change=${(e: Event) =>
                    props.onRunsFiltersChange({
                      cronRunsScope: (e.target as HTMLSelectElement).value as CronRunScope,
                    })}
                >
                  <option value="all">${t("cronUi.runs.allJobs")}</option>
                  <option value="job" ?disabled=${props.runsJobId == null}>${t("cronUi.runs.selectedJob")}</option>
                </select>
              </label>
              <label class="field cron-run-filter-search">
                <span>${t("cronUi.runs.search")}</span>
                <input
                  .value=${props.runsQuery}
                  placeholder=${t("cronUi.runs.searchPlaceholder")}
                  @input=${(e: Event) =>
                    props.onRunsFiltersChange({
                      cronRunsQuery: (e.target as HTMLInputElement).value,
                    })}
                />
              </label>
              <label class="field">
                <span>${t("usageUi.sessions.sort")}</span>
                <select
                  .value=${props.runsSortDir}
                  @change=${(e: Event) =>
                    props.onRunsFiltersChange({
                      cronRunsSortDir: (e.target as HTMLSelectElement).value as CronSortDir,
                    })}
                >
                  <option value="desc">${t("cronUi.runs.sort.newestFirst")}</option>
                  <option value="asc">${t("cronUi.runs.sort.oldestFirst")}</option>
                </select>
              </label>
            </div>
            <div class="cron-run-filters__row cron-run-filters__row--secondary">
              ${renderRunFilterDropdown({
                id: "status",
                title: t("debugUi.status"),
                summary: statusSummary,
                options: RUN_STATUS_OPTIONS,
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
                title: t("cronUi.form.sections.delivery"),
                summary: deliverySummary,
                options: RUN_DELIVERY_OPTIONS,
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
                  <div class="muted" style="margin-top: 12px">
                    ${t("cronUi.runs.selectJobToInspect")}
                  </div>
                `
              : runs.length === 0
                ? html`
                    <div class="muted" style="margin-top: 12px">${t("cronUi.runs.noMatching")}</div>
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
                      ${props.runsLoadingMore ? t("states.loading") : t("cronUi.runs.loadMore")}
                    </button>
                  </div>
                `
              : nothing
          }
        </section>
      </div>

      <section class="card cron-workspace-form">
        <div class="card-title">
          ${isEditing ? t("cronUi.form.editJob") : t("cronUi.form.newJob")}
        </div>
        <div class="card-sub">
          ${isEditing ? t("cronUi.form.editSubtitle") : t("cronUi.form.newSubtitle")}
        </div>
        <div class="cron-form">
          <div class="cron-required-legend">
            <span class="cron-required-marker" aria-hidden="true">*</span> ${t("cronUi.form.required")}
          </div>
          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cronUi.form.sections.basics")}</div>
            <div class="cron-form-section__sub">${t("cronUi.form.sections.basicsSub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field">
                ${renderFieldLabel(t("cronUi.form.fields.name"), true)}
                <input
                  id="cron-name"
                  .value=${props.form.name}
                  placeholder=${t("cronUi.form.placeholders.name")}
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
                <span>${t("cronUi.form.fields.description")}</span>
                <input
                  .value=${props.form.description}
                  placeholder=${t("cronUi.form.placeholders.description")}
                  @input=${(e: Event) =>
                    props.onFormChange({ description: (e.target as HTMLInputElement).value })}
                />
              </label>
              <label class="field">
                ${renderFieldLabel(t("cronUi.form.fields.agentId"))}
                <input
                  id="cron-agent-id"
                  .value=${props.form.agentId}
                  list="cron-agent-suggestions"
                  ?disabled=${props.form.clearAgent}
                  @input=${(e: Event) =>
                    props.onFormChange({ agentId: (e.target as HTMLInputElement).value })}
                  placeholder=${t("cronUi.form.placeholders.agentId")}
                />
                <div class="cron-help">
                  ${t("cronUi.form.help.agentId")}
                </div>
              </label>
              <label class="field checkbox cron-checkbox cron-checkbox-inline">
                <input
                  type="checkbox"
                  .checked=${props.form.enabled}
                  @change=${(e: Event) =>
                    props.onFormChange({ enabled: (e.target as HTMLInputElement).checked })}
                />
                <span class="field-checkbox__label">${t("common.enabled")}</span>
              </label>
            </div>
          </section>

          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cronUi.form.sections.schedule")}</div>
            <div class="cron-form-section__sub">${t("cronUi.form.sections.scheduleSub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field cron-span-2">
                ${renderFieldLabel(t("cronUi.form.fields.schedule"))}
                <select
                  id="cron-schedule-kind"
                  .value=${props.form.scheduleKind}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      scheduleKind: (e.target as HTMLSelectElement)
                        .value as CronFormState["scheduleKind"],
                    })}
                >
                  <option value="every">${t("cronUi.form.scheduleKinds.every")}</option>
                  <option value="at">${t("cronUi.form.scheduleKinds.at")}</option>
                  <option value="cron">Cron</option>
                </select>
              </label>
            </div>
            ${renderScheduleFields(props)}
          </section>

          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cronUi.form.sections.execution")}</div>
            <div class="cron-form-section__sub">${t("cronUi.form.sections.executionSub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field">
                ${renderFieldLabel(t("cronUi.form.fields.session"))}
                <select
                  id="cron-session-target"
                  .value=${props.form.sessionTarget}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      sessionTarget: (e.target as HTMLSelectElement)
                        .value as CronFormState["sessionTarget"],
                    })}
                >
                  <option value="main">${t("cronUi.form.sessionTarget.main")}</option>
                  <option value="isolated">${t("cronUi.form.sessionTarget.isolated")}</option>
                </select>
                <div class="cron-help">${t("cronUi.form.help.sessionTarget")}</div>
              </label>
              <label class="field">
                ${renderFieldLabel(t("cronUi.form.fields.wakeMode"))}
                <select
                  id="cron-wake-mode"
                  .value=${props.form.wakeMode}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      wakeMode: (e.target as HTMLSelectElement).value as CronFormState["wakeMode"],
                    })}
                >
                  <option value="now">${t("cronUi.form.wakeMode.now")}</option>
                  <option value="next-heartbeat">${t("cronUi.form.wakeMode.nextHeartbeat")}</option>
                </select>
                <div class="cron-help">${t("cronUi.form.help.wakeMode")}</div>
              </label>
              <label class="field ${isAgentTurn ? "" : "cron-span-2"}">
                ${renderFieldLabel(t("cronUi.form.fields.whatShouldRun"))}
                <select
                  id="cron-payload-kind"
                  .value=${props.form.payloadKind}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      payloadKind: (e.target as HTMLSelectElement)
                        .value as CronFormState["payloadKind"],
                    })}
                >
                  <option value="systemEvent">${t("cronUi.form.payloadKind.systemEvent")}</option>
                  <option value="agentTurn">${t("cronUi.form.payloadKind.agentTurn")}</option>
                </select>
                <div class="cron-help">
                  ${
                    props.form.payloadKind === "systemEvent"
                      ? t("cronUi.form.help.payloadSystemEvent")
                      : t("cronUi.form.help.payloadAgentTurn")
                  }
                </div>
              </label>
              ${
                isAgentTurn
                  ? html`
                      <label class="field">
                        ${renderFieldLabel(t("cronUi.form.fields.timeoutSeconds"))}
                        <input
                          id="cron-timeout-seconds"
                          .value=${props.form.timeoutSeconds}
                          placeholder=${t("cronUi.form.placeholders.timeoutSeconds")}
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
                          ${t("cronUi.form.help.timeoutSeconds")}
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
                  ? t("cronUi.form.fields.mainTimelineMessage")
                  : t("cronUi.form.fields.assistantTaskPrompt"),
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
            <div class="cron-form-section__title">${t("cronUi.form.sections.delivery")}</div>
            <div class="cron-form-section__sub">${t("cronUi.form.sections.deliverySub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field ${selectedDeliveryMode === "none" ? "cron-span-2" : ""}">
                ${renderFieldLabel(t("cronUi.form.fields.resultDelivery"))}
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
                          <option value="announce">${t("cronUi.form.deliveryMode.announce")}</option>
                        `
                      : nothing
                  }
                  <option value="webhook">${t("cronUi.form.deliveryMode.webhook")}</option>
                  <option value="none">${t("cronUi.form.deliveryMode.none")}</option>
                </select>
                <div class="cron-help">${t("cronUi.form.help.deliveryMode")}</div>
              </label>
              ${
                selectedDeliveryMode !== "none"
                  ? html`
                      <label class="field ${selectedDeliveryMode === "webhook" ? "cron-span-2" : ""}">
                        ${renderFieldLabel(
                          selectedDeliveryMode === "webhook"
                            ? t("cronUi.form.fields.webhookUrl")
                            : t("cronUi.form.fields.channel"),
                          selectedDeliveryMode === "webhook",
                        )}
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
                                  placeholder=${t("cronUi.form.placeholders.webhook")}
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
                                <div class="cron-help">${t("cronUi.form.help.deliveryChannel")}</div>
                              `
                            : html`
                                <div class="cron-help">${t("cronUi.form.help.deliveryWebhook")}</div>
                              `
                        }
                      </label>
                      ${
                        selectedDeliveryMode === "announce"
                          ? html`
                              <label class="field cron-span-2">
                                ${renderFieldLabel(t("cronUi.form.fields.to"))}
                                <input
                                  id="cron-delivery-to"
                                  .value=${props.form.deliveryTo}
                                  list="cron-delivery-to-suggestions"
                                  @input=${(e: Event) =>
                                    props.onFormChange({
                                      deliveryTo: (e.target as HTMLInputElement).value,
                                    })}
                                  placeholder=${t("cronUi.form.placeholders.deliveryTo")}
                                />
                                <div class="cron-help">${t("cronUi.form.help.deliveryTo")}</div>
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
            <summary class="cron-advanced__summary">${t("cronUi.form.sections.advanced")}</summary>
            <div class="cron-help">
              ${t("cronUi.form.sections.advancedSub")}
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
                <span class="field-checkbox__label">${t("cronUi.form.fields.deleteAfterRun")}</span>
                <div class="cron-help">${t("cronUi.form.help.deleteAfterRun")}</div>
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
                <span class="field-checkbox__label">${t("cronUi.form.fields.clearAgentOverride")}</span>
                <div class="cron-help">${t("cronUi.form.help.clearAgentOverride")}</div>
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
                        <span class="field-checkbox__label">${t("cronUi.form.fields.exactTiming")}</span>
                        <div class="cron-help">${t("cronUi.form.help.exactTiming")}</div>
                      </label>
                      <div class="cron-stagger-group cron-span-2">
                        <label class="field">
                          ${renderFieldLabel(t("cronUi.form.fields.staggerWindow"))}
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
                          <span>${t("cronUi.form.fields.staggerUnit")}</span>
                          <select
                            .value=${props.form.staggerUnit}
                            ?disabled=${props.form.scheduleExact}
                            @change=${(e: Event) =>
                              props.onFormChange({
                                staggerUnit: (e.target as HTMLSelectElement)
                                  .value as CronFormState["staggerUnit"],
                              })}
                          >
                            <option value="seconds">${t("cronUi.form.units.seconds")}</option>
                            <option value="minutes">${t("cronUi.form.units.minutes")}</option>
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
                        ${renderFieldLabel(t("cronUi.form.fields.model"))}
                        <input
                          id="cron-payload-model"
                          .value=${props.form.payloadModel}
                          list="cron-model-suggestions"
                          @input=${(e: Event) =>
                            props.onFormChange({
                              payloadModel: (e.target as HTMLInputElement).value,
                            })}
                          placeholder="openai/gpt-5.2"
                        />
                        <div class="cron-help">
                          ${t("cronUi.form.help.model")}
                        </div>
                      </label>
                      <label class="field">
                        ${renderFieldLabel(t("cronUi.form.fields.thinking"))}
                        <input
                          id="cron-payload-thinking"
                          .value=${props.form.payloadThinking}
                          list="cron-thinking-suggestions"
                          @input=${(e: Event) =>
                            props.onFormChange({
                              payloadThinking: (e.target as HTMLInputElement).value,
                            })}
                          placeholder="low"
                        />
                        <div class="cron-help">${t("cronUi.form.help.thinking")}</div>
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
                        <span class="field-checkbox__label">${t("cronUi.form.fields.bestEffortDelivery")}</span>
                        <div class="cron-help">${t("cronUi.form.help.bestEffortDelivery")}</div>
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
                  <div class="cron-form-status__title">${t("cronUi.form.cantAddYet")}</div>
                  <div class="cron-help">${t("cronUi.form.fillRequiredToSubmit")}</div>
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
            ${
              props.busy
                ? t("channels.common.saving")
                : isEditing
                  ? t("cronUi.form.saveChanges")
                  : t("cronUi.form.addJob")
            }
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
                    ${t("actions.cancel")}
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
        ${renderFieldLabel(t("cronUi.form.fields.runAt"), true)}
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
          ${renderFieldLabel(t("cronUi.form.fields.every"), true)}
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
            placeholder="30"
          />
          ${renderFieldError(props.fieldErrors.everyAmount, errorIdForField("everyAmount"))}
        </label>
        <label class="field">
          <span>${t("cronUi.form.fields.unit")}</span>
          <select
            .value=${form.everyUnit}
            @change=${(e: Event) =>
              props.onFormChange({
                everyUnit: (e.target as HTMLSelectElement).value as CronFormState["everyUnit"],
              })}
          >
            <option value="minutes">${t("cronUi.form.units.minutes")}</option>
            <option value="hours">${t("cronUi.form.units.hours")}</option>
            <option value="days">${t("cronUi.form.units.days")}</option>
          </select>
        </label>
      </div>
    `;
  }
  return html`
    <div class="form-grid cron-form-grid" style="margin-top: 12px;">
      <label class="field">
        ${renderFieldLabel(t("cronUi.form.fields.expression"), true)}
        <input
          id="cron-cron-expr"
          .value=${form.cronExpr}
          aria-invalid=${props.fieldErrors.cronExpr ? "true" : "false"}
          aria-describedby=${ifDefined(
            props.fieldErrors.cronExpr ? errorIdForField("cronExpr") : undefined,
          )}
          @input=${(e: Event) =>
            props.onFormChange({ cronExpr: (e.target as HTMLInputElement).value })}
          placeholder="0 7 * * *"
        />
        ${renderFieldError(props.fieldErrors.cronExpr, errorIdForField("cronExpr"))}
      </label>
      <label class="field">
        <span>${t("cronUi.form.fields.timezoneOptional")}</span>
        <input
          .value=${form.cronTz}
          list="cron-tz-suggestions"
          @input=${(e: Event) =>
            props.onFormChange({ cronTz: (e.target as HTMLInputElement).value })}
          placeholder="America/Los_Angeles"
        />
        <div class="cron-help">${t("cronUi.form.help.timezone")}</div>
      </label>
      <div class="cron-help cron-span-2">${t("cronUi.form.help.jitter")}</div>
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
        ${
          job.agentId
            ? html`<div class="muted cron-job-agent">
                ${t("execApproval.agent")}: ${job.agentId}
              </div>`
            : nothing
        }
      </div>
      <div class="list-meta">
        ${renderJobState(job)}
      </div>
      <div class="cron-job-footer">
        <div class="chip-row cron-job-chips">
          <span class=${`chip ${job.enabled ? "chip-ok" : "chip-danger"}`}>
            ${job.enabled ? t("common.enabled") : t("common.disabled")}
          </span>
          <span class="chip">${formatSessionTargetChip(job.sessionTarget)}</span>
          <span class="chip">${formatWakeModeChip(job.wakeMode)}</span>
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
            ${t("actions.edit")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onClone(job));
            }}
          >
            ${t("cronUi.actions.clone")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onToggle(job, !job.enabled));
            }}
          >
            ${job.enabled ? t("actions.disable") : t("actions.enable")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onRun(job));
            }}
          >
            ${t("actions.run")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onLoadRuns(job.id);
            }}
          >
            ${t("cronUi.actions.history")}
          </button>
          <button
            class="btn danger"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onRemove(job));
            }}
          >
            ${t("cronUi.actions.remove")}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderJobPayload(job: CronJob) {
  if (job.payload.kind === "systemEvent") {
    return html`<div class="cron-job-detail">
      <span class="cron-job-detail-label">${t("cronUi.jobPayload.system")}</span>
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
        ? ` (${resolveDeliveryChannelChip(delivery.channel)}${delivery.to ? ` -> ${delivery.to}` : ""})`
        : "";

  return html`
    <div class="cron-job-detail">
      <span class="cron-job-detail-label">${t("cronUi.jobPayload.prompt")}</span>
      <span class="muted cron-job-detail-value">${job.payload.message}</span>
    </div>
    ${
      delivery
        ? html`<div class="cron-job-detail">
            <span class="cron-job-detail-label">${t("cronUi.jobPayload.delivery")}</span>
            <span class="muted cron-job-detail-value">
              ${formatDeliveryModeLabel(delivery.mode)}${deliveryTarget}
            </span>
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
  return nextRunAtMs > nowMs
    ? t("cronUi.runCard.nextValue", { value: rel })
    : t("cronUi.runCard.dueValue", { value: rel });
}

function renderJobState(job: CronJob) {
  const status = job.state?.lastStatus ?? "n/a";
  const statusLabel = formatRunStatusBadge(status);
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
        <span class="cron-job-state-key">${t("debugUi.status")}</span>
        <span class=${`cron-job-status-pill ${statusClass}`}>${statusLabel}</span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">${t("cronUi.jobState.next")}</span>
        <span class="cron-job-state-value" title=${formatMs(nextRunAtMs)}>
          ${formatStateRelative(nextRunAtMs)}
        </span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">${t("cronUi.jobState.last")}</span>
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
      ? t("usageUi.labels.tokensValue", { value: String(usage.total_tokens) })
      : usage && typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number"
        ? t("cronUi.runCard.inputOutput", {
            input: String(usage.input_tokens),
            output: String(usage.output_tokens),
          })
        : null;
  return html`
    <div class="list-item cron-run-entry">
      <div class="list-main cron-run-entry__main">
        <div class="list-title cron-run-entry__title">
          ${entry.jobName ?? entry.jobId}
          <span class="muted"> · ${formatRunStatusBadge(status)}</span>
        </div>
        <div class="list-sub cron-run-entry__summary">
          ${entry.summary ?? entry.error ?? t("cronUi.runCard.noSummary")}
        </div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${formatDeliveryStatusBadge(delivery)}</span>
          ${entry.model ? html`<span class="chip">${entry.model}</span>` : nothing}
          ${entry.provider ? html`<span class="chip">${entry.provider}</span>` : nothing}
          ${usageSummary ? html`<span class="chip">${usageSummary}</span>` : nothing}
        </div>
      </div>
      <div class="list-meta cron-run-entry__meta">
        <div>${formatMs(entry.ts)}</div>
        ${
          typeof entry.runAtMs === "number"
            ? html`<div class="muted">
                ${t("cronUi.runCard.runAtValue", { value: formatMs(entry.runAtMs) })}
              </div>`
            : nothing
        }
        <div class="muted">${t("cronUi.runCard.durationMs", { value: String(entry.durationMs ?? 0) })}</div>
        ${
          typeof entry.nextRunAtMs === "number"
            ? html`<div class="muted">${formatRunNextLabel(entry.nextRunAtMs)}</div>`
            : nothing
        }
        ${
          chatUrl
            ? html`<div><a class="session-link" href=${chatUrl}>${t("cronUi.runCard.openRunChat")}</a></div>`
            : nothing
        }
        ${entry.error ? html`<div class="muted">${entry.error}</div>` : nothing}
        ${entry.deliveryError ? html`<div class="muted">${entry.deliveryError}</div>` : nothing}
      </div>
    </div>
  `;
}

function formatRunStatusBadge(status: string): string {
  switch (status) {
    case "ok":
      return t("common.ok");
    case "error":
      return t("cronUi.runStatus.error");
    case "skipped":
      return t("cronUi.runStatus.skipped");
    case "unknown":
      return t("states.unknown");
    case "n/a":
      return t("common.na");
    default:
      return status;
  }
}

function formatDeliveryStatusBadge(status: string): string {
  switch (status) {
    case "delivered":
      return t("cronUi.deliveryStatus.delivered");
    case "not-delivered":
      return t("cronUi.deliveryStatus.notDelivered");
    case "unknown":
      return t("states.unknown");
    case "not-requested":
      return t("cronUi.deliveryStatus.notRequested");
    default:
      return status;
  }
}

function formatDeliveryModeLabel(mode: string): string {
  switch (mode) {
    case "announce":
      return t("cronUi.form.deliveryMode.announceShort");
    case "webhook":
      return t("cronUi.form.deliveryMode.webhookShort");
    case "none":
      return t("cronUi.form.deliveryMode.noneShort");
    default:
      return mode;
  }
}

function resolveDeliveryChannelChip(channel?: string | null): string {
  return channel && channel.length > 0 ? channel : t("cronUi.channels.last");
}

function formatSessionTargetChip(value: string): string {
  if (value === "main") {
    return t("cronUi.form.sessionTarget.main");
  }
  if (value === "isolated") {
    return t("cronUi.form.sessionTarget.isolated");
  }
  return value;
}

function formatWakeModeChip(value: string): string {
  if (value === "now") {
    return t("cronUi.form.wakeMode.now");
  }
  if (value === "next-heartbeat") {
    return t("cronUi.form.wakeMode.nextHeartbeat");
  }
  return value;
}
