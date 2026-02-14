import type { OpenClawConfig } from "../config/config.js";
import type { FailoverReason } from "./pi-embedded-helpers.js";
import {
  createInternalHookEvent,
  triggerModelCompleteHook,
  triggerModelFailoverHook,
  triggerModelSelectHook,
  type ModelCompleteHookEvent,
  type ModelFailoverHookEvent,
  type ModelSelectHookEvent,
} from "../hooks/internal-hooks.js";
import { resolveAgentIdFromSessionKey, resolveAgentModelStrategy } from "./agent-scope.js";
import {
  ensureAuthProfileStore,
  isProfileInCooldown,
  resolveAuthProfileOrder,
} from "./auth-profiles.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "./defaults.js";
import {
  coerceToFailoverError,
  describeFailoverError,
  isFailoverError,
  isTimeoutError,
} from "./failover-error.js";
import {
  buildConfiguredAllowlistKeys,
  buildModelAliasIndex,
  modelKey,
  parseModelRef,
  resolveConfiguredModelRef,
  resolveModelRefFromString,
} from "./model-selection.js";

type ModelCandidate = {
  provider: string;
  model: string;
};

type FallbackAttempt = {
  provider: string;
  model: string;
  error: string;
  reason?: FailoverReason;
  status?: number;
  code?: string;
};

type ModelSelectionStrategy = "primary" | "round_robin" | "sticky_session";

const roundRobinState = new Map<string, number>();

/**
 * Fallback abort check. Only treats explicit AbortError names as user aborts.
 * Message-based checks (e.g., "aborted") can mask timeouts and skip fallback.
 */
function isFallbackAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  if (isFailoverError(err)) {
    return false;
  }
  const name = "name" in err ? String(err.name) : "";
  return name === "AbortError";
}

function shouldRethrowAbort(err: unknown): boolean {
  return isFallbackAbortError(err) && !isTimeoutError(err);
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function rotateCandidates(candidates: ModelCandidate[], startIndex: number): ModelCandidate[] {
  if (candidates.length <= 1) {
    return candidates;
  }
  const start = ((startIndex % candidates.length) + candidates.length) % candidates.length;
  if (start === 0) {
    return candidates;
  }
  return candidates.slice(start).concat(candidates.slice(0, start));
}

function buildPoolKey(candidates: ModelCandidate[]): string {
  return candidates.map((candidate) => `${candidate.provider}/${candidate.model}`).join("|");
}

function applySelectionStrategy(params: {
  candidates: ModelCandidate[];
  strategy: ModelSelectionStrategy;
  sessionKey?: string;
}): ModelCandidate[] {
  const { candidates, strategy } = params;
  if (candidates.length <= 1) {
    return candidates;
  }
  if (strategy === "round_robin") {
    const key = buildPoolKey(candidates);
    const current = roundRobinState.get(key) ?? 0;
    const next = (current + 1) % candidates.length;
    roundRobinState.set(key, next);
    return rotateCandidates(candidates, current);
  }
  if (strategy === "sticky_session") {
    if (!params.sessionKey) {
      return candidates;
    }
    const idx = hashString(params.sessionKey) % candidates.length;
    return rotateCandidates(candidates, idx);
  }
  return candidates;
}

function resolveImageFallbackCandidates(params: {
  cfg: OpenClawConfig | undefined;
  defaultProvider: string;
  modelOverride?: string;
}): ModelCandidate[] {
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg ?? {},
    defaultProvider: params.defaultProvider,
  });
  const allowlist = buildConfiguredAllowlistKeys({
    cfg: params.cfg,
    defaultProvider: params.defaultProvider,
  });
  const seen = new Set<string>();
  const candidates: ModelCandidate[] = [];

  const addCandidate = (candidate: ModelCandidate, enforceAllowlist: boolean) => {
    if (!candidate.provider || !candidate.model) {
      return;
    }
    const key = modelKey(candidate.provider, candidate.model);
    if (seen.has(key)) {
      return;
    }
    if (enforceAllowlist && allowlist && !allowlist.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(candidate);
  };

  const addRaw = (raw: string, enforceAllowlist: boolean) => {
    const resolved = resolveModelRefFromString({
      raw: String(raw ?? ""),
      defaultProvider: params.defaultProvider,
      aliasIndex,
    });
    if (!resolved) {
      return;
    }
    addCandidate(resolved.ref, enforceAllowlist);
  };

  if (params.modelOverride?.trim()) {
    addRaw(params.modelOverride, false);
  } else {
    const imageModel = params.cfg?.agents?.defaults?.imageModel as
      | { primary?: string }
      | string
      | undefined;
    const primary = typeof imageModel === "string" ? imageModel.trim() : imageModel?.primary;
    if (primary?.trim()) {
      addRaw(primary, false);
    }
  }

  const imageFallbacks = (() => {
    const imageModel = params.cfg?.agents?.defaults?.imageModel as
      | { fallbacks?: string[] }
      | string
      | undefined;
    if (imageModel && typeof imageModel === "object") {
      return imageModel.fallbacks ?? [];
    }
    return [];
  })();

  for (const raw of imageFallbacks) {
    addRaw(raw, true);
  }

  return candidates;
}

