import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

function resolveWorkspaceRoot(): string {
  const env = process.env.OPENCLAW_WORKSPACE?.trim();
  if (env) {
    return env;
  }
  return path.join(os.homedir(), ".openclaw", "workspace");
}

function readJsonSafe(filePath: string): unknown {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function runOps(root: string, args: string[]) {
  const script = path.join(root, "scripts", "clarityos", "ops.py");
  return spawnSync("python", [script, ...args], { encoding: "utf8" });
}

function clampLimit(raw: unknown, fallback = 200, max = 2000): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(n)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asIsoString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) {
    return null;
  }
  return dt.toISOString();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const clarityosHandlers: GatewayRequestHandlers = {
  "clarityos.status": async ({ respond }) => {
    const root = resolveWorkspaceRoot();
    const base = path.join(root, "reports", "clarityos");
    const status = readJsonSafe(path.join(root, ".clarityos", "status.json"));
    const verification = readJsonSafe(path.join(base, "verification.json"));
    const progressPath = path.join(base, "dev-progress.md");
    const progressTail = fs.existsSync(progressPath)
      ? fs.readFileSync(progressPath, "utf8").split(/\r?\n/).filter(Boolean).slice(-30)
      : [];

    const timelineLatest = readJsonSafe(path.join(base, "timeline-latest.json"));
    const timelineRows = Array.isArray(timelineLatest) ? timelineLatest : [];
    const timelineFirst = asRecord(timelineRows[0]);

    const statusObj = asRecord(status) ?? {};
    const statusExtra = asRecord(statusObj.extra) ?? {};
    const watchdog = asRecord(statusExtra.watchdog) ?? {};

    const now = Date.now();
    const checkpointIso = asIsoString(watchdog.next_checkpoint_due_ts);
    const checkpointMs = checkpointIso ? Date.parse(checkpointIso) : Number.NaN;
    const checkpointDeltaMin = Number.isFinite(checkpointMs)
      ? Math.max(0, Math.round((checkpointMs - now) / 60000))
      : null;

    const startedAtUtc =
      asIsoString(statusExtra.started_at_utc) ??
      asIsoString(watchdog.last_code_change_ts) ??
      asIsoString(statusObj.ts) ??
      asIsoString(timelineFirst?.ts) ??
      undefined;

    const existingMilestones = asStringArray(statusExtra.next_milestones);
    const activeMilestone =
      typeof watchdog.active_milestone_key === "string" ? watchdog.active_milestone_key.trim() : "";
    const step = typeof statusObj.step === "string" ? statusObj.step.trim() : "";
    const nextMilestones =
      existingMilestones.length > 0
        ? existingMilestones
        : activeMilestone
          ? [activeMilestone]
          : step
            ? [step]
            : [];

    const currentTask =
      typeof statusExtra.current_task === "string" && statusExtra.current_task.trim()
        ? statusExtra.current_task.trim()
        : step || undefined;

    const progressPercent =
      typeof statusExtra.progress_percent === "number" &&
      Number.isFinite(statusExtra.progress_percent)
        ? Math.max(0, Math.min(100, statusExtra.progress_percent))
        : undefined;

    const etaMinutes =
      typeof statusExtra.eta_minutes === "number" && Number.isFinite(statusExtra.eta_minutes)
        ? Math.max(0, Math.floor(statusExtra.eta_minutes))
        : (checkpointDeltaMin ?? undefined);

    const etaRange =
      typeof statusExtra.eta_range === "string" && statusExtra.eta_range.trim()
        ? statusExtra.eta_range.trim()
        : typeof etaMinutes === "number"
          ? `~${etaMinutes} min`
          : undefined;

    const enrichedExtra = {
      ...statusExtra,
      current_task: currentTask,
      started_at_utc: startedAtUtc,
      progress_percent: progressPercent,
      eta_minutes: etaMinutes,
      eta_range: etaRange,
      next_milestones: nextMilestones,
      watchdog,
    };

    const enrichedStatus = {
      ...statusObj,
      extra: enrichedExtra,
    };

    respond(true, {
      workspace: root,
      status: enrichedStatus,
      verification,
      progressTail,
      generatedAt: new Date().toISOString(),
    });
  },

  "clarityos.summary": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const base = path.join(root, "reports", "clarityos");
    const period = typeof params?.period === "string" ? params.period.toLowerCase() : "daily";
    const allowed = new Set(["daily", "weekly", "monthly", "custom"]);
    if (!allowed.has(period)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid period: ${String(params?.period)} (expected daily|weekly|monthly|custom)`,
        ),
      );
      return;
    }
    const filename = period === "custom" ? "custom-summary.json" : `${period}-summary.json`;
    const payload = readJsonSafe(path.join(base, filename));
    if (!payload) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `summary artifact missing: ${filename}`),
      );
      return;
    }
    respond(true, payload);
  },

  "clarityos.timeline": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const base = path.join(root, "reports", "clarityos");
    const payload = readJsonSafe(path.join(base, "timeline-latest.json"));
    if (!Array.isArray(payload)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "timeline artifact missing or invalid"),
      );
      return;
    }
    const limit = clampLimit(params?.limit, 200, 2000);
    respond(true, {
      generatedAt: new Date().toISOString(),
      limit,
      timeline: payload.slice(0, limit),
    });
  },

  "clarityos.timeline.query": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const script = path.join(root, "scripts", "clarityos", "clarityos.py");
    const args = [
      script,
      "timeline-query",
      "--limit",
      String(clampLimit(params?.limit, 200, 2000)),
    ];
    if (typeof params?.q === "string" && params.q.trim()) {
      args.push("--q", params.q.trim());
    }
    if (typeof params?.source === "string" && params.source.trim()) {
      args.push("--source", params.source.trim());
    }
    if (typeof params?.eventType === "string" && params.eventType.trim()) {
      args.push("--event-type", params.eventType.trim());
    }
    if (typeof params?.status === "string" && params.status.trim()) {
      args.push("--status", params.status.trim());
    }
    if (typeof params?.since === "string" && params.since.trim()) {
      args.push("--since", params.since.trim());
    }
    if (typeof params?.until === "string" && params.until.trim()) {
      args.push("--until", params.until.trim());
    }

    const py = spawnSync("python", args, { encoding: "utf8" });
    if (py.status !== 0) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `timeline query failed: ${py.stderr || py.stdout || "unknown error"}`.trim(),
        ),
      );
      return;
    }

    const payload = readJsonSafe(path.join(root, "reports", "clarityos", "timeline-query.json"));
    if (!payload) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "timeline-query artifact missing"),
      );
      return;
    }
    respond(true, payload);
  },

  "clarityos.proposals": async ({ respond }) => {
    const root = resolveWorkspaceRoot();
    const base = path.join(root, "reports", "clarityos");
    const payload = readJsonSafe(path.join(base, "proposals.json"));
    if (!payload) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "proposals artifact missing (run ops.py proposal-list)",
        ),
      );
      return;
    }
    respond(true, payload);
  },

  "clarityos.proposal.state": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const key = typeof params?.key === "string" ? params.key.trim() : "";
    const state = typeof params?.state === "string" ? params.state.trim() : "";
    const valid = new Set(["proposed", "approved", "in_progress", "standby", "blocked", "done"]);
    if (!key || !state || !valid.has(state)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "invalid params; expected { key, state } with valid state",
        ),
      );
      return;
    }

    const script = path.join(root, "scripts", "clarityos", "ops.py");
    const py = spawnSync("python", [script, "proposal-state", "--key", key, "--state", state], {
      encoding: "utf8",
    });
    if (py.status !== 0) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `proposal-state failed: ${py.stderr || py.stdout || "unknown error"}`.trim(),
        ),
      );
      return;
    }

    // Regenerate proposals snapshot for UI reads
    spawnSync("python", [script, "proposal-list"], { encoding: "utf8" });

    respond(true, { ok: true, key, state, output: py.stdout.trim() });
  },

  "clarityos.tasks.claimLease": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const key = typeof params?.key === "string" ? params.key.trim() : "";
    if (!key) {
      return respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing key"));
    }
    const agent =
      typeof params?.agent === "string" && params.agent.trim() ? params.agent.trim() : "executor";
    const ttl = Number.isFinite(Number(params?.ttlMin))
      ? Math.max(1, Math.floor(Number(params?.ttlMin)))
      : 20;
    const reason = typeof params?.reason === "string" ? params.reason : "lease-claim";
    const py = runOps(root, [
      "task-claim-lease",
      "--key",
      key,
      "--agent",
      agent,
      "--ttl-min",
      String(ttl),
      "--reason",
      reason,
    ]);
    if (py.status !== 0) {
      return respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          (py.stderr || py.stdout || "claim lease failed").trim(),
        ),
      );
    }
    respond(
      true,
      readJsonSafe(path.join(root, "reports", "clarityos", "tasks.json")) ?? {
        ok: true,
        out: py.stdout.trim(),
      },
    );
  },

  "clarityos.tasks.heartbeat": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const key = typeof params?.key === "string" ? params.key.trim() : "";
    if (!key) {
      return respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing key"));
    }
    const agent =
      typeof params?.agent === "string" && params.agent.trim() ? params.agent.trim() : "executor";
    const ttl = Number.isFinite(Number(params?.ttlMin))
      ? Math.max(1, Math.floor(Number(params?.ttlMin)))
      : 20;
    const py = runOps(root, [
      "task-lease-heartbeat",
      "--key",
      key,
      "--agent",
      agent,
      "--ttl-min",
      String(ttl),
    ]);
    if (py.status !== 0) {
      return respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          (py.stderr || py.stdout || "lease heartbeat failed").trim(),
        ),
      );
    }
    respond(true, { ok: true, output: py.stdout.trim() });
  },

  "clarityos.tasks.releaseLease": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const key = typeof params?.key === "string" ? params.key.trim() : "";
    if (!key) {
      return respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing key"));
    }
    const agent =
      typeof params?.agent === "string" && params.agent.trim() ? params.agent.trim() : "executor";
    const reason = typeof params?.reason === "string" ? params.reason : "lease-release";
    const py = runOps(root, [
      "task-release-lease",
      "--key",
      key,
      "--agent",
      agent,
      "--reason",
      reason,
    ]);
    if (py.status !== 0) {
      return respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          (py.stderr || py.stdout || "release lease failed").trim(),
        ),
      );
    }
    respond(true, { ok: true, output: py.stdout.trim() });
  },

  "clarityos.tasks.transition": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const key = typeof params?.key === "string" ? params.key.trim() : "";
    const toState = typeof params?.toState === "string" ? params.toState.trim() : "";
    if (!key || !toState) {
      return respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "missing key/toState"),
      );
    }
    const actor =
      typeof params?.actor === "string" && params.actor.trim() ? params.actor.trim() : "chief";
    const reason = typeof params?.reason === "string" ? params.reason : "manual-transition";
    const py = runOps(root, [
      "task-transition",
      "--key",
      key,
      "--to-state",
      toState,
      "--actor",
      actor,
      "--reason",
      reason,
    ]);
    if (py.status !== 0) {
      return respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          (py.stderr || py.stdout || "transition failed").trim(),
        ),
      );
    }
    respond(true, { ok: true, output: py.stdout.trim() });
  },

  "clarityos.tasks.validate": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const key = typeof params?.key === "string" ? params.key.trim() : "";
    if (!key) {
      return respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing key"));
    }
    const by = typeof params?.by === "string" && params.by.trim() ? params.by.trim() : "validator";
    const reason = typeof params?.reason === "string" ? params.reason : "validation gate";
    const py = runOps(root, ["task-validate", "--key", key, "--by", by, "--reason", reason]);
    if (py.status !== 0) {
      return respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          (py.stderr || py.stdout || "validate failed").trim(),
        ),
      );
    }
    respond(true, { ok: true, output: py.stdout.trim() });
  },

  "clarityos.metrics.slo": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const wh = Number.isFinite(Number(params?.windowHours))
      ? Math.max(1, Math.floor(Number(params?.windowHours)))
      : 24;
    const py = runOps(root, ["metrics-slo", "--window-hours", String(wh)]);
    if (py.status !== 0) {
      return respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, (py.stderr || py.stdout || "metrics failed").trim()),
      );
    }
    const payload = readJsonSafe(path.join(root, "reports", "clarityos", "metrics-slo.json"));
    respond(true, payload ?? { ok: true, output: py.stdout.trim() });
  },

  "clarityos.costs.ingestExact": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const provider = typeof params?.provider === "string" ? params.provider.trim() : "";
    const costUsd = Number(params?.costUsd);
    if (!provider || !Number.isFinite(costUsd)) {
      return respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "missing provider/costUsd"),
      );
    }
    const args = ["cost-ingest-exact", "--provider", provider, "--cost-usd", String(costUsd)];
    const map: Array<[string, string]> = [
      ["model", "model"],
      ["sessionId", "session-id"],
      ["runKey", "run-key"],
      ["confidence", "confidence"],
    ];
    for (const [k, a] of map) {
      const v = params?.[k];
      if (typeof v === "string" && v.trim()) {
        args.push(`--${a}`, v.trim());
      }
    }
    const nums: Array<[string, string]> = [
      ["inputTokens", "input-tokens"],
      ["outputTokens", "output-tokens"],
      ["cacheReadTokens", "cache-read-tokens"],
      ["cacheWriteTokens", "cache-write-tokens"],
    ];
    for (const [k, a] of nums) {
      const n = Number(params?.[k]);
      if (Number.isFinite(n) && n > 0) {
        args.push(`--${a}`, String(Math.floor(n)));
      }
    }
    const py = runOps(root, args);
    if (py.status !== 0) {
      return respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          (py.stderr || py.stdout || "cost ingest failed").trim(),
        ),
      );
    }
    respond(true, { ok: true, output: py.stdout.trim() });
  },

  "clarityos.costs.variance": async ({ respond, params }) => {
    const root = resolveWorkspaceRoot();
    const wh = Number.isFinite(Number(params?.windowHours))
      ? Math.max(1, Math.floor(Number(params?.windowHours)))
      : 24;
    const py = runOps(root, ["cost-variance", "--window-hours", String(wh)]);
    if (py.status !== 0) {
      return respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          (py.stderr || py.stdout || "cost variance failed").trim(),
        ),
      );
    }
    const payload = readJsonSafe(path.join(root, "reports", "clarityos", "cost-variance.json"));
    respond(true, payload ?? { ok: true, output: py.stdout.trim() });
  },

  "clarityos.nightly": async ({ respond }) => {
    const root = resolveWorkspaceRoot();
    const base = path.join(root, "reports", "clarityos");
    const files = fs.existsSync(base)
      ? fs
          .readdirSync(base)
          .filter((f) => f.startsWith("nightly-self-improvement-") && f.endsWith(".json"))
          .toSorted()
      : [];
    const latest = files.length ? readJsonSafe(path.join(base, files[files.length - 1])) : null;
    respond(true, {
      latest,
      files,
      count: files.length,
      generatedAt: new Date().toISOString(),
    });
  },
};
