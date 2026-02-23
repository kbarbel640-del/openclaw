import { callGateway } from "../../../gateway/call.js";
import { getSessionBindingService } from "../../../infra/outbound/session-binding-service.js";
import {
  isDiscordSurface,
  resolveDiscordAccountId,
  resolveRequesterSessionKey,
} from "../commands-subagents/shared.js";
import type { HandleCommandsParams } from "../commands-types.js";
import { SESSION_ID_RE } from "./shared.js";

async function resolveSessionKeyByToken(token: string): Promise<string | null> {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  const attempts: Array<Record<string, string>> = [{ key: trimmed }];
  if (SESSION_ID_RE.test(trimmed)) {
    attempts.push({ sessionId: trimmed });
  }
  attempts.push({ label: trimmed });

  for (const params of attempts) {
    try {
      const resolved = await callGateway<{ key?: string }>({
        method: "sessions.resolve",
        params,
        timeoutMs: 8_000,
      });
      const key = typeof resolved?.key === "string" ? resolved.key.trim() : "";
      if (key) {
        return key;
      }
    } catch {
      // Try next resolver strategy.
    }
  }
  return null;
}

export function resolveBoundAcpThreadSessionKey(params: HandleCommandsParams): string | undefined {
  if (!isDiscordSurface(params)) {
    return undefined;
  }
  const threadId =
    params.ctx.MessageThreadId != null ? String(params.ctx.MessageThreadId).trim() : "";
  if (!threadId) {
    return undefined;
  }
  const binding = getSessionBindingService().resolveByConversation({
    channel: "discord",
    accountId: resolveDiscordAccountId(params),
    conversationId: threadId,
  });
  if (!binding || binding.targetKind !== "session") {
    return undefined;
  }
  return binding.targetSessionKey.trim() || undefined;
}

export async function resolveAcpTargetSessionKey(params: {
  commandParams: HandleCommandsParams;
  token?: string;
}): Promise<{ ok: true; sessionKey: string } | { ok: false; error: string }> {
  const token = params.token?.trim() || "";
  if (token) {
    const resolved = await resolveSessionKeyByToken(token);
    if (!resolved) {
      return {
        ok: false,
        error: `Unable to resolve session target: ${token}`,
      };
    }
    return { ok: true, sessionKey: resolved };
  }

  const threadBound = resolveBoundAcpThreadSessionKey(params.commandParams);
  if (threadBound) {
    return {
      ok: true,
      sessionKey: threadBound,
    };
  }

  const fallback = resolveRequesterSessionKey(params.commandParams, {
    preferCommandTarget: true,
  });
  if (!fallback) {
    return {
      ok: false,
      error: "Missing session key.",
    };
  }
  return {
    ok: true,
    sessionKey: fallback,
  };
}
