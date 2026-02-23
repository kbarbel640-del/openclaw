import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import {
  addAllowlistEntry,
  type ExecAsk,
  type ExecAllowlistEntry,
  type ExecSecurity,
  buildSafeBinsShellCommand,
  buildSafeShellCommand,
  evaluateShellAllowlist,
  maxAsk,
  minSecurity,
  resolveAllowlistCandidatePath,
  matchAllowlist,
  recordAllowlistUse,
  requiresExecApproval,
  resolveAllowAlwaysPatterns,
  resolveExecApprovals,
} from "../infra/exec-approvals.js";
import type { CommandResolution } from "../infra/exec-command-resolution.js";
import type { SafeBinProfile } from "../infra/exec-safe-bin-policy.js";
import { markBackgrounded, tail } from "./bash-process-registry.js";
import { requestExecApprovalDecisionForHost } from "./bash-tools.exec-approval-request.js";
import {
  DEFAULT_APPROVAL_TIMEOUT_MS,
  DEFAULT_NOTIFY_TAIL_CHARS,
  createApprovalSlug,
  emitExecSystemEvent,
  normalizeNotifyOutput,
  runExecProcess,
} from "./bash-tools.exec-runtime.js";
import type { ExecToolDetails } from "./bash-tools.exec-types.js";

type PendingGatewayApproval = {
  id: string;
  expiresAtMs: number;
};

const pendingGatewayApprovals = new Map<string, PendingGatewayApproval>();
const gatewayApprovalRequestWindowMs = DEFAULT_APPROVAL_TIMEOUT_MS;
const TRACE_FLAG = "OPENCLAW_EXEC_ALLOWLIST_TRACE";
const execAllowlistTracePath = (() => {
  const home = process.env.HOME ?? process.env.USERPROFILE;
  return home ? path.join(home, ".openclaw", "derived", "exec-allowlist-trace.jsonl") : null;
})();

function approvalRequestKey(params: {
  agentId?: string;
  sessionKey?: string;
  workdir: string;
  command: string;
  hostSecurity: ExecSecurity;
  hostAsk: ExecAsk;
}): string {
  return JSON.stringify({
    agentId: params.agentId ?? "",
    sessionKey: params.sessionKey ?? "",
    workdir: params.workdir,
    commandHash: crypto.createHash("sha256").update(params.command).digest("hex"),
    hostSecurity: params.hostSecurity,
    hostAsk: params.hostAsk,
  });
}

function findAllowlistMissDetails(params: {
  analysisOk: boolean;
  allowlistSatisfied: boolean;
  segments: ReadonlyArray<{
    argv: string[];
    resolution: CommandResolution | null;
  }>;
  segmentSatisfiedBy: ReadonlyArray<"allowlist" | "safeBins" | "skills" | null>;
}): string | null {
  if (!params.analysisOk) {
    return "Allowlist analysis failed (unsupported shell syntax).";
  }
  if (params.allowlistSatisfied) {
    return null;
  }
  for (let i = 0; i < params.segments.length; i += 1) {
    if (params.segmentSatisfiedBy[i]) {
      continue;
    }
    const segment = params.segments[i];
    const resolution = segment.resolution;
    const argv0 = segment.argv[0] ?? "";
    const resolvedPath = resolution?.resolvedPath ?? "<unresolved>";
    const rawExecutable = resolution?.rawExecutable ?? argv0;
    return `Allowlist miss at segment ${i + 1}: argv0=${argv0 || "<empty>"} resolvedPath=${resolvedPath} rawExecutable=${rawExecutable}.`;
  }
  return "Allowlist miss: no segment satisfied allowlist evaluation.";
}

