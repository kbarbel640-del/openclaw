export type Env = {
  SLACK_CLIENT_ID: string;
  SLACK_CLIENT_SECRET: string;
  SLACK_OAUTH_REDIRECT_URI: string;
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_GATEWAY_TOKEN: string;
  SLACK_APP_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_MODE?: "socket" | "http";
  SLACK_ACCOUNT_ID?: string;
  PORT: number;
  STATE_SECRET: string;
};

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export async function loadEnv(): Promise<Env> {
  const { randomBytes } = await import("node:crypto");

  return {
    SLACK_CLIENT_ID: requireEnv("SLACK_CLIENT_ID"),
    SLACK_CLIENT_SECRET: requireEnv("SLACK_CLIENT_SECRET"),
    SLACK_OAUTH_REDIRECT_URI: requireEnv("SLACK_OAUTH_REDIRECT_URI"),
    OPENCLAW_GATEWAY_URL: requireEnv("OPENCLAW_GATEWAY_URL"),
    OPENCLAW_GATEWAY_TOKEN: requireEnv("OPENCLAW_GATEWAY_TOKEN"),
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN || undefined,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET || undefined,
    SLACK_MODE: (process.env.SLACK_MODE as "socket" | "http") || undefined,
    SLACK_ACCOUNT_ID: process.env.SLACK_ACCOUNT_ID || undefined,
    PORT: parseInt(process.env.PORT || "9876", 10),
    STATE_SECRET: process.env.STATE_SECRET || randomBytes(32).toString("hex"),
  };
}
