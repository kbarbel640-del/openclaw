import type { SignalApiMode } from "../config/types.signal.js";
import { detectSignalApiMode, checkAdapter } from "./client-adapter.js";

export type SignalProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs: number;
  version?: string | null;
  apiMode?: SignalApiMode | null;
};

/**
 * Probe Signal API availability, detecting which mode is available.
 * If apiMode is specified, only that mode is checked.
 * If apiMode is "auto" or not specified, both modes are probed.
 */
export async function probeSignal(
  baseUrl: string,
  timeoutMs: number,
  apiMode?: SignalApiMode,
): Promise<SignalProbe> {
  const started = Date.now();
  const result: SignalProbe = {
    ok: false,
    status: null,
    error: null,
    elapsedMs: 0,
    version: null,
    apiMode: null,
  };

  // If specific mode requested, check only that mode
  if (apiMode && apiMode !== "auto") {
    const check = await checkAdapter(baseUrl, apiMode, timeoutMs);
    if (!check.ok) {
      return {
        ...result,
        status: check.status ?? null,
        error: check.error ?? "unreachable",
        elapsedMs: Date.now() - started,
      };
    }
    return {
      ...result,
      ok: true,
      status: check.status ?? null,
      apiMode,
      version: apiMode === "container" ? "bbernhard/signal-cli-rest-api" : "signal-cli",
      elapsedMs: Date.now() - started,
    };
  }

  // Auto-detect mode by probing both endpoints
  try {
    const detectedMode = await detectSignalApiMode(baseUrl, timeoutMs);
    const check = await checkAdapter(baseUrl, detectedMode, timeoutMs);
    return {
      ...result,
      ok: check.ok,
      status: check.status ?? null,
      apiMode: detectedMode,
      version: detectedMode === "container" ? "bbernhard/signal-cli-rest-api" : "signal-cli",
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    // Neither endpoint responded
    return {
      ...result,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started,
    };
  }
}
