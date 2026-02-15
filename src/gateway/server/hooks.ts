import { randomUUID } from "node:crypto";
import type { CliDeps } from "../../cli/deps.js";
import type { CronJob } from "../../cron/types.js";
import type { createSubsystemLogger } from "../../logging/subsystem.js";
import type { HookDispatchers } from "../elysia-gateway.js";
import type { HookMessageChannel } from "../hooks.js";
import { loadConfig } from "../../config/config.js";
import { resolveMainSessionKeyFromConfig } from "../../config/sessions.js";
import { runCronIsolatedAgentTurn } from "../../cron/isolated-agent.js";
import { requestHeartbeatNow } from "../../infra/heartbeat-wake.js";
import { enqueueSystemEvent } from "../../infra/system-events.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

/**
 * Create hook dispatchers (wake + agent) without an HTTP handler.
 * Used by the Elysia gateway to wire dispatchers into Elysia route plugins.
 */
export function createHookDispatchers(params: {
  deps: CliDeps;
  logHooks: SubsystemLogger;
}): HookDispatchers {
  const { deps, logHooks } = params;

  const dispatchWakeHook = (value: { text: string; mode: "now" | "next-heartbeat" }) => {
    const sessionKey = resolveMainSessionKeyFromConfig();
    enqueueSystemEvent(value.text, { sessionKey });
    if (value.mode === "now") {
      requestHeartbeatNow({ reason: "hook:wake" });
    }
  };

  const dispatchAgentHook = (value: {
    message: string;
    name: string;
    wakeMode: "now" | "next-heartbeat";
    sessionKey: string;
    deliver: boolean;
    channel: HookMessageChannel;
    to?: string;
    model?: string;
    thinking?: string;
    timeoutSeconds?: number;
    allowUnsafeExternalContent?: boolean;
  }) => {
    const sessionKey = value.sessionKey.trim() ? value.sessionKey.trim() : `hook:${randomUUID()}`;
    const mainSessionKey = resolveMainSessionKeyFromConfig();
    const jobId = randomUUID();
    const now = Date.now();
    const job: CronJob = {
      id: jobId,
      name: value.name,
      enabled: true,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "at", atMs: now },
      sessionTarget: "isolated",
      wakeMode: value.wakeMode,
      payload: {
        kind: "agentTurn",
        message: value.message,
        model: value.model,
        thinking: value.thinking,
        timeoutSeconds: value.timeoutSeconds,
        deliver: value.deliver,
        channel: value.channel,
        to: value.to,
        allowUnsafeExternalContent: value.allowUnsafeExternalContent,
      },
      state: { nextRunAtMs: now },
    };

    const runId = randomUUID();
    void (async () => {
      try {
        const cfg = loadConfig();
        const result = await runCronIsolatedAgentTurn({
          cfg,
          deps,
          job,
          message: value.message,
          sessionKey,
          lane: "cron",
        });
        const summary = result.summary?.trim() || result.error?.trim() || result.status;
        const prefix =
          result.status === "ok" ? `Hook ${value.name}` : `Hook ${value.name} (${result.status})`;
        enqueueSystemEvent(`${prefix}: ${summary}`.trim(), {
          sessionKey: mainSessionKey,
        });
        if (value.wakeMode === "now") {
          requestHeartbeatNow({ reason: `hook:${jobId}` });
        }
      } catch (err) {
        logHooks.warn(`hook agent failed: ${String(err)}`);
        enqueueSystemEvent(`Hook ${value.name} (error): ${String(err)}`, {
          sessionKey: mainSessionKey,
        });
        if (value.wakeMode === "now") {
          requestHeartbeatNow({ reason: `hook:${jobId}:error` });
        }
      }
    })();

    return runId;
  };

  return { dispatchWakeHook, dispatchAgentHook };
}
