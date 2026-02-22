import type { OpenClawConfig } from "../../config/config.js";
import type { SessionAcpMeta, SessionEntry } from "../../config/sessions/types.js";
import { logVerbose } from "../../globals.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import { isAcpSessionKey } from "../../sessions/session-key-utils.js";
import { ACP_ERROR_CODES, AcpRuntimeError, toAcpRuntimeError } from "../runtime/errors.js";
import { requireAcpRuntimeBackend } from "../runtime/registry.js";
import { readAcpSessionEntry, upsertAcpSessionMeta } from "../runtime/session-meta.js";
import type {
  AcpRuntime,
  AcpRuntimeEvent,
  AcpRuntimeHandle,
  AcpRuntimePromptMode,
  AcpRuntimeSessionMode,
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

export class AcpSessionManager {
  private readonly actorTailBySession = new Map<string, Promise<void>>();

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
        cwd: input.cwd,
        state: "idle",
        lastActivityAt: Date.now(),
      };
      await this.writeSessionMeta({
        cfg: input.cfg,
        sessionKey,
        mutate: () => meta,
      });
      return {
        runtime,
        handle,
        meta,
      };
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

      await this.setSessionState({
        cfg: input.cfg,
        sessionKey,
        state: "running",
        clearLastError: true,
      });

      let streamError: AcpRuntimeError | null = null;
      try {
        for await (const event of runtime.runTurn({
          handle,
          text: input.text,
          mode: input.mode,
          requestId: input.requestId,
          signal: input.signal,
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
        if (meta.mode === "oneshot") {
          try {
            await runtime.close({
              handle,
              reason: "oneshot-complete",
            });
          } catch (error) {
            logVerbose(`acp-manager: ACP oneshot close failed for ${sessionKey}: ${String(error)}`);
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
    const backend = this.deps.requireRuntimeBackend(params.meta.backend || params.cfg.acp?.backend);
    const runtime = backend.runtime;
    const agent =
      params.meta.agent?.trim() || resolveAcpAgentFromSessionKey(params.sessionKey, "main");
    let ensured: AcpRuntimeHandle;
    try {
      ensured = await runtime.ensureSession({
        sessionKey: params.sessionKey,
        agent,
        mode: params.meta.mode,
        cwd: params.meta.cwd,
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
      state: previousMeta.state,
      lastActivityAt: Date.now(),
    };
    const shouldPersistMeta =
      previousMeta.backend !== nextMeta.backend ||
      previousMeta.runtimeSessionName !== nextMeta.runtimeSessionName ||
      previousMeta.agent !== nextMeta.agent ||
      previousMeta.cwd !== nextMeta.cwd;
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
    return {
      runtime,
      handle: ensured,
      meta: nextMeta,
    };
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
  }): Promise<void> {
    try {
      await this.deps.upsertSessionMeta({
        cfg: params.cfg,
        sessionKey: params.sessionKey,
        mutate: params.mutate,
      });
    } catch (error) {
      logVerbose(
        `acp-manager: failed persisting ACP metadata for ${params.sessionKey}: ${String(error)}`,
      );
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
