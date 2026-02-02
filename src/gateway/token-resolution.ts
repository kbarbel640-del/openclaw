/**
 * Shared gateway token resolution.
 * Used by both gateway server and TUI client to ensure consistent token handling.
 *
 * Precedence (highest to lowest):
 *   1. CLI argument (when provided)
 *   2. Config file (gateway.auth.token)
 *   3. Environment variable (CLAWDBOT_GATEWAY_TOKEN)
 */

export type TokenResolutionParams = {
  /** Token from CLI argument (--token) */
  cliToken?: string;
  /** Token from config file (gateway.auth.token) */
  configToken?: string;
  /** Environment variables (defaults to process.env) */
  env?: NodeJS.ProcessEnv;
};

export type ResolvedToken = {
  token: string | undefined;
  source: "cli" | "config" | "env" | "none";
};

/**
 * Resolve gateway token with consistent precedence.
 *
 * @param params - Token resolution parameters
 * @returns Resolved token and its source
 */
export function resolveGatewayToken(params: TokenResolutionParams): ResolvedToken {
  const env = params.env ?? process.env;

  // 1. CLI argument takes priority
  const cliToken = params.cliToken?.trim();
  if (cliToken && cliToken.length > 0) {
    return { token: cliToken, source: "cli" };
  }

  // 2. Config file (gateway.auth.token)
  const configToken = params.configToken?.trim();
  if (configToken && configToken.length > 0) {
    return { token: configToken, source: "config" };
  }

  // 3. Environment variable
  const envToken = env.CLAWDBOT_GATEWAY_TOKEN?.trim();
  if (envToken && envToken.length > 0) {
    return { token: envToken, source: "env" };
  }

  return { token: undefined, source: "none" };
}

/**
 * Generate a hint for debugging token mismatch errors.
 * Shows which source the token came from.
 */
export function formatTokenSourceHint(source: ResolvedToken["source"]): string {
  switch (source) {
    case "cli":
      return "from CLI --token argument";
    case "config":
      return "from gateway.auth.token config";
    case "env":
      return "from CLAWDBOT_GATEWAY_TOKEN env var";
    case "none":
      return "no token configured";
  }
}

/**
 * Resolve gateway password with consistent precedence.
 * Password precedence mirrors token precedence.
 */
export type PasswordResolutionParams = {
  /** Password from CLI argument (--password) */
  cliPassword?: string;
  /** Password from config file (gateway.auth.password) */
  configPassword?: string;
  /** Environment variables (defaults to process.env) */
  env?: NodeJS.ProcessEnv;
};

export type ResolvedPassword = {
  password: string | undefined;
  source: "cli" | "config" | "env" | "none";
};

export function resolveGatewayPassword(params: PasswordResolutionParams): ResolvedPassword {
  const env = params.env ?? process.env;

  // 1. CLI argument takes priority
  const cliPassword = params.cliPassword?.trim();
  if (cliPassword && cliPassword.length > 0) {
    return { password: cliPassword, source: "cli" };
  }

  // 2. Config file (gateway.auth.password)
  const configPassword = params.configPassword?.trim();
  if (configPassword && configPassword.length > 0) {
    return { password: configPassword, source: "config" };
  }

  // 3. Environment variable
  const envPassword = env.CLAWDBOT_GATEWAY_PASSWORD?.trim();
  if (envPassword && envPassword.length > 0) {
    return { password: envPassword, source: "env" };
  }

  return { password: undefined, source: "none" };
}
