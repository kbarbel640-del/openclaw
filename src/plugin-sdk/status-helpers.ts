import type { ChannelStatusIssue } from "../channels/plugins/types.js";

type RuntimeLifecycleSnapshot = {
  running?: boolean | null;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
};

/**
 * @description Creates an initial runtime state object for a channel account,
 * with all lifecycle fields set to their idle defaults (`running: false`,
 * timestamps `null`). Callers can supply additional properties via `extra`
 * which are merged into the returned object.
 *
 * @param accountId - The account identifier this state belongs to.
 * @param extra - Optional additional fields to merge into the default state.
 * @returns A new runtime state object with `accountId`, `running: false`,
 *   `lastStartAt: null`, `lastStopAt: null`, `lastError: null`, and any
 *   fields from `extra`.
 *
 * @example
 * ```ts
 * const state = createDefaultChannelRuntimeState("default", { botId: null });
 * // { accountId: "default", running: false, lastStartAt: null, ..., botId: null }
 * ```
 */
export function createDefaultChannelRuntimeState<T extends Record<string, unknown>>(
  accountId: string,
  extra?: T,
): {
  accountId: string;
  running: false;
  lastStartAt: null;
  lastStopAt: null;
  lastError: null;
} & T {
  return {
    accountId,
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null,
    ...(extra ?? ({} as T)),
  };
}

/**
 * @description Builds a minimal channel status summary from a partial runtime
 * snapshot. Absent or `null` fields are coerced to safe defaults (`false` for
 * booleans, `null` for nullable timestamps/strings).
 *
 * @param snapshot - Partial runtime snapshot containing lifecycle fields.
 * @returns A normalized summary object with `configured`, `running`,
 *   `lastStartAt`, `lastStopAt`, and `lastError` fields.
 */
export function buildBaseChannelStatusSummary(snapshot: {
  configured?: boolean | null;
  running?: boolean | null;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
}) {
  return {
    configured: snapshot.configured ?? false,
    running: snapshot.running ?? false,
    lastStartAt: snapshot.lastStartAt ?? null,
    lastStopAt: snapshot.lastStopAt ?? null,
    lastError: snapshot.lastError ?? null,
  };
}

/**
 * @description Builds a complete per-account status snapshot by merging static
 * account config fields with dynamic runtime lifecycle state and an optional
 * probe result.
 *
 * @param params.account - Static account descriptor (id, name, enabled, configured).
 * @param params.runtime - Current runtime lifecycle snapshot, or `null`/`undefined`
 *   when the channel has never started.
 * @param params.probe - Arbitrary probe result attached to the snapshot as-is.
 * @returns A flat snapshot object suitable for inclusion in channel status
 *   API responses.
 */
export function buildBaseAccountStatusSnapshot(params: {
  account: {
    accountId: string;
    name?: string;
    enabled?: boolean;
    configured?: boolean;
  };
  runtime?: RuntimeLifecycleSnapshot | null;
  probe?: unknown;
}) {
  const { account, runtime, probe } = params;
  return {
    accountId: account.accountId,
    name: account.name,
    enabled: account.enabled,
    configured: account.configured,
    running: runtime?.running ?? false,
    lastStartAt: runtime?.lastStartAt ?? null,
    lastStopAt: runtime?.lastStopAt ?? null,
    lastError: runtime?.lastError ?? null,
    probe,
    lastInboundAt: runtime?.lastInboundAt ?? null,
    lastOutboundAt: runtime?.lastOutboundAt ?? null,
  };
}

/**
 * @description Extends {@link buildBaseChannelStatusSummary} with fields
 * common to token-authenticated channels: `tokenSource`, `probe`,
 * `lastProbeAt`, and optionally `mode`.
 *
 * @param snapshot - Partial runtime snapshot including token-auth fields.
 * @param opts.includeMode - When explicitly `false`, the `mode` field is
 *   omitted from the result (defaults to included).
 * @returns A normalized token-channel status summary object.
 */
export function buildTokenChannelStatusSummary(
  snapshot: {
    configured?: boolean | null;
    tokenSource?: string | null;
    running?: boolean | null;
    mode?: string | null;
    lastStartAt?: number | null;
    lastStopAt?: number | null;
    lastError?: string | null;
    probe?: unknown;
    lastProbeAt?: number | null;
  },
  opts?: { includeMode?: boolean },
) {
  const base = {
    ...buildBaseChannelStatusSummary(snapshot),
    tokenSource: snapshot.tokenSource ?? "none",
    probe: snapshot.probe,
    lastProbeAt: snapshot.lastProbeAt ?? null,
  };
  if (opts?.includeMode === false) {
    return base;
  }
  return {
    ...base,
    mode: snapshot.mode ?? null,
  };
}

/**
 * @description Scans a list of account runtime states and returns a
 * {@link ChannelStatusIssue} for every account that has a non-empty
 * `lastError` string.
 *
 * @param channel - The channel identifier included in each emitted issue.
 * @param accounts - Array of per-account runtime objects. Only the
 *   `accountId` and `lastError` fields are used.
 * @returns An array of `ChannelStatusIssue` records (may be empty if no
 *   accounts have errors).
 */
export function collectStatusIssuesFromLastError(
  channel: string,
  accounts: Array<{ accountId: string; lastError?: unknown }>,
): ChannelStatusIssue[] {
  return accounts.flatMap((account) => {
    const lastError = typeof account.lastError === "string" ? account.lastError.trim() : "";
    if (!lastError) {
      return [];
    }
    return [
      {
        channel,
        accountId: account.accountId,
        kind: "runtime",
        message: `Channel error: ${lastError}`,
      },
    ];
  });
}
