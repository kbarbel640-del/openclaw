import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerBeforeToolCallHookWithConfig } from "./hooks/before-tool-call.js";

export type SecurityCommandAuditConfig = {
  /**
   * When enabled, high-risk (ask) decisions will be enforced via exec approvals by
   * setting `ask: "always"` on the exec tool call.
   *
   * Note: Exec approvals only apply for `host=gateway|node`.
   */
  approvalsForAsk?: boolean;
};

function pluginConfigSchema() {
  return {
    safeParse(value: unknown) {
      if (value === undefined) {
        return { success: true, data: undefined };
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {
          success: false,
          error: { issues: [{ path: [], message: "expected config object" }] },
        };
      }
      const v = value as Record<string, unknown>;
      const out: SecurityCommandAuditConfig = {};
      if (v.approvalsForAsk !== undefined && typeof v.approvalsForAsk !== "boolean") {
        return {
          success: false,
          error: { issues: [{ path: ["approvalsForAsk"], message: "expected boolean" }] },
        };
      }
      if (v.approvalsForAsk === true) {
        out.approvalsForAsk = true;
      }
      const allowed = new Set(["approvalsForAsk"]);
      const unknown = Object.keys(v).filter((k) => !allowed.has(k));
      if (unknown.length > 0) {
        return {
          success: false,
          error: { issues: [{ path: [], message: `unknown config keys: ${unknown.join(", ")}` }] },
        };
      }
      return { success: true, data: out };
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        approvalsForAsk: { type: "boolean" },
      },
    },
  };
}

function coerceConfig(value: unknown): SecurityCommandAuditConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const v = value as Record<string, unknown>;
  return { approvalsForAsk: v.approvalsForAsk === true };
}

/**
 * Security Command Audit plugin.
 */
const plugin = {
  id: "security-command-audit",
  name: "Security Command Audit",
  description: "Audits high-risk exec/bash commands.",
  configSchema: pluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.logger.info("SecurityCommand: enabled");
    registerBeforeToolCallHookWithConfig(api, coerceConfig(api.pluginConfig));
  },
};

export default plugin;
