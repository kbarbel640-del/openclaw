import { readCronRunLogEntries, resolveCronRunLogPath } from "../../cron/run-log.js";
import type { CronRunLogEntry } from "../../cron/run-log.js";
import type { CronJob } from "../../cron/types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const DEFAULT_LIMIT = 100;
const DEFAULT_PER_JOB_LIMIT = 120;
const MAX_LIMIT = 500;
const MAX_PER_JOB_LIMIT = 500;
const MAX_JOB_SCAN = 500;

type OpsRuntimeRunsParams = {
  limit: number;
  perJobLimit: number;
  search: string;
  fromMs?: number;
  toMs?: number;
  status?: "ok" | "error" | "skipped";
  includeDisabledCron: boolean;
  jobId?: string;
};

type OpsRuntimeRunItem = {
  ts: number;
  ageMs: number;
  jobId: string;
  jobName: string;
  enabled: boolean;
  status: "ok" | "error" | "skipped";
  error?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
  model?: string;
  provider?: string;
  logPath: string;
};

type OpsRuntimeFailureItem = {
  jobId: string;
  jobName: string;
  enabled: boolean;
  totalRuns: number;
  errors: number;
  timeoutErrors: number;
  consecutiveErrors: number;
  lastStatus?: string;
  lastError?: string;
  lastErrorAtMs?: number;
  needsAction: boolean;
  logPath: string;
};

export const opsRuntimeRunsHandlers: GatewayRequestHandlers = {
  "ops.runtime.runs": async ({ params, respond, context }) => {
    const normalized = normalizeParams(params);
    if (!normalized.ok) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, normalized.error));
      return;
    }

    const filters = normalized.value;
    const now = Date.now();

    try {
      const allJobs = await context.cron.list({
        includeDisabled: filters.includeDisabledCron,
      });
      const selectedJobs = filters.jobId
        ? allJobs.filter((job) => job.id === filters.jobId)
        : allJobs;
      const scannedJobs = selectedJobs.slice(0, MAX_JOB_SCAN);

      const runBundles = await Promise.all(
        scannedJobs.map(async (job) => {
          const logPath = resolveCronRunLogPath({
            storePath: context.cronStorePath,
            jobId: job.id,
          });
          const entries = await readCronRunLogEntries(logPath, {
            limit: filters.perJobLimit,
            jobId: job.id,
          });
          return { job, logPath, entries };
        }),
      );

      const allRuns: OpsRuntimeRunItem[] = [];
      for (const bundle of runBundles) {
        for (const entry of bundle.entries) {
          const item = toRunItem(entry, bundle.job, bundle.logPath, now);
          if (!matchesRunFilters(item, filters)) {
            continue;
          }
          allRuns.push(item);
        }
      }
      allRuns.sort((a, b) => b.ts - a.ts);

      const runs = allRuns.slice(0, filters.limit);
      const allFailures = summarizeFailures({
        jobs: scannedJobs,
        runs: allRuns,
        logPaths: new Map(runBundles.map((bundle) => [bundle.job.id, bundle.logPath])),
        filters,
      });
      const failures = allFailures.slice(0, filters.limit);

      const payload = {
        ts: now,
        filters: {
          limit: filters.limit,
          perJobLimit: filters.perJobLimit,
          search: filters.search || null,
          fromMs: filters.fromMs ?? null,
          toMs: filters.toMs ?? null,
          status: filters.status ?? null,
          includeDisabledCron: filters.includeDisabledCron,
          jobId: filters.jobId ?? null,
        },
        summary: {
          jobsScanned: scannedJobs.length,
          jobsTotal: selectedJobs.length,
          jobsTruncated: selectedJobs.length > scannedJobs.length,
          totalRuns: allRuns.length,
          okRuns: allRuns.filter((run) => run.status === "ok").length,
          errorRuns: allRuns.filter((run) => run.status === "error").length,
          skippedRuns: allRuns.filter((run) => run.status === "skipped").length,
          timeoutRuns: allRuns.filter((run) => isTimeoutError(run.error)).length,
          jobsWithFailures: allFailures.length,
          needsAction: allFailures.filter((item) => item.needsAction).length,
        },
        runs,
        failures,
      };

      respond(true, payload, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },
};

