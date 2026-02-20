import { formatControlPlaneActor, resolveControlPlaneActor } from "./control-plane-audit.js";
import { consumeControlPlaneWriteBudget } from "./control-plane-rate-limit.js";
import {
  ADMIN_SCOPE,
  authorizeOperatorScopesForMethod,
  isNodeRoleMethod,
} from "./method-scopes.js";
import { ErrorCodes, errorShape } from "./protocol/index.js";
import { agentHandlers } from "./server-methods/agent.js";
import { agentsHandlers } from "./server-methods/agents.js";
import { browserHandlers } from "./server-methods/browser.js";
import { channelsHandlers } from "./server-methods/channels.js";
import { chatHandlers } from "./server-methods/chat.js";
import { configHandlers } from "./server-methods/config.js";
import { connectHandlers } from "./server-methods/connect.js";
import { cronHandlers } from "./server-methods/cron.js";
import { deviceHandlers } from "./server-methods/devices.js";
import { execApprovalsHandlers } from "./server-methods/exec-approvals.js";
import { healthHandlers } from "./server-methods/health.js";
import { logsHandlers } from "./server-methods/logs.js";
import { modelsHandlers } from "./server-methods/models.js";
import { nodeHandlers } from "./server-methods/nodes.js";
import { pushHandlers } from "./server-methods/push.js";
import { sendHandlers } from "./server-methods/send.js";
import { sessionsHandlers } from "./server-methods/sessions.js";
import { skillsHandlers } from "./server-methods/skills.js";
import { systemHandlers } from "./server-methods/system.js";
import { talkHandlers } from "./server-methods/talk.js";
import { ttsHandlers } from "./server-methods/tts.js";
import type { GatewayRequestHandlers, GatewayRequestOptions } from "./server-methods/types.js";
import { updateHandlers } from "./server-methods/update.js";
import { usageHandlers } from "./server-methods/usage.js";
import { voicewakeHandlers } from "./server-methods/voicewake.js";
import { webHandlers } from "./server-methods/web.js";
import { wizardHandlers } from "./server-methods/wizard.js";

const CONTROL_PLANE_WRITE_METHODS = new Set(["config.apply", "config.patch", "update.run"]);
const NODE_ROLE_ALLOWED_METHODS = new Set(["health"]);
const ROLE_AUTH_FAILURE_LIMIT = 3;
const ROLE_AUTH_FAILURE_WINDOW_MS = 30_000;
const ROLE_AUTH_FAILURE_LOCKOUT_MS = 30_000;

type RoleAuthFailureState = {
  attempts: number;
  windowStartAtMs: number;
  lockedUntilMs?: number;
};

const roleAuthFailuresByConn = new Map<string, RoleAuthFailureState>();

function consumeUnauthorizedRoleBudget(client: GatewayRequestOptions["client"]): {
  blocked: boolean;
  retryAfterMs: number;
  attempts: number;
} {
  const connId = client?.connId;
  if (!connId) {
    return { blocked: false, retryAfterMs: 0, attempts: 0 };
  }
  const now = Date.now();
  const current = roleAuthFailuresByConn.get(connId);
  const state: RoleAuthFailureState =
    current && now - current.windowStartAtMs <= ROLE_AUTH_FAILURE_WINDOW_MS
      ? { ...current }
      : { attempts: 0, windowStartAtMs: now };

  if (state.lockedUntilMs && now < state.lockedUntilMs) {
    return {
      blocked: true,
      retryAfterMs: state.lockedUntilMs - now,
      attempts: state.attempts,
    };
  }

  if (state.lockedUntilMs && now >= state.lockedUntilMs) {
    state.attempts = 0;
    state.windowStartAtMs = now;
    state.lockedUntilMs = undefined;
  }

  state.attempts += 1;
  if (state.attempts >= ROLE_AUTH_FAILURE_LIMIT) {
    state.lockedUntilMs = now + ROLE_AUTH_FAILURE_LOCKOUT_MS;
  }
  roleAuthFailuresByConn.set(connId, state);

  return {
    blocked: Boolean(state.lockedUntilMs),
    retryAfterMs: state.lockedUntilMs ? state.lockedUntilMs - now : 0,
    attempts: state.attempts,
  };
}

function resetUnauthorizedRoleBudget(client: GatewayRequestOptions["client"]): void {
  const connId = client?.connId;
  if (connId) {
    roleAuthFailuresByConn.delete(connId);
  }
}

