/**
 * @description Normalizes a raw webhook path string: trims whitespace, ensures
 * a leading `/`, and removes a trailing `/` (except for the root `/`).
 *
 * @param raw - The raw path string to normalize (e.g. `"webhooks/my-bot/"`).
 * @returns The normalized path (e.g. `"/webhooks/my-bot"`), or `"/"` when the
 *   input is empty or whitespace-only.
 *
 * @example
 * ```ts
 * normalizeWebhookPath("webhooks/slack/");  // "/webhooks/slack"
 * normalizeWebhookPath("/webhook");         // "/webhook"
 * normalizeWebhookPath("");                 // "/"
 * ```
 */
export function normalizeWebhookPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "/";
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

/**
 * @description Resolves the effective webhook path from a prioritized set of
 * inputs: an explicit path string takes precedence, then the pathname parsed
 * from a full webhook URL, then a caller-supplied default.
 *
 * @param params.webhookPath - Explicit path string (highest priority).
 * @param params.webhookUrl - Full webhook URL whose pathname is extracted when
 *   no explicit path is given.
 * @param params.defaultPath - Fallback path (or `null`) used when neither of
 *   the above is provided.
 * @returns The normalized webhook path, or `null` if no usable value is found.
 *
 * @example
 * ```ts
 * resolveWebhookPath({ webhookPath: "/my/path" });
 * // "/my/path"
 *
 * resolveWebhookPath({ webhookUrl: "https://example.com/hooks/bot" });
 * // "/hooks/bot"
 *
 * resolveWebhookPath({ defaultPath: "/default" });
 * // "/default"
 * ```
 */
export function resolveWebhookPath(params: {
  webhookPath?: string;
  webhookUrl?: string;
  defaultPath?: string | null;
}): string | null {
  const trimmedPath = params.webhookPath?.trim();
  if (trimmedPath) {
    return normalizeWebhookPath(trimmedPath);
  }
  if (params.webhookUrl?.trim()) {
    try {
      const parsed = new URL(params.webhookUrl);
      return normalizeWebhookPath(parsed.pathname || "/");
    } catch {
      return null;
    }
  }
  return params.defaultPath ?? null;
}
