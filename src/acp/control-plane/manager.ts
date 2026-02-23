import type { OpenClawConfig } from "../../config/config.js";
import type {
  AcpSessionRuntimeOptions,
  SessionAcpMeta,
  SessionEntry,
} from "../../config/sessions/types.js";
import { logVerbose } from "../../globals.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import { isAcpSessionKey } from "../../sessions/session-key-utils.js";
import { ACP_ERROR_CODES, AcpRuntimeError, toAcpRuntimeError } from "../runtime/errors.js";
import { requireAcpRuntimeBackend } from "../runtime/registry.js";
import { readAcpSessionEntry, upsertAcpSessionMeta } from "../runtime/session-meta.js";
import type {
  AcpRuntime,
  AcpRuntimeCapabilities,
  AcpRuntimeEvent,
  AcpRuntimeHandle,
  AcpRuntimePromptMode,
  AcpRuntimeSessionMode,
  AcpRuntimeStatus,
} from "../runtime/types.js";

export type AcpSessionResolution =
  | {
      kind: "none";
      sessionKey: string;
    }
  | {
      kind: "stale";
      sessionKey: string;
      error: AcpRuntimeError;
    }
  | {
      kind: "ready";
      sessionKey: string;
      meta: SessionAcpMeta;
    };

export type AcpInitializeSessionInput = {
  cfg: OpenClawConfig;
  sessionKey: string;
  agent: string;
  mode: AcpRuntimeSessionMode;
  cwd?: string;
  backendId?: string;
};

export type AcpRunTurnInput = {
  cfg: OpenClawConfig;
  sessionKey: string;
  text: string;
  mode: AcpRuntimePromptMode;
  requestId: string;
  signal?: AbortSignal;
  onEvent?: (event: AcpRuntimeEvent) => Promise<void> | void;
};

export type AcpCloseSessionInput = {
  cfg: OpenClawConfig;
  sessionKey: string;
  reason: string;
  clearMeta?: boolean;
  allowBackendUnavailable?: boolean;
  requireAcpSession?: boolean;
};

export type AcpCloseSessionResult = {
  runtimeClosed: boolean;
  runtimeNotice?: string;
  metaCleared: boolean;
};

export type AcpSessionStatus = {
  sessionKey: string;
  backend: string;
  agent: string;
  state: SessionAcpMeta["state"];
  mode: AcpRuntimeSessionMode;
  runtimeOptions: AcpSessionRuntimeOptions;
  capabilities: AcpRuntimeCapabilities;
  runtimeStatus?: AcpRuntimeStatus;
  lastActivityAt: number;
  lastError?: string;
};

type CachedRuntimeState = {
  runtime: AcpRuntime;
  handle: AcpRuntimeHandle;
  backend: string;
  agent: string;
  mode: AcpRuntimeSessionMode;
  cwd?: string;
  appliedControlSignature?: string;
};

type ActiveTurnState = {
  runtime: AcpRuntime;
  handle: AcpRuntimeHandle;
  abortController: AbortController;
  cancelPromise?: Promise<void>;
};

type AcpSessionManagerDeps = {
  readSessionEntry: typeof readAcpSessionEntry;
  upsertSessionMeta: typeof upsertAcpSessionMeta;
  requireRuntimeBackend: typeof requireAcpRuntimeBackend;
};

const DEFAULT_DEPS: AcpSessionManagerDeps = {
  readSessionEntry: readAcpSessionEntry,
  upsertSessionMeta: upsertAcpSessionMeta,
  requireRuntimeBackend: requireAcpRuntimeBackend,
};

function resolveAcpAgentFromSessionKey(sessionKey: string, fallback = "main"): string {
  const parsed = parseAgentSessionKey(sessionKey);
  return normalizeAgentId(parsed?.agentId ?? fallback);
}

function resolveMissingMetaError(sessionKey: string): AcpRuntimeError {
  return new AcpRuntimeError(
    "ACP_SESSION_INIT_FAILED",
    `ACP metadata is missing for ${sessionKey}. Recreate this ACP session with /acp spawn and rebind the thread.`,
  );
}

function normalizeSessionKey(sessionKey: string): string {
  return sessionKey.trim();
}

function normalizeActorKey(sessionKey: string): string {
  return sessionKey.trim().toLowerCase();
}