function resolveFallbackCandidates(params: {
  cfg: OpenClawConfig | undefined;
  provider: string;
  model: string;
  /** Optional explicit fallbacks list; when provided (even empty), replaces agents.defaults.model.fallbacks. */
  fallbacksOverride?: string[];
}): ModelCandidate[] {
  const primary = params.cfg
    ? resolveConfiguredModelRef({
        cfg: params.cfg,
        defaultProvider: DEFAULT_PROVIDER,
        defaultModel: DEFAULT_MODEL,
      })
    : null;
  const defaultProvider = primary?.provider ?? DEFAULT_PROVIDER;
  const defaultModel = primary?.model ?? DEFAULT_MODEL;
  const provider = String(params.provider ?? "").trim() || defaultProvider;
  const model = String(params.model ?? "").trim() || defaultModel;
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg ?? {},
    defaultProvider,
  });
  const allowlist = buildConfiguredAllowlistKeys({
    cfg: params.cfg,
    defaultProvider,
  });
  const seen = new Set<string>();
  const candidates: ModelCandidate[] = [];

  const addCandidate = (candidate: ModelCandidate, enforceAllowlist: boolean) => {
    if (!candidate.provider || !candidate.model) {
      return;
    }
    const key = modelKey(candidate.provider, candidate.model);
    if (seen.has(key)) {
      return;
    }
    if (enforceAllowlist && allowlist && !allowlist.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(candidate);
  };

  addCandidate({ provider, model }, false);

  const modelFallbacks = (() => {
    if (params.fallbacksOverride !== undefined) {
      return params.fallbacksOverride;
    }
    const model = params.cfg?.agents?.defaults?.model as
      | { fallbacks?: string[] }
      | string
      | undefined;
    if (model && typeof model === "object") {
      return model.fallbacks ?? [];
    }
    return [];
  })();

  for (const raw of modelFallbacks) {
    const resolved = resolveModelRefFromString({
      raw: String(raw ?? ""),
      defaultProvider,
      aliasIndex,
    });
    if (!resolved) {
      continue;
    }
    addCandidate(resolved.ref, true);
  }

  if (params.fallbacksOverride === undefined && primary?.provider && primary.model) {
    addCandidate({ provider: primary.provider, model: primary.model }, false);
  }

  return candidates;
}