function normalizeParams(
  input: unknown,
): { ok: true; value: OpsRuntimeRunsParams } | { ok: false; error: string } {
  if (input != null && typeof input !== "object") {
    return { ok: false, error: "ops.runtime.runs params must be an object" };
  }

  const params = (input ?? {}) as Record<string, unknown>;
  const limit = toPositiveInt(params.limit, DEFAULT_LIMIT);
  if (!limit) {
    return { ok: false, error: "limit must be a positive integer" };
  }

  const perJobLimit = toPositiveInt(params.perJobLimit, DEFAULT_PER_JOB_LIMIT);
  if (!perJobLimit) {
    return { ok: false, error: "perJobLimit must be a positive integer" };
  }

  const fromMs = toOptionalMs(params.fromMs);
  if (params.fromMs !== undefined && fromMs === undefined) {
    return { ok: false, error: "fromMs must be a valid unix timestamp in milliseconds" };
  }

  const toMs = toOptionalMs(params.toMs);
  if (params.toMs !== undefined && toMs === undefined) {
    return { ok: false, error: "toMs must be a valid unix timestamp in milliseconds" };
  }
  if (fromMs !== undefined && toMs !== undefined && fromMs > toMs) {
    return { ok: false, error: "fromMs cannot be greater than toMs" };
  }

  const status = normalizeStatusFilter(params.status);
  if (params.status !== undefined && status === undefined) {
    return { ok: false, error: "status must be one of: ok, error, skipped" };
  }

  const search =
    typeof params.search === "string" ? params.search.trim().toLowerCase().slice(0, 200) : "";
  const includeDisabledCron = params.includeDisabledCron === true;
  const jobId = typeof params.jobId === "string" ? params.jobId.trim() : "";
  if (params.jobId !== undefined && jobId.length === 0) {
    return { ok: false, error: "jobId must be a non-empty string" };
  }

  return {
    ok: true,
    value: {
      limit: Math.min(limit, MAX_LIMIT),
      perJobLimit: Math.min(perJobLimit, MAX_PER_JOB_LIMIT),
      search,
      fromMs,
      toMs,
      status,
      includeDisabledCron,
      jobId: jobId || undefined,
    },
  };
}

function toRunItem(
  entry: CronRunLogEntry,
  job: CronJob,
  logPath: string,
  now: number,
): OpsRuntimeRunItem {
  const ts = numberOr(entry.ts) ?? now;
  const status = normalizeRunStatus(entry.status, entry.error);
  return {
    ts,
    ageMs: Math.max(0, now - ts),
    jobId: job.id,
    jobName: job.name || job.id,
    enabled: Boolean(job.enabled),
    status,
    error: stringOrUndefined(entry.error),
    summary: stringOrUndefined(entry.summary),
    sessionId: stringOrUndefined(entry.sessionId),
    sessionKey: stringOrUndefined(entry.sessionKey),
    runAtMs: numberOr(entry.runAtMs),
    durationMs: numberOr(entry.durationMs),
    nextRunAtMs: numberOr(entry.nextRunAtMs),
    model: stringOrUndefined(entry.model),
    provider: stringOrUndefined(entry.provider),
    logPath,
  };
}

