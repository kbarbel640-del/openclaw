import { parseDurationMs } from "../../../cli/parse-duration.js";

export type ContextPruningToolMatch = {
  allow?: string[];
  deny?: string[];
};
export type ContextPruningMode = "off" | "cache-ttl";

export type ContextPruningSoftTrimConfig = {
  maxChars?: number;
  headChars?: number;
  tailChars?: number;
};

export type ContextPruningToolOverride = {
  softTrim?: ContextPruningSoftTrimConfig;
};

export type ContextPruningConfig = {
  mode?: ContextPruningMode;
  /** TTL to consider cache expired (duration string, default unit: minutes). */
  ttl?: string;
  keepLastAssistants?: number;
  softTrimRatio?: number;
  hardClearRatio?: number;
  minPrunableToolChars?: number;
  tools?: ContextPruningToolMatch;
  softTrim?: ContextPruningSoftTrimConfig;
  hardClear?: {
    enabled?: boolean;
    placeholder?: string;
  };
  /** Per-tool overrides keyed by tool name or glob pattern. */
  toolOverrides?: Record<string, ContextPruningToolOverride>;
};

export type EffectiveSoftTrimSettings = {
  maxChars: number;
  headChars: number;
  tailChars: number;
};

export type EffectiveContextPruningSettings = {
  mode: Exclude<ContextPruningMode, "off">;
  ttlMs: number;
  keepLastAssistants: number;
  softTrimRatio: number;
  hardClearRatio: number;
  minPrunableToolChars: number;
  tools: ContextPruningToolMatch;
  softTrim: EffectiveSoftTrimSettings;
  hardClear: {
    enabled: boolean;
    placeholder: string;
  };
  /** Per-tool softTrim overrides resolved from toolOverrides config. */
  toolOverrides: Map<string, EffectiveSoftTrimSettings>;
};

export const DEFAULT_SOFT_TRIM: EffectiveSoftTrimSettings = {
  maxChars: 4_000,
  headChars: 1_500,
  tailChars: 1_500,
};

export const DEFAULT_CONTEXT_PRUNING_SETTINGS: EffectiveContextPruningSettings = {
  mode: "cache-ttl",
  ttlMs: 5 * 60 * 1000,
  keepLastAssistants: 3,
  softTrimRatio: 0.3,
  hardClearRatio: 0.5,
  minPrunableToolChars: 50_000,
  tools: {},
  softTrim: { ...DEFAULT_SOFT_TRIM },
  hardClear: {
    enabled: true,
    placeholder: "[Old tool result content cleared]",
  },
  toolOverrides: new Map(),
};

export function computeEffectiveSettings(raw: unknown): EffectiveContextPruningSettings | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const cfg = raw as ContextPruningConfig;
  if (cfg.mode !== "cache-ttl") {
    return null;
  }

  const s: EffectiveContextPruningSettings = structuredClone(DEFAULT_CONTEXT_PRUNING_SETTINGS);
  s.mode = cfg.mode;

  if (typeof cfg.ttl === "string") {
    try {
      s.ttlMs = parseDurationMs(cfg.ttl, { defaultUnit: "m" });
    } catch {
      // keep default ttl
    }
  }

  if (typeof cfg.keepLastAssistants === "number" && Number.isFinite(cfg.keepLastAssistants)) {
    s.keepLastAssistants = Math.max(0, Math.floor(cfg.keepLastAssistants));
  }
  if (typeof cfg.softTrimRatio === "number" && Number.isFinite(cfg.softTrimRatio)) {
    s.softTrimRatio = Math.min(1, Math.max(0, cfg.softTrimRatio));
  }
  if (typeof cfg.hardClearRatio === "number" && Number.isFinite(cfg.hardClearRatio)) {
    s.hardClearRatio = Math.min(1, Math.max(0, cfg.hardClearRatio));
  }
  if (typeof cfg.minPrunableToolChars === "number" && Number.isFinite(cfg.minPrunableToolChars)) {
    s.minPrunableToolChars = Math.max(0, Math.floor(cfg.minPrunableToolChars));
  }
  if (cfg.tools) {
    s.tools = cfg.tools;
  }
  if (cfg.softTrim) {
    if (typeof cfg.softTrim.maxChars === "number" && Number.isFinite(cfg.softTrim.maxChars)) {
      s.softTrim.maxChars = Math.max(0, Math.floor(cfg.softTrim.maxChars));
    }
    if (typeof cfg.softTrim.headChars === "number" && Number.isFinite(cfg.softTrim.headChars)) {
      s.softTrim.headChars = Math.max(0, Math.floor(cfg.softTrim.headChars));
    }
    if (typeof cfg.softTrim.tailChars === "number" && Number.isFinite(cfg.softTrim.tailChars)) {
      s.softTrim.tailChars = Math.max(0, Math.floor(cfg.softTrim.tailChars));
    }
  }
  if (cfg.hardClear) {
    if (typeof cfg.hardClear.enabled === "boolean") {
      s.hardClear.enabled = cfg.hardClear.enabled;
    }
    if (typeof cfg.hardClear.placeholder === "string" && cfg.hardClear.placeholder.trim()) {
      s.hardClear.placeholder = cfg.hardClear.placeholder.trim();
    }
  }

  if (cfg.toolOverrides && typeof cfg.toolOverrides === "object") {
    for (const [toolName, override] of Object.entries(cfg.toolOverrides)) {
      if (!override || typeof override !== "object" || !override.softTrim) {
        continue;
      }
      const toolSoftTrim: EffectiveSoftTrimSettings = { ...s.softTrim };
      if (
        typeof override.softTrim.maxChars === "number" &&
        Number.isFinite(override.softTrim.maxChars)
      ) {
        toolSoftTrim.maxChars = Math.max(0, Math.floor(override.softTrim.maxChars));
      }
      if (
        typeof override.softTrim.headChars === "number" &&
        Number.isFinite(override.softTrim.headChars)
      ) {
        toolSoftTrim.headChars = Math.max(0, Math.floor(override.softTrim.headChars));
      }
      if (
        typeof override.softTrim.tailChars === "number" &&
        Number.isFinite(override.softTrim.tailChars)
      ) {
        toolSoftTrim.tailChars = Math.max(0, Math.floor(override.softTrim.tailChars));
      }
      s.toolOverrides.set(toolName.toLowerCase().trim(), toolSoftTrim);
    }
  }

  return s;
}