export async function runWithModelFallback<T>(params: {
  cfg: OpenClawConfig | undefined;
  provider: string;
  model: string;
  agentDir?: string;
  sessionKey?: string;
  /** Optional model selection strategy override. */
  selectionStrategy?: ModelSelectionStrategy;
  /** Optional explicit fallbacks list; when provided (even empty), replaces agents.defaults.model.fallbacks. */
  fallbacksOverride?: string[];
  /** Task hint for smart routing (e.g., "code", "chat", "math") */
  taskHint?: string;
  /** Estimated context length in tokens for routing decisions */
  contextLength?: number;
  run: (provider: string, model: string) => Promise<T>;
  onError?: (attempt: {
    provider: string;
    model: string;
    error: unknown;
    attempt: number;
    total: number;
  }) => void | Promise<void>;
}): Promise<{
  result: T;
  provider: string;
  model: string;
  attempts: FallbackAttempt[];
}> {
  const candidates = resolveFallbackCandidates({
    cfg: params.cfg,
    provider: params.provider,
    model: params.model,
    fallbacksOverride: params.fallbacksOverride,
  });
  const strategy =
    params.selectionStrategy ??
    (params.cfg
      ? resolveAgentModelStrategy(
          params.cfg,
          params.sessionKey ? resolveAgentIdFromSessionKey(params.sessionKey) : undefined,
        )
      : undefined) ??
    "primary";
  let orderedCandidates = applySelectionStrategy({
    candidates,
    strategy,
    sessionKey: params.sessionKey,
  });

  // Trigger model:select hook for smart routing
  try {
    const agentId = params.sessionKey ? resolveAgentIdFromSessionKey(params.sessionKey) : undefined;

    const selectEvent = createInternalHookEvent("model", "select", params.sessionKey ?? "unknown", {
      requestedProvider: params.provider,
      requestedModel: params.model,
      candidates: orderedCandidates.map((c) => ({ provider: c.provider, model: c.model })),
      strategy,
      sessionKey: params.sessionKey,
      agentId,
      workspaceDir: params.agentDir,
      taskHint: params.taskHint,
      contextLength: params.contextLength,
    }) as ModelSelectHookEvent;

    const selectResult = await triggerModelSelectHook(selectEvent);

    if (selectResult) {
      // Handle override candidates (replaces entire list)
      if (selectResult.overrideCandidates?.length) {
        orderedCandidates = selectResult.overrideCandidates;
      }
      // Handle prepend candidates (adds to front)
      else if (selectResult.prependCandidates?.length) {
        const seen = new Set(selectResult.prependCandidates.map((c) => `${c.provider}/${c.model}`));
        const filtered = orderedCandidates.filter((c) => !seen.has(`${c.provider}/${c.model}`));
        orderedCandidates = [...selectResult.prependCandidates, ...filtered];
      }
      // Handle single model override
      else if (selectResult.overrideModel) {
        const parsed = parseModelRef(selectResult.overrideModel, params.provider);
        if (parsed) {
          const key = `${parsed.provider}/${parsed.model}`;
          const filtered = orderedCandidates.filter((c) => `${c.provider}/${c.model}` !== key);
          orderedCandidates = [{ provider: parsed.provider, model: parsed.model }, ...filtered];
        }
      }
    }
  } catch (err) {
    console.warn(`[model-fallback] model:select hook error: ${String(err)}`);
  }

  const authStore = params.cfg
    ? ensureAuthProfileStore(params.agentDir, { allowKeychainPrompt: false })
    : null;
  const attempts: FallbackAttempt[] = [];
  let lastError: unknown;

  const transientReasons = new Set<FailoverReason>(["rate_limit", "timeout"]);
  const hardReasons = new Set<FailoverReason>(["auth", "billing", "format"]);
  const maxPasses = 2;
  const retryDelayMs = 750;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const passStartIndex = attempts.length;
    for (let i = 0; i < orderedCandidates.length; i += 1) {
      const candidate = orderedCandidates[i];
      if (authStore) {
        const profileIds = resolveAuthProfileOrder({
          cfg: params.cfg,
          store: authStore,
          provider: candidate.provider,
        });
        const isAnyProfileAvailable = profileIds.some((id) => !isProfileInCooldown(authStore, id));

        if (profileIds.length > 0 && !isAnyProfileAvailable) {
          // All profiles for this provider are in cooldown; skip without attempting
          attempts.push({
            provider: candidate.provider,
            model: candidate.model,
            error: `Provider ${candidate.provider} is in cooldown (all profiles unavailable)`,
            reason: "rate_limit",
          });
          continue;
        }
      }
      try {
        const startTime = Date.now();
        const result = await params.run(candidate.provider, candidate.model);

        // Trigger model:complete hook on success
        try {
          const completeEvent = createInternalHookEvent(
            "model",
            "complete",
            params.sessionKey ?? "unknown",
            {
              provider: candidate.provider,
              model: candidate.model,
              durationMs: Date.now() - startTime,
              success: true,
              sessionKey: params.sessionKey,
              agentId: params.sessionKey
                ? resolveAgentIdFromSessionKey(params.sessionKey)
                : undefined,
              workspaceDir: params.agentDir,
            },
          ) as ModelCompleteHookEvent;
          // Fire and forget
          triggerModelCompleteHook(completeEvent).catch(() => {});
        } catch {
          // Ignore hook errors
        }

        return {
          result,
          provider: candidate.provider,
          model: candidate.model,
          attempts,
        };
      } catch (err) {
        if (shouldRethrowAbort(err)) {
          throw err;
        }
        const normalized =
          coerceToFailoverError(err, {
            provider: candidate.provider,
            model: candidate.model,
          }) ?? err;
        if (!isFailoverError(normalized)) {
          throw err;
        }

        lastError = normalized;
        const described = describeFailoverError(normalized);
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          error: described.message,
          reason: described.reason,
          status: described.status,
          code: described.code,
        });
        await params.onError?.({
          provider: candidate.provider,
          model: candidate.model,
          error: normalized,
          attempt: pass * orderedCandidates.length + i + 1,
          total: orderedCandidates.length * maxPasses,
        });

        // Call model:failover internal hook if there's a next candidate
        const nextCandidate = orderedCandidates[i + 1];
        if (nextCandidate) {
          try {
            const agentId = params.sessionKey
              ? resolveAgentIdFromSessionKey(params.sessionKey)
              : undefined;

            const hookEvent = createInternalHookEvent(
              "model",
              "failover",
              params.sessionKey ?? "unknown",
              {
                fromProvider: candidate.provider,
                fromModel: candidate.model,
                toProvider: nextCandidate.provider,
                toModel: nextCandidate.model,
                reason: described.reason ?? "unknown",
                errorMessage: described.message,
                statusCode: described.status,
                attemptNumber: pass * orderedCandidates.length + i + 1,
                totalCandidates: orderedCandidates.length,
                agentId,
                workspaceDir: params.agentDir,
              },
            ) as ModelFailoverHookEvent;

            const hookResult = await triggerModelFailoverHook(hookEvent);

            // Check for veto
            if (hookResult?.allow === false) {
              throw new Error(
                `Model failover vetoed: ${hookResult.vetoReason ?? "no reason provided"}`,
                { cause: err },
              );
            }

            // Check for override target
            if (hookResult?.overrideTarget) {
              const parsed = parseModelRef(hookResult.overrideTarget, candidate.provider);
              if (parsed) {
                // Insert override as next candidate
                orderedCandidates.splice(i + 1, 0, {
                  provider: parsed.provider,
                  model: parsed.model,
                });
              }
            }
          } catch (hookErr) {
            // Re-throw veto errors
            if (hookErr instanceof Error && hookErr.message.startsWith("Model failover vetoed")) {
              throw hookErr;
            }
            // Log but don't fail for other hook errors
            console.warn(`[model-fallback] model:failover hook error: ${String(hookErr)}`);
          }
        }
      }
    }

    if (pass < maxPasses - 1) {
      const passAttempts = attempts.slice(passStartIndex);
      const hasTransient = passAttempts.some(
        (attempt) => attempt.reason && transientReasons.has(attempt.reason),
      );
      const hasHard = passAttempts.some(
        (attempt) => attempt.reason && hardReasons.has(attempt.reason),
      );
      if (hasTransient && !hasHard) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
    }
    break;
  }

  if (attempts.length <= 1 && lastError) {
    throw lastError;
  }
  const summary =
    attempts.length > 0
      ? attempts
          .map(
            (attempt) =>
              `${attempt.provider}/${attempt.model}: ${attempt.error}${
                attempt.reason ? ` (${attempt.reason})` : ""
              }`,
          )
          .join(" | ")
      : "unknown";
  throw new Error(
    `All models failed (${attempts.length || orderedCandidates.length}): ${summary}`,
    {
      cause: lastError instanceof Error ? lastError : undefined,
    },
  );
}

