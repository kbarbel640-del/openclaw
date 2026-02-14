import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import {
  buildAgentMainSessionKey,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../routing/session-key.js";

export function getHeader(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return undefined;
}

export function getBearerToken(req: IncomingMessage): string | undefined {
  const raw = getHeader(req, "authorization")?.trim() ?? "";
  if (!raw.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }
  const token = raw.slice(7).trim();
  return token || undefined;
}

export function resolveAgentIdFromHeader(req: IncomingMessage): string | undefined {
  const raw =
    getHeader(req, "x-openclaw-agent-id")?.trim() ||
    getHeader(req, "x-openclaw-agent")?.trim() ||
    "";
  if (!raw) {
    return undefined;
  }
  return normalizeAgentId(raw);
}

export function resolveAgentIdFromModel(model: string | undefined): string | undefined {
  const raw = model?.trim();
  if (!raw) {
    return undefined;
  }

  const m =
    raw.match(/^openclaw[:/](?<agentId>[a-z0-9][a-z0-9_-]{0,63})$/i) ??
    raw.match(/^agent:(?<agentId>[a-z0-9][a-z0-9_-]{0,63})$/i);
  const agentId = m?.groups?.agentId;
  if (!agentId) {
    return undefined;
  }
  return normalizeAgentId(agentId);
}

export function resolveAgentIdForRequest(params: {
  req: IncomingMessage;
  model: string | undefined;
}): string {
  const fromHeader = resolveAgentIdFromHeader(params.req);
  if (fromHeader) {
    return fromHeader;
  }

  const fromModel = resolveAgentIdFromModel(params.model);
  return fromModel ?? "main";
}

/**
 * Validates that an explicit session key from the x-openclaw-session-key header
 * belongs to the authenticated user. Prevents CWE-639 (IDOR) by blocking
 * cross-user session access.
 *
 * Returns null if access is allowed, or an error message if denied.
 */
export function validateSessionKeyOwnership(
  req: IncomingMessage,
  authUser: string | undefined,
): string | null {
  // Only enforce when auth identifies a specific user (e.g. tailscale).
  // Token/password auth has no user identity and implies service-level access.
  if (!authUser) {
    return null;
  }

  const explicit = getHeader(req, "x-openclaw-session-key")?.trim();
  if (!explicit) {
    return null;
  }

  const parsed = parseAgentSessionKey(explicit);
  if (!parsed) {
    return null;
  }

  // User-scoped keys: {prefix}-user:{userId} or user:{userId}
  const match = parsed.rest.match(/(?:^|.*-)user:(.+)$/);
  if (!match) {
    return null;
  }

  const sessionUser = match[1];
  if (sessionUser.toLowerCase() === authUser.toLowerCase()) {
    return null;
  }

  return "Access denied: session belongs to another user";
}

export function resolveSessionKey(params: {
  req: IncomingMessage;
  agentId: string;
  user?: string | undefined;
  prefix: string;
}): string {
  const explicit = getHeader(params.req, "x-openclaw-session-key")?.trim();
  if (explicit) {
    return explicit;
  }

  const user = params.user?.trim();
  const mainKey = user ? `${params.prefix}-user:${user}` : `${params.prefix}:${randomUUID()}`;
  return buildAgentMainSessionKey({ agentId: params.agentId, mainKey });
}
