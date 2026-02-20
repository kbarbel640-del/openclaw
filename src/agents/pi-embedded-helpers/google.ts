import { sanitizeGoogleTurnOrdering } from "./bootstrap.js";

const ANTIGRAVITY_MIN_VERSION = [1, 18, 0] as const;

function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    return null;
  }
  const major = Number.parseInt(match[1] ?? "", 10);
  const minor = Number.parseInt(match[2] ?? "", 10);
  const patch = Number.parseInt(match[3] ?? "", 10);
  if (![major, minor, patch].every((value) => Number.isFinite(value) && value >= 0)) {
    return null;
  }
  return [major, minor, patch];
}

function isAtLeastVersion(
  current: [number, number, number],
  minimum: readonly [number, number, number],
): boolean {
  if (current[0] !== minimum[0]) {
    return current[0] > minimum[0];
  }
  if (current[1] !== minimum[1]) {
    return current[1] > minimum[1];
  }
  return current[2] >= minimum[2];
}

export function isGoogleModelApi(api?: string | null): boolean {
  return (
    api === "google-gemini-cli" || api === "google-generative-ai" || api === "google-antigravity"
  );
}

export function isAntigravityClaude(params: {
  api?: string | null;
  provider?: string | null;
  modelId?: string;
}): boolean {
  const provider = params.provider?.toLowerCase();
  const api = params.api?.toLowerCase();
  if (provider !== "google-antigravity" && api !== "google-antigravity") {
    return false;
  }
  return params.modelId?.toLowerCase().includes("claude") ?? false;
}

export function ensureMinAntigravityVersion(params: {
  provider?: string | null;
  modelId?: string | null;
}): void {
  if (params.provider?.toLowerCase() !== "google-antigravity") {
    return;
  }
  if (!params.modelId?.toLowerCase().includes("gemini-3.1")) {
    return;
  }

  const current = process.env.PI_AI_ANTIGRAVITY_VERSION;
  const parsed = current ? parseSemver(current) : null;
  if (parsed && isAtLeastVersion(parsed, ANTIGRAVITY_MIN_VERSION)) {
    return;
  }
  process.env.PI_AI_ANTIGRAVITY_VERSION = ANTIGRAVITY_MIN_VERSION.join(".");
}

export { sanitizeGoogleTurnOrdering };
