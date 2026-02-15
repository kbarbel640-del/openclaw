/**
 * Tools Invoke route — Elysia plugin.
 *
 * POST /tools/invoke — Execute a tool by name with arguments.
 */

import { Elysia } from "elysia";
import { createOpenClawTools } from "../../agents/openclaw-tools.js";
import {
  filterToolsByPolicy,
  resolveEffectiveToolPolicy,
  resolveGroupToolPolicy,
  resolveSubagentToolPolicy,
} from "../../agents/pi-tools.policy.js";
import {
  buildPluginToolGroups,
  collectExplicitAllowlist,
  expandPolicyWithPluginGroups,
  normalizeToolName,
  resolveToolProfilePolicy,
  stripPluginOnlyAllowlist,
} from "../../agents/tool-policy.js";
import { loadConfig } from "../../config/config.js";
import { resolveMainSessionKey } from "../../config/sessions.js";
import { logWarn } from "../../logger.js";
import { isTestDefaultMemorySlotDisabled } from "../../plugins/config-state.js";
import { getPluginToolMeta } from "../../plugins/tools.js";
import { isSubagentSessionKey } from "../../routing/session-key.js";
import { normalizeMessageChannel } from "../../utils/message-channel.js";
import { authorizeGatewayConnect, type ResolvedGatewayAuth } from "../auth.js";
import { getNodeRequest, getWebBearerToken } from "../elysia-node-compat.js";

const MEMORY_TOOL_NAMES = new Set(["memory_search", "memory_get"]);

type ToolsInvokeBody = {
  tool?: unknown;
  action?: unknown;
  args?: unknown;
  sessionKey?: unknown;
  dryRun?: unknown;
};

function resolveSessionKeyFromBody(body: ToolsInvokeBody): string | undefined {
  if (typeof body.sessionKey === "string" && body.sessionKey.trim()) {
    return body.sessionKey.trim();
  }
  return undefined;
}

function resolveMemoryToolDisableReasons(cfg: ReturnType<typeof loadConfig>): string[] {
  if (!process.env.VITEST) {
    return [];
  }
  const reasons: string[] = [];
  const plugins = cfg.plugins;
  const slotRaw = plugins?.slots?.memory;
  const slotDisabled =
    slotRaw === null || (typeof slotRaw === "string" && slotRaw.trim().toLowerCase() === "none");
  const pluginsDisabled = plugins?.enabled === false;
  const defaultDisabled = isTestDefaultMemorySlotDisabled(cfg);

  if (pluginsDisabled) {
    reasons.push("plugins.enabled=false");
  }
  if (slotDisabled) {
    reasons.push(slotRaw === null ? "plugins.slots.memory=null" : 'plugins.slots.memory="none"');
  }
  if (!pluginsDisabled && !slotDisabled && defaultDisabled) {
    reasons.push("memory plugin disabled by test default");
  }
  return reasons;
}

function mergeActionIntoArgsIfSupported(params: {
  toolSchema: unknown;
  action: string | undefined;
  args: Record<string, unknown>;
}): Record<string, unknown> {
  const { toolSchema, action, args } = params;
  if (!action) {
    return args;
  }
  if (args.action !== undefined) {
    return args;
  }
  const schemaObj = toolSchema as { properties?: Record<string, unknown> } | null;
  const hasAction = Boolean(
    schemaObj &&
    typeof schemaObj === "object" &&
    schemaObj.properties &&
    "action" in schemaObj.properties,
  );
  if (!hasAction) {
    return args;
  }
  return { ...args, action };
}