function normalizeAcpErrorCode(code: string | undefined): AcpRuntimeError["code"] {
  if (!code) {
    return "ACP_TURN_FAILED";
  }
  const normalized = code.trim().toUpperCase();
  for (const allowed of ACP_ERROR_CODES) {
    if (allowed === normalized) {
      return allowed;
    }
  }
  return "ACP_TURN_FAILED";
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeRuntimeOptions(
  options: AcpSessionRuntimeOptions | undefined,
): AcpSessionRuntimeOptions {
  const runtimeMode = normalizeText(options?.runtimeMode);
  const model = normalizeText(options?.model);
  const cwd = normalizeText(options?.cwd);
  const permissionProfile = normalizeText(options?.permissionProfile);
  let timeoutSeconds: number | undefined;
  if (typeof options?.timeoutSeconds === "number" && Number.isFinite(options.timeoutSeconds)) {
    const rounded = Math.round(options.timeoutSeconds);
    if (rounded > 0) {
      timeoutSeconds = rounded;
    }
  }
  const backendExtrasEntries = Object.entries(options?.backendExtras ?? {})
    .map(([key, value]) => [normalizeText(key), normalizeText(value)] as const)
    .filter(([key, value]) => Boolean(key && value)) as Array<[string, string]>;
  const backendExtras =
    backendExtrasEntries.length > 0 ? Object.fromEntries(backendExtrasEntries) : undefined;
  return {
    ...(runtimeMode ? { runtimeMode } : {}),
    ...(model ? { model } : {}),
    ...(cwd ? { cwd } : {}),
    ...(permissionProfile ? { permissionProfile } : {}),
    ...(typeof timeoutSeconds === "number" ? { timeoutSeconds } : {}),
    ...(backendExtras ? { backendExtras } : {}),
  };
}

function mergeRuntimeOptions(params: {
  current?: AcpSessionRuntimeOptions;
  patch?: Partial<AcpSessionRuntimeOptions>;
}): AcpSessionRuntimeOptions {
  const current = normalizeRuntimeOptions(params.current);
  const patch = normalizeRuntimeOptions(params.patch as AcpSessionRuntimeOptions | undefined);
  const mergedExtras = {
    ...current.backendExtras,
    ...patch.backendExtras,
  };
  return normalizeRuntimeOptions({
    ...current,
    ...patch,
    ...(Object.keys(mergedExtras).length > 0 ? { backendExtras: mergedExtras } : {}),
  });
}

function resolveRuntimeOptionsFromMeta(meta: SessionAcpMeta): AcpSessionRuntimeOptions {
  const normalized = normalizeRuntimeOptions(meta.runtimeOptions);
  if (normalized.cwd || !meta.cwd) {
    return normalized;
  }
  return normalizeRuntimeOptions({
    ...normalized,
    cwd: meta.cwd,
  });
}

function runtimeOptionsEqual(
  a: AcpSessionRuntimeOptions | undefined,
  b: AcpSessionRuntimeOptions | undefined,
): boolean {
  return JSON.stringify(normalizeRuntimeOptions(a)) === JSON.stringify(normalizeRuntimeOptions(b));
}

function buildRuntimeControlSignature(options: AcpSessionRuntimeOptions): string {
  const normalized = normalizeRuntimeOptions(options);
  const extras = Object.entries(normalized.backendExtras ?? {}).toSorted(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify({
    runtimeMode: normalized.runtimeMode ?? null,
    model: normalized.model ?? null,
    permissionProfile: normalized.permissionProfile ?? null,
    timeoutSeconds: normalized.timeoutSeconds ?? null,
    backendExtras: extras,
  });
}

function buildRuntimeConfigOptionPairs(options: AcpSessionRuntimeOptions): Array<[string, string]> {
  const normalized = normalizeRuntimeOptions(options);
  const pairs = new Map<string, string>();
  if (normalized.model) {
    pairs.set("model", normalized.model);
  }
  if (normalized.permissionProfile) {
    pairs.set("approval_policy", normalized.permissionProfile);
  }
  if (typeof normalized.timeoutSeconds === "number") {
    pairs.set("timeout", String(normalized.timeoutSeconds));
  }
  for (const [key, value] of Object.entries(normalized.backendExtras ?? {})) {
    if (!pairs.has(key)) {
      pairs.set(key, value);
    }
  }
  return [...pairs.entries()];
}

function inferRuntimeOptionPatchFromConfigOption(
  key: string,
  value: string,
): Partial<AcpSessionRuntimeOptions> {
  const normalizedKey = key.trim().toLowerCase();
  if (normalizedKey === "model") {
    return { model: value };
  }
  if (
    normalizedKey === "approval_policy" ||
    normalizedKey === "permission_profile" ||
    normalizedKey === "permissions"
  ) {
    return { permissionProfile: value };
  }
  if (normalizedKey === "timeout" || normalizedKey === "timeout_seconds") {
    const asNumber = Number.parseInt(value, 10);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return { timeoutSeconds: asNumber };
    }
  }
  if (normalizedKey === "cwd") {
    return { cwd: value };
  }
  return {
    backendExtras: {
      [key]: value,
    },
  };
}

function createUnsupportedControlError(params: {
  backend: string;
  control: string;
}): AcpRuntimeError {
  return new AcpRuntimeError(
    "ACP_BACKEND_UNSUPPORTED_CONTROL",
    `ACP backend "${params.backend}" does not support ${params.control}.`,
  );
}

export class AcpSessionManager {
  private readonly actorTailBySession = new Map<string, Promise<void>>();
  private readonly cachedRuntimeBySession = new Map<string, CachedRuntimeState>();
  private readonly activeTurnBySession = new Map<string, ActiveTurnState>();

  constructor(private readonly deps: AcpSessionManagerDeps = DEFAULT_DEPS) {}

  resolveSession(params: { cfg: OpenClawConfig; sessionKey: string }): AcpSessionResolution {
    const sessionKey = normalizeSessionKey(params.sessionKey);
    if (!sessionKey) {
      return {
        kind: "none",
        sessionKey,
      };
    }
    const acp = this.deps.readSessionEntry({
      cfg: params.cfg,
      sessionKey,
    })?.acp;
    if (acp) {
      return {
        kind: "ready",
        sessionKey,
        meta: acp,
      };
    }
    if (isAcpSessionKey(sessionKey)) {
      return {
        kind: "stale",
        sessionKey,
        error: resolveMissingMetaError(sessionKey),
      };
    }
    return {
      kind: "none",
      sessionKey,
    };
  }

  async initializeSession(input: AcpInitializeSessionInput): Promise<{
    runtime: AcpRuntime;
    handle: AcpRuntimeHandle;
    meta: SessionAcpMeta;
  }> {
    const sessionKey = normalizeSessionKey(input.sessionKey);
    if (!sessionKey) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }
    const agent = normalizeAgentId(input.agent);
    return await this.withSessionActor(sessionKey, async () => {
      const backend = this.deps.requireRuntimeBackend(input.backendId || input.cfg.acp?.backend);
      const runtime = backend.runtime;
      const initialRuntimeOptions = normalizeRuntimeOptions({ cwd: input.cwd });
      let handle: AcpRuntimeHandle;
      try {
        handle = await runtime.ensureSession({
          sessionKey,
          agent,
          mode: input.mode,
          cwd: input.cwd,
        });
      } catch (error) {
        throw toAcpRuntimeError({
          error,
          fallbackCode: "ACP_SESSION_INIT_FAILED",
          fallbackMessage: "Could not initialize ACP session runtime.",
        });
      }

      const meta: SessionAcpMeta = {
        backend: handle.backend || backend.id,
        agent,
        runtimeSessionName: handle.runtimeSessionName,
        mode: input.mode,
        ...(Object.keys(initialRuntimeOptions).length > 0
          ? { runtimeOptions: initialRuntimeOptions }
          : {}),
        cwd: normalizeText(input.cwd),
        state: "idle",
        lastActivityAt: Date.now(),
      };
      const persisted = await this.writeSessionMeta({
        cfg: input.cfg,
        sessionKey,
        mutate: () => meta,
        failOnError: true,
      });
      if (!persisted?.acp) {
        throw new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Could not persist ACP metadata for ${sessionKey}.`,
        );
      }
      this.setCachedRuntimeState(sessionKey, {
        runtime,
        handle,
        backend: handle.backend || backend.id,
        agent,
        mode: input.mode,
        cwd: normalizeText(input.cwd),
      });
      return {
        runtime,
        handle,
        meta,
      };
    });
  }

  async getSessionStatus(params: {
    cfg: OpenClawConfig;
    sessionKey: string;
  }): Promise<AcpSessionStatus> {
    const sessionKey = normalizeSessionKey(params.sessionKey);
    if (!sessionKey) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }
    return await this.withSessionActor(sessionKey, async () => {
      const resolution = this.resolveSession({
        cfg: params.cfg,
        sessionKey,
      });
      if (resolution.kind === "none") {
        throw new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Session is not ACP-enabled: ${sessionKey}`,
        );
      }
      if (resolution.kind === "stale") {
        throw resolution.error;
      }
      const { runtime, handle, meta } = await this.ensureRuntimeHandle({
        cfg: params.cfg,
        sessionKey,
        meta: resolution.meta,
      });
      const capabilities = await this.resolveRuntimeCapabilities({ runtime, handle });
      let runtimeStatus: AcpRuntimeStatus | undefined;
      if (runtime.getStatus) {
        try {
          runtimeStatus = await runtime.getStatus({ handle });
        } catch (error) {
          throw toAcpRuntimeError({
            error,
            fallbackCode: "ACP_TURN_FAILED",
            fallbackMessage: "Could not read ACP runtime status.",
          });
        }
      }
      return {
        sessionKey,
        backend: handle.backend || meta.backend,
        agent: meta.agent,
        state: meta.state,
        mode: meta.mode,
        runtimeOptions: resolveRuntimeOptionsFromMeta(meta),
        capabilities,
        runtimeStatus,
        lastActivityAt: meta.lastActivityAt,
        lastError: meta.lastError,
      };
    });
  }

  async setSessionRuntimeMode(params: {
    cfg: OpenClawConfig;
    sessionKey: string;
    runtimeMode: string;
  }): Promise<AcpSessionRuntimeOptions> {
    const sessionKey = normalizeSessionKey(params.sessionKey);
    const runtimeMode = normalizeText(params.runtimeMode);
    if (!sessionKey) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }
    if (!runtimeMode) {
      throw new AcpRuntimeError("ACP_INVALID_RUNTIME_OPTION", "Runtime mode must not be empty.");
    }

    return await this.withSessionActor(sessionKey, async () => {
      const resolution = this.resolveSession({
        cfg: params.cfg,
        sessionKey,
      });
      if (resolution.kind === "none") {
        throw new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Session is not ACP-enabled: ${sessionKey}`,
        );
      }
      if (resolution.kind === "stale") {
        throw resolution.error;
      }
      const { runtime, handle, meta } = await this.ensureRuntimeHandle({
        cfg: params.cfg,
        sessionKey,
        meta: resolution.meta,
      });
      const capabilities = await this.resolveRuntimeCapabilities({ runtime, handle });
      if (!capabilities.controls.includes("session/set_mode") || !runtime.setMode) {
        throw createUnsupportedControlError({
          backend: handle.backend || meta.backend,
          control: "session/set_mode",
        });
      }

      try {
        await runtime.setMode({
          handle,
          mode: runtimeMode,
        });
      } catch (error) {
        throw toAcpRuntimeError({
          error,
          fallbackCode: "ACP_TURN_FAILED",
          fallbackMessage: "Could not update ACP runtime mode.",
        });
      }

      const nextOptions = mergeRuntimeOptions({
        current: resolveRuntimeOptionsFromMeta(meta),
        patch: { runtimeMode },
      });
      await this.persistRuntimeOptions({
        cfg: params.cfg,
        sessionKey,
        options: nextOptions,
      });
      return nextOptions;
    });
  }

  async setSessionConfigOption(params: {
    cfg: OpenClawConfig;
    sessionKey: string;
    key: string;
    value: string;
  }): Promise<AcpSessionRuntimeOptions> {
    const sessionKey = normalizeSessionKey(params.sessionKey);
    const key = normalizeText(params.key);
    const value = normalizeText(params.value);
    if (!sessionKey) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }
    if (!key || !value) {
      throw new AcpRuntimeError(
        "ACP_INVALID_RUNTIME_OPTION",
        "Config option key and value are required.",
      );
    }

    return await this.withSessionActor(sessionKey, async () => {
      const resolution = this.resolveSession({
        cfg: params.cfg,
        sessionKey,
      });
      if (resolution.kind === "none") {
        throw new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Session is not ACP-enabled: ${sessionKey}`,
        );
      }
      if (resolution.kind === "stale") {
        throw resolution.error;
      }
      const { runtime, handle, meta } = await this.ensureRuntimeHandle({
        cfg: params.cfg,
        sessionKey,
        meta: resolution.meta,
      });
      const capabilities = await this.resolveRuntimeCapabilities({ runtime, handle });
      if (
        !capabilities.controls.includes("session/set_config_option") ||
        !runtime.setConfigOption
      ) {
        throw createUnsupportedControlError({
          backend: handle.backend || meta.backend,
          control: "session/set_config_option",
        });
      }

      const advertisedKeys = new Set(
        (capabilities.configOptionKeys ?? [])
          .map((entry) => normalizeText(entry))
          .filter(Boolean) as string[],
      );
      if (advertisedKeys.size > 0 && !advertisedKeys.has(key)) {
        throw new AcpRuntimeError(
          "ACP_BACKEND_UNSUPPORTED_CONTROL",
          `ACP backend "${handle.backend || meta.backend}" does not accept config key "${key}".`,
        );
      }

      try {
        await runtime.setConfigOption({
          handle,
          key,
          value,
        });
      } catch (error) {
        throw toAcpRuntimeError({
          error,
          fallbackCode: "ACP_TURN_FAILED",
          fallbackMessage: "Could not update ACP runtime config option.",
        });
      }

      const inferredPatch = inferRuntimeOptionPatchFromConfigOption(key, value);
      const nextOptions = mergeRuntimeOptions({
        current: resolveRuntimeOptionsFromMeta(meta),
        patch: inferredPatch,
      });
      await this.persistRuntimeOptions({
        cfg: params.cfg,
        sessionKey,
        options: nextOptions,
      });
      return nextOptions;
    });
  }

  async updateSessionRuntimeOptions(params: {
    cfg: OpenClawConfig;
    sessionKey: string;
    patch: Partial<AcpSessionRuntimeOptions>;
  }): Promise<AcpSessionRuntimeOptions> {
    const sessionKey = normalizeSessionKey(params.sessionKey);
    if (!sessionKey) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }

    return await this.withSessionActor(sessionKey, async () => {
      const resolution = this.resolveSession({
        cfg: params.cfg,
        sessionKey,
      });
      if (resolution.kind === "none") {
        throw new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Session is not ACP-enabled: ${sessionKey}`,
        );
      }
      if (resolution.kind === "stale") {
        throw resolution.error;
      }
      const nextOptions = mergeRuntimeOptions({
        current: resolveRuntimeOptionsFromMeta(resolution.meta),
        patch: params.patch,
      });
      await this.persistRuntimeOptions({
        cfg: params.cfg,
        sessionKey,
        options: nextOptions,
      });
      return nextOptions;
    });
  }

  async resetSessionRuntimeOptions(params: {
    cfg: OpenClawConfig;
    sessionKey: string;
  }): Promise<AcpSessionRuntimeOptions> {
    const sessionKey = normalizeSessionKey(params.sessionKey);
    if (!sessionKey) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }
    return await this.withSessionActor(sessionKey, async () => {
      const resolution = this.resolveSession({
        cfg: params.cfg,
        sessionKey,
      });
      if (resolution.kind === "none") {
        throw new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Session is not ACP-enabled: ${sessionKey}`,
        );
      }
      if (resolution.kind === "stale") {
        throw resolution.error;
      }
      const { runtime, handle } = await this.ensureRuntimeHandle({
        cfg: params.cfg,
        sessionKey,
        meta: resolution.meta,
      });
      try {
        await runtime.close({
          handle,
          reason: "reset-runtime-options",
        });
      } catch (error) {
        throw toAcpRuntimeError({
          error,
          fallbackCode: "ACP_TURN_FAILED",
          fallbackMessage: "Could not reset ACP runtime options.",
        });
      }
      this.clearCachedRuntimeState(sessionKey);
      await this.persistRuntimeOptions({
        cfg: params.cfg,
        sessionKey,
        options: {},
      });
      return {};
    });
  }

  async runTurn(input: AcpRunTurnInput): Promise<void> {
    const sessionKey = normalizeSessionKey(input.sessionKey);
    if (!sessionKey) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }
    await this.withSessionActor(sessionKey, async () => {
      const resolution = this.resolveSession({
        cfg: input.cfg,
        sessionKey,
      });
      if (resolution.kind === "none") {
        throw new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Session is not ACP-enabled: ${sessionKey}`,
        );
      }
      if (resolution.kind === "stale") {
        throw resolution.error;
      }

      const { runtime, handle, meta } = await this.ensureRuntimeHandle({
        cfg: input.cfg,
        sessionKey,
        meta: resolution.meta,
      });
      await this.applyRuntimeControls({
        sessionKey,
        runtime,
        handle,
        meta,
      });
      const actorKey = normalizeActorKey(sessionKey);

      await this.setSessionState({
        cfg: input.cfg,
        sessionKey,
        state: "running",
        clearLastError: true,
      });

      const internalAbortController = new AbortController();
      const onCallerAbort = () => {
        internalAbortController.abort();
      };
      if (input.signal?.aborted) {
        internalAbortController.abort();
      } else if (input.signal) {
        input.signal.addEventListener("abort", onCallerAbort, { once: true });
      }

      const activeTurn: ActiveTurnState = {
        runtime,
        handle,
        abortController: internalAbortController,
      };
      this.activeTurnBySession.set(actorKey, activeTurn);

      let streamError: AcpRuntimeError | null = null;
      try {
        const combinedSignal =
          input.signal && typeof AbortSignal.any === "function"
            ? AbortSignal.any([input.signal, internalAbortController.signal])
            : internalAbortController.signal;
        for await (const event of runtime.runTurn({
          handle,
          text: input.text,
          mode: input.mode,
          requestId: input.requestId,
          signal: combinedSignal,
        })) {
          if (event.type === "error") {
            streamError = new AcpRuntimeError(
              normalizeAcpErrorCode(event.code),
              event.message?.trim() || "ACP turn failed before completion.",
            );
          }
          if (input.onEvent) {
            await input.onEvent(event);
          }
          if (event.type === "error" || event.type === "done") {
            break;
          }
        }
        if (streamError) {
          throw streamError;
        }
        await this.setSessionState({
          cfg: input.cfg,
          sessionKey,
          state: "idle",
          clearLastError: true,
        });
      } catch (error) {
        const acpError = toAcpRuntimeError({
          error,
          fallbackCode: "ACP_TURN_FAILED",
          fallbackMessage: "ACP turn failed before completion.",
        });
        await this.setSessionState({
          cfg: input.cfg,
          sessionKey,
          state: "error",
          lastError: acpError.message,
        });
        throw acpError;
      } finally {
        if (input.signal) {
          input.signal.removeEventListener("abort", onCallerAbort);
        }
        if (this.activeTurnBySession.get(actorKey) === activeTurn) {
          this.activeTurnBySession.delete(actorKey);
        }
        if (meta.mode === "oneshot") {
          try {
            await runtime.close({
              handle,
              reason: "oneshot-complete",
            });
          } catch (error) {
            logVerbose(`acp-manager: ACP oneshot close failed for ${sessionKey}: ${String(error)}`);
          } finally {
            this.clearCachedRuntimeState(sessionKey);
          }
        }
      }
    });
  }

  async cancelSession(params: {
    cfg: OpenClawConfig;
    sessionKey: string;
    reason?: string;
  }): Promise<void> {
    const sessionKey = normalizeSessionKey(params.sessionKey);
    if (!sessionKey) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }
    const actorKey = normalizeActorKey(sessionKey);
    const activeTurn = this.activeTurnBySession.get(actorKey);
    if (activeTurn) {
      activeTurn.abortController.abort();
      if (!activeTurn.cancelPromise) {
        activeTurn.cancelPromise = activeTurn.runtime.cancel({
          handle: activeTurn.handle,
          reason: params.reason,
        });
      }
      try {
        await activeTurn.cancelPromise;
      } catch (error) {
        throw toAcpRuntimeError({
          error,
          fallbackCode: "ACP_TURN_FAILED",
          fallbackMessage: "ACP cancel failed before completion.",
        });
      }
      return;
    }

    await this.withSessionActor(sessionKey, async () => {
      const resolution = this.resolveSession({
        cfg: params.cfg,
        sessionKey,
      });
      if (resolution.kind === "none") {
        throw new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Session is not ACP-enabled: ${sessionKey}`,
        );
      }
      if (resolution.kind === "stale") {
        throw resolution.error;
      }
      const { runtime, handle } = await this.ensureRuntimeHandle({
        cfg: params.cfg,
        sessionKey,
        meta: resolution.meta,
      });
      try {
        await runtime.cancel({
          handle,
          reason: params.reason,
        });
        await this.setSessionState({
          cfg: params.cfg,
          sessionKey,
          state: "idle",
          clearLastError: true,
        });
      } catch (error) {
        const acpError = toAcpRuntimeError({
          error,
          fallbackCode: "ACP_TURN_FAILED",
          fallbackMessage: "ACP cancel failed before completion.",
        });
        await this.setSessionState({
          cfg: params.cfg,
          sessionKey,
          state: "error",
          lastError: acpError.message,
        });
        throw acpError;
      }
    });
  }

  async closeSession(input: AcpCloseSessionInput): Promise<AcpCloseSessionResult> {
    const sessionKey = normalizeSessionKey(input.sessionKey);
    if (!sessionKey) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }
    return await this.withSessionActor(sessionKey, async () => {
      const resolution = this.resolveSession({
        cfg: input.cfg,
        sessionKey,
      });
      if (resolution.kind === "none") {
        if (input.requireAcpSession ?? true) {
          throw new AcpRuntimeError(
            "ACP_SESSION_INIT_FAILED",
            `Session is not ACP-enabled: ${sessionKey}`,
          );
        }
        return {
          runtimeClosed: false,
          metaCleared: false,
        };
      }
      if (resolution.kind === "stale") {
        if (input.requireAcpSession ?? true) {
          throw resolution.error;
        }
        return {
          runtimeClosed: false,
          metaCleared: false,
        };
      }

      let runtimeClosed = false;
      let runtimeNotice: string | undefined;
      try {
        const { runtime, handle } = await this.ensureRuntimeHandle({
          cfg: input.cfg,
          sessionKey,
          meta: resolution.meta,
        });
        await runtime.close({
          handle,
          reason: input.reason,
        });
        runtimeClosed = true;
        this.clearCachedRuntimeState(sessionKey);
      } catch (error) {
        const acpError = toAcpRuntimeError({
          error,
          fallbackCode: "ACP_TURN_FAILED",
          fallbackMessage: "ACP close failed before completion.",
        });
        if (
          input.allowBackendUnavailable &&
          (acpError.code === "ACP_BACKEND_MISSING" || acpError.code === "ACP_BACKEND_UNAVAILABLE")
        ) {
          runtimeNotice = acpError.message;
        } else {
          throw acpError;
        }
      }

      let metaCleared = false;
      if (input.clearMeta) {
        await this.writeSessionMeta({
          cfg: input.cfg,
          sessionKey,
          mutate: (_current, entry) => {
            if (!entry) {
              return null;
            }
            return null;
          },
        });
        metaCleared = true;
      }

      return {
        runtimeClosed,
        runtimeNotice,
        metaCleared,
      };
    });
  }

  private async ensureRuntimeHandle(params: {
    cfg: OpenClawConfig;
    sessionKey: string;
    meta: SessionAcpMeta;
  }): Promise<{ runtime: AcpRuntime; handle: AcpRuntimeHandle; meta: SessionAcpMeta }> {
    const agent =
      params.meta.agent?.trim() || resolveAcpAgentFromSessionKey(params.sessionKey, "main");
    const mode = params.meta.mode;
    const runtimeOptions = resolveRuntimeOptionsFromMeta(params.meta);
    const cwd = runtimeOptions.cwd;
    const configuredBackend = (params.meta.backend || params.cfg.acp?.backend || "").trim();
    const cached = this.getCachedRuntimeState(params.sessionKey);
    if (cached) {
      const backendMatches = !configuredBackend || cached.backend === configuredBackend;
      const agentMatches = cached.agent === agent;
      const modeMatches = cached.mode === mode;
      const cwdMatches = (cached.cwd ?? "") === (cwd ?? "");
      if (backendMatches && agentMatches && modeMatches && cwdMatches) {
        return {
          runtime: cached.runtime,
          handle: cached.handle,
          meta: params.meta,
        };
      }
      this.clearCachedRuntimeState(params.sessionKey);
    }

    const backend = this.deps.requireRuntimeBackend(configuredBackend || undefined);
    const runtime = backend.runtime;
    let ensured: AcpRuntimeHandle;
    try {
      ensured = await runtime.ensureSession({
        sessionKey: params.sessionKey,
        agent,
        mode,
        cwd,
      });
    } catch (error) {
      throw toAcpRuntimeError({
        error,
        fallbackCode: "ACP_SESSION_INIT_FAILED",
        fallbackMessage: "Could not initialize ACP session runtime.",
      });
    }

    const previousMeta = params.meta;
    const nextMeta: SessionAcpMeta = {
      ...params.meta,
      backend: ensured.backend || backend.id,
      runtimeSessionName: ensured.runtimeSessionName,
      agent,
      runtimeOptions,
      cwd,
      state: previousMeta.state,
      lastActivityAt: Date.now(),
    };
    const shouldPersistMeta =
      previousMeta.backend !== nextMeta.backend ||
      previousMeta.runtimeSessionName !== nextMeta.runtimeSessionName ||
      previousMeta.agent !== nextMeta.agent ||
      previousMeta.cwd !== nextMeta.cwd ||
      !runtimeOptionsEqual(previousMeta.runtimeOptions, nextMeta.runtimeOptions);
    if (shouldPersistMeta) {
      await this.writeSessionMeta({
        cfg: params.cfg,
        sessionKey: params.sessionKey,
        mutate: (_current, entry) => {
          if (!entry) {
            return null;
          }
          return nextMeta;
        },
      });
    }
    this.setCachedRuntimeState(params.sessionKey, {
      runtime,
      handle: ensured,
      backend: ensured.backend || backend.id,
      agent,
      mode,
      cwd,
      appliedControlSignature: undefined,
    });
    return {
      runtime,
      handle: ensured,
      meta: nextMeta,
    };
  }

  private async persistRuntimeOptions(params: {
    cfg: OpenClawConfig;
    sessionKey: string;
    options: AcpSessionRuntimeOptions;
  }): Promise<void> {
    const normalized = normalizeRuntimeOptions(params.options);
    const hasOptions = Object.keys(normalized).length > 0;
    await this.writeSessionMeta({
      cfg: params.cfg,
      sessionKey: params.sessionKey,
      mutate: (current, entry) => {
        if (!entry) {
          return null;
        }
        const base = current ?? entry.acp;
        if (!base) {
          return null;
        }
        return {
          ...base,
          runtimeOptions: hasOptions ? normalized : undefined,
          cwd: normalized.cwd,
          lastActivityAt: Date.now(),
        };
      },
      failOnError: true,
    });

    const cached = this.getCachedRuntimeState(params.sessionKey);
    if (!cached) {
      return;
    }
    if ((cached.cwd ?? "") !== (normalized.cwd ?? "")) {
      this.clearCachedRuntimeState(params.sessionKey);
      return;
    }
    cached.appliedControlSignature = buildRuntimeControlSignature(normalized);
  }

  private async resolveRuntimeCapabilities(params: {
    runtime: AcpRuntime;
    handle: AcpRuntimeHandle;
  }): Promise<AcpRuntimeCapabilities> {
    let reported: AcpRuntimeCapabilities | undefined;
    if (params.runtime.getCapabilities) {
      try {
        reported = await params.runtime.getCapabilities({ handle: params.handle });
      } catch (error) {
        throw toAcpRuntimeError({
          error,
          fallbackCode: "ACP_TURN_FAILED",
          fallbackMessage: "Could not read ACP runtime capabilities.",
        });
      }
    }
    const controls = new Set<AcpRuntimeCapabilities["controls"][number]>(reported?.controls ?? []);
    if (params.runtime.setMode) {
      controls.add("session/set_mode");
    }
    if (params.runtime.setConfigOption) {
      controls.add("session/set_config_option");
    }
    if (params.runtime.getStatus) {
      controls.add("session/status");
    }
    const normalizedKeys = (reported?.configOptionKeys ?? [])
      .map((entry) => normalizeText(entry))
      .filter(Boolean) as string[];
    return {
      controls: [...controls].toSorted(),
      ...(normalizedKeys.length > 0 ? { configOptionKeys: normalizedKeys } : {}),
    };
  }

  private async applyRuntimeControls(params: {
    sessionKey: string;
    runtime: AcpRuntime;
    handle: AcpRuntimeHandle;
    meta: SessionAcpMeta;
  }): Promise<void> {
    const options = resolveRuntimeOptionsFromMeta(params.meta);
    const signature = buildRuntimeControlSignature(options);
    const cached = this.getCachedRuntimeState(params.sessionKey);
    if (cached?.appliedControlSignature === signature) {
      return;
    }

    const capabilities = await this.resolveRuntimeCapabilities({
      runtime: params.runtime,
      handle: params.handle,
    });
    const backend = params.handle.backend || params.meta.backend;
    const runtimeMode = normalizeText(options.runtimeMode);
    const configOptions = buildRuntimeConfigOptionPairs(options);
    const advertisedKeys = new Set(
      (capabilities.configOptionKeys ?? [])
        .map((entry) => normalizeText(entry))
        .filter(Boolean) as string[],
    );

    try {
      if (runtimeMode) {
        if (!capabilities.controls.includes("session/set_mode") || !params.runtime.setMode) {
          throw createUnsupportedControlError({
            backend,
            control: "session/set_mode",
          });
        }
        await params.runtime.setMode({
          handle: params.handle,
          mode: runtimeMode,
        });
      }

      if (configOptions.length > 0) {
        if (
          !capabilities.controls.includes("session/set_config_option") ||
          !params.runtime.setConfigOption
        ) {
          throw createUnsupportedControlError({
            backend,
            control: "session/set_config_option",
          });
        }
        for (const [key, value] of configOptions) {
          if (advertisedKeys.size > 0 && !advertisedKeys.has(key)) {
            throw new AcpRuntimeError(
              "ACP_BACKEND_UNSUPPORTED_CONTROL",
              `ACP backend "${backend}" does not accept config key "${key}".`,
            );
          }
          await params.runtime.setConfigOption({
            handle: params.handle,
            key,
            value,
          });
        }
      }
    } catch (error) {
      if (error instanceof AcpRuntimeError) {
        throw error;
      }
      throw toAcpRuntimeError({
        error,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "Could not apply ACP runtime options before turn execution.",
      });
    }

    if (cached) {
      cached.appliedControlSignature = signature;
    }
  }

  private async setSessionState(params: {
    cfg: OpenClawConfig;
    sessionKey: string;
    state: SessionAcpMeta["state"];
    lastError?: string;
    clearLastError?: boolean;
  }): Promise<void> {
    await this.writeSessionMeta({
      cfg: params.cfg,
      sessionKey: params.sessionKey,
      mutate: (current, entry) => {
        if (!entry) {
          return null;
        }
        const base = current ?? entry.acp;
        if (!base) {
          return null;
        }
        const next: SessionAcpMeta = {
          ...base,
          state: params.state,
          lastActivityAt: Date.now(),
        };
        if (params.lastError?.trim()) {
          next.lastError = params.lastError.trim();
        } else if (params.clearLastError) {
          delete next.lastError;
        }
        return next;
      },
    });
  }

  private async writeSessionMeta(params: {
    cfg: OpenClawConfig;
    sessionKey: string;
    mutate: (
      current: SessionAcpMeta | undefined,
      entry: SessionEntry | undefined,
    ) => SessionAcpMeta | null | undefined;
    failOnError?: boolean;
  }): Promise<SessionEntry | null> {
    try {
      return await this.deps.upsertSessionMeta({
        cfg: params.cfg,
        sessionKey: params.sessionKey,
        mutate: params.mutate,
      });
    } catch (error) {
      if (params.failOnError) {
        throw error;
      }
      logVerbose(
        `acp-manager: failed persisting ACP metadata for ${params.sessionKey}: ${String(error)}`,
      );
      return null;
    }
  }

  private async withSessionActor<T>(sessionKey: string, op: () => Promise<T>): Promise<T> {
    const actorKey = normalizeActorKey(sessionKey);
    const previous = this.actorTailBySession.get(actorKey) ?? Promise.resolve();
    let release: () => void = () => {};
    const marker = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.actorTailBySession.set(
      actorKey,
      previous
        .catch(() => {
          // Keep actor queue alive after an operation failure.
        })
        .then(() => marker),
    );

    await previous.catch(() => {
      // Previous failures should not block newer commands.
    });
    try {
      return await op();
    } finally {
      release();
      if (this.actorTailBySession.get(actorKey) === marker) {
        this.actorTailBySession.delete(actorKey);
      }
    }
  }

  private getCachedRuntimeState(sessionKey: string): CachedRuntimeState | null {
    return this.cachedRuntimeBySession.get(normalizeActorKey(sessionKey)) ?? null;
  }

  private setCachedRuntimeState(sessionKey: string, state: CachedRuntimeState): void {
    this.cachedRuntimeBySession.set(normalizeActorKey(sessionKey), state);
  }

  private clearCachedRuntimeState(sessionKey: string): void {
    this.cachedRuntimeBySession.delete(normalizeActorKey(sessionKey));
  }
}

let ACP_SESSION_MANAGER_SINGLETON: AcpSessionManager | null = null;

export function getAcpSessionManager(): AcpSessionManager {
  if (!ACP_SESSION_MANAGER_SINGLETON) {
    ACP_SESSION_MANAGER_SINGLETON = new AcpSessionManager();
  }
  return ACP_SESSION_MANAGER_SINGLETON;
}

export const __testing = {
  resetAcpSessionManagerForTests() {
    ACP_SESSION_MANAGER_SINGLETON = null;
  },
};
