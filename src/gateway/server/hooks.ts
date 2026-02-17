import { createHmac, randomUUID } from "node:crypto";
import type { CliDeps } from "../../cli/deps.js";
import { loadConfig } from "../../config/config.js";
import { resolveMainSessionKeyFromConfig } from "../../config/sessions.js";
import { runCronIsolatedAgentTurn } from "../../cron/isolated-agent.js";
import type { CronJob } from "../../cron/types.js";
import { requestHeartbeatNow } from "../../infra/heartbeat-wake.js";
import { enqueueSystemEvent } from "../../infra/system-events.js";
import type { createSubsystemLogger } from "../../logging/subsystem.js";
import type { HookMessageChannel, HooksConfigResolved } from "../hooks.js";
import { createHooksRequestHandler } from "../server-http.js";

const RESPONSE_CALLBACK_TIMEOUT_MS = 10_000;

// Block private/reserved IP ranges to prevent SSRF
const BLOCKED_IP_PATTERNS = [
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^127\./, // loopback
  /^169\.254\./, // link-local
  /^0\./, // 0.0.0.0/8
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
];

function isBlockedHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }
  return BLOCKED_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

function validateResponseUrl(
  urlString: string,
): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { ok: false, error: "invalid URL" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "responseUrl must use HTTPS" };
  }
  if (isBlockedHost(url.hostname)) {
    return { ok: false, error: "responseUrl blocked (private/reserved address)" };
  }
  return { ok: true, url };
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

export function createGatewayHooksRequestHandler(params: {
  deps: CliDeps;
  getHooksConfig: () => HooksConfigResolved | null;
  bindHost: string;
  port: number;
  logHooks: SubsystemLogger;
}) {
  const { deps, getHooksConfig, bindHost, port, logHooks } = params;

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
    agentId?: string;
    wakeMode: "now" | "next-heartbeat";
    sessionKey: string;
    deliver: boolean;
    channel: HookMessageChannel;
    to?: string;
    model?: string;
    thinking?: string;
    timeoutSeconds?: number;
    allowUnsafeExternalContent?: boolean;
    responseUrl?: string;
    responseSecret?: string;
  }) => {
    const sessionKey = value.sessionKey.trim();
    const mainSessionKey = resolveMainSessionKeyFromConfig();
    const jobId = randomUUID();
    const now = Date.now();
    const job: CronJob = {
      id: jobId,
      agentId: value.agentId,
      name: value.name,
      enabled: true,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "at", at: new Date(now).toISOString() },
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

        // POST result to responseUrl if provided
        if (value.responseUrl) {
          const urlValidation = validateResponseUrl(value.responseUrl);
          if (!urlValidation.ok) {
            logHooks.warn(`hook responseUrl invalid: ${urlValidation.error}`);
          } else {
            try {
              const body = JSON.stringify({
                runId,
                status: result.status,
                summary: result.summary,
                outputText: result.outputText,
                error: result.error,
                sessionKey,
                jobId,
                timestamp: Date.now(),
              });
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              if (value.responseSecret) {
                headers["X-OpenClaw-Signature"] =
                  `sha256=${signPayload(body, value.responseSecret)}`;
              }
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), RESPONSE_CALLBACK_TIMEOUT_MS);
              try {
                await fetch(urlValidation.url.href, {
                  method: "POST",
                  headers,
                  body,
                  signal: controller.signal,
                });
              } finally {
                clearTimeout(timeoutId);
              }
            } catch (callbackErr) {
              const errMsg =
                callbackErr instanceof Error && callbackErr.name === "AbortError"
                  ? "timeout"
                  : String(callbackErr);
              logHooks.warn(`hook responseUrl callback failed: ${errMsg}`);
            }
          }
        }

        enqueueSystemEvent(`${prefix}: ${summary}`.trim(), {
          sessionKey: mainSessionKey,
        });
        if (value.wakeMode === "now") {
          requestHeartbeatNow({ reason: `hook:${jobId}` });
        }
      } catch (err) {
        logHooks.warn(`hook agent failed: ${String(err)}`);

        // Also callback on error if responseUrl provided
        if (value.responseUrl) {
          const urlValidation = validateResponseUrl(value.responseUrl);
          if (urlValidation.ok) {
            try {
              const body = JSON.stringify({
                runId,
                status: "error",
                error: String(err),
                sessionKey,
                jobId,
                timestamp: Date.now(),
              });
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              if (value.responseSecret) {
                headers["X-OpenClaw-Signature"] =
                  `sha256=${signPayload(body, value.responseSecret)}`;
              }
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), RESPONSE_CALLBACK_TIMEOUT_MS);
              try {
                await fetch(urlValidation.url.href, {
                  method: "POST",
                  headers,
                  body,
                  signal: controller.signal,
                });
              } finally {
                clearTimeout(timeoutId);
              }
            } catch (callbackErr) {
              const errMsg =
                callbackErr instanceof Error && callbackErr.name === "AbortError"
                  ? "timeout"
                  : String(callbackErr);
              logHooks.warn(`hook responseUrl error callback failed: ${errMsg}`);
            }
          }
        }

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

  return createHooksRequestHandler({
    getHooksConfig,
    bindHost,
    port,
    logHooks,
    dispatchAgentHook,
    dispatchWakeHook,
  });
}
