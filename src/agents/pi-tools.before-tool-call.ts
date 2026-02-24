import os from "node:os";
import path from "node:path";
import type { ToolLoopDetectionConfig } from "../config/types.tools.js";
import type { SessionState } from "../logging/diagnostic-session-state.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import { isPlainObject } from "../utils.js";
import { resolvePathArg } from "./tool-display-common.js";
import { isMutatingToolCall } from "./tool-mutation.js";
import { normalizeToolName } from "./tool-policy.js";
import type { AnyAgentTool } from "./tools/common.js";

export type HookContext = {
  agentId?: string;
  sessionKey?: string;
  loopDetection?: ToolLoopDetectionConfig;
  workspaceDir?: string;
  skillGuard?: SkillFirstGuardConfig;
};

export type SkillFirstGuardSkill = {
  name?: string;
  path: string;
};

export type SkillFirstGuardConfig = {
  enabled?: boolean;
  requireReadBeforeMutatingTools?: boolean;
  skills?: ReadonlyArray<SkillFirstGuardSkill>;
};

type SkillFirstSessionState = {
  hasReadSkill: boolean;
  skillNames: Set<string>;
  startedAt: number;
};

export type SkillFirstSummary = {
  hasReadSkill: boolean;
  skillNames: string[];
};

type HookOutcome = { blocked: true; reason: string } | { blocked: false; params: unknown };

const log = createSubsystemLogger("agents/tools");
const BEFORE_TOOL_CALL_WRAPPED = Symbol("beforeToolCallWrapped");
const adjustedParamsByToolCallId = new Map<string, unknown>();
const MAX_TRACKED_ADJUSTED_PARAMS = 1024;
const LOOP_WARNING_BUCKET_SIZE = 10;
const MAX_LOOP_WARNING_KEYS = 256;
const MAX_SKILL_GUARD_SESSIONS = 512;
const SKILL_FILE_NAME = "skill.md";
const skillFirstStateBySessionKey = new Map<string, SkillFirstSessionState>();

