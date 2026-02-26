/**
 * Plimsoll DeFi Security Extension
 *
 * Transaction firewall for OpenClaw agents that handle financial
 * operations. Intercepts DeFi tool calls via before_tool_call and
 * runs them through three defense engines from the Plimsoll Protocol
 * (https://github.com/scoootscooob/plimsoll-protocol):
 *
 *   1. Trajectory Hash  — blocks hallucination retry loops
 *   2. Capital Velocity — enforces spend-rate limits
 *   3. Entropy Guard    — blocks private key exfiltration
 *
 * All engines are deterministic, zero-dependency, and fail-closed.
 *
 * Usage: Enable via openclaw.json plugins config. All DeFi tool
 * calls (swap, transfer, approve, bridge, etc.) are automatically
 * guarded. Non-financial tools pass through untouched.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { evaluate, DEFAULT_CONFIG } from "./src/firewall.js";
import type { PlimsollConfig } from "./src/firewall.js";

/** Tool names that involve financial transactions. */
const DEFI_TOOLS = new Set([
  "swap",
  "transfer",
  "approve",
  "bridge",
  "stake",
  "unstake",
  "deposit",
  "withdraw",
  "borrow",
  "repay",
  "lend",
  "supply",
  "send",
  "send_transaction",
]);

function isDefiTool(toolName: string): boolean {
  if (DEFI_TOOLS.has(toolName)) return true;
  // Catch plugin-registered DeFi tools by keyword
  const lower = toolName.toLowerCase();
  return lower.includes("swap") || lower.includes("transfer") || lower.includes("bridge");
}

const plugin = {
  id: "plimsoll-security",
  name: "Plimsoll DeFi Security",
  description: "Transaction firewall — loop detection, spend-rate limits, and exfiltration defense for DeFi tools",

  register(api: OpenClawPluginApi) {
    const pluginCfg = (api.pluginConfig ?? {}) as Partial<PlimsollConfig & { enabled: boolean }>;

    if (pluginCfg.enabled === false) {
      api.logger.info?.("Plimsoll Security: disabled via config");
      return;
    }

    const config: PlimsollConfig = {
      maxVelocityCentsPerWindow:
        pluginCfg.maxVelocityCentsPerWindow ?? DEFAULT_CONFIG.maxVelocityCentsPerWindow,
      velocityWindowSeconds:
        pluginCfg.velocityWindowSeconds ?? DEFAULT_CONFIG.velocityWindowSeconds,
      loopThreshold: pluginCfg.loopThreshold ?? DEFAULT_CONFIG.loopThreshold,
      loopWindowSeconds: pluginCfg.loopWindowSeconds ?? DEFAULT_CONFIG.loopWindowSeconds,
    };

    api.logger.info?.("Plimsoll Security: active");

    // ── Hook: before_tool_call ──────────────────────────────────
    api.registerHook("before_tool_call", async (event) => {
      const { toolName, params } = event as {
        toolName: string;
        params: Record<string, unknown>;
      };

      if (!isDefiTool(toolName)) return {};

      const verdict = evaluate(toolName, params, config);

      if (verdict.blocked) {
        api.logger.warn?.(
          `PLIMSOLL BLOCK [${verdict.engine}]: ${verdict.reason}`,
        );
        return {
          block: true,
          blockReason:
            `[PLIMSOLL OVERRIDE] ${verdict.code}: ${verdict.reason} ` +
            `Do not retry. Pivot strategy.`,
        };
      }

      if (verdict.friction) {
        api.logger.info?.(
          `PLIMSOLL FRICTION [${verdict.engine}]: ${verdict.reason}`,
        );
        // Inject friction as a modified parameter the LLM will read
        return {
          params: {
            ...params,
            _plimsoll_warning: verdict.reason,
          },
        };
      }

      return {};
    });

    // ── Hook: after_tool_call (audit log) ────────────────────────
    api.registerHook("after_tool_call", async (event) => {
      const { toolName, durationMs } = event as {
        toolName: string;
        params: Record<string, unknown>;
        result: unknown;
        durationMs: number;
      };

      if (isDefiTool(toolName)) {
        api.logger.debug?.(
          `PLIMSOLL AUDIT: ${toolName} completed in ${durationMs}ms`,
        );
      }
    });

    // ── Command: /plimsoll ──────────────────────────────────────
    api.registerCommand({
      name: "plimsoll",
      description: "Show Plimsoll firewall status and configuration",
      requireAuth: true,
      handler: async () => {
        return {
          text:
            `**Plimsoll DeFi Security** — active\n\n` +
            `- Velocity cap: $${(config.maxVelocityCentsPerWindow / 100).toFixed(2)} / ${config.velocityWindowSeconds}s\n` +
            `- Loop threshold: ${config.loopThreshold} identical calls / ${config.loopWindowSeconds}s\n` +
            `- Entropy guard: enabled\n` +
            `- Guarded tools: ${Array.from(DEFI_TOOLS).join(", ")}\n\n` +
            `_Powered by [Plimsoll Protocol](https://github.com/scoootscooob/plimsoll-protocol)_`,
        };
      },
    });
  },
};

export default plugin;
