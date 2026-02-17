/**
 * Gateway handlers for provider auth configuration.
 */

import { randomBytes } from "node:crypto";
import {
  removeAuthProfilesForProvider,
  upsertAuthProfile,
} from "../../agents/auth-profiles/profiles.js";
import { ensureAuthProfileStore } from "../../agents/auth-profiles/store.js";
import { invalidateModelCatalogCache } from "../../agents/model-catalog.js";
import { normalizeProviderId } from "../../agents/model-selection.js";
import { isRemoteEnvironment } from "../../commands/oauth-env.js";
import { createVpsAwareOAuthHandlers } from "../../commands/oauth-flow.js";
import { getProviderById, PROVIDER_REGISTRY } from "../../commands/providers/registry.js";
import { loadConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { resolvePluginProviders } from "../../plugins/providers.js";
import type { ProviderAuthResult } from "../../plugins/types.js";
import type { RuntimeEnv } from "../../runtime.js";
import type { WizardPrompter } from "../../wizard/prompts.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const log = createSubsystemLogger("auth");

// --- In-memory OAuth flow tracking ---

type OAuthFlowState = {
  status: "waiting_url" | "pending" | "success" | "error";
  authUrl?: string;
  userCode?: string;
  verificationUri?: string;
  flowType?: "pkce" | "device_code";
  error?: string;
  result?: ProviderAuthResult;
  createdAt: number;
  /** True when the flow is waiting for the user to paste a code (e.g. Anthropic OAuth) */
  needsCode?: boolean;
  /** Prompt message to show the user when requesting the code */
  codePromptMessage?: string;
  /** Resolves the pending prompter.text() call with the user-submitted code */
  codeResolve?: (code: string) => void;
};

const pendingOAuthFlows = new Map<string, OAuthFlowState>();

// Clean up flows older than 10 minutes
function cleanupStaleFlows(): void {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, flow] of pendingOAuthFlows) {
    if (flow.createdAt < cutoff) {
      pendingOAuthFlows.delete(id);
    }
  }
}

/**
 * Create a minimal non-interactive prompter for the gateway context.
 * PKCE flows running locally don't need text prompts (the callback server handles it).
 * If a prompt is required (remote/manual flow), it resolves via the manualResolve callback.
 */
function createGatewayPrompter(
  manualResolve?: (message: string) => Promise<string>,
): WizardPrompter {
  const noop = async () => {};
  return {
    intro: noop,
    outro: noop,
    note: noop,
    select: async () => {
      throw new Error("Interactive selection not supported in gateway OAuth flow");
    },
    multiselect: async () => {
      throw new Error("Interactive multiselect not supported in gateway OAuth flow");
    },
    text: async (params) => {
      if (manualResolve) {
        return manualResolve(params.message);
      }
      throw new Error("Interactive text input not supported in gateway OAuth flow");
    },
    confirm: async () => true,
    progress: (_label: string) => ({
      update: () => {},
      stop: () => {},
    }),
  };
}

/**
 * Create a minimal RuntimeEnv for gateway context.
 */
function createGatewayRuntime(): RuntimeEnv {
  return {
    log: () => {},
    error: () => {},
    exit: () => {
      throw new Error("exit not supported in gateway OAuth flow");
    },
  };
}

