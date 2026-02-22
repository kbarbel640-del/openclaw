import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../../config/config.js";
import { callGateway } from "../../gateway/call.js";
import type { PipelineSpecZ } from "./pipeline.spec.js";

export type PipelineRunOptions = {
  phase?: string;
  until?: string;
  yes?: boolean;
  dryRun?: boolean;
};

type StepRunRecord = {
  id: string;
  phase: string;
  model: string;
  startedAt: number;
  endedAt?: number;
  runId?: string;
  status?: string;
  error?: string;
};

function now() {
  return Date.now();
}

function sleep(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function resolveWorkspaceRoot() {
  const cfg = loadConfig();
  const ws = cfg.agents?.defaults?.workspace;
  if (!ws) {
    throw new Error("agents.defaults.workspace is not set in config");
  }
  return ws;
}

function absPath(workspaceRoot: string, p: string) {
  if (path.isAbsolute(p)) {
    return p;
  }
  return path.join(workspaceRoot, p);
}

function filesExist(workspaceRoot: string, files: string[]) {
  return files.every((f) => fs.existsSync(absPath(workspaceRoot, f)));
}

async function runAgentTurn(params: {
  agentId?: string;
  sessionKey: string;
  message: string;
  timeoutMs: number;
}) {
  const idempotencyKey = crypto.randomUUID();
  const resp = await callGateway<{ runId?: string }>({
    method: "agent",
    params: {
      message: params.message,
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      deliver: false,
      channel: "internal",
      lane: "pipeline",
      timeout: 0,
      idempotencyKey,
    },
    timeoutMs: 10_000,
  });
  const runId = typeof resp?.runId === "string" && resp.runId ? resp.runId : idempotencyKey;

  const waitMs = params.timeoutMs;
  const wait = await callGateway<{ status?: string }>({
    method: "agent.wait",
    params: { runId, timeoutMs: waitMs },
    timeoutMs: waitMs + 2_000,
  });
  return { runId, status: wait?.status ?? "unknown" };
}

export async function runPipeline(spec: PipelineSpecZ, opts: PipelineRunOptions) {
  const workspaceRoot = resolveWorkspaceRoot();

  // Default to running on the agent's own sessionKey (pipeline runner is CLI-side).
  // For now we use a stable internal session key derived from agentId.
  // TODO: support explicit sessionKey in spec.
  const sessionKey = `agent:${spec.agentId ?? "flash-orchestrator"}:pipeline`;

  const steps = spec.steps;

  const records: StepRunRecord[] = [];
  const completed = new Set<string>();

  // TODO: implement loop gating based on checkpoints/verdict parsing.
  // const maxLoops = new Map((spec.loops ?? []).map((l) => [l.id, l.maxIterations ?? 3]));
  // const loopCounts = new Map<string, number>();

  const wantedPhase = opts.phase;
  const untilPhase = opts.until;

  const phaseAllowed = (phase: string) => {
    if (wantedPhase && phase !== wantedPhase) {
      return false;
    }
    if (untilPhase) {
      // very rough ordering: string compare not reliable; for now treat as exact match or run all.
      // TODO: implement explicit phase ordering in spec.
      return true;
    }
    return true;
  };

  const getReadySteps = () => {
    return steps.filter((s) => {
      if (completed.has(s.id)) {
        return false;
      }
      if (!phaseAllowed(s.phase)) {
        return false;
      }
      const deps = s.dependsOn ?? [];
      if (!deps.every((d) => completed.has(d))) {
        return false;
      }
      const reqFiles = s.requiresFiles ?? [];
      if (reqFiles.length && !filesExist(workspaceRoot, reqFiles)) {
        return false;
      }
      return true;
    });
  };

  const runOne = async (stepId: string) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Unknown step: ${stepId}`);
    }

    const rec: StepRunRecord = {
      id: step.id,
      phase: step.phase,
      model: step.model,
      startedAt: now(),
    };
    records.push(rec);

    if (opts.dryRun) {
      rec.status = "dry_run";
      rec.endedAt = now();
      completed.add(step.id);
      return;
    }

    const msg = step.task;
    const res = await runAgentTurn({
      agentId: spec.agentId,
      sessionKey,
      message: msg,
      timeoutMs: 30 * 60 * 1000,
    });
    rec.runId = res.runId;
    rec.status = res.status;

    const produces = step.producesFiles ?? [];
    if (produces.length) {
      const startWait = now();
      while (!filesExist(workspaceRoot, produces)) {
        if (now() - startWait > 30 * 60 * 1000) {
          rec.error = `Timeout waiting for outputs: ${produces.join(", ")}`;
          break;
        }
        sleep(1000);
      }
    }

    rec.endedAt = now();
    completed.add(step.id);
  };

  // Simple scheduler: run by groups. Steps without group run serially.
  while (true) {
    const ready = getReadySteps();
    if (ready.length === 0) {
      break;
    }

    const byGroup = new Map<string, string[]>();
    const serial: string[] = [];
    for (const s of ready) {
      if (s.group) {
        const arr = byGroup.get(s.group) ?? [];
        arr.push(s.id);
        byGroup.set(s.group, arr);
      } else {
        serial.push(s.id);
      }
    }

    // Run all grouped steps in parallel, group by group.
    for (const [group, ids] of byGroup) {
      // eslint-disable-next-line no-console
      console.log(`[pipeline] group ${group}: ${ids.join(", ")}`);
      await Promise.all(ids.map((id) => runOne(id)));
    }

    for (const id of serial) {
      // eslint-disable-next-line no-console
      console.log(`[pipeline] step ${id}`);
      await runOne(id);
    }

    // TODO: checkpoints + loops based on verdict parsing.
  }

  const summary = {
    ok: true,
    name: spec.name,
    runDir: spec.runDir,
    stepsRun: records.length,
    records,
  };

  const outPath = absPath(workspaceRoot, path.join(spec.runDir, "pipeline-run-summary.json"));
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  return summary;
}
