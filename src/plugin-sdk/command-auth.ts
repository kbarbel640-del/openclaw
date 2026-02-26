import type { OpenClawConfig } from "../config/config.js";

export type ResolveSenderCommandAuthorizationParams = {
  cfg: OpenClawConfig;
  rawBody: string;
  isGroup: boolean;
  dmPolicy: string;
  configuredAllowFrom: string[];
  senderId: string;
  isSenderAllowed: (senderId: string, allowFrom: string[]) => boolean;
  readAllowFromStore: () => Promise<string[]>;
  shouldComputeCommandAuthorized: (rawBody: string, cfg: OpenClawConfig) => boolean;
  resolveCommandAuthorizedFromAuthorizers: (params: {
    useAccessGroups: boolean;
    authorizers: Array<{ configured: boolean; allowed: boolean }>;
  }) => boolean;
};

/**
 * @description Resolves whether a sender is authorized to run a command.
 * Combines the configured allowlist with a store-backed allowlist (for DM
 * policies that are not strictly `"allowlist"`), then delegates to
 * `resolveCommandAuthorizedFromAuthorizers` to produce the final boolean.
 *
 * The function short-circuits and returns `commandAuthorized: undefined` when
 * the message body does not look like a command invocation according to
 * `shouldComputeCommandAuthorized`.
 *
 * @param params - See {@link ResolveSenderCommandAuthorizationParams} for all
 *   required inputs.
 * @returns An object with:
 *   - `shouldComputeAuth` — whether authorization was computed for this message.
 *   - `effectiveAllowFrom` — merged allowlist (config + store) used for the check.
 *   - `senderAllowedForCommands` — whether the sender ID is in the effective list.
 *   - `commandAuthorized` — final authorization result, or `undefined` when not
 *     applicable.
 */
export async function resolveSenderCommandAuthorization(
  params: ResolveSenderCommandAuthorizationParams,
): Promise<{
  shouldComputeAuth: boolean;
  effectiveAllowFrom: string[];
  senderAllowedForCommands: boolean;
  commandAuthorized: boolean | undefined;
}> {
  const shouldComputeAuth = params.shouldComputeCommandAuthorized(params.rawBody, params.cfg);
  const storeAllowFrom =
    !params.isGroup &&
    params.dmPolicy !== "allowlist" &&
    (params.dmPolicy !== "open" || shouldComputeAuth)
      ? await params.readAllowFromStore().catch(() => [])
      : [];
  const effectiveAllowFrom = [...params.configuredAllowFrom, ...storeAllowFrom];
  const useAccessGroups = params.cfg.commands?.useAccessGroups !== false;
  const senderAllowedForCommands = params.isSenderAllowed(params.senderId, effectiveAllowFrom);
  const commandAuthorized = shouldComputeAuth
    ? params.resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups,
        authorizers: [
          { configured: effectiveAllowFrom.length > 0, allowed: senderAllowedForCommands },
        ],
      })
    : undefined;

  return {
    shouldComputeAuth,
    effectiveAllowFrom,
    senderAllowedForCommands,
    commandAuthorized,
  };
}