export async function runWithImageModelFallback<T>(params: {
  cfg: OpenClawConfig | undefined;
  modelOverride?: string;
  run: (provider: string, model: string) => Promise<T>;
  onError?: (attempt: {
    provider: string;
    model: string;
    error: unknown;
    attempt: number;
    total: number;
  }) => void | Promise<void>;
}): Promise<{
  result: T;
  provider: string;
  model: string;
  attempts: FallbackAttempt[];
}> {
  const candidates = resolveImageFallbackCandidates({
    cfg: params.cfg,
    defaultProvider: DEFAULT_PROVIDER,
    modelOverride: params.modelOverride,
  });
  if (candidates.length === 0) {
    throw new Error(
      "No image model configured. Set agents.defaults.imageModel.primary or agents.defaults.imageModel.fallbacks.",
    );
  }

  const attempts: FallbackAttempt[] = [];
  let lastError: unknown;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      const result = await params.run(candidate.provider, candidate.model);
      return {
        result,
        provider: candidate.provider,
        model: candidate.model,
        attempts,
      };
    } catch (err) {
      if (shouldRethrowAbort(err)) {
        throw err;
      }
      lastError = err;
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        error: err instanceof Error ? err.message : String(err),
      });
      await params.onError?.({
        provider: candidate.provider,
        model: candidate.model,
        error: err,
        attempt: i + 1,
        total: candidates.length,
      });
    }
  }

  if (attempts.length <= 1 && lastError) {
    throw lastError;
  }
  const summary =
    attempts.length > 0
      ? attempts
          .map((attempt) => `${attempt.provider}/${attempt.model}: ${attempt.error}`)
          .join(" | ")
      : "unknown";
  throw new Error(`All image models failed (${attempts.length || candidates.length}): ${summary}`, {
    cause: lastError instanceof Error ? lastError : undefined,
  });
}