function summarizeFailures(params: {
  jobs: CronJob[];
  runs: OpsRuntimeRunItem[];
  logPaths: Map<string, string>;
  filters: OpsRuntimeRunsParams;
}): OpsRuntimeFailureItem[] {
  const runsByJob = new Map<string, OpsRuntimeRunItem[]>();
  for (const run of params.runs) {
    const list = runsByJob.get(run.jobId) ?? [];
    list.push(run);
    runsByJob.set(run.jobId, list);
  }

  const failures: OpsRuntimeFailureItem[] = [];
  for (const job of params.jobs) {
    const runs = runsByJob.get(job.id) ?? [];
    const errorRuns = runs.filter((run) => run.status === "error");
    const state = job.state ?? {};
    const stateLastStatus = normalizeStateStatus(state.lastStatus);
    const stateLastError = stringOrUndefined(state.lastError);
    const stateConsecutiveErrors = Math.max(0, numberOr(state.consecutiveErrors) ?? 0);
    const stateAnchor = numberOr(state.lastRunAtMs) ?? numberOr(state.runningAtMs);
    const stateMatchesTime = withinTimeRange(
      stateAnchor,
      params.filters.fromMs,
      params.filters.toMs,
    );
    const stateMatchesSearch = matchesSearch(params.filters.search, [
      job.id,
      job.name,
      stateLastStatus,
      stateLastError,
    ]);
    const statusAllowsFailures =
      params.filters.status === undefined || params.filters.status === "error";
    const latestErrorRun = errorRuns.toSorted((a, b) => b.ts - a.ts)[0];
    const stateSignalsFailure =
      statusAllowsFailures &&
      stateMatchesTime &&
      stateMatchesSearch &&
      (stateConsecutiveErrors > 0 ||
        stateLastStatus === "error" ||
        stateLastStatus === "failed" ||
        Boolean(stateLastError));
    const timeoutErrors =
      errorRuns.filter((run) => isTimeoutError(run.error)).length +
      (stateSignalsFailure &&
      stateLastError &&
      isTimeoutError(stateLastError) &&
      errorRuns.length === 0
        ? 1
        : 0);

    const hasFailureSignals = errorRuns.length > 0 || stateSignalsFailure;
    if (!hasFailureSignals) {
      continue;
    }

    const lastErrorAtMs =
      latestErrorRun?.ts ?? numberOr(state.lastRunAtMs) ?? numberOr(state.runningAtMs);
    const lastError = latestErrorRun?.error ?? stateLastError;
    const needsAction =
      stateConsecutiveErrors >= 2 ||
      timeoutErrors > 0 ||
      stateLastStatus === "error" ||
      stateLastStatus === "failed";

    failures.push({
      jobId: job.id,
      jobName: job.name || job.id,
      enabled: Boolean(job.enabled),
      totalRuns: runs.length,
      errors: errorRuns.length,
      timeoutErrors,
      consecutiveErrors: stateConsecutiveErrors,
      lastStatus: latestErrorRun?.status ?? stateLastStatus,
      lastError,
      lastErrorAtMs,
      needsAction,
      logPath: params.logPaths.get(job.id) ?? "",
    });
  }

  failures.sort((a, b) => {
    if (Number(b.needsAction) !== Number(a.needsAction)) {
      return Number(b.needsAction) - Number(a.needsAction);
    }
    if (b.consecutiveErrors !== a.consecutiveErrors) {
      return b.consecutiveErrors - a.consecutiveErrors;
    }
    if (b.errors !== a.errors) {
      return b.errors - a.errors;
    }
    return (b.lastErrorAtMs ?? 0) - (a.lastErrorAtMs ?? 0);
  });
  return failures;
}

function matchesRunFilters(item: OpsRuntimeRunItem, filters: OpsRuntimeRunsParams): boolean {
  if (!withinTimeRange(item.ts, filters.fromMs, filters.toMs)) {
    return false;
  }
  if (filters.status && item.status !== filters.status) {
    return false;
  }
  if (
    !matchesSearch(filters.search, [
      item.jobId,
      item.jobName,
      item.status,
      item.error,
      item.summary,
      item.sessionId,
      item.sessionKey,
      item.model,
      item.provider,
    ])
  ) {
    return false;
  }
  return true;
}

function normalizeRunStatus(status: unknown, error: unknown): "ok" | "error" | "skipped" {
  const value = normalizeStateStatus(status);
  if (value === "ok" || value === "error" || value === "skipped") {
    return value;
  }
  if (typeof error === "string" && error.trim()) {
    return "error";
  }
  return "ok";
}

function normalizeStateStatus(status: unknown): "ok" | "error" | "skipped" | "failed" | undefined {
  if (typeof status !== "string") {
    return undefined;
  }
  const value = status.trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  if (value === "failed") {
    return "failed";
  }
  if (value === "ok" || value === "error" || value === "skipped") {
    return value;
  }
  return undefined;
}

function normalizeStatusFilter(status: unknown): "ok" | "error" | "skipped" | undefined {
  const value = normalizeStateStatus(status);
  if (value === "failed") {
    return "error";
  }
  return value;
}

function isTimeoutError(error: unknown): boolean {
  return typeof error === "string" && /timeout|timed out/i.test(error);
}

function withinTimeRange(ts: number | undefined, fromMs?: number, toMs?: number): boolean {
  if (fromMs === undefined && toMs === undefined) {
    return true;
  }
  if (typeof ts !== "number" || !Number.isFinite(ts)) {
    return false;
  }
  if (fromMs !== undefined && ts < fromMs) {
    return false;
  }
  if (toMs !== undefined && ts > toMs) {
    return false;
  }
  return true;
}

function matchesSearch(search: string, values: Array<string | undefined>): boolean {
  if (!search) {
    return true;
  }
  return values.some((value) => typeof value === "string" && value.toLowerCase().includes(search));
}

function toPositiveInt(value: unknown, fallback: number): number | undefined {
  if (value === undefined) {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return undefined;
  }
  const parsed = Math.floor(num);
  if (parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function toOptionalMs(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return undefined;
  }
  return Math.floor(num);
}

function numberOr(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const text = value.trim();
  return text ? text : undefined;
}