function appendExecAllowlistTrace(entry: Record<string, unknown>) {
  if (!execAllowlistTracePath) {
    return;
  }
  try {
    const dir = path.dirname(execAllowlistTracePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(execAllowlistTracePath, `${JSON.stringify(entry)}\n`);
  } catch {
    // best-effort trace only
  }
}

function isExecAllowlistTraceEnabled(): boolean {
  const value = (process.env[TRACE_FLAG] ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function buildSegmentTrace(params: {
  allowlist: ReadonlyArray<ExecAllowlistEntry>;
  segments: ReadonlyArray<{
    argv: string[];
    resolution: CommandResolution | null;
  }>;
  segmentSatisfiedBy: ReadonlyArray<"allowlist" | "safeBins" | "skills" | null>;
  cwd: string;
}): Array<Record<string, unknown>> {
  return params.segments.map((segment, idx) => {
    const by = params.segmentSatisfiedBy[idx] ?? null;
    const candidatePath = resolveAllowlistCandidatePath(segment.resolution, params.cwd);
    const candidateResolution =
      candidatePath && segment.resolution
        ? { ...segment.resolution, resolvedPath: candidatePath }
        : segment.resolution;
    const allowlistMatch = matchAllowlist([...params.allowlist], candidateResolution);
    let reason = "allowlist-no-pattern-match";
    if (by === "allowlist") {
      reason = "allowlist-matched";
    } else if (by === "safeBins") {
      reason = "safe-bin-accepted";
    } else if (by === "skills") {
      reason = "skill-bin-accepted";
    }
    return {
      idx,
      argv: segment.argv,
      argv0: segment.argv[0] ?? null,
      rawExecutable: segment.resolution?.rawExecutable ?? null,
      resolvedPath: segment.resolution?.resolvedPath ?? null,
      candidatePath: candidatePath ?? null,
      matchedBy: by,
      matchedPattern: allowlistMatch?.pattern ?? null,
      matchedPatternId: allowlistMatch?.id ?? null,
      reason,
    };
  });
}

export type ProcessGatewayAllowlistParams = {
  command: string;
  workdir: string;
  env: Record<string, string>;
  pty: boolean;
  timeoutSec?: number;
  defaultTimeoutSec: number;
  security: ExecSecurity;
  ask: ExecAsk;
  safeBins: Set<string>;
  safeBinProfiles: Readonly<Record<string, SafeBinProfile>>;
  agentId?: string;
  sessionKey?: string;
  scopeKey?: string;
  warnings: string[];
  notifySessionKey?: string;
  approvalRunningNoticeMs: number;
  maxOutput: number;
  pendingMaxOutput: number;
  trustedSafeBinDirs?: ReadonlySet<string>;
};

export type ProcessGatewayAllowlistResult = {
  execCommandOverride?: string;
  pendingResult?: AgentToolResult<ExecToolDetails>;
};

export async function processGatewayAllowlist(
  params: ProcessGatewayAllowlistParams,
): Promise<ProcessGatewayAllowlistResult> {
  const approvals = resolveExecApprovals(params.agentId, {
    security: params.security,
    ask: params.ask,
  });
  const hostSecurity = minSecurity(params.security, approvals.agent.security);
  const hostAsk = maxAsk(params.ask, approvals.agent.ask);
  const askFallback = approvals.agent.askFallback;
  if (hostSecurity === "deny") {
    throw new Error("exec denied: host=gateway security=deny");
  }
  const allowlistEval = evaluateShellAllowlist({
    command: params.command,
    allowlist: approvals.allowlist,
    safeBins: params.safeBins,
    safeBinProfiles: params.safeBinProfiles,
    cwd: params.workdir,
    env: params.env,
    platform: process.platform,
    trustedSafeBinDirs: params.trustedSafeBinDirs,
  });
  const allowlistMatches = allowlistEval.allowlistMatches;
  const analysisOk = allowlistEval.analysisOk;
  const traceEnabled = isExecAllowlistTraceEnabled();
  const segmentTrace = traceEnabled
    ? buildSegmentTrace({
        allowlist: approvals.allowlist,
        segments: allowlistEval.segments,
        segmentSatisfiedBy: allowlistEval.segmentSatisfiedBy,
        cwd: params.workdir,
      })
    : [];
  const allowlistSatisfied =
    hostSecurity === "allowlist" && analysisOk ? allowlistEval.allowlistSatisfied : false;
  const recordMatchedAllowlistUse = (resolvedPath?: string) => {
    if (allowlistMatches.length === 0) {
      return;
    }
    const seen = new Set<string>();
    for (const match of allowlistMatches) {
      if (seen.has(match.pattern)) {
        continue;
      }
      seen.add(match.pattern);
      recordAllowlistUse(approvals.file, params.agentId, match, params.command, resolvedPath);
    }
  };
  const hasHeredocSegment = allowlistEval.segments.some((segment) =>
    segment.argv.some((token) => token.startsWith("<<")),
  );
  const requiresHeredocApproval =
    hostSecurity === "allowlist" && analysisOk && allowlistSatisfied && hasHeredocSegment;
  const requiresAsk =
    requiresExecApproval({
      ask: hostAsk,
      security: hostSecurity,
      analysisOk,
      allowlistSatisfied,
    }) || requiresHeredocApproval;
  if (requiresHeredocApproval) {
    params.warnings.push(
      "Warning: heredoc execution requires explicit approval in allowlist mode.",
    );
  }

  if (requiresAsk) {
    const nowMs = Date.now();
    const missDetails = findAllowlistMissDetails({
      analysisOk,
      allowlistSatisfied,
      segments: allowlistEval.segments,
      segmentSatisfiedBy: allowlistEval.segmentSatisfiedBy,
    });
    const requestKey = approvalRequestKey({
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      workdir: params.workdir,
      command: params.command,
      hostSecurity,
      hostAsk,
    });
    const existingPending = pendingGatewayApprovals.get(requestKey);
    if (existingPending && existingPending.expiresAtMs > nowMs) {
      const existingSlug = createApprovalSlug(existingPending.id);
      const warningText = params.warnings.length ? `${params.warnings.join("\n")}\n\n` : "";
      const detailText = missDetails ? ` ${missDetails}` : "";
      return {
        pendingResult: {
          content: [
            {
              type: "text",
              text:
                `${warningText}Approval required (id ${existingPending.id}, short ${existingSlug}).` +
                `${detailText} Approve to run; updates will arrive after completion.`,
            },
          ],
          details: {
            status: "approval-pending",
            approvalId: existingPending.id,
            approvalSlug: existingSlug,
            expiresAtMs: existingPending.expiresAtMs,
            host: "gateway",
            command: params.command,
            cwd: params.workdir,
          },
        },
      };
    }

    const approvalId = crypto.randomUUID();
    const approvalSlug = createApprovalSlug(approvalId);
    const expiresAtMs = nowMs + gatewayApprovalRequestWindowMs;
    const contextKey = `exec:${approvalId}`;
    const resolvedPath = allowlistEval.segments[0]?.resolution?.resolvedPath;
    const noticeSeconds = Math.max(1, Math.round(params.approvalRunningNoticeMs / 1000));
    const effectiveTimeout =
      typeof params.timeoutSec === "number" ? params.timeoutSec : params.defaultTimeoutSec;
    const warningText = params.warnings.length ? `${params.warnings.join("\n")}\n\n` : "";
    pendingGatewayApprovals.set(requestKey, { id: approvalId, expiresAtMs });
    if (traceEnabled) {
      appendExecAllowlistTrace({
        ts: new Date(nowMs).toISOString(),
        event: "approval-required",
        approvalId,
        approvalSlug,
        approvalTtlMs: gatewayApprovalRequestWindowMs,
        agentId: params.agentId ?? "main",
        sessionKey: params.sessionKey ?? null,
        hostSecurity,
        hostAsk,
        analysisOk,
        allowlistSatisfied,
        missDetails,
        commandHash: crypto.createHash("sha256").update(params.command).digest("hex"),
        workdir: params.workdir,
        segments: segmentTrace,
      });
    }

    void (async () => {
      let decision: string | null = null;
      try {
        decision = await requestExecApprovalDecisionForHost({
          approvalId,
          command: params.command,
          workdir: params.workdir,
          host: "gateway",
          security: hostSecurity,
          ask: hostAsk,
          agentId: params.agentId,
          resolvedPath,
          sessionKey: params.sessionKey,
        });
      } catch {
        emitExecSystemEvent(
          `Exec denied (gateway id=${approvalId}, approval-request-failed): ${params.command}`,
          {
            sessionKey: params.notifySessionKey,
            contextKey,
          },
        );
        if (pendingGatewayApprovals.get(requestKey)?.id === approvalId) {
          pendingGatewayApprovals.delete(requestKey);
        }
        return;
      }

      let approvedByAsk = false;
      let deniedReason: string | null = null;

      if (decision === "deny") {
        deniedReason = "user-denied";
      } else if (!decision) {
        if (askFallback === "full") {
          approvedByAsk = true;
        } else if (askFallback === "allowlist") {
          if (!analysisOk || !allowlistSatisfied) {
            deniedReason = "approval-timeout (allowlist-miss)";
          } else {
            approvedByAsk = true;
          }
        } else {
          deniedReason = "approval-timeout";
        }
      } else if (decision === "allow-once") {
        approvedByAsk = true;
      } else if (decision === "allow-always") {
        approvedByAsk = true;
        if (hostSecurity === "allowlist") {
          const patterns = resolveAllowAlwaysPatterns({
            segments: allowlistEval.segments,
            cwd: params.workdir,
            env: params.env,
            platform: process.platform,
          });
          for (const pattern of patterns) {
            if (pattern) {
              addAllowlistEntry(approvals.file, params.agentId, pattern);
            }
          }
        }
      }

      if (hostSecurity === "allowlist" && (!analysisOk || !allowlistSatisfied) && !approvedByAsk) {
        deniedReason = deniedReason ?? "allowlist-miss";
      }

      if (deniedReason) {
        emitExecSystemEvent(
          `Exec denied (gateway id=${approvalId}, ${deniedReason}): ${params.command}`,
          {
            sessionKey: params.notifySessionKey,
            contextKey,
          },
        );
        if (pendingGatewayApprovals.get(requestKey)?.id === approvalId) {
          pendingGatewayApprovals.delete(requestKey);
        }
        return;
      }

      recordMatchedAllowlistUse(resolvedPath ?? undefined);

      let run: Awaited<ReturnType<typeof runExecProcess>> | null = null;
      try {
        run = await runExecProcess({
          command: params.command,
          workdir: params.workdir,
          env: params.env,
          sandbox: undefined,
          containerWorkdir: null,
          usePty: params.pty,
          warnings: params.warnings,
          maxOutput: params.maxOutput,
          pendingMaxOutput: params.pendingMaxOutput,
          notifyOnExit: false,
          notifyOnExitEmptySuccess: false,
          scopeKey: params.scopeKey,
          sessionKey: params.notifySessionKey,
          timeoutSec: effectiveTimeout,
        });
      } catch {
        emitExecSystemEvent(
          `Exec denied (gateway id=${approvalId}, spawn-failed): ${params.command}`,
          {
            sessionKey: params.notifySessionKey,
            contextKey,
          },
        );
        if (pendingGatewayApprovals.get(requestKey)?.id === approvalId) {
          pendingGatewayApprovals.delete(requestKey);
        }
        return;
      }

      markBackgrounded(run.session);

      let runningTimer: NodeJS.Timeout | null = null;
      if (params.approvalRunningNoticeMs > 0) {
        runningTimer = setTimeout(() => {
          emitExecSystemEvent(
            `Exec running (gateway id=${approvalId}, session=${run?.session.id}, >${noticeSeconds}s): ${params.command}`,
            { sessionKey: params.notifySessionKey, contextKey },
          );
        }, params.approvalRunningNoticeMs);
      }

      try {
        const outcome = await run.promise;
        if (runningTimer) {
          clearTimeout(runningTimer);
          runningTimer = null;
        }
        const output = normalizeNotifyOutput(
          tail(outcome.aggregated || "", DEFAULT_NOTIFY_TAIL_CHARS),
        );
        const exitLabel = outcome.timedOut ? "timeout" : `code ${outcome.exitCode ?? "?"}`;
        const summary = output
          ? `Exec finished (gateway id=${approvalId}, session=${run.session.id}, ${exitLabel})\n${output}`
          : `Exec finished (gateway id=${approvalId}, session=${run.session.id}, ${exitLabel})`;
        emitExecSystemEvent(summary, { sessionKey: params.notifySessionKey, contextKey });
      } finally {
        if (runningTimer) {
          clearTimeout(runningTimer);
        }
        if (pendingGatewayApprovals.get(requestKey)?.id === approvalId) {
          pendingGatewayApprovals.delete(requestKey);
        }
      }
    })();

    const detailText = missDetails ? ` ${missDetails}` : "";
    return {
      pendingResult: {
        content: [
          {
            type: "text",
            text:
              `${warningText}Approval required (id ${approvalId}, short ${approvalSlug}).` +
              `${detailText} ` +
              "Approve to run; updates will arrive after completion.",
          },
        ],
        details: {
          status: "approval-pending",
          approvalId,
          approvalSlug,
          expiresAtMs,
          host: "gateway",
          command: params.command,
          cwd: params.workdir,
        },
      },
    };
  }

  if (traceEnabled) {
    appendExecAllowlistTrace({
      ts: new Date().toISOString(),
      event: "allowlist-evaluated",
      agentId: params.agentId ?? "main",
      sessionKey: params.sessionKey ?? null,
      hostSecurity,
      hostAsk,
      requiresAsk,
      analysisOk,
      allowlistSatisfied,
      commandHash: crypto.createHash("sha256").update(params.command).digest("hex"),
      workdir: params.workdir,
      matchedPatterns: allowlistMatches.map((m) => ({ id: m.id ?? null, pattern: m.pattern })),
      segments: segmentTrace,
    });
  }

  if (hostSecurity === "allowlist" && (!analysisOk || !allowlistSatisfied)) {
    throw new Error("exec denied: allowlist miss");
  }

  let execCommandOverride: string | undefined;
  // If allowlist uses safeBins, sanitize only those stdin-only segments:
  // disable glob/var expansion by forcing argv tokens to be literal via single-quoting.
  if (
    hostSecurity === "allowlist" &&
    analysisOk &&
    allowlistSatisfied &&
    allowlistEval.segmentSatisfiedBy.some((by) => by === "safeBins")
  ) {
    const safe = buildSafeBinsShellCommand({
      command: params.command,
      segments: allowlistEval.segments,
      segmentSatisfiedBy: allowlistEval.segmentSatisfiedBy,
      platform: process.platform,
    });
    if (!safe.ok || !safe.command) {
      // Fallback: quote everything (safe, but may change glob behavior).
      const fallback = buildSafeShellCommand({
        command: params.command,
        platform: process.platform,
      });
      if (!fallback.ok || !fallback.command) {
        throw new Error(`exec denied: safeBins sanitize failed (${safe.reason ?? "unknown"})`);
      }
      params.warnings.push(
        "Warning: safeBins hardening used fallback quoting due to parser mismatch.",
      );
      execCommandOverride = fallback.command;
    } else {
      params.warnings.push(
        "Warning: safeBins hardening disabled glob/variable expansion for stdin-only segments.",
      );
      execCommandOverride = safe.command;
    }
  }

  recordMatchedAllowlistUse(allowlistEval.segments[0]?.resolution?.resolvedPath);

  return { execCommandOverride };
}
