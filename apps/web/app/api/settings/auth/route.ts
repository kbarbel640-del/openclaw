import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveConfigPath(): string {
  const envPath = process.env.OPENCLAW_CONFIG;
  if (envPath) {return envPath;}
  return join(homedir(), ".openclaw", "openclaw.json");
}

function readConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) {return {};}
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(configPath: string, config: Record<string, unknown>): void {
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * POST /api/settings/auth
 *
 * Body: { provider: string, authMethod: string, apiKey?: string }
 *
 * Writes the API key into the correct location in openclaw.json's
 * models.providers section, mirroring how the CLI stores credentials.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, authMethod, apiKey } = body as {
      provider?: string;
      authMethod?: string;
      apiKey?: string;
    };

    if (!provider || !authMethod) {
      return NextResponse.json(
        { error: "provider and authMethod are required" },
        { status: 400 },
      );
    }

    if (!apiKey || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: "apiKey is required" },
        { status: 400 },
      );
    }

    const configPath = resolveConfigPath();
    const config = readConfig(configPath);

    // Resolve the provider key used in models.providers.
    // This mirrors the CLI's onboard-auth.ts provider mapping.
    const providerKeyMap: Record<string, string> = {
      "openai-api-key": "openai",
      "apiKey": "anthropic",
      "gemini-api-key": "google-generative-ai",
      "xai-api-key": "xai",
      "openrouter-api-key": "openrouter",
      "ai-gateway-api-key": "ai-gateway",
      "moonshot-api-key": "moonshot",
      "moonshot-api-key-cn": "moonshot",
      "kimi-code-api-key": "kimi-coding",
      "together-api-key": "together",
      "huggingface-api-key": "huggingface",
      "venice-api-key": "venice",
      "litellm-api-key": "litellm",
      "synthetic-api-key": "synthetic",
      "xiaomi-api-key": "xiaomi",
      "cloudflare-ai-gateway-api-key": "cloudflare-ai-gateway",
      "opencode-zen": "opencode-zen",
      "qianfan-api-key": "qianfan",
      "custom-api-key": "custom",
    };

    const providerKey = providerKeyMap[authMethod] ?? provider;

    // Ensure models.providers exists
    if (!config.models || typeof config.models !== "object") {
      config.models = {};
    }
    const models = config.models as Record<string, unknown>;
    if (!models.providers || typeof models.providers !== "object") {
      models.providers = {};
    }
    const providers = models.providers as Record<string, Record<string, unknown>>;

    // Create or update provider entry
    if (!providers[providerKey] || typeof providers[providerKey] !== "object") {
      providers[providerKey] = {};
    }
    providers[providerKey].apiKey = apiKey.trim();

    // Also update auth profile (mirrors CLI behavior)
    if (!config.auth || typeof config.auth !== "object") {
      config.auth = {};
    }
    const auth = config.auth as Record<string, unknown>;
    if (!auth.profiles || typeof auth.profiles !== "object") {
      auth.profiles = {};
    }
    const profiles = auth.profiles as Record<string, unknown>;
    profiles[`${providerKey}:default`] = {
      provider: providerKey,
      mode: "api_key",
    };

    writeConfig(configPath, config);

    return NextResponse.json({
      ok: true,
      provider: providerKey,
      configPath,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save auth config: ${String(err)}` },
      { status: 500 },
    );
  }
}
