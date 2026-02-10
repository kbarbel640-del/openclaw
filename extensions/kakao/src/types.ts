export type KakaoAccountConfig = {
  /** Optional display name for this account (used in CLI/UI lists). */
  name?: string;
  /** If false, do not start this Kakao account. Default: true. */
  enabled?: boolean;
  /** Optional webhook path for Kakao Skill requests. */
  webhookPath?: string;
  /** Optional webhook URL (path is derived if present). */
  webhookUrl?: string;
  /** Optional Kakao bot ID for routing when multiple accounts share a path. */
  botId?: string;
  /** Direct message access policy (default: pairing). */
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  /** Allowlist for DM senders (Kakao user IDs). */
  allowFrom?: Array<string | number>;
  /** Outbound response prefix override for this channel/account. */
  responsePrefix?: string;
};

export type KakaoConfig = {
  /** Optional per-account Kakao configuration (multi-account). */
  accounts?: Record<string, KakaoAccountConfig>;
  /** Default account ID when multiple accounts are configured. */
  defaultAccount?: string;
} & KakaoAccountConfig;

export type ResolvedKakaoAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  botId?: string;
  config: KakaoAccountConfig;
};