function normalizePathForCompare(value: string, workspaceDir?: string): string {
  let normalized = value.trim();
  if (!normalized) {
    return "";
  }
  if (normalized === "~") {
    normalized = os.homedir();
  } else if (normalized.startsWith("~/")) {
    normalized = path.join(os.homedir(), normalized.slice(2));
  }
  if (!path.isAbsolute(normalized) && workspaceDir) {
    normalized = path.resolve(workspaceDir, normalized);
  }
  normalized = path.normalize(normalized).replace(/\\/g, "/");
  if (process.platform === "win32") {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

function trimSkillFirstSessionState(): void {
  while (skillFirstStateBySessionKey.size > MAX_SKILL_GUARD_SESSIONS) {
    const oldest = skillFirstStateBySessionKey.keys().next().value;
    if (!oldest) {
      break;
    }
    skillFirstStateBySessionKey.delete(oldest);
  }
}

function ensureSkillFirstSessionState(sessionKey: string): SkillFirstSessionState {
  const existing = skillFirstStateBySessionKey.get(sessionKey);
  if (existing) {
    return existing;
  }
  const created: SkillFirstSessionState = {
    hasReadSkill: false,
    skillNames: new Set<string>(),
    startedAt: Date.now(),
  };
  skillFirstStateBySessionKey.set(sessionKey, created);
  trimSkillFirstSessionState();
  return created;
}

function pathLooksLikeSkillFile(filePath: string): boolean {
  const normalized = filePath.trim().replace(/\\/g, "/");
  if (!normalized) {
    return false;
  }
  return (
    normalized.toLowerCase().endsWith(`/${SKILL_FILE_NAME}`) ||
    normalized.toLowerCase() === SKILL_FILE_NAME
  );
}

function resolveSkillNameFromPath(filePath: string): string | undefined {
  const parent = path.basename(path.dirname(filePath));
  const normalized = parent.trim();
  return normalized || undefined;
}

function resolveSkillRead(params: {
  readPath: string;
  workspaceDir?: string;
  skillGuard?: SkillFirstGuardConfig;
}): { matched: boolean; skillName?: string } {
  const readPathNormalized = normalizePathForCompare(params.readPath, params.workspaceDir);
  if (!readPathNormalized || !pathLooksLikeSkillFile(readPathNormalized)) {
    return { matched: false };
  }

  const configuredSkills = params.skillGuard?.skills ?? [];
  if (configuredSkills.length === 0) {
    return {
      matched: true,
      skillName: resolveSkillNameFromPath(readPathNormalized),
    };
  }

  for (const configured of configuredSkills) {
    const configuredPath = normalizePathForCompare(configured.path, params.workspaceDir);
    if (!configuredPath) {
      continue;
    }
    if (configuredPath === readPathNormalized) {
      return {
        matched: true,
        skillName: configured.name?.trim() || resolveSkillNameFromPath(readPathNormalized),
      };
    }
  }

  return { matched: false };
}

function evaluateSkillFirstGuard(args: {
  toolName: string;
  params: unknown;
  ctx?: HookContext;
}): HookOutcome | null {
  const sessionKey = args.ctx?.sessionKey?.trim();
  const skillGuard = args.ctx?.skillGuard;
  if (!sessionKey || skillGuard?.enabled !== true) {
    return null;
  }

  const state = ensureSkillFirstSessionState(sessionKey);

  if (args.toolName === "read") {
    const readPath = resolvePathArg(args.params);
    if (!readPath) {
      return null;
    }
    const readMatch = resolveSkillRead({
      readPath,
      workspaceDir: args.ctx?.workspaceDir,
      skillGuard,
    });
    if (!readMatch.matched) {
      return null;
    }
    state.hasReadSkill = true;
    if (readMatch.skillName) {
      state.skillNames.add(readMatch.skillName);
    }
    return null;
  }

  const requiresRead = skillGuard.requireReadBeforeMutatingTools !== false;
  if (!requiresRead || !isMutatingToolCall(args.toolName, args.params) || state.hasReadSkill) {
    return null;
  }

  return {
    blocked: true,
    reason:
      "Skill-first guard: read at least one relevant SKILL.md with the read tool before mutating tools.",
  };
}

function shouldEmitLoopWarning(state: SessionState, warningKey: string, count: number): boolean {
  if (!state.toolLoopWarningBuckets) {
    state.toolLoopWarningBuckets = new Map();
  }
  const bucket = Math.floor(count / LOOP_WARNING_BUCKET_SIZE);
  const lastBucket = state.toolLoopWarningBuckets.get(warningKey) ?? 0;
  if (bucket <= lastBucket) {
    return false;
  }
  state.toolLoopWarningBuckets.set(warningKey, bucket);
  if (state.toolLoopWarningBuckets.size > MAX_LOOP_WARNING_KEYS) {
    const oldest = state.toolLoopWarningBuckets.keys().next().value;
    if (oldest) {
      state.toolLoopWarningBuckets.delete(oldest);
    }
  }
  return true;
}

async function recordLoopOutcome(args: {
  ctx?: HookContext;
  toolName: string;
  toolParams: unknown;
  toolCallId?: string;
  result?: unknown;
  error?: unknown;
}): Promise<void> {
  if (!args.ctx?.sessionKey) {
    return;
  }
  try {
    const { getDiagnosticSessionState } = await import("../logging/diagnostic-session-state.js");
    const { recordToolCallOutcome } = await import("./tool-loop-detection.js");
    const sessionState = getDiagnosticSessionState({
      sessionKey: args.ctx.sessionKey,
      sessionId: args.ctx?.agentId,
    });
    recordToolCallOutcome(sessionState, {
      toolName: args.toolName,
      toolParams: args.toolParams,
      toolCallId: args.toolCallId,
      result: args.result,
      error: args.error,
      config: args.ctx.loopDetection,
    });
  } catch (err) {
    log.warn(`tool loop outcome tracking failed: tool=${args.toolName} error=${String(err)}`);
  }
}

export async function runBeforeToolCallHook(args: {
  toolName: string;
  params: unknown;
  toolCallId?: string;
  ctx?: HookContext;
}): Promise<HookOutcome> {
  const toolName = normalizeToolName(args.toolName || "tool");
  const params = args.params;
  const skillFirstOutcome = evaluateSkillFirstGuard({
    toolName,
    params,
    ctx: args.ctx,
  });
  if (skillFirstOutcome?.blocked) {
    return skillFirstOutcome;
  }

  if (args.ctx?.sessionKey) {
    const { getDiagnosticSessionState } = await import("../logging/diagnostic-session-state.js");
    const { logToolLoopAction } = await import("../logging/diagnostic.js");
    const { detectToolCallLoop, recordToolCall } = await import("./tool-loop-detection.js");

    const sessionState = getDiagnosticSessionState({
      sessionKey: args.ctx.sessionKey,
      sessionId: args.ctx?.agentId,
    });

    const loopResult = detectToolCallLoop(sessionState, toolName, params, args.ctx.loopDetection);

    if (loopResult.stuck) {
      if (loopResult.level === "critical") {
        log.error(`Blocking ${toolName} due to critical loop: ${loopResult.message}`);
        logToolLoopAction({
          sessionKey: args.ctx.sessionKey,
          sessionId: args.ctx?.agentId,
          toolName,
          level: "critical",
          action: "block",
          detector: loopResult.detector,
          count: loopResult.count,
          message: loopResult.message,
          pairedToolName: loopResult.pairedToolName,
        });
        return {
          blocked: true,
          reason: loopResult.message,
        };
      } else {
        const warningKey = loopResult.warningKey ?? `${loopResult.detector}:${toolName}`;
        if (shouldEmitLoopWarning(sessionState, warningKey, loopResult.count)) {
          log.warn(`Loop warning for ${toolName}: ${loopResult.message}`);
          logToolLoopAction({
            sessionKey: args.ctx.sessionKey,
            sessionId: args.ctx?.agentId,
            toolName,
            level: "warning",
            action: "warn",
            detector: loopResult.detector,
            count: loopResult.count,
            message: loopResult.message,
            pairedToolName: loopResult.pairedToolName,
          });
        }
      }
    }

    recordToolCall(sessionState, toolName, params, args.toolCallId, args.ctx.loopDetection);
  }

  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("before_tool_call")) {
    return { blocked: false, params: args.params };
  }

  try {
    const normalizedParams = isPlainObject(params) ? params : {};
    const hookResult = await hookRunner.runBeforeToolCall(
      {
        toolName,
        params: normalizedParams,
      },
      {
        toolName,
        agentId: args.ctx?.agentId,
        sessionKey: args.ctx?.sessionKey,
      },
    );

    if (hookResult?.block) {
      return {
        blocked: true,
        reason: hookResult.blockReason || "Tool call blocked by plugin hook",
      };
    }

    if (hookResult?.params && isPlainObject(hookResult.params)) {
      if (isPlainObject(params)) {
        return { blocked: false, params: { ...params, ...hookResult.params } };
      }
      return { blocked: false, params: hookResult.params };
    }
  } catch (err) {
    const toolCallId = args.toolCallId ? ` toolCallId=${args.toolCallId}` : "";
    log.warn(`before_tool_call hook failed: tool=${toolName}${toolCallId} error=${String(err)}`);
  }

  return { blocked: false, params };
}

export function startSkillFirstRun(sessionKey?: string): void {
  const key = sessionKey?.trim();
  if (!key) {
    return;
  }
  skillFirstStateBySessionKey.set(key, {
    hasReadSkill: false,
    skillNames: new Set<string>(),
    startedAt: Date.now(),
  });
  trimSkillFirstSessionState();
}

export function getSkillFirstSummary(sessionKey?: string): SkillFirstSummary {
  const key = sessionKey?.trim();
  if (!key) {
    return { hasReadSkill: false, skillNames: [] };
  }
  const state = skillFirstStateBySessionKey.get(key);
  if (!state) {
    return { hasReadSkill: false, skillNames: [] };
  }
  return {
    hasReadSkill: state.hasReadSkill,
    skillNames: Array.from(state.skillNames).toSorted((a, b) => a.localeCompare(b)),
  };
}

export function clearSkillFirstSummary(sessionKey?: string): void {
  const key = sessionKey?.trim();
  if (!key) {
    return;
  }
  skillFirstStateBySessionKey.delete(key);
}

export function wrapToolWithBeforeToolCallHook(
  tool: AnyAgentTool,
  ctx?: HookContext,
): AnyAgentTool {
  const execute = tool.execute;
  if (!execute) {
    return tool;
  }
  const toolName = tool.name || "tool";
  const wrappedTool: AnyAgentTool = {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const outcome = await runBeforeToolCallHook({
        toolName,
        params,
        toolCallId,
        ctx,
      });
      if (outcome.blocked) {
        throw new Error(outcome.reason);
      }
      if (toolCallId) {
        adjustedParamsByToolCallId.set(toolCallId, outcome.params);
        if (adjustedParamsByToolCallId.size > MAX_TRACKED_ADJUSTED_PARAMS) {
          const oldest = adjustedParamsByToolCallId.keys().next().value;
          if (oldest) {
            adjustedParamsByToolCallId.delete(oldest);
          }
        }
      }
      const normalizedToolName = normalizeToolName(toolName || "tool");
      try {
        const result = await execute(toolCallId, outcome.params, signal, onUpdate);
        await recordLoopOutcome({
          ctx,
          toolName: normalizedToolName,
          toolParams: outcome.params,
          toolCallId,
          result,
        });
        return result;
      } catch (err) {
        await recordLoopOutcome({
          ctx,
          toolName: normalizedToolName,
          toolParams: outcome.params,
          toolCallId,
          error: err,
        });
        throw err;
      }
    },
  };
  Object.defineProperty(wrappedTool, BEFORE_TOOL_CALL_WRAPPED, {
    value: true,
    enumerable: true,
  });
  return wrappedTool;
}

export function isToolWrappedWithBeforeToolCallHook(tool: AnyAgentTool): boolean {
  const taggedTool = tool as unknown as Record<symbol, unknown>;
  return taggedTool[BEFORE_TOOL_CALL_WRAPPED] === true;
}

export function consumeAdjustedParamsForToolCall(toolCallId: string): unknown {
  const params = adjustedParamsByToolCallId.get(toolCallId);
  adjustedParamsByToolCallId.delete(toolCallId);
  return params;
}

export const __testing = {
  BEFORE_TOOL_CALL_WRAPPED,
  adjustedParamsByToolCallId,
  skillFirstStateBySessionKey,
  runBeforeToolCallHook,
  evaluateSkillFirstGuard,
  normalizePathForCompare,
  resolveSkillRead,
  isPlainObject,
};
