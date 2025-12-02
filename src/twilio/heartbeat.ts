import {
  buildHeartbeatPrompt,
  runHeartbeatPreHook,
} from "../auto-reply/heartbeat-prehook.js";
import { getReplyFromConfig } from "../auto-reply/reply.js";
import { loadConfig, type WarelayConfig } from "../config/config.js";
import { danger, success } from "../globals.js";
import { logInfo } from "../logger.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { HEARTBEAT_PROMPT, stripHeartbeatToken } from "../web/auto-reply.js";
import { sendMessage } from "./send.js";

type ReplyResolver = typeof getReplyFromConfig;

export async function runTwilioHeartbeatOnce(opts: {
  to: string;
  verbose?: boolean;
  runtime?: RuntimeEnv;
  replyResolver?: ReplyResolver;
  overrideBody?: string;
  dryRun?: boolean;
  skipPreHook?: boolean;
  cfg?: WarelayConfig;
}) {
  const {
    to,
    verbose: _verbose = false,
    runtime = defaultRuntime,
    overrideBody,
    dryRun = false,
    skipPreHook = false,
  } = opts;
  const replyResolver = opts.replyResolver ?? getReplyFromConfig;
  const cfg = opts.cfg ?? loadConfig();

  if (overrideBody && overrideBody.trim().length === 0) {
    throw new Error("Override body must be non-empty when provided.");
  }

  try {
    if (overrideBody) {
      if (dryRun) {
        logInfo(
          `[dry-run] twilio send -> ${to}: ${overrideBody.trim()} (manual message)`,
          runtime,
        );
        return;
      }
      await sendMessage(to, overrideBody, undefined, runtime);
      logInfo(success(`sent manual message to ${to} (twilio)`), runtime);
      return;
    }

    // Run pre-hook unless skipped
    let heartbeatPrompt = HEARTBEAT_PROMPT;
    if (!skipPreHook) {
      const preHookResult = await runHeartbeatPreHook(cfg);
      if (preHookResult.error) {
        logInfo(
          `Pre-hook failed: ${preHookResult.error} (continuing)`,
          runtime,
        );
      }
      heartbeatPrompt = buildHeartbeatPrompt(
        HEARTBEAT_PROMPT,
        preHookResult.context,
      );
    }

    const replyResult = await replyResolver(
      {
        Body: heartbeatPrompt,
        From: to,
        To: to,
        MessageSid: undefined,
      },
      undefined,
    );

    if (
      !replyResult ||
      (!replyResult.text &&
        !replyResult.mediaUrl &&
        !replyResult.mediaUrls?.length)
    ) {
      logInfo("heartbeat skipped: empty reply", runtime);
      return;
    }

    const hasMedia = Boolean(
      replyResult.mediaUrl || (replyResult.mediaUrls?.length ?? 0) > 0,
    );
    const stripped = stripHeartbeatToken(replyResult.text);
    if (stripped.shouldSkip && !hasMedia) {
      logInfo(success("heartbeat: ok (HEARTBEAT_OK)"), runtime);
      return;
    }

    const finalText = stripped.text || replyResult.text || "";
    if (dryRun) {
      logInfo(
        `[dry-run] heartbeat -> ${to}: ${finalText.slice(0, 200)}`,
        runtime,
      );
      return;
    }

    await sendMessage(to, finalText, undefined, runtime);
    logInfo(success(`heartbeat sent to ${to} (twilio)`), runtime);
  } catch (err) {
    runtime.error(danger(`Heartbeat failed: ${String(err)}`));
    throw err;
  }
}
