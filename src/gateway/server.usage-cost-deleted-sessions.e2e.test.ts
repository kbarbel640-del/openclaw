import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { connectOk, installGatewayTestHooks, rpcReq } from "./test-helpers.js";
import { withServer } from "./test-with-server.js";

installGatewayTestHooks({ scope: "suite" });

describe("usage.cost deleted/reset sessions e2e (#20599)", () => {
  it("should include tokens from deleted and reset sessions, not just active", async () => {
    const ts = new Date().toISOString();
    const stateDir = process.env.OPENCLAW_STATE_DIR!;

    const { writeConfigFile } = await import("../config/config.js");
    await writeConfigFile({
      session: { mainKey: "main-test" },
    });

    const sessionsDir = path.join(stateDir, "agents", "main", "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });

    // Active session: 100 tokens, $0.10
    await fs.writeFile(
      path.join(sessionsDir, "sess-active.jsonl"),
      JSON.stringify({
        type: "message",
        timestamp: ts,
        message: {
          role: "assistant",
          provider: "openai",
          model: "gpt-5.2",
          usage: { input: 60, output: 40, totalTokens: 100, cost: { total: 0.1 } },
        },
      }),
      "utf-8",
    );

    // Deleted session: 200 tokens, $0.20
    const deletedTs = new Date().toISOString().replaceAll(":", "-");
    await fs.writeFile(
      path.join(sessionsDir, `sess-deleted.jsonl.deleted.${deletedTs}`),
      JSON.stringify({
        type: "message",
        timestamp: ts,
        message: {
          role: "assistant",
          provider: "openai",
          model: "gpt-5.2",
          usage: { input: 120, output: 80, totalTokens: 200, cost: { total: 0.2 } },
        },
      }),
      "utf-8",
    );

    // Reset session: 300 tokens, $0.30
    const resetTs = new Date().toISOString().replaceAll(":", "-");
    await fs.writeFile(
      path.join(sessionsDir, `sess-reset.jsonl.reset.${resetTs}`),
      JSON.stringify({
        type: "message",
        timestamp: ts,
        message: {
          role: "assistant",
          provider: "openai",
          model: "gpt-5.2",
          usage: { input: 180, output: 120, totalTokens: 300, cost: { total: 0.3 } },
        },
      }),
      "utf-8",
    );

    // Start real gateway, connect, call usage.cost RPC
    await withServer(async (ws) => {
      await connectOk(ws, { token: "secret", scopes: ["operator.read"] });

      const res = await rpcReq<{
        totals: { totalTokens: number; totalCost: number };
        daily: Array<{ date: string; totalTokens: number }>;
      }>(ws, "usage.cost", { days: 7 });

      expect(res.ok).toBe(true);

      const totals = res.payload!.totals;
      console.log(`Total tokens from usage.cost RPC: ${totals.totalTokens}`);
      console.log(`Total cost from usage.cost RPC: ${totals.totalCost}`);

      if (totals.totalTokens < 600) {
        console.log("❌ BUG CONFIRMED: usage.cost ignores deleted/reset sessions");
        console.log(
          `   Expected >= 600 (active 100 + deleted 200 + reset 300), got ${totals.totalTokens}`,
        );
      }

      // Should be 600 (active 100 + deleted 200 + reset 300)
      expect(totals.totalTokens).toBeGreaterThanOrEqual(600);
      expect(totals.totalCost).toBeGreaterThanOrEqual(0.6 - 0.001);
    });
  });
});
