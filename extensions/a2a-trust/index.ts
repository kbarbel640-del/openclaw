import { TrustClient } from "./src/client.js";
import { TrustServer } from "./src/trust-server.js";
import {
  trustStatusHandler,
  trustCheckHandler,
  trustVerifyHandler,
} from "./src/commands.js";
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

// OpenClaw plugin API types (minimal interface)
interface PluginApi {
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  config: TrustPluginConfig;
  registerGatewayMethod: (
    name: string,
    handler: (ctx: { respond: (ok: boolean, data: unknown) => void; payload?: unknown }) => void
  ) => void;
  registerService: (svc: {
    id: string;
    start: () => void | Promise<void>;
    stop: () => void | Promise<void>;
  }) => void;
  registerCommand: (cmd: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth?: boolean;
    handler: (ctx: { args?: string }) => Promise<{ text: string }>;
  }) => void;
  registerHook: (
    event: string,
    handler: (event: Record<string, unknown>) => Promise<void>,
    meta?: { name: string; description: string }
  ) => void;
}

export default {
  id: "kevros-a2a-trust",
  name: "Kevros A2A Trust",
  configSchema: {
    type: "object" as const,
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

  register(api: PluginApi) {
    const config: TrustPluginConfig = {
      gatewayUrl: api.config.gatewayUrl ?? "https://governance.taskhawktech.com",
      apiKey: api.config.apiKey,
      agentId: api.config.agentId,
      autoVerify: api.config.autoVerify ?? false,
      autoAttest: api.config.autoAttest ?? false,
      trustServerPort: api.config.trustServerPort ?? 18790,
    };

    const client = new TrustClient(config);
    const server = new TrustServer(config, client);

    api.logger.info(
      `[kevros-a2a-trust] Initializing for agent: ${config.agentId}`
    );

    // ── Auto-signup if no API key ──────────────────────────────────

    if (!client.hasApiKey) {
      api.logger.info(
        "[kevros-a2a-trust] No API key configured — will auto-signup on first use"
      );
    }

    // ── Gateway RPC methods (local agent tool calls) ───────────────

    api.registerGatewayMethod(
      "kevros.trust.verify",
      async ({ respond, payload }) => {
        try {
          await ensureApiKey(client, api);
          const req = payload as {
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
      }
    );

    api.registerGatewayMethod(
      "kevros.trust.attest",
      async ({ respond, payload }) => {
        try {
          await ensureApiKey(client, api);
          const req = payload as {
            action_description: string;
            action_payload: Record<string, unknown>;
            context?: Record<string, unknown>;
          };
          const result = await client.attest(req);
          respond(true, result);
        } catch (e) {
          respond(false, { error: String(e) });
        }
      }
    );

    api.registerGatewayMethod(
      "kevros.trust.bind",
      async ({ respond, payload }) => {
        try {
          await ensureApiKey(client, api);
          const req = payload as {
            intent_type: string;
            intent_description: string;
            command_payload: Record<string, unknown>;
            goal_state?: Record<string, unknown>;
          };
          const result = await client.bind(
            req as Parameters<typeof client.bind>[0]
          );
          respond(true, result);
        } catch (e) {
          respond(false, { error: String(e) });
        }
      }
    );

    api.registerGatewayMethod(
      "kevros.trust.verify-outcome",
      async ({ respond, payload }) => {
        try {
          await ensureApiKey(client, api);
          const req = payload as {
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
      }
    );

    api.registerGatewayMethod(
      "kevros.trust.bundle",
      async ({ respond, payload }) => {
        try {
          await ensureApiKey(client, api);
          const req = (payload ?? {}) as Partial<
            Parameters<typeof client.bundle>[0]
          >;
          const result = await client.bundle(req);
          respond(true, result);
        } catch (e) {
          respond(false, { error: String(e) });
        }
      }
    );

    api.registerGatewayMethod(
      "kevros.trust.reputation",
      async ({ respond, payload }) => {
        try {
          const req = payload as { agent_id: string };
          const result = await client.reputation(req.agent_id);
          respond(true, result);
        } catch (e) {
          respond(false, { error: String(e) });
        }
      }
    );

    // ── Background trust server ─────────────────────────────────────

    api.registerService({
      id: "kevros-trust-server",
      start: async () => {
        await server.start();
        api.logger.info(
          `[kevros-a2a-trust] Trust server listening on 127.0.0.1:${config.trustServerPort}`
        );
        api.logger.info(
          `[kevros-a2a-trust] Agent Card: http://127.0.0.1:${config.trustServerPort}/.well-known/agent.json`
        );
      },
      stop: async () => {
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
              typeof event["toolName"] === "string"
                ? event["toolName"]
                : "unknown_tool";
            const result = event["result"] ?? {};
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
        }
      );
      api.logger.info(
        "[kevros-a2a-trust] Auto-attest enabled — tool calls will be attested"
      );
    }

    api.logger.info(
      "[kevros-a2a-trust] Plugin registered. Use /trust, /trustcheck, /trustverify"
    );
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

let signupInFlight = false;

async function ensureApiKey(
  client: TrustClient,
  api: PluginApi
): Promise<void> {
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
      `[kevros-a2a-trust] Auto-signed up for free tier (${signup.monthly_limit} calls/month)`
    );
  } finally {
    signupInFlight = false;
  }
}
