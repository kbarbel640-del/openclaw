import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { detectDestructive } from "../destructive/index.js";
import type { SecurityCommandAuditConfig } from "../index.js";
import { resolveAction } from "../policy.js";
import { detectOsType } from "../utils/os.js";

/**
 * Check if the agent has explicitly confirmed this high-risk tool call.
 * The agent can add `_sec_confirm: true` to acknowledge the risk.
 */
function hasSecConfirmFlag(params: Record<string, unknown>): boolean {
  const v = params._sec_confirm;
  if (v === true) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  if (typeof v === "number") {
    return v === 1;
  }
  return false;
}

/**
 * Strip the confirm flag from params before passing to the tool.
 * This prevents `_sec_confirm` from leaking into exec/bash and causing errors.
 */
function stripSecConfirmFlag(params: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...params };
  delete next._sec_confirm;
  return next;
}

function guessExecHost(api: OpenClawPluginApi, params: Record<string, unknown>): string {
  const hostParam = typeof params.host === "string" ? params.host.trim() : "";
  if (hostParam) {
    return hostParam;
  }
  // Best-effort: read global config default. (Per-agent overrides may differ.)
  const cfgHost = (api.config as unknown as { tools?: { exec?: { host?: unknown } } })?.tools?.exec
    ?.host;
  return typeof cfgHost === "string" ? cfgHost.trim() : "sandbox";
}

export function registerBeforeToolCallHook(api: OpenClawPluginApi): void {
  return registerBeforeToolCallHookWithConfig(api, {});
}

export function registerBeforeToolCallHookWithConfig(
  api: OpenClawPluginApi,
  config: SecurityCommandAuditConfig,
): void {
  api.on(
    "before_tool_call",
    async (event, ctx) => {
      // Hook enters -> determine OS first -> dispatch to OS-specific matcher
      const osType = detectOsType(); // linux/windows/darwin

      const toolName = String(event.toolName ?? "");
      const tool = toolName.trim().toLowerCase();
      if (tool !== "exec" && tool !== "bash") {
        return;
      }

      const params = event.params ?? {};
      const confirmed = hasSecConfirmFlag(params);
      const strippedParams = stripSecConfirmFlag(params);
      const command = typeof params.command === "string" ? params.command : "";
      if (!command.trim()) {
        return;
      }
      const destructiveMatch = detectDestructive({ toolName, command, osType });
      const action = destructiveMatch ? resolveAction(destructiveMatch) : ("pass" as const);
      if (destructiveMatch) {
        api.logger.warn(
          `[security-command-audit] before_tool_call: action=${action} severity=${destructiveMatch.severity} rule=${destructiveMatch.rule}`,
        );
      } else {
        api.logger.debug?.(`[security-command-audit] before_tool_call: action=pass`);
      }

      if (!destructiveMatch) {
        // Still strip `_sec_confirm` if present to avoid leaking to exec/bash.
        if ("_sec_confirm" in params) {
          return { params: strippedParams };
        }
        return;
      }

      // Violation: always block; do not allow confirmation bypass.
      if (destructiveMatch.severity === "violation") {
        return {
          block: true,
          blockReason: `SecCommand blocked - violation detected: ${destructiveMatch.reason}`,
        };
      }

      if (action === "block") {
        return {
          block: true,
          blockReason: `SecCommand blocked: ${destructiveMatch.reason}`,
        };
      }

      if (action === "ask") {
        // Mode A: Use exec approvals (ask: always) when enabled.
        if (config.approvalsForAsk === true && tool === "exec") {
          const hostGuess = guessExecHost(api, params);
          if (hostGuess !== "gateway" && hostGuess !== "node") {
            return {
              block: true,
              blockReason:
                `SecCommand blocked (high risk): ${destructiveMatch.reason}.\n` +
                `To use approvals, exec must run on host=gateway or host=node.\n` +
                `Fix: set tools.exec.host to "gateway" (or "node"), or re-run exec with { host: "gateway" }.\n` +
                `Note: host overrides are only allowed when tools.exec.host is configured to that host.`,
            };
          }
          return {
            params: {
              ...strippedParams,
              ask: "always",
            },
          };
        }

        // Mode B: Two-step confirmation (block first, re-run with `_sec_confirm=true`).
        if (confirmed) {
          return { params: strippedParams };
        }
        return {
          block: true,
          blockReason:
            `SecCommand blocked (high risk): ${destructiveMatch.reason}. ` +
            `Explain the risk and request explicit approval. If approved, re-run with \`_sec_confirm=true\`.`,
        };
      }

      // Always strip `_sec_confirm` before allowing the tool call through.
      if ("_sec_confirm" in params) {
        return { params: strippedParams };
      }
      return;
    },
    { priority: 100 },
  );
}
