import type { GatewayBrowserClient } from "../gateway.ts";
import type { ClosestUsageWindow } from "./models-availability.ts";

export type UsageState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  usageLoading: boolean;
  usageError: string | null;
  usageStatus: unknown;
  usageCost: unknown;
  usagePeriod: "24h" | "7d" | "30d" | "all";
};

type UsageStatusResponse = {
  providers?: Array<{
    provider?: string;
    windows?: Array<{ label?: string; usedPercent?: number; resetAt?: number }>;
  }>;
};

function pickClosestUsageWindow(
  windows: Array<{ label?: string; usedPercent?: number; resetAt?: number }> | undefined,
  now: number,
): ClosestUsageWindow | null {
  if (!Array.isArray(windows) || windows.length === 0) {
    return null;
  }

  let best: ClosestUsageWindow | null = null;
  for (const w of windows) {
    const label = typeof w?.label === "string" ? w.label : "";
    const usedRaw = typeof w?.usedPercent === "number" ? w.usedPercent : NaN;
    if (!Number.isFinite(usedRaw)) {
      continue;
    }
    const usedPercent = Math.min(100, Math.max(0, usedRaw));
    const resetAt = typeof w?.resetAt === "number" ? w.resetAt : null;
    const resetRemainingMs = resetAt ? Math.max(0, resetAt - now) : null;

    const candidate: ClosestUsageWindow = {
      label: label || "Quota",
      usedPercent,
      resetAt,
      resetRemainingMs,
    };

    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.usedPercent > best.usedPercent) {
      best = candidate;
      continue;
    }

    if (candidate.usedPercent === best.usedPercent) {
      const a = candidate.resetRemainingMs;
      const b = best.resetRemainingMs;
      // Tie-breaker: prefer whichever resets sooner (more "urgent" to watch).
      if (typeof a === "number" && typeof b === "number" && a < b) {
        best = candidate;
        continue;
      }
      if (typeof a === "number" && b === null) {
        best = candidate;
        continue;
      }
    }
  }

  return best;
}

function computeClosestUsageByProvider(status: unknown): Record<string, ClosestUsageWindow | null> {
  const data = status as UsageStatusResponse | null;
  const providers = Array.isArray(data?.providers) ? data?.providers : [];
  const now = Date.now();
  const out: Record<string, ClosestUsageWindow | null> = {};
  for (const p of providers) {
    const id = typeof p?.provider === "string" ? p.provider.trim().toLowerCase() : "";
    if (!id) {
      continue;
    }
    out[id] = pickClosestUsageWindow(p.windows, now);
  }
  return out;
}

function tickClosestUsageCountdown(
  closest: Record<string, ClosestUsageWindow | null>,
  now = Date.now(),
): Record<string, ClosestUsageWindow | null> {
  let changed = false;
  const next: Record<string, ClosestUsageWindow | null> = {};
  for (const [k, w] of Object.entries(closest)) {
    if (!w || w.resetAt == null) {
      next[k] = w;
      continue;
    }
    const remaining = Math.max(0, w.resetAt - now);
    if (remaining !== w.resetRemainingMs) {
      changed = true;
      next[k] = { ...w, resetRemainingMs: remaining };
      continue;
    }
    next[k] = w;
  }
  return changed ? next : closest;
}

export async function loadUsage(state: UsageState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.usageLoading) {
    return;
  }
  state.usageLoading = true;
  state.usageError = null;
  try {
    const res = await state.client.request("usage.status", {
      period: state.usagePeriod,
    });
    state.usageStatus = res;
  } catch (err) {
    state.usageError = String(err);
  } finally {
    state.usageLoading = false;
  }
}

export async function loadUsageCost(state: UsageState) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request("usage.cost", {
      period: state.usagePeriod,
    });
    state.usageCost = res;
  } catch {
    // Cost endpoint is optional; don't overwrite main error
  }
}

// --- Composer usage bars (always-on polling) ---

export type UsagePollHost = UsageState & {
  // Used by the chat composer quota bars.
  closestUsageByProvider: Record<string, ClosestUsageWindow | null>;
};

let pollInterval: ReturnType<typeof setInterval> | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;

function syncClosestUsage(host: UsagePollHost) {
  host.closestUsageByProvider = computeClosestUsageByProvider(host.usageStatus);
}

export function startUsagePolling(host: UsagePollHost): void {
  stopUsagePolling();
  void loadUsage(host).then(() => syncClosestUsage(host));

  // Pull fresh usage windows regularly so the bar reflects real consumption (same as /usage).
  pollInterval = setInterval(() => {
    if (!host.connected) {
      return;
    }
    void loadUsage(host).then(() => syncClosestUsage(host));
  }, 15_000);

  // Keep "resets in ..." countdown smooth even between polls.
  countdownInterval = setInterval(() => {
    if (!host.connected) {
      return;
    }
    host.closestUsageByProvider = tickClosestUsageCountdown(host.closestUsageByProvider);
  }, 1000);
}

export function stopUsagePolling(): void {
  if (pollInterval != null) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (countdownInterval != null) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}
