import type { ConfigSource } from "./config-source.js";
import { FileConfigSource } from "./file-source.js";
import { HttpConfigSource } from "./http-source.js";

/**
 * Create a ConfigSource based on environment variables.
 *
 * OCM_CONFIG_SOURCE selects the implementation:
 *   - "metadata" → HttpConfigSource (IMDSv2-style metadata endpoint)
 *   - undefined   → FileConfigSource (local openclaw.json file)
 *
 * The "metadata" source reads OCM_METADATA_URL and OCM_METADATA_NONCE
 * from the environment. This keeps the metadata-specific env vars
 * contained here rather than scattered through server.impl.ts.
 */
export function createConfigSource(env: Record<string, string | undefined>): ConfigSource {
  const source = env.OCM_CONFIG_SOURCE;

  if (source === "metadata") {
    const metadataUrl = env.OCM_METADATA_URL || "http://169.254.169.253";
    const nonce = env.OCM_METADATA_NONCE || "";
    return new HttpConfigSource({
      url: metadataUrl,
      headers: nonce ? { "X-Metadata-Nonce": nonce } : {},
      label: "metadata",
    });
  }

  return new FileConfigSource();
}
