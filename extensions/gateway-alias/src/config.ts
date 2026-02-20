/**
 * Configuration for the gateway-alias plugin.
 */
export type GatewayAliasConfig = {
  /** Map of hostname alias → gateway port. E.g. { "hal": 18789, "sam": 19789 } */
  aliases: Record<string, number>;
  /** Port the reverse proxy listens on (default: 80). */
  port: number;
  /** Bind address for the proxy (default: 127.0.0.1). */
  bind: string;
  /** Whether to manage /etc/hosts entries (default: true). */
  manageHosts: boolean;
};

const DEFAULT_PORT = 80;
const DEFAULT_BIND = "127.0.0.1";

/**
 * Parse and validate plugin config from the raw config object.
 */
export function resolveConfig(raw: Record<string, unknown> | undefined): GatewayAliasConfig {
  const input = raw ?? {};

  const aliases: Record<string, number> = {};
  if (input.aliases && typeof input.aliases === "object" && !Array.isArray(input.aliases)) {
    for (const [key, value] of Object.entries(input.aliases as Record<string, unknown>)) {
      const hostname = key.trim().toLowerCase();
      if (!hostname) continue;
      const port = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(port) && port >= 1 && port <= 65535) {
        aliases[hostname] = Math.floor(port);
      }
    }
  }

  const port =
    typeof input.port === "number" && Number.isFinite(input.port) && input.port >= 1
      ? Math.floor(input.port as number)
      : DEFAULT_PORT;

  const bind =
    typeof input.bind === "string" && input.bind.trim().length > 0
      ? input.bind.trim()
      : DEFAULT_BIND;

  const manageHosts = input.manageHosts !== false;

  return { aliases, port, bind, manageHosts };
}
