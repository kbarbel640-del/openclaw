import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { TrustPluginConfig } from "./types.js";
import { TrustClient } from "./client.js";

/**
 * Lightweight HTTP server that exposes this agent's A2A trust surface:
 *
 * - GET  /.well-known/agent.json  — A2A Agent Card (discovery)
 * - POST /a2a/verify-inbound      — Verify an inbound action from a peer
 * - GET  /a2a/trust-score         — Public trust score for this agent
 * - GET  /health                  — Health check
 *
 * Runs as an OpenClaw background service via api.registerService().
 */
export class TrustServer {
  private server: ReturnType<typeof createServer> | null = null;
  private config: TrustPluginConfig;
  private client: TrustClient;

  constructor(config: TrustPluginConfig, client: TrustClient) {
    this.config = config;
    this.client = client;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch(() => {
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
      });

      this.server.on("error", reject);
      this.server.listen(this.config.trustServerPort, "127.0.0.1", () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    // CORS headers for local agent communication
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Kevros-Release-Token, X-Kevros-Agent-Id");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (method === "GET" && url === "/.well-known/agent.json") {
      return this.serveAgentCard(res);
    }

    if (method === "POST" && url === "/a2a/verify-inbound") {
      return this.handleVerifyInbound(req, res);
    }

    if (method === "GET" && url === "/a2a/trust-score") {
      return this.handleTrustScore(res);
    }

    if (method === "GET" && url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", agent_id: this.config.agentId }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }

  /**
   * A2A Agent Card — the standard discovery document that tells
   * other agents who we are and what trust capabilities we support.
   */
  private serveAgentCard(res: ServerResponse): void {
    const card = {
      name: this.config.agentId,
      description: `OpenClaw agent with Kevros cryptographic trust verification`,
      url: `http://127.0.0.1:${this.config.trustServerPort}`,
      version: "0.1.0",
      provider: {
        organization: "Kevros A2A Trust",
        url: "https://taskhawktech.com",
      },
      capabilities: {
        streaming: false,
        pushNotifications: false,
        trustVerification: true,
        provenanceAttestation: true,
        intentBinding: true,
      },
      authentication: {
        schemes: ["bearer"],
        description: "Release tokens from Kevros trust gateway serve as bearer proof of verified decisions",
      },
      skills: [
        {
          id: "trust-verify",
          name: "Verify Action Trust",
          description: "Verify an action before execution — returns ALLOW/CLAMP/DENY with cryptographic proof",
          inputModes: ["application/json"],
          outputModes: ["application/json"],
        },
        {
          id: "trust-attest",
          name: "Attest Action Provenance",
          description: "Record a completed action to build verifiable trust history",
          inputModes: ["application/json"],
          outputModes: ["application/json"],
        },
        {
          id: "trust-bind",
          name: "Bind Intent to Action",
          description: "Cryptographically link planned intent to command — verify outcome after execution",
          inputModes: ["application/json"],
          outputModes: ["application/json"],
        },
      ],
      trust: {
        protocol: "kevros-a2a-trust-v1",
        gateway: this.config.gatewayUrl,
        verification_endpoints: {
          verify_token: `${this.config.gatewayUrl}/governance/verify-token`,
          verify_certificate: `${this.config.gatewayUrl}/governance/verify-certificate`,
          reputation: `${this.config.gatewayUrl}/governance/reputation/${encodeURIComponent(this.config.agentId)}`,
        },
        headers: {
          "X-Kevros-Release-Token": "HMAC release token proving a verified decision",
          "X-Kevros-Agent-Id": "Agent identifier for trust history lookup",
        },
      },
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(card, null, 2));
  }

  /**
   * Verify an inbound action from a peer agent.
   * The peer sends us their action + optional release token;
   * we verify through the gateway and return the trust decision.
   */
  private async handleVerifyInbound(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const body = await readBody(req);
    if (!body) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Request body required" }));
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    // If the peer sent a release token, verify it first
    const peerToken = parsed["release_token"] as string | undefined;
    const peerPreimage = parsed["token_preimage"] as string | undefined;

    if (peerToken && peerPreimage) {
      const tokenCheck = await this.client.verifyToken({
        release_token: peerToken,
        token_preimage: peerPreimage,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          peer_token_valid: tokenCheck.valid,
          peer_decision: tokenCheck.decision,
          peer_epoch: tokenCheck.epoch,
          chain_found: tokenCheck.chain_found,
        })
      );
      return;
    }

    // Otherwise, verify the action through the gateway
    const actionType =
      typeof parsed["action_type"] === "string"
        ? parsed["action_type"]
        : "unknown";
    const actionPayload =
      typeof parsed["action_payload"] === "object" && parsed["action_payload"]
        ? (parsed["action_payload"] as Record<string, unknown>)
        : {};

    const result = await this.client.verify({
      action_type: actionType,
      action_payload: actionPayload,
      policy_context: parsed["policy_context"] as
        | { max_values?: Record<string, number>; forbidden_keys?: string[] }
        | undefined,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  }

  /**
   * Public trust score for this agent.
   */
  private async handleTrustScore(res: ServerResponse): Promise<void> {
    const rep = await this.client.reputation(this.config.agentId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(rep));
  }
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX_BODY = 1024 * 1024; // 1 MB

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (size > MAX_BODY) {
        resolve(null);
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });

    req.on("error", () => resolve(null));
  });
}
