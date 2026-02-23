import type { AcpSessionRuntimeOptions, SessionAcpMeta } from "../../config/sessions/types.js";

export function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function normalizeRuntimeOptions(
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

export function mergeRuntimeOptions(params: {
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

export function resolveRuntimeOptionsFromMeta(meta: SessionAcpMeta): AcpSessionRuntimeOptions {
  const normalized = normalizeRuntimeOptions(meta.runtimeOptions);
  if (normalized.cwd || !meta.cwd) {
    return normalized;
  }
  return normalizeRuntimeOptions({
    ...normalized,
    cwd: meta.cwd,
  });
}

export function runtimeOptionsEqual(
  a: AcpSessionRuntimeOptions | undefined,
  b: AcpSessionRuntimeOptions | undefined,
): boolean {
  return JSON.stringify(normalizeRuntimeOptions(a)) === JSON.stringify(normalizeRuntimeOptions(b));
}

export function buildRuntimeControlSignature(options: AcpSessionRuntimeOptions): string {
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

export function buildRuntimeConfigOptionPairs(
  options: AcpSessionRuntimeOptions,
): Array<[string, string]> {
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

export function inferRuntimeOptionPatchFromConfigOption(
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
