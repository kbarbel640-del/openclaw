import type { AuthProfileCredential } from "../agents/auth-profiles/types.js";
import type { OpenClawConfig } from "../config/config.js";
import type { ProviderAuthResult } from "../plugins/types.js";

/**
 * @description Constructs a {@link ProviderAuthResult} for an OAuth-based AI
 * provider. Generates a profile ID in the form `<profilePrefix>:<email|"default">`,
 * stores the access (and optional refresh) tokens as an `"oauth"` credential,
 * and produces a default config patch that registers the provider's model
 * unless the caller supplies a custom `configPatch`.
 *
 * @param params.providerId - Unique provider identifier (e.g. `"google-gemini"`).
 * @param params.defaultModel - Model identifier to activate by default (e.g.
 *   `"gemini-2.0-flash"`).
 * @param params.access - OAuth access token.
 * @param params.refresh - Optional OAuth refresh token.
 * @param params.expires - Optional UNIX timestamp (seconds) when the access
 *   token expires.
 * @param params.email - Optional authenticated email used to build the profile
 *   ID.
 * @param params.profilePrefix - Prefix for the generated profile ID; defaults
 *   to `providerId`.
 * @param params.credentialExtra - Optional extra fields merged into the
 *   credential object.
 * @param params.configPatch - Optional config patch to apply after
 *   authentication; overrides the default model-registration patch.
 * @param params.notes - Optional informational notes shown to the user after
 *   login.
 * @returns A {@link ProviderAuthResult} ready to be returned from a provider's
 *   `authenticate` method.
 *
 * @example
 * ```ts
 * return buildOauthProviderAuthResult({
 *   providerId: "my-provider",
 *   defaultModel: "my-provider:chat",
 *   access: tokens.accessToken,
 *   refresh: tokens.refreshToken,
 *   email: userInfo.email,
 * });
 * ```
 */
export function buildOauthProviderAuthResult(params: {
  providerId: string;
  defaultModel: string;
  access: string;
  refresh?: string | null;
  expires?: number | null;
  email?: string | null;
  profilePrefix?: string;
  credentialExtra?: Record<string, unknown>;
  configPatch?: Partial<OpenClawConfig>;
  notes?: string[];
}): ProviderAuthResult {
  const email = params.email ?? undefined;
  const profilePrefix = params.profilePrefix ?? params.providerId;
  const profileId = `${profilePrefix}:${email ?? "default"}`;

  const credential: AuthProfileCredential = {
    type: "oauth",
    provider: params.providerId,
    access: params.access,
    ...(params.refresh ? { refresh: params.refresh } : {}),
    ...(Number.isFinite(params.expires) ? { expires: params.expires as number } : {}),
    ...(email ? { email } : {}),
    ...params.credentialExtra,
  } as AuthProfileCredential;

  return {
    profiles: [{ profileId, credential }],
    configPatch:
      params.configPatch ??
      ({
        agents: {
          defaults: {
            models: {
              [params.defaultModel]: {},
            },
          },
        },
      } as Partial<OpenClawConfig>),
    defaultModel: params.defaultModel,
    notes: params.notes,
  };
}