export const authHandlers: GatewayRequestHandlers = {
  /**
   * Set an API key or token for a provider.
   * Saves the credential to the auth profile store and triggers model discovery.
   */
  "auth.setKey": async ({ params, respond, context }) => {
    const provider = typeof params.provider === "string" ? params.provider.trim() : "";
    const credential = typeof params.credential === "string" ? params.credential.trim() : "";
    const credentialType =
      typeof params.credentialType === "string" ? params.credentialType : "api_key";

    if (!provider) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing provider"));
      return;
    }
    if (!credential) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing credential"));
      return;
    }
    if (credentialType !== "api_key" && credentialType !== "token") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `unsupported credentialType: ${credentialType}`),
      );
      return;
    }

    const providerDef = getProviderById(provider);
    if (!providerDef) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `unknown provider: ${provider}`),
      );
      return;
    }

    // Strip surrounding quotes if present
    const cleanCredential = credential.replace(/^["']|["']$/g, "");
    const normalizedId = normalizeProviderId(providerDef.id);
    const profileId = `${normalizedId}:default`;

    try {
      if (credentialType === "api_key") {
        upsertAuthProfile({
          profileId,
          credential: {
            type: "api_key",
            provider: normalizedId,
            key: cleanCredential,
          },
        });
      } else {
        upsertAuthProfile({
          profileId,
          credential: {
            type: "token",
            provider: normalizedId,
            token: cleanCredential,
          },
        });
      }

      // Invalidate cached catalog so the new credential is picked up,
      // then reload so newly configured providers are discovered.
      invalidateModelCatalogCache();
      try {
        await context.loadGatewayModelCatalog();
      } catch {
        // Non-fatal: credential is saved even if model discovery fails
      }

      respond(true, { ok: true, profileId });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * List all known providers with their auth modes and configuration status.
   */
  "auth.listProviders": ({ respond }) => {
    try {
      const store = ensureAuthProfileStore();
      const profileProviders = new Set<string>();
      for (const cred of Object.values(store.profiles)) {
        profileProviders.add(normalizeProviderId(cred.provider));
      }

      const providers = PROVIDER_REGISTRY.map((def) => {
        const normalizedId = normalizeProviderId(def.id);
        return {
          id: def.id,
          name: def.name,
          authModes: def.authModes,
          configured: profileProviders.has(normalizedId),
          envVars: def.envVars,
          isLocal: def.isLocal ?? false,
        };
      });

      respond(true, { providers });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Start an OAuth flow for a provider.
   * Loads the provider's auth plugin, initiates the flow in the background,
   * and returns the auth URL (for PKCE) or user code + verification URI (for device code).
   */
  "auth.startOAuth": async ({ params, respond, context }) => {
    const providerId = typeof params.provider === "string" ? params.provider.trim() : "";
    if (!providerId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing provider"));
      return;
    }

    cleanupStaleFlows();

    try {
      const cfg = loadConfig();
      log.info(`startOAuth: loading plugins for provider=${providerId}`);
      const plugins = resolvePluginProviders({ config: cfg });
      log.info(
        `startOAuth: found ${plugins.length} plugin providers: ${plugins.map((p) => p.id).join(", ")}`,
      );
      const normalizedId = normalizeProviderId(providerId);
      const plugin = plugins.find(
        (p) =>
          normalizeProviderId(p.id) === normalizedId ||
          (p.aliases ?? []).some((a) => normalizeProviderId(a) === normalizedId),
      );

      if (!plugin) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `no plugin found for provider: ${providerId}`),
        );
        return;
      }

      // Find an OAuth or device_code auth method
      const oauthMethod = plugin.auth.find((m) => m.kind === "oauth" || m.kind === "device_code");
      if (!oauthMethod) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `provider ${providerId} has no OAuth auth method`),
        );
        return;
      }

      const flowId = randomBytes(8).toString("hex");
      const flow: OAuthFlowState = {
        status: "waiting_url",
        createdAt: Date.now(),
      };
      pendingOAuthFlows.set(flowId, flow);

      // Promise that resolves when the auth URL is captured
      let urlResolve: (value: void) => void;
      const urlPromise = new Promise<void>((resolve) => {
        urlResolve = resolve;
      });

      const isRemote = isRemoteEnvironment();
      const runtime = createGatewayRuntime();

      // manualResolve bridges prompter.text() → auth.submitOAuthCode
      const manualResolve = async (message: string): Promise<string> => {
        flow.needsCode = true;
        flow.codePromptMessage = message;
        return new Promise<string>((resolve) => {
          flow.codeResolve = resolve;
        });
      };
      const prompter = createGatewayPrompter(manualResolve);

      log.info(
        `startOAuth: running OAuth method kind=${oauthMethod.kind} for provider=${plugin.id}`,
      );
      // Run the auth flow in the background
      const authPromise = oauthMethod.run({
        config: cfg,
        workspaceDir: undefined,
        prompter,
        runtime,
        isRemote,
        openUrl: async (url) => {
          flow.authUrl = url;
          flow.flowType = "pkce";
          flow.status = "pending";
          urlResolve();
        },
        oauth: {
          createVpsAwareHandlers: (handlerParams) =>
            createVpsAwareOAuthHandlers({
              ...handlerParams,
              // Override openUrl to capture the URL
              openUrl: async (url) => {
                flow.authUrl = url;
                flow.flowType = "pkce";
                flow.status = "pending";
                urlResolve();
              },
            }),
        },
      });

      // Track early failure: if the plugin throws before openUrl, reject immediately
      let earlyReject: (err: Error) => void;
      const earlyFailure = new Promise<void>((_, reject) => {
        earlyReject = reject;
      });

      // Handle completion in the background
      authPromise
        .then(async (result) => {
          flow.status = "success";
          flow.result = result;
          // Save profiles
          for (const profile of result.profiles) {
            upsertAuthProfile({
              profileId: profile.profileId,
              credential: profile.credential,
            });
          }
          // Invalidate cached catalog so the new OAuth credential is picked up
          invalidateModelCatalogCache();
          try {
            await context.loadGatewayModelCatalog();
          } catch {
            // Non-fatal
          }
        })
        .catch((err) => {
          flow.status = "error";
          flow.error = String(err);
          // Signal early failure so the handler doesn't wait for the timeout
          earlyReject(err instanceof Error ? err : new Error(String(err)));
        });

      // Wait for: auth URL captured, plugin failure, or timeout
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Timed out waiting for OAuth URL")), 15_000),
      );

      try {
        await Promise.race([urlPromise, earlyFailure, timeout]);
      } catch (err) {
        pendingOAuthFlows.delete(flowId);
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
        return;
      }

      respond(true, {
        flowId,
        authUrl: flow.authUrl,
        userCode: flow.userCode,
        verificationUri: flow.verificationUri,
        flowType: flow.flowType ?? "pkce",
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Submit an authorization code for an OAuth flow that requires manual code paste.
   * Used by flows like Anthropic OAuth where the redirect goes to an external page.
   */
  "auth.submitOAuthCode": ({ params, respond }) => {
    const flowId = typeof params.flowId === "string" ? params.flowId : "";
    const code = typeof params.code === "string" ? params.code.trim() : "";
    if (!flowId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing flowId"));
      return;
    }
    if (!code) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing code"));
      return;
    }

    const flow = pendingOAuthFlows.get(flowId);
    if (!flow) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown flowId"));
      return;
    }
    if (!flow.codeResolve) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "flow is not waiting for a code"),
      );
      return;
    }

    flow.codeResolve(code);
    flow.needsCode = false;
    flow.codeResolve = undefined;
    respond(true, { ok: true });
  },

  /**
   * Check the status of an in-progress OAuth flow.
   */
  "auth.checkOAuth": ({ params, respond }) => {
    const flowId = typeof params.flowId === "string" ? params.flowId : "";
    if (!flowId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing flowId"));
      return;
    }

    const flow = pendingOAuthFlows.get(flowId);
    if (!flow) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown flowId"));
      return;
    }

    respond(true, {
      status: flow.status,
      error: flow.error,
      needsCode: flow.needsCode ?? false,
      codePromptMessage: flow.codePromptMessage,
    });

    // Clean up completed flows
    if (flow.status === "success" || flow.status === "error") {
      pendingOAuthFlows.delete(flowId);
    }
  },

  /**
   * Remove all credentials for a provider.
   */
  "auth.removeCredential": async ({ params, respond, context }) => {
    const provider = typeof params.provider === "string" ? params.provider.trim() : "";
    if (!provider) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing provider"));
      return;
    }

    try {
      const removed = removeAuthProfilesForProvider({ provider });
      if (removed === 0) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `no credentials found for provider: ${provider}`),
        );
        return;
      }

      // Invalidate cached catalog so removed provider models are purged,
      // then reload to reflect the current credential state.
      invalidateModelCatalogCache();
      try {
        await context.loadGatewayModelCatalog();
      } catch {
        // Non-fatal
      }

      respond(true, { ok: true, removed });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
