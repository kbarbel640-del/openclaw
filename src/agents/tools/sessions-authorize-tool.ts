import crypto from "node:crypto";
import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { callGateway } from "../../gateway/call.js";
import { normalizeAgentId, resolveAgentIdFromSessionKey } from "../../routing/session-key.js";
import { issueAuthorizationGrant } from "../../security/authorization-grants.js";
import {
  HIGH_RISK_AUTHORIZATION_ACTION_VALUES,
  normalizeHighRiskAuthorizationAction,
} from "../../security/high-risk-authorization.js";
import type { InputProvenance } from "../../sessions/input-provenance.js";
import { SESSION_LABEL_MAX_LENGTH } from "../../sessions/session-label.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import {
  createAgentToAgentPolicy,
  createSessionVisibilityGuard,
  isResolvedSessionVisibleToRequester,
  resolveEffectiveSessionToolsVisibility,
  resolveSessionReference,
  resolveSandboxedSessionToolContext,
} from "./sessions-helpers.js";

const SessionsAuthorizeToolSchema = Type.Object({
  sessionKey: Type.Optional(Type.String()),
  label: Type.Optional(Type.String({ minLength: 1, maxLength: SESSION_LABEL_MAX_LENGTH })),
  agentId: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  action: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  ttlSeconds: Type.Optional(Type.Number({ minimum: 30, maximum: 600 })),
});

