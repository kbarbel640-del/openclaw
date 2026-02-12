import type { OpenClawConfig } from "../../config/config.js";
import { normalizeAccountId } from "../../routing/session-key.js";

const MB = 1024 * 1024;

export function resolveChannelMediaMaxBytes(params: {
  cfg: OpenClawConfig;
  // Channel-specific config lives under different keys; keep this helper generic
  // so shared plugin helpers don't need channel-id branching.
  resolveChannelLimitMb: (params: { cfg: OpenClawConfig; accountId: string }) => number | undefined;
  accountId?: string | null;
}): number | undefined {
  const accountId = normalizeAccountId(params.accountId);
  const channelLimit = params.resolveChannelLimitMb({
    cfg: params.cfg,
    accountId,
  });
  if (channelLimit != null) {
    return channelLimit * MB;
  }
  const globalLimit = params.cfg.agents?.defaults?.mediaMaxMb;
  if (globalLimit != null) {
    return globalLimit * MB;
  }
  return undefined;
}
