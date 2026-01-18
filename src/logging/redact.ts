import { createRequire } from "node:module";

import type { ClawdbotConfig } from "../config/config.js";
import {
  getDefaultRedactPatterns,
  redactSensitiveText as redactSensitiveTextCore,
  type RedactOptions,
  type RedactSensitiveMode,
} from "../security/secret-scan/redact.js";

const requireConfig = createRequire(import.meta.url);

export type { RedactOptions, RedactSensitiveMode };
export { getDefaultRedactPatterns };

function resolveConfigRedaction(): RedactOptions {
  let cfg: ClawdbotConfig["logging"] | undefined;
  try {
    const loaded = requireConfig("../config/config.js") as {
      loadConfig?: () => ClawdbotConfig;
    };
    cfg = loaded.loadConfig?.().logging;
  } catch {
    cfg = undefined;
  }
  return {
    mode: cfg?.redactSensitive,
    patterns: cfg?.redactPatterns,
  };
}

export function redactSensitiveText(text: string, options?: RedactOptions): string {
  const resolved = options ?? resolveConfigRedaction();
  return redactSensitiveTextCore(text, resolved);
}

export function redactToolDetail(detail: string): string {
  const resolved = resolveConfigRedaction();
  const mode = resolved.mode === "off" ? "off" : "tools";
  if (mode !== "tools") return detail;
  return redactSensitiveText(detail, resolved);
}
