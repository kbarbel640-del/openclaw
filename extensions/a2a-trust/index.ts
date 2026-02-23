import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { TrustClient } from "./src/client.js";
import { trustStatusHandler, trustCheckHandler, trustVerifyHandler } from "./src/commands.js";
import { TrustServer } from "./src/trust-server.js";
import type { TrustPluginConfig } from "./src/types.js";

/**
 * kevros-a2a-trust — Cryptographic decision trust for OpenClaw agents
 *
 * What this does:
 *   - Adds trust verification to agent-to-agent communication
 *   - Lets agents verify actions before execution (ALLOW / CLAMP / DENY)
 *   - Builds provenance history that strengthens trust over time
 *   - Binds intent to outcome for decision precision
 *   - Identity emerges as a byproduct of trust history
 *
 * What it does NOT do:
 *   - Govern or restrict agent autonomy
 *   - Require centralized identity registration
 *   - Store raw action payloads (only SHA-256 hashes)
 *
 * Integration points:
 *   - Gateway RPC methods for local agent tool calls
 *   - Background HTTP server for A2A Agent Card discovery
 *   - Slash commands for operator trust inspection
 *   - Auto-verify hook on outbound A2A messages (opt-in)
 *   - Auto-attest hook on completed tool calls (opt-in)
 */

