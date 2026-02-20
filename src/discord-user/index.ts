export { resolveDiscordUserToken, normalizeDiscordUserToken } from "./token.js";
export type { DiscordUserTokenResolution } from "./token.js";

export { buildStealthFingerprint, resolveTypingDelay, resolveActionJitter } from "./stealth.js";
export type { StealthFingerprint, StealthConfig, StealthProperties } from "./stealth.js";

export {
  resolveDiscordUserAccount,
  listDiscordUserAccountIds,
  resolveDefaultDiscordUserAccountId,
  listEnabledDiscordUserAccounts,
} from "./accounts.js";
export type { ResolvedDiscordUserAccount, DiscordUserAccountConfig } from "./accounts.js";

export { createDiscordUserRestClient } from "./rest.js";
export type { DiscordUserRestClient } from "./rest.js";

export { probeDiscordUser } from "./probe.js";
export type { DiscordUserProbe } from "./probe.js";

export { DiscordUserGateway } from "./gateway.js";
export type { GatewayReadyData } from "./gateway.js";

export { sendDiscordUserMessage } from "./send.js";

export { shouldSkipCrossChannelDuplicate } from "./monitor/cross-channel-dedupe.js";
