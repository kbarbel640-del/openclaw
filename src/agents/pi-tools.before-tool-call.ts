import type { HeimdallConfig, SenderTier } from "../security/heimdall/types.js";
import type { AnyAgentTool } from "./tools/common.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import { isPlainObject } from "../utils.js";
import { normalizeToolName } from "./tool-policy.js";

type HookContext = {
  agentId?: string;
  sessionKey?: string;
  /** Heimdall: resolved sender tier for runtime tool ACL. */
  senderTier?: SenderTier;
  /** Heimdall: security config for runtime tool ACL. */
  heimdallConfig?: HeimdallConfig;
};

type HookOutcome = { blocked: true; reason: string } | { blocked: false; params: unknown };

const log = createSubsystemLogger("agents/tools");

export async function runBeforeToolCallHook(args: {
  toolName: string;
  params: unknown;
  toolCallId?: string;
  ctx?: HookContext;
}): Promise<HookOutcome> {
  // Heimdall: deterministic tool ACL check (feature-flagged).
  if (args.ctx?.heimdallConfig?.enabled && args.ctx?.senderTier) {
    const toolName = normalizeToolName(args.toolName || "tool");
    // Lazy import to avoid circular deps and keep zero-cost when disabled.
    const { isToolAllowed } = await import("../security/heimdall/tool-acl.js");
    if (!isToolAllowed(toolName, args.ctx.senderTier, args.ctx.heimdallConfig)) {
      const reason = `[heimdall] Tool "${toolName}" denied for tier "${args.ctx.senderTier}"`;
      // Audit: log blocked tool call.
      if (args.ctx.heimdallConfig.audit?.enabled) {
        const { getHeimdallAuditLogger } = await import("../security/heimdall/audit.js");
        getHeimdallAuditLogger(args.ctx.heimdallConfig.audit).logToolBlocked({
          toolName,
          senderTier: args.ctx.senderTier,
          reason,
        });
      }
      return { blocked: true, reason };
    }
  }

  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("before_tool_call")) {
    return { blocked: false, params: args.params };
  }

  const toolName = normalizeToolName(args.toolName || "tool");
  const params = args.params;
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

export function wrapToolWithBeforeToolCallHook(
  tool: AnyAgentTool,
  ctx?: HookContext,
): AnyAgentTool {
  const execute = tool.execute;
  if (!execute) {
    return tool;
  }
  const toolName = tool.name || "tool";
  return {
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
      return await execute(toolCallId, outcome.params, signal, onUpdate);
    },
  };
}

export const __testing = {
  runBeforeToolCallHook,
  isPlainObject,
};
