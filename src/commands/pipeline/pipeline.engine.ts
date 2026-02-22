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
  meta?: Record<string, unknown>;
};

type LoopFixPlan = {
  loopId: string;
  iteration: number;
  verdict: string;
  verdictFile: string;
  createdAt: string;
  plan: string;
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

function readVerdictFromFile(workspaceRoot: string, filePath: string): string {
  const abs = absPath(workspaceRoot, filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Verdict file does not exist: ${filePath} (resolved ${abs})`);
  }
  return fs.readFileSync(abs, "utf8");
}

function parseVerdict(text: string): "PASS" | "WARN" | "FAIL" | "ABORT" | "UNKNOWN" {
  const upper = text.toUpperCase();
  if (upper.includes("ABORT")) {
    return "ABORT";
  }
  // Prefer FAIL over WARN if both appear.
  if (upper.includes("FAIL")) {
    return "FAIL";
  }
  if (upper.includes("WARN")) {
    return "WARN";
  }
  if (upper.includes("PASS")) {
    return "PASS";
  }
  return "UNKNOWN";
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeLoopFixPlan(params: {
  workspaceRoot: string;
  runDir: string;
  loopId: string;
  iteration: number;
  verdict: string;
  verdictFile: string;
  plan: string;
}) {
  const runDirAbs = absPath(params.workspaceRoot, params.runDir);
  ensureDir(runDirAbs);
  const outRel = path.join(
    params.runDir,
    `loop-${params.loopId}-iter-${String(params.iteration).padStart(2, "0")}-fixplan.md`,
  );
  const outAbs = absPath(params.workspaceRoot, outRel);
  const body: LoopFixPlan = {
    loopId: params.loopId,
    iteration: params.iteration,
    verdict: params.verdict,
    verdictFile: params.verdictFile,
    createdAt: new Date().toISOString(),
    plan: params.plan,
  };
  const md =
    `# Loop Fix Plan\n\n` +
    `- loopId: ${body.loopId}\n` +
    `- iteration: ${body.iteration}\n` +
    `- verdict: ${body.verdict}\n` +
    `- verdictFile: ${body.verdictFile}\n` +
    `- createdAt: ${body.createdAt}\n\n` +
    `---\n\n` +
    `${body.plan.trim()}\n`;

  fs.writeFileSync(outAbs, md);
  return { outRel, outAbs };
}

export async function runPipeline(spec: PipelineSpecZ, opts: PipelineRunOptions) {
  const workspaceRoot = resolveWorkspaceRoot();

  // Default to running on the agent's own sessionKey (pipeline runner is CLI-side).
  // For now we use a stable internal session key derived from agentId.
  // TODO: support explicit sessionKey in spec.
  const sessionKey = `agent:${spec.agentId ?? "flash-orchestrator"}:pipeline`;

  const steps = spec.steps;
  const stepById = new Map(steps.map((s) => [s.id, s] as const));

  const records: StepRunRecord[] = [];
  const completed = new Set<string>();

  const loops = spec.loops ?? [];
  const loopsByVerdictStepId = new Map<string, (typeof loops)[number][]>();
  for (const l of loops) {
    const arr = loopsByVerdictStepId.get(l.verdictStepId) ?? [];
    arr.push(l);
    loopsByVerdictStepId.set(l.verdictStepId, arr);
  }
  const loopIterations = new Map<string, number>();

  const phases = spec.phases;
  const phaseIdx = new Map(phases.map((p, i) => [p, i] as const));
  for (const s of steps) {
    if (!phaseIdx.has(s.phase)) {
      throw new Error(
        `Step ${s.id} uses phase '${s.phase}' but spec.phases does not include it. Add it to phases.`,
      );
    }
  }

  const wantedPhase = opts.phase;
  const untilPhase = opts.until;

  const startIdx = wantedPhase ? phaseIdx.get(wantedPhase) : 0;
  if (wantedPhase && startIdx === undefined) {
    throw new Error(`--phase '${wantedPhase}' is not in spec.phases`);
  }
  const untilIdx = untilPhase ? phaseIdx.get(untilPhase) : phases.length - 1;
  if (untilPhase && untilIdx === undefined) {
    throw new Error(`--until '${untilPhase}' is not in spec.phases`);
  }

  const phaseAllowed = (phase: string) => {
    const idx = phaseIdx.get(phase);
    if (idx === undefined) {
      return false;
    }
    if (startIdx !== undefined && idx < startIdx) {
      return false;
    }
    if (untilIdx !== undefined && idx > untilIdx) {
      return false;
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
    const step = stepById.get(stepId);
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

    // Loop evaluation: if this step controls any loops, parse verdict and rerun target steps.
    const loopRules = loopsByVerdictStepId.get(step.id) ?? [];
    for (const rule of loopRules) {
      const iter = (loopIterations.get(rule.id) ?? 0) + 1;
      loopIterations.set(rule.id, iter);

      const onVerdicts = rule.on ?? ["WARN", "FAIL"];

      const verdictFile = step.verdictFile;
      if (!verdictFile) {
        throw new Error(
          `Loop '${rule.id}' references verdictStepId '${rule.verdictStepId}' but that step has no verdictFile`,
        );
      }

      const verdictText = readVerdictFromFile(workspaceRoot, verdictFile);
      const verdict = parseVerdict(verdictText);
      rec.meta = { ...rec.meta, verdict, verdictFile };

      if (verdict === "PASS") {
        continue;
      }

      if (verdict === "ABORT") {
        throw new Error(`Loop '${rule.id}' aborted (verdict ABORT in ${verdictFile})`);
      }

      if (
        verdict !== "UNKNOWN" &&
        verdict !== "PASS" &&
        verdict !== "WARN" &&
        verdict !== "FAIL" &&
        verdict !== "ABORT"
      ) {
        continue;
      }
      if (verdict !== "UNKNOWN" && !onVerdicts.includes(verdict)) {
        continue;
      }

      const maxIterations = rule.maxIterations ?? 3;
      if (iter >= maxIterations) {
        throw new Error(
          `Loop '${rule.id}' exceeded maxIterations (${maxIterations}); last verdict=${verdict} (file ${verdictFile})`,
        );
      }

      // Ask the agent to generate a fix plan and persist it into the runDir.
      const fixPlanPrompt =
        `You are running inside a verification pipeline.\n\n` +
        `The pipeline produced a verdict that was not PASS.\n` +
        `Your job: write a concise, actionable FIX PLAN that will help the next rerun pass.\n\n` +
        `Return ONLY markdown. Include:\n` +
        `- bullet list of issues observed\n` +
        `- bullet list of concrete changes to make\n` +
        `- if you need more data, specify exactly which file(s) to inspect next\n\n` +
        `Verdict file path: ${verdictFile}\n\n` +
        `Verdict file contents:\n\n` +
        `---\n${verdictText}\n---\n`;

      const fixRes = await runAgentTurn({
        agentId: spec.agentId,
        sessionKey,
        message: fixPlanPrompt,
        timeoutMs: 10 * 60 * 1000,
      });

      // We don't currently fetch the model's raw text from the gateway in this runner.
      // So we store the prompt itself as a placeholder and rely on downstream steps to read the verdict.
      // TODO: enhance gateway call to return the final assistant text so we can store the actual plan.
      const planText =
        `## Fix plan generation run\n\n- runId: ${fixRes.runId}\n- status: ${fixRes.status}\n\n` +
        `> TODO: pipeline runner does not yet capture the assistant's final text.\n`;

      const fixOut = writeLoopFixPlan({
        workspaceRoot,
        runDir: spec.runDir,
        loopId: rule.id,
        iteration: iter,
        verdict: String(verdict),
        verdictFile,
        plan: planText,
      });
      rec.meta = { ...rec.meta, fixPlanFile: fixOut.outRel };

      // Mark rerun targets as incomplete so scheduler can pick them up again.
      for (const rerunId of rule.rerunStepIds) {
        if (!stepById.has(rerunId)) {
          throw new Error(`Loop '${rule.id}' rerunStepIds references unknown step '${rerunId}'`);
        }
        completed.delete(rerunId);
      }

      // eslint-disable-next-line no-console
      console.log(
        `[pipeline] loop '${rule.id}' iteration ${iter}/${maxIterations} (verdict=${verdict}); wrote ${fixOut.outRel}; rerunning: ${rule.rerunStepIds.join(
          ", ",
        )}`,
      );
    }
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