function isUnauthorizedRoleErrorMessage(message: string): boolean {
  return message.startsWith("unauthorized role:");
}

function authorizeGatewayMethod(method: string, client: GatewayRequestOptions["client"]) {
  if (!client?.connect) {
    return null;
  }
  const role = client.connect.role ?? "operator";
  const scopes = client.connect.scopes ?? [];
  if (isNodeRoleMethod(method)) {
    if (role === "node") {
      return null;
    }
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (role === "node") {
    if (NODE_ROLE_ALLOWED_METHODS.has(method)) {
      return null;
    }
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (role !== "operator") {
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (scopes.includes(ADMIN_SCOPE)) {
    return null;
  }
  const scopeAuth = authorizeOperatorScopesForMethod(method, scopes);
  if (!scopeAuth.allowed) {
    return errorShape(ErrorCodes.INVALID_REQUEST, `missing scope: ${scopeAuth.missingScope}`);
  }
  return null;
}

export const coreGatewayHandlers: GatewayRequestHandlers = {
  ...connectHandlers,
  ...logsHandlers,
  ...voicewakeHandlers,
  ...healthHandlers,
  ...channelsHandlers,
  ...chatHandlers,
  ...cronHandlers,
  ...deviceHandlers,
  ...execApprovalsHandlers,
  ...webHandlers,
  ...modelsHandlers,
  ...configHandlers,
  ...wizardHandlers,
  ...talkHandlers,
  ...ttsHandlers,
  ...skillsHandlers,
  ...sessionsHandlers,
  ...systemHandlers,
  ...updateHandlers,
  ...nodeHandlers,
  ...pushHandlers,
  ...sendHandlers,
  ...usageHandlers,
  ...agentHandlers,
  ...agentsHandlers,
  ...browserHandlers,
};

export async function handleGatewayRequest(
  opts: GatewayRequestOptions & { extraHandlers?: GatewayRequestHandlers },
): Promise<void> {
  const { req, respond, client, isWebchatConnect, context } = opts;
  const authError = authorizeGatewayMethod(req.method, client);
  if (authError) {
    const role = client?.connect?.role ?? "operator";
    if (role === "node" && isUnauthorizedRoleErrorMessage(authError.message)) {
      const budget = consumeUnauthorizedRoleBudget(client);
      if (budget.blocked) {
        context.logGateway.warn(
          `node authz rate-limited conn=${client?.connId ?? "unknown"} method=${req.method} retryAfterMs=${budget.retryAfterMs} attempts=${budget.attempts}`,
        );
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.UNAVAILABLE,
            `rate limit exceeded for unauthorized role errors; retry after ${Math.ceil(budget.retryAfterMs / 1000)}s`,
            {
              retryable: true,
              retryAfterMs: budget.retryAfterMs,
              details: {
                method: req.method,
                limit: `${ROLE_AUTH_FAILURE_LIMIT} per ${Math.round(ROLE_AUTH_FAILURE_WINDOW_MS / 1000)}s`,
              },
            },
          ),
        );
        return;
      }
    }
    respond(false, undefined, authError);
    return;
  }
  resetUnauthorizedRoleBudget(client);
  if (CONTROL_PLANE_WRITE_METHODS.has(req.method)) {
    const budget = consumeControlPlaneWriteBudget({ client });
    if (!budget.allowed) {
      const actor = resolveControlPlaneActor(client);
      context.logGateway.warn(
        `control-plane write rate-limited method=${req.method} ${formatControlPlaneActor(actor)} retryAfterMs=${budget.retryAfterMs} key=${budget.key}`,
      );
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `rate limit exceeded for ${req.method}; retry after ${Math.ceil(budget.retryAfterMs / 1000)}s`,
          {
            retryable: true,
            retryAfterMs: budget.retryAfterMs,
            details: {
              method: req.method,
              limit: "3 per 60s",
            },
          },
        ),
      );
      return;
    }
  }
  const handler = opts.extraHandlers?.[req.method] ?? coreGatewayHandlers[req.method];
  if (!handler) {
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INVALID_REQUEST, `unknown method: ${req.method}`),
    );
    return;
  }
  await handler({
    req,
    params: (req.params ?? {}) as Record<string, unknown>,
    client,
    isWebchatConnect,
    respond,
    context,
  });
}

export const __testing = {
  resetUnauthorizedRoleRateLimitState() {
    roleAuthFailuresByConn.clear();
  },
};