export function createSessionsAuthorizeTool(opts?: {
  agentSessionKey?: string;
  sandboxed?: boolean;
  requestInputProvenance?: InputProvenance;
  senderIsOwner?: boolean;
}): AnyAgentTool {
  return {
    label: "Session Authorize",
    name: "sessions_authorize",
    description:
      "Issue a short-lived one-time AUTHZ token for high-risk session relays (e.g., push/deploy authorization).",
    ownerOnly: true,
    parameters: SessionsAuthorizeToolSchema,
    execute: async (_toolCallId, args) => {
      const provenanceKind = opts?.requestInputProvenance?.kind;
      if (provenanceKind !== "external_user") {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: "forbidden",
          error:
            "Authorization grants require direct external user input for this run (provenance=external_user).",
        });
      }
      if (opts?.senderIsOwner !== true) {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: "forbidden",
          error: "Authorization grants are restricted to owner senders.",
        });
      }

      const params = args as Record<string, unknown>;
      const actionRaw = readStringParam(params, "action");
      const action =
        normalizeHighRiskAuthorizationAction(actionRaw) ??
        (actionRaw ? undefined : "high_risk_relay");
      if (!action) {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: "error",
          error: `Invalid action. Use one of: ${HIGH_RISK_AUTHORIZATION_ACTION_VALUES.join(", ")}`,
        });
      }

      const cfg = loadConfig();
      const { mainKey, alias, effectiveRequesterKey, restrictToSpawned } =
        resolveSandboxedSessionToolContext({
          cfg,
          agentSessionKey: opts?.agentSessionKey,
          sandboxed: opts?.sandboxed,
        });
      const a2aPolicy = createAgentToAgentPolicy(cfg);
      const sessionVisibility = resolveEffectiveSessionToolsVisibility({
        cfg,
        sandboxed: opts?.sandboxed === true,
      });

      const sessionKeyParam = readStringParam(params, "sessionKey");
      const labelParam = readStringParam(params, "label")?.trim() || undefined;
      const labelAgentIdParam = readStringParam(params, "agentId")?.trim() || undefined;
      if (sessionKeyParam && labelParam) {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: "error",
          error: "Provide either sessionKey or label (not both).",
        });
      }
      let sessionKey = sessionKeyParam;
      if (!sessionKey && labelParam) {
        const requesterAgentId = resolveAgentIdFromSessionKey(effectiveRequesterKey);
        const requestedAgentId = labelAgentIdParam
          ? normalizeAgentId(labelAgentIdParam)
          : undefined;

        if (restrictToSpawned && requestedAgentId && requestedAgentId !== requesterAgentId) {
          return jsonResult({
            runId: crypto.randomUUID(),
            status: "forbidden",
            error: "Sandboxed sessions_authorize label lookup is limited to this agent",
          });
        }
        if (requesterAgentId && requestedAgentId && requestedAgentId !== requesterAgentId) {
          if (!a2aPolicy.enabled) {
            return jsonResult({
              runId: crypto.randomUUID(),
              status: "forbidden",
              error:
                "Agent-to-agent messaging is disabled. Set tools.agentToAgent.enabled=true to allow cross-agent sends.",
            });
          }
          if (!a2aPolicy.isAllowed(requesterAgentId, requestedAgentId)) {
            return jsonResult({
              runId: crypto.randomUUID(),
              status: "forbidden",
              error: "Agent-to-agent messaging denied by tools.agentToAgent.allow.",
            });
          }
        }

        const resolveParams: Record<string, unknown> = {
          label: labelParam,
          ...(requestedAgentId ? { agentId: requestedAgentId } : {}),
          ...(restrictToSpawned ? { spawnedBy: effectiveRequesterKey } : {}),
        };
        let resolvedKey = "";
        try {
          const resolved = await callGateway<{ key: string }>({
            method: "sessions.resolve",
            params: resolveParams,
            timeoutMs: 10_000,
          });
          resolvedKey = typeof resolved?.key === "string" ? resolved.key.trim() : "";
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (restrictToSpawned) {
            return jsonResult({
              runId: crypto.randomUUID(),
              status: "forbidden",
              error: "Session not visible from this sandboxed agent session.",
            });
          }
          return jsonResult({
            runId: crypto.randomUUID(),
            status: "error",
            error: msg || `No session found with label: ${labelParam}`,
          });
        }
        if (!resolvedKey) {
          return jsonResult({
            runId: crypto.randomUUID(),
            status: "error",
            error: `No session found with label: ${labelParam}`,
          });
        }
        sessionKey = resolvedKey;
      }
      if (!sessionKey) {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: "error",
          error: "Either sessionKey or label is required",
        });
      }

      const resolvedSession = await resolveSessionReference({
        sessionKey,
        alias,
        mainKey,
        requesterInternalKey: effectiveRequesterKey,
        restrictToSpawned,
      });
      if (!resolvedSession.ok) {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: resolvedSession.status,
          error: resolvedSession.error,
        });
      }
      const resolvedKey = resolvedSession.key;
      const displayKey = resolvedSession.displayKey;
      const resolvedViaSessionId = resolvedSession.resolvedViaSessionId;
      const visible = await isResolvedSessionVisibleToRequester({
        requesterSessionKey: effectiveRequesterKey,
        targetSessionKey: resolvedKey,
        restrictToSpawned,
        resolvedViaSessionId,
      });
      if (!visible) {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: "forbidden",
          error: `Session not visible from this sandboxed agent session: ${sessionKey}`,
          sessionKey: displayKey,
        });
      }

      const visibilityGuard = await createSessionVisibilityGuard({
        action: "send",
        requesterSessionKey: effectiveRequesterKey,
        visibility: sessionVisibility,
        a2aPolicy,
      });
      const access = visibilityGuard.check(resolvedKey);
      if (!access.allowed) {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: access.status,
          error: access.error,
          sessionKey: displayKey,
        });
      }

      const ttlSeconds =
        typeof params.ttlSeconds === "number" && Number.isFinite(params.ttlSeconds)
          ? params.ttlSeconds
          : undefined;
      const grant = issueAuthorizationGrant({
        action,
        issuerSessionKey: effectiveRequesterKey,
        issuerProvenanceKind: provenanceKind,
        targetSessionKey: resolvedKey,
        ttlSeconds,
      });
      const expiresInSeconds = Math.max(
        0,
        Math.floor((grant.expiresAtMs - grant.issuedAtMs) / 1000),
      );

      return jsonResult({
        runId: crypto.randomUUID(),
        status: "ok",
        action,
        sessionKey: displayKey,
        grantToken: grant.token,
        expiresAtMs: grant.expiresAtMs,
        expiresInSeconds,
        usage:
          `Include this marker in the authorization relay message:\n` +
          `AUTHZ_TOKEN: ${grant.token}\n` +
          `Token is one-time and expires in ${expiresInSeconds}s.`,
      });
    },
  };
}
