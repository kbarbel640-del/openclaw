import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, type Mock } from "vitest";
import { createOpenClawTools } from "../agents/openclaw-tools.js";
import { resolveSessionTranscriptPath } from "../config/sessions.js";
import { emitAgentEvent } from "../infra/agent-events.js";
import { captureEnv } from "../test-utils/env.js";
import { callGateway } from "./call.js";
import {
  agentCommand,
  installGatewayTestHooks,
  testState,
  withGatewayServer,
} from "./test-helpers.js";

installGatewayTestHooks({ scope: "suite" });

describe("sessions_spawn gateway loopback", () => {
  it("succeeds after least-privilege loopback pairing bootstrap", async () => {
    const envSnapshot = captureEnv(["OPENCLAW_GATEWAY_PORT", "OPENCLAW_GATEWAY_TOKEN"]);
    const gatewayToken = "spawn-loopback-token";
    testState.gatewayAuth = { mode: "token", token: gatewayToken };

    const spy = agentCommand as unknown as Mock<(opts: unknown) => Promise<void>>;
    spy.mockImplementation(async (opts: unknown) => {
      const params = opts as { runId?: string; sessionId?: string };
      const runId = params.runId ?? params.sessionId ?? "run";
      const sessionId = params.sessionId ?? "main";
      const transcript = resolveSessionTranscriptPath(sessionId);
      await fs.mkdir(path.dirname(transcript), { recursive: true });
      const startedAt = Date.now();
      emitAgentEvent({
        runId,
        stream: "lifecycle",
        data: { phase: "start", startedAt },
      });
      emitAgentEvent({
        runId,
        stream: "lifecycle",
        data: { phase: "end", startedAt, endedAt: Date.now() },
      });
    });

    try {
      await withGatewayServer(async ({ port }) => {
        process.env.OPENCLAW_GATEWAY_PORT = String(port);
        process.env.OPENCLAW_GATEWAY_TOKEN = gatewayToken;

        await callGateway({ method: "health", timeoutMs: 10_000 });

        const { loadOrCreateDeviceIdentity } = await import("../infra/device-identity.js");
        const { getPairedDevice } = await import("../infra/device-pairing.js");
        const identity = loadOrCreateDeviceIdentity();

        const pairedBefore = await getPairedDevice(identity.deviceId);
        expect(pairedBefore?.scopes).toContain("operator.read");
        expect(pairedBefore?.scopes ?? []).not.toContain("operator.admin");

        const tool = createOpenClawTools({ agentSessionKey: "main" }).find(
          (candidate) => candidate.name === "sessions_spawn",
        );
        if (!tool) {
          throw new Error("missing sessions_spawn tool");
        }

        const result = await tool.execute("spawn-loopback", {
          task: "spawn test task",
        });
        const details = result.details as { status?: string; error?: string };
        expect(details.status).toBe("accepted");
        expect(details.error).toBeUndefined();

        const pairedAfter = await getPairedDevice(identity.deviceId);
        expect(pairedAfter?.scopes).toContain("operator.admin");

        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    } finally {
      spy.mockResolvedValue(undefined);
      envSnapshot.restore();
    }
  });
});