export default {
  id: "kevros-a2a-trust",
  name: "Kevros A2A Trust",
  configSchema: {
    safeParse(value: unknown) {
      if (value === undefined) {
        return { success: true as const, data: undefined };
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {
          success: false as const,
          error: { issues: [{ path: [] as string[], message: "expected config object" }] },
        };
      }
      const cfg = value as Record<string, unknown>;
      if (typeof cfg.agentId !== "string" || !cfg.agentId) {
        return {
          success: false as const,
          error: { issues: [{ path: ["agentId"], message: "agentId is required" }] },
        };
      }
      return { success: true as const, data: value };
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        gatewayUrl: { type: "string", default: "https://governance.taskhawktech.com" },
        apiKey: { type: "string" },
        agentId: { type: "string" },
        autoVerify: { type: "boolean", default: false },
        autoAttest: { type: "boolean", default: false },
        trustServerPort: { type: "number", default: 18790 },
      },
      required: ["agentId"],
    },
  },

  register(api: OpenClawPluginApi) {
    const pluginCfg = api.pluginConfig ?? {};
    const config: TrustPluginConfig = {
      gatewayUrl: (pluginCfg.gatewayUrl as string) ?? "https://governance.taskhawktech.com",
      apiKey: pluginCfg.apiKey as string | undefined,
      agentId: pluginCfg.agentId as string,
      autoVerify: (pluginCfg.autoVerify as boolean) ?? false,
      autoAttest: (pluginCfg.autoAttest as boolean) ?? false,
      trustServerPort: (pluginCfg.trustServerPort as number) ?? 18790,
    };

    const client = new TrustClient(config);
    const server = new TrustServer(config, client);

    api.logger.info(`[kevros-a2a-trust] Initializing for agent: ${config.agentId}`);

    // ── Auto-signup if no API key ──────────────────────────────────

    if (!client.hasApiKey) {
      api.logger.info("[kevros-a2a-trust] No API key configured — will auto-signup on first use");
    }

    // ── Gateway RPC methods (local agent tool calls) ───────────────

    api.registerGatewayMethod("kevros.trust.verify", async ({ respond, params }) => {
      try {
        await ensureApiKey(client, api);
        const req = params as {
          action_type: string;
          action_payload: Record<string, unknown>;
          policy_context?: {
            max_values?: Record<string, number>;
            forbidden_keys?: string[];
          };
        };
        const result = await client.verify(req);
        respond(true, result);
      } catch (e) {
        respond(false, { error: String(e) });
      }
    });

    api.registerGatewayMethod("kevros.trust.attest", async ({ respond, params }) => {
      try {
        await ensureApiKey(client, api);
        const req = params as {
          action_description: string;
          action_payload: Record<string, unknown>;
          context?: Record<string, unknown>;
        };
        const result = await client.attest(req);
        respond(true, result);
      } catch (e) {
        respond(false, { error: String(e) });
      }
    });

    api.registerGatewayMethod("kevros.trust.bind", async ({ respond, params }) => {
      try {
        await ensureApiKey(client, api);
        const req = params as {
          intent_type: string;
          intent_description: string;
          command_payload: Record<string, unknown>;
          goal_state?: Record<string, unknown>;
        };
        const result = await client.bind(req as Parameters<typeof client.bind>[0]);
        respond(true, result);
      } catch (e) {
        respond(false, { error: String(e) });
      }
    });

    api.registerGatewayMethod("kevros.trust.verify-outcome", async ({ respond, params }) => {
      try {
        await ensureApiKey(client, api);
        const req = params as {
          intent_id: string;
          binding_id: string;
          actual_state: Record<string, unknown>;
          tolerance?: number;
        };
        const result = await client.verifyOutcome(req);
        respond(true, result);
      } catch (e) {
        respond(false, { error: String(e) });
      }
    });

    api.registerGatewayMethod("kevros.trust.bundle", async ({ respond, params }) => {
      try {
        await ensureApiKey(client, api);
        const req = (params ?? {}) as Partial<Parameters<typeof client.bundle>[0]>;
        const result = await client.bundle(req);
        respond(true, result);
      } catch (e) {
        respond(false, { error: String(e) });
      }
    });

    api.registerGatewayMethod("kevros.trust.reputation", async ({ respond, params }) => {
      try {
        const req = params as { agent_id: string };
        const result = await client.reputation(req.agent_id);
        respond(true, result);
      } catch (e) {
        respond(false, { error: String(e) });
      }
    });

    // ── Background trust server ─────────────────────────────────────

    api.registerService({
      id: "kevros-trust-server",
      start: async (_ctx) => {
        await server.start();
        api.logger.info(
          `[kevros-a2a-trust] Trust server listening on 127.0.0.1:${config.trustServerPort}`,
        );
        api.logger.info(
          `[kevros-a2a-trust] Agent Card: http://127.0.0.1:${config.trustServerPort}/.well-known/agent.json`,
        );
      },
      stop: async (_ctx) => {
        await server.stop();
        api.logger.info("[kevros-a2a-trust] Trust server stopped");
      },
    });

    // ── Slash commands ──────────────────────────────────────────────

    api.registerCommand({
      name: "trust",
      description: "Show your agent's trust status and score",
      handler: trustStatusHandler(client, config.agentId),
    });

    api.registerCommand({
      name: "trustcheck",
      description: "Check another agent's trust score",
      acceptsArgs: true,
      handler: trustCheckHandler(client),
    });

    api.registerCommand({
      name: "trustverify",
      description: "Verify an action through the trust gateway",
      acceptsArgs: true,
      handler: trustVerifyHandler(client),
    });

    // ── Auto-attest hook (opt-in) ───────────────────────────────────

    if (config.autoAttest) {
      api.registerHook(
        "tool_result_persist",
        async (event) => {
          try {
            await ensureApiKey(client, api);
            const toolName =
              typeof event.context.toolName === "string"
                ? (event.context.toolName as string)
                : "unknown_tool";
            const result = event.context.result ?? {};
            await client.attest({
              action_description: `Tool call: ${toolName}`,
              action_payload:
                typeof result === "object"
                  ? (result as Record<string, unknown>)
                  : { value: result },
            });
          } catch {
            // Trust attestation is best-effort — never block agent work
          }
        },
        {
          name: "kevros-a2a-trust.auto-attest",
          description: "Automatically attest completed tool calls to build trust history",
        },
      );
      api.logger.info("[kevros-a2a-trust] Auto-attest enabled — tool calls will be attested");
    }

    api.logger.info("[kevros-a2a-trust] Plugin registered. Use /trust, /trustcheck, /trustverify");
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

let signupInFlight = false;

async function ensureApiKey(client: TrustClient, api: OpenClawPluginApi): Promise<void> {
  if (client.hasApiKey) return;
  if (signupInFlight) {
    // Wait briefly for concurrent signup to complete
    await new Promise((r) => setTimeout(r, 2000));
    if (client.hasApiKey) return;
    throw new Error("API key signup in progress — retry in a moment");
  }
  signupInFlight = true;
  try {
    const signup = await client.signup();
    api.logger.info(
      `[kevros-a2a-trust] Auto-signed up for free tier (${signup.monthly_limit} calls/month)`,
    );
  } finally {
    signupInFlight = false;
  }
}