export function toolsInvokeRoutes(params: { auth: ResolvedGatewayAuth }) {
  const { auth } = params;

  return new Elysia({ name: "tools-invoke-routes" }).post(
    "/tools/invoke",
    async ({ body: rawBody, request, set }) => {
      const cfg = loadConfig();
      const token = getWebBearerToken(request);
      const nodeReq = getNodeRequest(request);

      const authResult = await authorizeGatewayConnect({
        auth,
        connectAuth: token ? { token, password: token } : null,
        req: nodeReq,
        trustedProxies: cfg.gateway?.trustedProxies,
      });
      if (!authResult.ok) {
        set.status = 401;
        return { error: { message: "Unauthorized", type: "unauthorized" } };
      }

      const body = (rawBody ?? {}) as ToolsInvokeBody;
      const toolName = typeof body.tool === "string" ? body.tool.trim() : "";
      if (!toolName) {
        set.status = 400;
        return {
          error: { message: "tools.invoke requires body.tool", type: "invalid_request_error" },
        };
      }

      if (process.env.VITEST && MEMORY_TOOL_NAMES.has(toolName)) {
        const reasons = resolveMemoryToolDisableReasons(cfg);
        if (reasons.length > 0) {
          const suffix = reasons.length > 0 ? ` (${reasons.join(", ")})` : "";
          set.status = 400;
          return {
            ok: false,
            error: {
              type: "invalid_request",
              message:
                `memory tools are disabled in tests${suffix}. ` +
                'Enable by setting plugins.slots.memory="memory-core" (and ensure plugins.enabled is not false).',
            },
          };
        }
      }

      const action = typeof body.action === "string" ? body.action.trim() : undefined;
      const argsRaw = body.args;
      const args =
        argsRaw && typeof argsRaw === "object" && !Array.isArray(argsRaw)
          ? (argsRaw as Record<string, unknown>)
          : {};

      const rawSessionKey = resolveSessionKeyFromBody(body);
      const sessionKey =
        !rawSessionKey || rawSessionKey === "main" ? resolveMainSessionKey(cfg) : rawSessionKey;

      const messageChannel = normalizeMessageChannel(
        request.headers.get("x-openclaw-message-channel") ?? "",
      );
      const accountId = request.headers.get("x-openclaw-account-id")?.trim() || undefined;

      const {
        agentId,
        globalPolicy,
        globalProviderPolicy,
        agentPolicy,
        agentProviderPolicy,
        profile,
        providerProfile,
        profileAlsoAllow,
        providerProfileAlsoAllow,
      } = resolveEffectiveToolPolicy({ config: cfg, sessionKey });
      const profilePolicy = resolveToolProfilePolicy(profile);
      const providerProfilePolicy = resolveToolProfilePolicy(providerProfile);

      const mergeAlsoAllow = (policy: typeof profilePolicy, alsoAllow?: string[]) => {
        if (!policy?.allow || !Array.isArray(alsoAllow) || alsoAllow.length === 0) {
          return policy;
        }
        return { ...policy, allow: Array.from(new Set([...policy.allow, ...alsoAllow])) };
      };

      const profilePolicyWithAlsoAllow = mergeAlsoAllow(profilePolicy, profileAlsoAllow);
      const providerProfilePolicyWithAlsoAllow = mergeAlsoAllow(
        providerProfilePolicy,
        providerProfileAlsoAllow,
      );
      const groupPolicy = resolveGroupToolPolicy({
        config: cfg,
        sessionKey,
        messageProvider: messageChannel ?? undefined,
        accountId: accountId ?? null,
      });
      const subagentPolicy = isSubagentSessionKey(sessionKey)
        ? resolveSubagentToolPolicy(cfg)
        : undefined;

      const allTools = createOpenClawTools({
        agentSessionKey: sessionKey,
        agentChannel: messageChannel ?? undefined,
        agentAccountId: accountId,
        config: cfg,
        pluginToolAllowlist: collectExplicitAllowlist([
          profilePolicy,
          providerProfilePolicy,
          globalPolicy,
          globalProviderPolicy,
          agentPolicy,
          agentProviderPolicy,
          groupPolicy,
          subagentPolicy,
        ]),
      });

      const coreToolNames = new Set(
        allTools
          // oxlint-disable-next-line typescript/no-explicit-any
          .filter((tool) => !getPluginToolMeta(tool as any))
          .map((tool) => normalizeToolName(tool.name))
          .filter(Boolean),
      );
      const pluginGroups = buildPluginToolGroups({
        tools: allTools,
        // oxlint-disable-next-line typescript/no-explicit-any
        toolMeta: (tool) => getPluginToolMeta(tool as any),
      });
      const resolvePolicy = (policy: typeof profilePolicy, label: string) => {
        const resolved = stripPluginOnlyAllowlist(policy, pluginGroups, coreToolNames);
        if (resolved.unknownAllowlist.length > 0) {
          const entries = resolved.unknownAllowlist.join(", ");
          const suffix = resolved.strippedAllowlist
            ? "Ignoring allowlist so core tools remain available. Use tools.alsoAllow for additive plugin tool enablement."
            : "These entries won't match any tool unless the plugin is enabled.";
          logWarn(`tools: ${label} allowlist contains unknown entries (${entries}). ${suffix}`);
        }
        return expandPolicyWithPluginGroups(resolved.policy, pluginGroups);
      };
      const profilePolicyExpanded = resolvePolicy(
        profilePolicyWithAlsoAllow,
        profile ? `tools.profile (${profile})` : "tools.profile",
      );
      const providerProfileExpanded = resolvePolicy(
        providerProfilePolicyWithAlsoAllow,
        providerProfile
          ? `tools.byProvider.profile (${providerProfile})`
          : "tools.byProvider.profile",
      );
      const globalPolicyExpanded = resolvePolicy(globalPolicy, "tools.allow");
      const globalProviderExpanded = resolvePolicy(globalProviderPolicy, "tools.byProvider.allow");
      const agentPolicyExpanded = resolvePolicy(
        agentPolicy,
        agentId ? `agents.${agentId}.tools.allow` : "agent tools.allow",
      );
      const agentProviderExpanded = resolvePolicy(
        agentProviderPolicy,
        agentId ? `agents.${agentId}.tools.byProvider.allow` : "agent tools.byProvider.allow",
      );
      const groupPolicyExpanded = resolvePolicy(groupPolicy, "group tools.allow");
      const subagentPolicyExpanded = expandPolicyWithPluginGroups(subagentPolicy, pluginGroups);

      const toolsFiltered = profilePolicyExpanded
        ? filterToolsByPolicy(allTools, profilePolicyExpanded)
        : allTools;
      const providerProfileFiltered = providerProfileExpanded
        ? filterToolsByPolicy(toolsFiltered, providerProfileExpanded)
        : toolsFiltered;
      const globalFiltered = globalPolicyExpanded
        ? filterToolsByPolicy(providerProfileFiltered, globalPolicyExpanded)
        : providerProfileFiltered;
      const globalProviderFiltered = globalProviderExpanded
        ? filterToolsByPolicy(globalFiltered, globalProviderExpanded)
        : globalFiltered;
      const agentFiltered = agentPolicyExpanded
        ? filterToolsByPolicy(globalProviderFiltered, agentPolicyExpanded)
        : globalProviderFiltered;
      const agentProviderFiltered = agentProviderExpanded
        ? filterToolsByPolicy(agentFiltered, agentProviderExpanded)
        : agentFiltered;
      const groupFiltered = groupPolicyExpanded
        ? filterToolsByPolicy(agentProviderFiltered, groupPolicyExpanded)
        : agentProviderFiltered;
      const subagentFiltered = subagentPolicyExpanded
        ? filterToolsByPolicy(groupFiltered, subagentPolicyExpanded)
        : groupFiltered;

      const tool = subagentFiltered.find((t) => t.name === toolName);
      if (!tool) {
        set.status = 404;
        return {
          ok: false,
          error: { type: "not_found", message: `Tool not available: ${toolName}` },
        };
      }

      try {
        const toolArgs = mergeActionIntoArgsIfSupported({
          // oxlint-disable-next-line typescript/no-explicit-any
          toolSchema: (tool as any).parameters,
          action,
          args,
        });
        // oxlint-disable-next-line typescript/no-explicit-any
        const result = await (tool as any).execute?.(`http-${Date.now()}`, toolArgs);
        return { ok: true, result };
      } catch (err) {
        set.status = 400;
        return {
          ok: false,
          error: {
            type: "tool_error",
            message: err instanceof Error ? err.message : String(err),
          },
        };
      }
    },
  );
}
