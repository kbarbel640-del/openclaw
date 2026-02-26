/**
 * Regression test for session key doubling bug (#27289, #27282).
 *
 * When a fully-qualified "agent:main:main" session key was passed to
 * runCronIsolatedAgentTurn (via hooks or cron jobs), it was incorrectly
 * double-prefixed to "agent:main:agent:main:main", causing routing failures.
 */
import "./isolated-agent.mocks.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { runCronIsolatedAgentTurn } from "./isolated-agent.js";
import {
  makeCfg,
  makeJob,
  withTempCronHome,
  writeSessionStore,
} from "./isolated-agent.test-harness.js";
import { setupIsolatedAgentTurnMocks } from "./isolated-agent.test-setup.js";

describe("runCronIsolatedAgentTurn session key doubling regression (#27289)", () => {
  beforeEach(() => {
    setupIsolatedAgentTurnMocks({ fast: true });
    vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
      payloads: [{ text: "ok" }],
      meta: {
        durationMs: 5,
        agentMeta: { sessionId: "sid", provider: "anthropic", model: "claude-sonnet-4-5" },
      },
    });
  });

  it("does not double-prefix an already-qualified agent:main:main session key", async () => {
    await withTempCronHome(async (home) => {
      const storePath = await writeSessionStore(home, {
        lastProvider: "webchat",
        lastTo: "",
      });

      const cfg = makeCfg(home, storePath);
      const job = makeJob({ kind: "agentTurn", message: "hello" });

      await runCronIsolatedAgentTurn({
        cfg,
        deps: {} as never,
        job,
        message: "hello",
        sessionKey: "agent:main:main", // fully-qualified key — must NOT become agent:main:agent:main:main
        lane: "cron",
      });

      expect(vi.mocked(runEmbeddedPiAgent)).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "agent:main:main",
        }),
      );
    });
  });

  it("does not double-prefix an already-qualified agent:main:hook:uuid session key", async () => {
    await withTempCronHome(async (home) => {
      const storePath = await writeSessionStore(home, {
        lastProvider: "webchat",
        lastTo: "",
      });

      const cfg = makeCfg(home, storePath);
      const job = makeJob({ kind: "agentTurn", message: "hello" });

      await runCronIsolatedAgentTurn({
        cfg,
        deps: {} as never,
        job,
        message: "hello",
        sessionKey: "agent:main:hook:abc-123", // fully-qualified hook session key
        lane: "cron",
      });

      expect(vi.mocked(runEmbeddedPiAgent)).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "agent:main:hook:abc-123",
        }),
      );
    });
  });

  it("still correctly qualifies a bare hook session key", async () => {
    await withTempCronHome(async (home) => {
      const storePath = await writeSessionStore(home, {
        lastProvider: "webchat",
        lastTo: "",
      });

      const cfg = makeCfg(home, storePath);
      const job = makeJob({ kind: "agentTurn", message: "hello" });

      await runCronIsolatedAgentTurn({
        cfg,
        deps: {} as never,
        job,
        message: "hello",
        sessionKey: "hook:abc-123", // bare key — should become agent:main:hook:abc-123
        lane: "cron",
      });

      expect(vi.mocked(runEmbeddedPiAgent)).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "agent:main:hook:abc-123",
        }),
      );
    });
  });

  it("uses the job id as fallback when no session key is provided", async () => {
    await withTempCronHome(async (home) => {
      const storePath = await writeSessionStore(home, {
        lastProvider: "webchat",
        lastTo: "",
      });

      const cfg = makeCfg(home, storePath);
      const job = makeJob({ kind: "agentTurn", message: "hello" });

      await runCronIsolatedAgentTurn({
        cfg,
        deps: {} as never,
        job,
        message: "hello",
        sessionKey: " ",
        lane: "cron",
        // no sessionKey — should fall back to "agent:main:cron:job-1"
      });

      expect(vi.mocked(runEmbeddedPiAgent)).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: `agent:main:cron:${job.id}`,
        }),
      );
    });
  });
});
