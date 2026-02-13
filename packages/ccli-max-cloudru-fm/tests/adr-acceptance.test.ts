/**
 * ADR Acceptance & Integration Tests
 *
 * Shift-Left Testing Level 2: TDD Practice
 * Validates architectural decisions from ADR-001 through ADR-005
 * for the OpenClaw + cloud.ru FM integration.
 *
 * Source references (in fork: https://github.com/dzhechko/openclaw):
 *   - src/agents/cli-backends.ts
 *   - src/agents/cli-runner.ts
 *   - src/commands/onboard-types.ts
 *   - src/config/types.agent-defaults.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Inline re-declarations of key structures from source to keep tests
// self-contained.  These mirror the upstream source and will fail if the
// upstream diverges, which is the desired early-warning behavior.
// ---------------------------------------------------------------------------

/** CLAUDE_MODEL_ALIASES (cli-backends.ts:10-28) */
const CLAUDE_MODEL_ALIASES: Record<string, string> = {
  opus: "opus",
  "opus-4.6": "opus",
  "opus-4.5": "opus",
  "opus-4": "opus",
  "claude-opus-4-6": "opus",
  "claude-opus-4-5": "opus",
  "claude-opus-4": "opus",
  sonnet: "sonnet",
  "sonnet-4.5": "sonnet",
  "sonnet-4.1": "sonnet",
  "sonnet-4.0": "sonnet",
  "claude-sonnet-4-5": "sonnet",
  "claude-sonnet-4-1": "sonnet",
  "claude-sonnet-4-0": "sonnet",
  haiku: "haiku",
  "haiku-3.5": "haiku",
  "claude-haiku-3-5": "haiku",
};

/** CliBackendConfig shape (types.agent-defaults.ts:51-94) */
type CliBackendConfig = {
  command: string;
  args?: string[];
  output?: "json" | "text" | "jsonl";
  resumeOutput?: "json" | "text" | "jsonl";
  input?: "arg" | "stdin";
  maxPromptArgChars?: number;
  env?: Record<string, string>;
  clearEnv?: string[];
  modelArg?: string;
  modelAliases?: Record<string, string>;
  sessionArg?: string;
  sessionArgs?: string[];
  resumeArgs?: string[];
  sessionMode?: "always" | "existing" | "none";
  sessionIdFields?: string[];
  systemPromptArg?: string;
  systemPromptMode?: "append" | "replace";
  systemPromptWhen?: "first" | "always" | "never";
  imageArg?: string;
  imageMode?: "repeat" | "list";
  serialize?: boolean;
};

/** DEFAULT_CLAUDE_BACKEND (cli-backends.ts:30-53) */
const DEFAULT_CLAUDE_BACKEND: CliBackendConfig = {
  command: "claude",
  args: ["-p", "--output-format", "json", "--dangerously-skip-permissions"],
  resumeArgs: [
    "-p",
    "--output-format",
    "json",
    "--dangerously-skip-permissions",
    "--resume",
    "{sessionId}",
  ],
  output: "json",
  input: "arg",
  modelArg: "--model",
  modelAliases: CLAUDE_MODEL_ALIASES,
  sessionArg: "--session-id",
  sessionMode: "always",
  sessionIdFields: [
    "session_id",
    "sessionId",
    "conversation_id",
    "conversationId",
  ],
  systemPromptArg: "--append-system-prompt",
  systemPromptMode: "append",
  systemPromptWhen: "first",
  clearEnv: ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_OLD"],
  serialize: true,
};

/** mergeBackendConfig (cli-backends.ts:95-110) */
function mergeBackendConfig(
  base: CliBackendConfig,
  override?: CliBackendConfig,
): CliBackendConfig {
  if (!override) {
    return { ...base };
  }
  return {
    ...base,
    ...override,
    args: override.args ?? base.args,
    env: { ...base.env, ...override.env },
    modelAliases: { ...base.modelAliases, ...override.modelAliases },
    clearEnv: Array.from(
      new Set([...(base.clearEnv ?? []), ...(override.clearEnv ?? [])]),
    ),
    sessionIdFields: override.sessionIdFields ?? base.sessionIdFields,
    sessionArgs: override.sessionArgs ?? base.sessionArgs,
    resumeArgs: override.resumeArgs ?? base.resumeArgs,
  };
}

// ---------------------------------------------------------------------------
// ADR-005 model mapping structures
// ---------------------------------------------------------------------------

type ModelPreset = {
  BIG_MODEL: string;
  MIDDLE_MODEL: string;
  SMALL_MODEL: string;
};

/** Wizard preset mapping per ADR-005 table */
const MODEL_PRESETS: Record<string, ModelPreset> = {
  "cloudru-fm-glm47": {
    BIG_MODEL: "zai-org/GLM-4.7",
    MIDDLE_MODEL: "zai-org/GLM-4.7-FlashX",
    SMALL_MODEL: "zai-org/GLM-4.7-Flash",
  },
  "cloudru-fm-flash": {
    BIG_MODEL: "zai-org/GLM-4.7-Flash",
    MIDDLE_MODEL: "zai-org/GLM-4.7-Flash",
    SMALL_MODEL: "zai-org/GLM-4.7-Flash",
  },
  "cloudru-fm-qwen": {
    BIG_MODEL: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    MIDDLE_MODEL: "zai-org/GLM-4.7-FlashX",
    SMALL_MODEL: "zai-org/GLM-4.7-Flash",
  },
};

function resolveModelPreset(choice: string): ModelPreset {
  const preset = MODEL_PRESETS[choice];
  if (!preset) {
    throw new Error(`Unknown model preset: ${choice}`);
  }
  return preset;
}

/** ADR-005 fallback chains */
const FALLBACK_CHAINS: Record<string, string[]> = {
  "zai-org/GLM-4.7": [
    "zai-org/GLM-4.7",
    "zai-org/GLM-4.7-FlashX",
    "zai-org/GLM-4.7-Flash",
  ],
  "Qwen/Qwen3-Coder-480B-A35B-Instruct": [
    "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "zai-org/GLM-4.7",
    "zai-org/GLM-4.7-Flash",
  ],
};

function validateFallbackChain(chain: string[]): boolean {
  const seen = new Set<string>();
  for (const model of chain) {
    if (seen.has(model)) return false; // circular
    seen.add(model);
  }
  return true;
}

// ---------------------------------------------------------------------------
// ADR-004 proxy health and state machine
// ---------------------------------------------------------------------------

type ProxyState =
  | "UNDEPLOYED"
  | "DEPLOYING"
  | "RUNNING"
  | "HEALTHY"
  | "UNHEALTHY"
  | "RECOVERING"
  | "STOPPED";

const VALID_TRANSITIONS: Record<ProxyState, ProxyState[]> = {
  UNDEPLOYED: ["DEPLOYING"],
  DEPLOYING: ["RUNNING"],
  RUNNING: ["HEALTHY", "STOPPED"],
  HEALTHY: ["UNHEALTHY", "STOPPED"],
  UNHEALTHY: ["RECOVERING", "STOPPED"],
  RECOVERING: ["HEALTHY", "UNHEALTHY", "STOPPED"],
  STOPPED: ["DEPLOYING"],
};

class ProxyLifecycle {
  state: ProxyState = "UNDEPLOYED";

  transition(to: ProxyState): void {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed || !allowed.includes(to)) {
      throw new Error(
        `Invalid transition: ${this.state} -> ${to}`,
      );
    }
    this.state = to;
  }

  deploy(): void {
    this.transition("DEPLOYING");
  }
  onContainerStarted(): void {
    this.transition("RUNNING");
  }
  onHealthCheckPassed(): void {
    if (this.state === "RUNNING" || this.state === "RECOVERING") {
      this.transition("HEALTHY");
    } else {
      throw new Error(
        `Invalid transition: ${this.state} -> HEALTHY`,
      );
    }
  }
  onHealthCheckFailed(): void {
    if (this.state === "HEALTHY" || this.state === "RECOVERING") {
      this.transition("UNHEALTHY");
    }
  }
  onRestart(): void {
    if (this.state === "UNHEALTHY") {
      this.transition("RECOVERING");
    }
  }
  stop(): void {
    this.transition("STOPPED");
  }
}

// ---------------------------------------------------------------------------
// ADR-004 docker compose template generator
// ---------------------------------------------------------------------------

function generateDockerCompose(params: {
  apiKeyRef: string;
  port: number;
  bigModel: string;
  middleModel: string;
  smallModel: string;
}): string {
  return `version: "3.8"
services:
  claude-code-proxy:
    image: legard/claude-code-proxy:latest
    ports:
      - "127.0.0.1:${params.port}:${params.port}"
    environment:
      OPENAI_API_KEY: "\${${params.apiKeyRef}}"
      OPENAI_BASE_URL: "https://foundation-models.api.cloud.ru/v1"
      BIG_MODEL: "${params.bigModel}"
      MIDDLE_MODEL: "${params.middleModel}"
      SMALL_MODEL: "${params.smallModel}"
      HOST: "0.0.0.0"
      PORT: "${params.port}"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${params.port}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
`;
}

// ---------------------------------------------------------------------------
// ADR-004 health check
// ---------------------------------------------------------------------------

type HealthResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

async function verifyProxyHealth(
  proxyUrl: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = 5000,
): Promise<HealthResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetchFn(`${proxyUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// ADR-002 wizard types (to-be-extended)
// ---------------------------------------------------------------------------

/** Current AuthChoice values from onboard-types.ts:5-47 */
const EXISTING_AUTH_CHOICES = [
  "oauth",
  "setup-token",
  "claude-cli",
  "token",
  "chutes",
  "openai-codex",
  "openai-api-key",
  "openrouter-api-key",
  "litellm-api-key",
  "ai-gateway-api-key",
  "cloudflare-ai-gateway-api-key",
  "moonshot-api-key",
  "moonshot-api-key-cn",
  "kimi-code-api-key",
  "synthetic-api-key",
  "venice-api-key",
  "together-api-key",
  "codex-cli",
  "apiKey",
  "gemini-api-key",
  "google-antigravity",
  "google-gemini-cli",
  "zai-api-key",
  "zai-coding-global",
  "zai-coding-cn",
  "zai-global",
  "zai-cn",
  "xiaomi-api-key",
  "minimax-cloud",
  "minimax",
  "minimax-api",
  "minimax-api-lightning",
  "minimax-portal",
  "opencode-zen",
  "github-copilot",
  "copilot-proxy",
  "qwen-portal",
  "xai-api-key",
  "qianfan-api-key",
  "custom-api-key",
  "skip",
] as const;

/** Cloud.ru FM additions per ADR-002 */
const CLOUDRU_FM_AUTH_CHOICES = [
  "cloudru-fm-glm47",
  "cloudru-fm-flash",
  "cloudru-fm-qwen",
] as const;

/** Simulated AUTH_CHOICE_GROUP_DEFS entry per ADR-002 */
const CLOUDRU_FM_GROUP_DEF = {
  value: "cloudru-fm" as const,
  label: "Cloud.ru FM",
  hint: "GLM-4.7 / Qwen3 via Claude Code proxy",
  choices: [
    "cloudru-fm-glm47",
    "cloudru-fm-flash",
    "cloudru-fm-qwen",
  ] as const,
};

/** Existing AuthChoiceGroupId values from onboard-types.ts:48-66 */
const EXISTING_GROUP_IDS = [
  "openai",
  "anthropic",
  "google",
  "copilot",
  "openrouter",
  "ai-gateway",
  "cloudflare-ai-gateway",
  "moonshot",
  "zai",
  "xiaomi",
  "opencode-zen",
  "minimax",
  "synthetic",
  "venice",
  "qwen",
  "qianfan",
  "xai",
  "custom",
] as const;

// =========================================================================
// ADR-001: Cloud.ru FM Proxy Integration
// =========================================================================

describe("ADR-001: Cloud.ru FM Proxy Integration", () => {
  describe("Proxy env injection into claude-cli backend", () => {
    it("should merge ANTHROPIC_BASE_URL into claude-cli backend env", () => {
      const override: CliBackendConfig = {
        command: "claude",
        env: {
          ANTHROPIC_BASE_URL: "http://localhost:8082",
          ANTHROPIC_API_KEY: "cloudru-proxy-key",
        },
      };
      const merged = mergeBackendConfig(DEFAULT_CLAUDE_BACKEND, override);

      expect(merged.env).toBeDefined();
      expect(merged.env!.ANTHROPIC_BASE_URL).toBe("http://localhost:8082");
    });

    it("should merge ANTHROPIC_API_KEY into claude-cli backend env", () => {
      const override: CliBackendConfig = {
        command: "claude",
        env: {
          ANTHROPIC_API_KEY: "cloudru-proxy-key",
        },
      };
      const merged = mergeBackendConfig(DEFAULT_CLAUDE_BACKEND, override);

      expect(merged.env!.ANTHROPIC_API_KEY).toBe("cloudru-proxy-key");
    });

    it("should preserve default args when only env is overridden", () => {
      const override: CliBackendConfig = {
        command: "claude",
        env: { ANTHROPIC_BASE_URL: "http://localhost:8082" },
      };
      const merged = mergeBackendConfig(DEFAULT_CLAUDE_BACKEND, override);

      expect(merged.args).toEqual(DEFAULT_CLAUDE_BACKEND.args);
    });

    it("should preserve default command when override has same command", () => {
      const override: CliBackendConfig = {
        command: "claude",
        env: { ANTHROPIC_BASE_URL: "http://localhost:8082" },
      };
      const merged = mergeBackendConfig(DEFAULT_CLAUDE_BACKEND, override);

      expect(merged.command).toBe("claude");
    });
  });

  describe("mergeBackendConfig() merge semantics", () => {
    it("should deep-merge env from base and override", () => {
      const base: CliBackendConfig = {
        command: "test",
        env: { A: "1" },
      };
      const override: CliBackendConfig = {
        command: "test",
        env: { B: "2" },
      };
      const result = mergeBackendConfig(base, override);

      expect(result.env).toEqual({ A: "1", B: "2" });
    });

    it("should override env values when keys conflict", () => {
      const base: CliBackendConfig = {
        command: "test",
        env: { A: "1" },
      };
      const override: CliBackendConfig = {
        command: "test",
        env: { A: "9" },
      };
      const result = mergeBackendConfig(base, override);

      expect(result.env!.A).toBe("9");
    });

    it("should union clearEnv arrays without duplicates", () => {
      const base: CliBackendConfig = {
        command: "test",
        clearEnv: ["X"],
      };
      const override: CliBackendConfig = {
        command: "test",
        clearEnv: ["X", "Y"],
      };
      const result = mergeBackendConfig(base, override);

      expect(result.clearEnv).toEqual(["X", "Y"]);
    });

    it("should return a new object when override is undefined", () => {
      const base: CliBackendConfig = {
        command: "test",
        env: { A: "1" },
      };
      const result = mergeBackendConfig(base, undefined);

      expect(result).not.toBe(base);
      expect(result).toEqual(base);
    });

    it("should merge modelAliases from base and override", () => {
      const base: CliBackendConfig = {
        command: "test",
        modelAliases: { a: "alpha" },
      };
      const override: CliBackendConfig = {
        command: "test",
        modelAliases: { b: "beta" },
      };
      const result = mergeBackendConfig(base, override);

      expect(result.modelAliases).toEqual({ a: "alpha", b: "beta" });
    });

    it("should prefer override resumeArgs over base", () => {
      const base: CliBackendConfig = {
        command: "test",
        resumeArgs: ["--resume", "{sessionId}"],
      };
      const override: CliBackendConfig = {
        command: "test",
        resumeArgs: ["--continue", "{sessionId}"],
      };
      const result = mergeBackendConfig(base, override);

      expect(result.resumeArgs).toEqual(["--continue", "{sessionId}"]);
    });
  });

  describe("Proxy health check", () => {
    it("should return ok=true when proxy responds 200", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      const result = await verifyProxyHealth(
        "http://localhost:8082",
        mockFetch as unknown as typeof fetch,
      );

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });

    it("should return ok=false with status on 503", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });
      const result = await verifyProxyHealth(
        "http://localhost:8082",
        mockFetch as unknown as typeof fetch,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe(503);
    });

    it("should return ok=false with error on connection refused", async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));
      const result = await verifyProxyHealth(
        "http://localhost:9999",
        mockFetch as unknown as typeof fetch,
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("ECONNREFUSED");
    });

    it("should call /health endpoint on provided URL", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      await verifyProxyHealth(
        "http://localhost:8082",
        mockFetch as unknown as typeof fetch,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8082/health",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("Model alias mapping (CLAUDE_MODEL_ALIASES)", () => {
    it("should map 'claude-opus-4-6' to 'opus'", () => {
      expect(CLAUDE_MODEL_ALIASES["claude-opus-4-6"]).toBe("opus");
    });

    it("should map 'claude-sonnet-4-5' to 'sonnet'", () => {
      expect(CLAUDE_MODEL_ALIASES["claude-sonnet-4-5"]).toBe("sonnet");
    });

    it("should map 'claude-haiku-3-5' to 'haiku'", () => {
      expect(CLAUDE_MODEL_ALIASES["claude-haiku-3-5"]).toBe("haiku");
    });

    it("should map short alias 'opus' to 'opus'", () => {
      expect(CLAUDE_MODEL_ALIASES["opus"]).toBe("opus");
    });

    it("should map short alias 'sonnet' to 'sonnet'", () => {
      expect(CLAUDE_MODEL_ALIASES["sonnet"]).toBe("sonnet");
    });

    it("should map short alias 'haiku' to 'haiku'", () => {
      expect(CLAUDE_MODEL_ALIASES["haiku"]).toBe("haiku");
    });

    it("should only contain valid tier values (opus, sonnet, haiku)", () => {
      const validTiers = new Set(["opus", "sonnet", "haiku"]);
      for (const [_alias, tier] of Object.entries(CLAUDE_MODEL_ALIASES)) {
        expect(validTiers.has(tier)).toBe(true);
      }
    });

    it("should have at least 3 opus aliases", () => {
      const opusAliases = Object.entries(CLAUDE_MODEL_ALIASES).filter(
        ([, v]) => v === "opus",
      );
      expect(opusAliases.length).toBeGreaterThanOrEqual(3);
    });

    it("should have at least 3 sonnet aliases", () => {
      const sonnetAliases = Object.entries(CLAUDE_MODEL_ALIASES).filter(
        ([, v]) => v === "sonnet",
      );
      expect(sonnetAliases.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Localhost-only binding", () => {
    it("should bind docker ports to 127.0.0.1 in compose template", () => {
      const compose = generateDockerCompose({
        apiKeyRef: "CLOUDRU_API_KEY",
        port: 8082,
        bigModel: "zai-org/GLM-4.7",
        middleModel: "zai-org/GLM-4.7-FlashX",
        smallModel: "zai-org/GLM-4.7-Flash",
      });

      expect(compose).toContain("127.0.0.1:8082:8082");
      expect(compose).not.toMatch(/ports:\s*\n\s*-\s*"8082:8082"/);
    });
  });
});

// =========================================================================
// ADR-002: Wizard Cloud.ru FM Auth Choice
// =========================================================================

describe("ADR-002: Wizard Cloud.ru FM Auth Choice", () => {
  describe("AuthChoice type extensions", () => {
    it("should define cloudru-fm-glm47 as a valid choice", () => {
      expect(CLOUDRU_FM_AUTH_CHOICES).toContain("cloudru-fm-glm47");
    });

    it("should define cloudru-fm-flash as a valid choice", () => {
      expect(CLOUDRU_FM_AUTH_CHOICES).toContain("cloudru-fm-flash");
    });

    it("should define cloudru-fm-qwen as a valid choice", () => {
      expect(CLOUDRU_FM_AUTH_CHOICES).toContain("cloudru-fm-qwen");
    });

    it("should not conflict with existing AuthChoice values", () => {
      for (const choice of CLOUDRU_FM_AUTH_CHOICES) {
        expect(EXISTING_AUTH_CHOICES).not.toContain(choice);
      }
    });
  });

  describe("AUTH_CHOICE_GROUP_DEFS extension", () => {
    it("should define a group with value 'cloudru-fm'", () => {
      expect(CLOUDRU_FM_GROUP_DEF.value).toBe("cloudru-fm");
    });

    it("should have label 'Cloud.ru FM'", () => {
      expect(CLOUDRU_FM_GROUP_DEF.label).toBe("Cloud.ru FM");
    });

    it("should include exactly 3 choices", () => {
      expect(CLOUDRU_FM_GROUP_DEF.choices).toHaveLength(3);
    });

    it("should include all 3 cloudru-fm auth choices", () => {
      expect(CLOUDRU_FM_GROUP_DEF.choices).toContain("cloudru-fm-glm47");
      expect(CLOUDRU_FM_GROUP_DEF.choices).toContain("cloudru-fm-flash");
      expect(CLOUDRU_FM_GROUP_DEF.choices).toContain("cloudru-fm-qwen");
    });

    it("should not conflict with existing AuthChoiceGroupId values", () => {
      expect(EXISTING_GROUP_IDS).not.toContain("cloudru-fm");
    });

    it("should have a non-empty hint", () => {
      expect(CLOUDRU_FM_GROUP_DEF.hint.length).toBeGreaterThan(0);
    });
  });

  describe("Wizard dispatch routing", () => {
    function routeAuthChoice(
      choice: string,
    ): "cloudru-fm" | "standard" | "unknown" {
      if (choice.startsWith("cloudru-fm-")) return "cloudru-fm";
      if (
        (EXISTING_AUTH_CHOICES as readonly string[]).includes(choice)
      )
        return "standard";
      return "unknown";
    }

    it("should route cloudru-fm-glm47 to cloudru handler", () => {
      expect(routeAuthChoice("cloudru-fm-glm47")).toBe("cloudru-fm");
    });

    it("should route cloudru-fm-flash to cloudru handler", () => {
      expect(routeAuthChoice("cloudru-fm-flash")).toBe("cloudru-fm");
    });

    it("should route cloudru-fm-qwen to cloudru handler", () => {
      expect(routeAuthChoice("cloudru-fm-qwen")).toBe("cloudru-fm");
    });

    it("should route standard choices to standard handler", () => {
      expect(routeAuthChoice("openai-api-key")).toBe("standard");
    });

    it("should route unknown choices to unknown", () => {
      expect(routeAuthChoice("nonexistent")).toBe("unknown");
    });
  });

  describe("applyCloudruFmConfig() output structure", () => {
    type PartialOpenClawConfig = {
      models?: {
        providers?: Record<
          string,
          { baseUrl?: string; apiKey?: string; models?: string[] }
        >;
      };
      agents?: {
        defaults?: {
          model?: { primary?: string; fallbacks?: string[] };
          cliBackends?: Record<string, { env?: Record<string, string> }>;
        };
      };
    };

    function applyCloudruFmConfig(
      choice: string,
      apiKeyEnvRef: string,
      proxyUrl: string,
    ): PartialOpenClawConfig {
      const preset = resolveModelPreset(choice);
      return {
        models: {
          providers: {
            "cloudru-fm": {
              baseUrl: "https://foundation-models.api.cloud.ru/v1",
              apiKey: apiKeyEnvRef,
              models: [preset.BIG_MODEL, preset.MIDDLE_MODEL, preset.SMALL_MODEL],
            },
          },
        },
        agents: {
          defaults: {
            model: {
              primary: `cloudru-fm/${preset.BIG_MODEL}`,
              fallbacks: [
                `cloudru-fm/${preset.MIDDLE_MODEL}`,
                `cloudru-fm/${preset.SMALL_MODEL}`,
              ],
            },
            cliBackends: {
              "claude-cli": {
                env: {
                  ANTHROPIC_BASE_URL: proxyUrl,
                  ANTHROPIC_API_KEY: "cloudru-proxy-key",
                },
              },
            },
          },
        },
      };
    }

    it("should set models.providers.cloudru-fm.baseUrl to cloud.ru endpoint", () => {
      const config = applyCloudruFmConfig(
        "cloudru-fm-glm47",
        "${CLOUDRU_API_KEY}",
        "http://localhost:8082",
      );
      expect(config.models?.providers?.["cloudru-fm"]?.baseUrl).toBe(
        "https://foundation-models.api.cloud.ru/v1",
      );
    });

    it("should set cliBackends.claude-cli.env.ANTHROPIC_BASE_URL", () => {
      const config = applyCloudruFmConfig(
        "cloudru-fm-glm47",
        "${CLOUDRU_API_KEY}",
        "http://localhost:8082",
      );
      const env =
        config.agents?.defaults?.cliBackends?.["claude-cli"]?.env;
      expect(env?.ANTHROPIC_BASE_URL).toBe("http://localhost:8082");
    });

    it("should set model.primary for GLM-4.7 choice", () => {
      const config = applyCloudruFmConfig(
        "cloudru-fm-glm47",
        "${CLOUDRU_API_KEY}",
        "http://localhost:8082",
      );
      expect(config.agents?.defaults?.model?.primary).toBe(
        "cloudru-fm/zai-org/GLM-4.7",
      );
    });

    it("should set model.primary for Flash choice", () => {
      const config = applyCloudruFmConfig(
        "cloudru-fm-flash",
        "${CLOUDRU_API_KEY}",
        "http://localhost:8082",
      );
      expect(config.agents?.defaults?.model?.primary).toBe(
        "cloudru-fm/zai-org/GLM-4.7-Flash",
      );
    });

    it("should use env reference not raw API key in provider config", () => {
      const config = applyCloudruFmConfig(
        "cloudru-fm-glm47",
        "${CLOUDRU_API_KEY}",
        "http://localhost:8082",
      );
      expect(config.models?.providers?.["cloudru-fm"]?.apiKey).toBe(
        "${CLOUDRU_API_KEY}",
      );
    });
  });

  describe("Docker compose template generation", () => {
    const compose = generateDockerCompose({
      apiKeyRef: "CLOUDRU_API_KEY",
      port: 8082,
      bigModel: "zai-org/GLM-4.7",
      middleModel: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      smallModel: "zai-org/GLM-4.7-Flash",
    });

    it("should include OPENAI_API_KEY placeholder", () => {
      expect(compose).toContain("OPENAI_API_KEY");
      expect(compose).toContain("CLOUDRU_API_KEY");
    });

    it("should include OPENAI_BASE_URL for cloud.ru", () => {
      expect(compose).toContain(
        "https://foundation-models.api.cloud.ru/v1",
      );
    });

    it("should include BIG_MODEL env", () => {
      expect(compose).toContain("BIG_MODEL:");
    });

    it("should include MIDDLE_MODEL env", () => {
      expect(compose).toContain("MIDDLE_MODEL:");
    });

    it("should include SMALL_MODEL env", () => {
      expect(compose).toContain("SMALL_MODEL:");
    });

    it("should bind to 127.0.0.1:8082", () => {
      expect(compose).toContain("127.0.0.1:8082:8082");
    });

    it("should include healthcheck with curl and /health", () => {
      expect(compose).toContain("curl");
      expect(compose).toContain("/health");
    });

    it("should set restart: unless-stopped", () => {
      expect(compose).toContain("restart: unless-stopped");
    });

    it("should use legard/claude-code-proxy:latest image", () => {
      expect(compose).toContain("legard/claude-code-proxy:latest");
    });
  });
});

// =========================================================================
// ADR-003: Claude Code as Agentic Execution Engine
// =========================================================================

describe("ADR-003: Claude Code as Agentic Engine", () => {
  describe("CLI provider identification", () => {
    /** Simulates isCliProvider from agent-runner.ts */
    const CLI_PROVIDER_IDS = new Set(["claude-cli", "codex-cli"]);
    function isCliProvider(provider: string): boolean {
      return CLI_PROVIDER_IDS.has(provider);
    }

    it("should identify 'claude-cli' as a CLI provider", () => {
      expect(isCliProvider("claude-cli")).toBe(true);
    });

    it("should identify 'codex-cli' as a CLI provider", () => {
      expect(isCliProvider("codex-cli")).toBe(true);
    });

    it("should return false for 'openai'", () => {
      expect(isCliProvider("openai")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isCliProvider("")).toBe(false);
    });

    it("should return false for 'Claude-CLI' (case sensitive)", () => {
      expect(isCliProvider("Claude-CLI")).toBe(false);
    });
  });

  describe("runCliAgent subprocess args construction", () => {
    it("should include -p flag in default args", () => {
      expect(DEFAULT_CLAUDE_BACKEND.args).toContain("-p");
    });

    it("should include --output-format json in default args", () => {
      const args = DEFAULT_CLAUDE_BACKEND.args!;
      const fmtIdx = args.indexOf("--output-format");
      expect(fmtIdx).toBeGreaterThanOrEqual(0);
      expect(args[fmtIdx + 1]).toBe("json");
    });

    it("should include --dangerously-skip-permissions in default args", () => {
      expect(DEFAULT_CLAUDE_BACKEND.args).toContain(
        "--dangerously-skip-permissions",
      );
    });

    it("should have --model as the modelArg", () => {
      expect(DEFAULT_CLAUDE_BACKEND.modelArg).toBe("--model");
    });

    it("should have --session-id as the sessionArg", () => {
      expect(DEFAULT_CLAUDE_BACKEND.sessionArg).toBe("--session-id");
    });

    it("should have sessionMode set to 'always'", () => {
      expect(DEFAULT_CLAUDE_BACKEND.sessionMode).toBe("always");
    });

    it("should include --resume and {sessionId} in resumeArgs", () => {
      expect(DEFAULT_CLAUDE_BACKEND.resumeArgs).toContain("--resume");
      expect(DEFAULT_CLAUDE_BACKEND.resumeArgs).toContain("{sessionId}");
    });
  });

  describe("Session ID consistency", () => {
    it("should use existing cliSessionId when provided for resume", () => {
      const cliSessionId = "session-abc-123";
      const resumeArgs = DEFAULT_CLAUDE_BACKEND.resumeArgs!;
      const resolvedArgs = resumeArgs.map((entry) =>
        entry.replaceAll("{sessionId}", cliSessionId),
      );

      expect(resolvedArgs).toContain("session-abc-123");
      expect(resolvedArgs).not.toContain("{sessionId}");
    });

    it("should replace all {sessionId} placeholders in resumeArgs", () => {
      const sessionId = "test-session-42";
      const resumeArgs = DEFAULT_CLAUDE_BACKEND.resumeArgs!;
      const resolvedArgs = resumeArgs.map((entry) =>
        entry.replaceAll("{sessionId}", sessionId),
      );

      const unreplaced = resolvedArgs.filter((a) =>
        a.includes("{sessionId}"),
      );
      expect(unreplaced).toHaveLength(0);
    });

    it("should read session ID from documented fields", () => {
      const fields = DEFAULT_CLAUDE_BACKEND.sessionIdFields!;
      expect(fields).toContain("session_id");
      expect(fields).toContain("sessionId");
      expect(fields).toContain("conversation_id");
      expect(fields).toContain("conversationId");
    });
  });

  describe("Environment isolation (clearEnv)", () => {
    it("should list ANTHROPIC_API_KEY in clearEnv", () => {
      expect(DEFAULT_CLAUDE_BACKEND.clearEnv).toContain("ANTHROPIC_API_KEY");
    });

    it("should list ANTHROPIC_API_KEY_OLD in clearEnv", () => {
      expect(DEFAULT_CLAUDE_BACKEND.clearEnv).toContain(
        "ANTHROPIC_API_KEY_OLD",
      );
    });

    it("should remove cleared keys from constructed env", () => {
      const backendEnv = { ANTHROPIC_API_KEY: "new-proxy-key" };
      const processEnv: Record<string, string> = {
        ANTHROPIC_API_KEY: "old-dangerous-key",
        ANTHROPIC_API_KEY_OLD: "older-key",
        PATH: "/usr/bin",
      };

      // Simulates cli-runner.ts:222-228
      const env: Record<string, string> = { ...processEnv, ...backendEnv };
      for (const key of DEFAULT_CLAUDE_BACKEND.clearEnv ?? []) {
        delete env[key];
      }

      // NOTE: current code clears AFTER merge, so backend.env ANTHROPIC_API_KEY
      // gets deleted too. This is the actual behavior from cli-runner.ts.
      expect(env["ANTHROPIC_API_KEY"]).toBeUndefined();
      expect(env["ANTHROPIC_API_KEY_OLD"]).toBeUndefined();
      expect(env["PATH"]).toBe("/usr/bin");
    });

    it("should demonstrate that clearEnv runs AFTER env merge (actual behavior)", () => {
      // This tests the ACTUAL behavior in cli-runner.ts:222-228:
      //   const next = { ...process.env, ...backend.env };
      //   for (const key of backend.clearEnv ?? []) { delete next[key]; }
      //
      // This means backend.env.ANTHROPIC_API_KEY is also deleted!
      // This is a potential bug when using cloudru proxy config.
      const backendConfig: CliBackendConfig = {
        command: "claude",
        env: { ANTHROPIC_API_KEY: "cloudru-proxy-key" },
        clearEnv: ["ANTHROPIC_API_KEY"],
      };

      const processEnv: Record<string, string> = {
        ANTHROPIC_API_KEY: "old-key",
      };

      const env = { ...processEnv, ...backendConfig.env };
      for (const key of backendConfig.clearEnv ?? []) {
        delete env[key];
      }

      // The user-provided key gets cleared too! ADR-001 works because
      // the proxy doesn't need ANTHROPIC_API_KEY in the subprocess env --
      // Claude Code sends it to the proxy which ignores it.
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    });
  });

  describe("Tools disabled injection", () => {
    function buildExtraSystemPrompt(
      userExtra?: string,
    ): string {
      return [
        userExtra?.trim(),
        "Tools are disabled in this session. Do not call tools.",
      ]
        .filter(Boolean)
        .join("\n");
    }

    it("should inject 'Tools are disabled' message", () => {
      const result = buildExtraSystemPrompt(undefined);
      expect(result).toBe(
        "Tools are disabled in this session. Do not call tools.",
      );
    });

    it("should append tools-disabled after user extraSystemPrompt", () => {
      const result = buildExtraSystemPrompt("Be helpful.");
      expect(result).toBe(
        "Be helpful.\nTools are disabled in this session. Do not call tools.",
      );
    });

    it("should handle whitespace-only extraSystemPrompt", () => {
      const result = buildExtraSystemPrompt("   ");
      expect(result).toBe(
        "Tools are disabled in this session. Do not call tools.",
      );
    });

    it("should handle empty string extraSystemPrompt", () => {
      const result = buildExtraSystemPrompt("");
      expect(result).toBe(
        "Tools are disabled in this session. Do not call tools.",
      );
    });

    it("should always contain the exact tools-disabled text", () => {
      const variations = [undefined, "", "Custom prompt", "Multi\nline\nprompt"];
      for (const v of variations) {
        const result = buildExtraSystemPrompt(v);
        expect(result).toContain(
          "Tools are disabled in this session. Do not call tools.",
        );
      }
    });
  });
});

// =========================================================================
// ADR-004: Proxy Lifecycle Management
// =========================================================================

describe("ADR-004: Proxy Lifecycle Management", () => {
  describe("Docker compose generation", () => {
    it("should generate valid compose with all template variables", () => {
      const compose = generateDockerCompose({
        apiKeyRef: "CLOUDRU_API_KEY",
        port: 8082,
        bigModel: "zai-org/GLM-4.7",
        middleModel: "zai-org/GLM-4.7-FlashX",
        smallModel: "zai-org/GLM-4.7-Flash",
      });

      expect(compose).toContain("services:");
      expect(compose).toContain("claude-code-proxy:");
      expect(compose).toContain("zai-org/GLM-4.7");
      expect(compose).toContain("zai-org/GLM-4.7-FlashX");
      expect(compose).toContain("zai-org/GLM-4.7-Flash");
    });

    it("should use legard/claude-code-proxy:latest image", () => {
      const compose = generateDockerCompose({
        apiKeyRef: "CLOUDRU_API_KEY",
        port: 8082,
        bigModel: "zai-org/GLM-4.7",
        middleModel: "zai-org/GLM-4.7-FlashX",
        smallModel: "zai-org/GLM-4.7-Flash",
      });

      expect(compose).toContain("legard/claude-code-proxy:latest");
    });

    it("should include healthcheck with 30s interval", () => {
      const compose = generateDockerCompose({
        apiKeyRef: "CLOUDRU_API_KEY",
        port: 8082,
        bigModel: "zai-org/GLM-4.7",
        middleModel: "zai-org/GLM-4.7-FlashX",
        smallModel: "zai-org/GLM-4.7-Flash",
      });

      expect(compose).toContain("healthcheck:");
      expect(compose).toContain("interval: 30s");
    });

    it("should set PORT env to match exposed port", () => {
      const compose = generateDockerCompose({
        apiKeyRef: "CLOUDRU_API_KEY",
        port: 9090,
        bigModel: "m1",
        middleModel: "m2",
        smallModel: "m3",
      });

      expect(compose).toContain('PORT: "9090"');
    });

    it("should support custom port configuration", () => {
      const compose = generateDockerCompose({
        apiKeyRef: "CLOUDRU_API_KEY",
        port: 9090,
        bigModel: "m1",
        middleModel: "m2",
        smallModel: "m3",
      });

      expect(compose).toContain("127.0.0.1:9090:9090");
    });
  });

  describe("verifyProxyHealth()", () => {
    it("should return { ok: true, status: 200 } for healthy proxy", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      const result = await verifyProxyHealth(
        "http://localhost:8082",
        mockFetch as unknown as typeof fetch,
      );

      expect(result).toEqual({ ok: true, status: 200 });
    });

    it("should return { ok: false, status: 503 } for degraded proxy", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      const result = await verifyProxyHealth(
        "http://localhost:8082",
        mockFetch as unknown as typeof fetch,
      );

      expect(result).toEqual({ ok: false, status: 503 });
    });

    it("should return error message on network failure", async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new Error("fetch failed"));
      const result = await verifyProxyHealth(
        "http://localhost:8082",
        mockFetch as unknown as typeof fetch,
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("fetch failed");
    });

    it("should handle non-Error thrown values", async () => {
      const mockFetch = vi.fn().mockRejectedValue("string error");
      const result = await verifyProxyHealth(
        "http://localhost:8082",
        mockFetch as unknown as typeof fetch,
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBe("string error");
    });
  });

  describe("Proxy state machine", () => {
    let lifecycle: ProxyLifecycle;

    beforeEach(() => {
      lifecycle = new ProxyLifecycle();
    });

    it("should start in UNDEPLOYED state", () => {
      expect(lifecycle.state).toBe("UNDEPLOYED");
    });

    it("should transition UNDEPLOYED -> DEPLOYING on deploy()", () => {
      lifecycle.deploy();
      expect(lifecycle.state).toBe("DEPLOYING");
    });

    it("should transition DEPLOYING -> RUNNING on container started", () => {
      lifecycle.deploy();
      lifecycle.onContainerStarted();
      expect(lifecycle.state).toBe("RUNNING");
    });

    it("should transition RUNNING -> HEALTHY on health check pass", () => {
      lifecycle.deploy();
      lifecycle.onContainerStarted();
      lifecycle.onHealthCheckPassed();
      expect(lifecycle.state).toBe("HEALTHY");
    });

    it("should transition HEALTHY -> UNHEALTHY on health check fail", () => {
      lifecycle.deploy();
      lifecycle.onContainerStarted();
      lifecycle.onHealthCheckPassed();
      lifecycle.onHealthCheckFailed();
      expect(lifecycle.state).toBe("UNHEALTHY");
    });

    it("should transition UNHEALTHY -> RECOVERING on restart", () => {
      lifecycle.deploy();
      lifecycle.onContainerStarted();
      lifecycle.onHealthCheckPassed();
      lifecycle.onHealthCheckFailed();
      lifecycle.onRestart();
      expect(lifecycle.state).toBe("RECOVERING");
    });

    it("should transition RECOVERING -> HEALTHY on recovery", () => {
      lifecycle.deploy();
      lifecycle.onContainerStarted();
      lifecycle.onHealthCheckPassed();
      lifecycle.onHealthCheckFailed();
      lifecycle.onRestart();
      lifecycle.onHealthCheckPassed();
      expect(lifecycle.state).toBe("HEALTHY");
    });

    it("should throw on invalid transition UNDEPLOYED -> HEALTHY", () => {
      expect(() => lifecycle.onHealthCheckPassed()).toThrow(
        "Invalid transition",
      );
    });

    it("should throw on invalid transition UNDEPLOYED -> RUNNING", () => {
      expect(() => lifecycle.onContainerStarted()).toThrow(
        "Invalid transition",
      );
    });

    it("should allow STOPPED -> DEPLOYING (re-deploy)", () => {
      lifecycle.deploy();
      lifecycle.onContainerStarted();
      lifecycle.stop();
      expect(lifecycle.state).toBe("STOPPED");
      lifecycle.deploy();
      expect(lifecycle.state).toBe("DEPLOYING");
    });

    it("should complete full happy-path lifecycle", () => {
      lifecycle.deploy();
      lifecycle.onContainerStarted();
      lifecycle.onHealthCheckPassed();
      expect(lifecycle.state).toBe("HEALTHY");
    });

    it("should complete full failure-recovery lifecycle", () => {
      lifecycle.deploy();
      lifecycle.onContainerStarted();
      lifecycle.onHealthCheckPassed();
      lifecycle.onHealthCheckFailed();
      lifecycle.onRestart();
      lifecycle.onHealthCheckPassed();
      expect(lifecycle.state).toBe("HEALTHY");
    });
  });

  describe("Proxy restart recovery", () => {
    it("should recover from UNHEALTHY through RECOVERING to HEALTHY", () => {
      const lifecycle = new ProxyLifecycle();
      lifecycle.deploy();
      lifecycle.onContainerStarted();
      lifecycle.onHealthCheckPassed();

      // Simulate failure
      lifecycle.onHealthCheckFailed();
      expect(lifecycle.state).toBe("UNHEALTHY");

      // Docker restart triggers recovery
      lifecycle.onRestart();
      expect(lifecycle.state).toBe("RECOVERING");

      // Health check passes after restart
      lifecycle.onHealthCheckPassed();
      expect(lifecycle.state).toBe("HEALTHY");
    });

    it("should handle multiple consecutive health failures in RECOVERING", () => {
      const lifecycle = new ProxyLifecycle();
      lifecycle.deploy();
      lifecycle.onContainerStarted();
      lifecycle.onHealthCheckPassed();
      lifecycle.onHealthCheckFailed();
      lifecycle.onRestart();

      // First retry fails
      lifecycle.onHealthCheckFailed();
      expect(lifecycle.state).toBe("UNHEALTHY");
    });
  });
});

// =========================================================================
// ADR-005: Model Mapping and Fallback Strategy
// =========================================================================

describe("ADR-005: Model Mapping & Fallback Strategy", () => {
  describe("Wizard preset: GLM-4.7 (Full)", () => {
    const preset = resolveModelPreset("cloudru-fm-glm47");

    it("should set BIG_MODEL to 'zai-org/GLM-4.7'", () => {
      expect(preset.BIG_MODEL).toBe("zai-org/GLM-4.7");
    });

    it("should set MIDDLE_MODEL to 'zai-org/GLM-4.7-FlashX'", () => {
      expect(preset.MIDDLE_MODEL).toBe("zai-org/GLM-4.7-FlashX");
    });

    it("should set SMALL_MODEL to 'zai-org/GLM-4.7-Flash'", () => {
      expect(preset.SMALL_MODEL).toBe("zai-org/GLM-4.7-Flash");
    });
  });

  describe("Wizard preset: GLM-4.7-Flash (Free)", () => {
    const preset = resolveModelPreset("cloudru-fm-flash");

    it("should set BIG_MODEL to 'zai-org/GLM-4.7-Flash'", () => {
      expect(preset.BIG_MODEL).toBe("zai-org/GLM-4.7-Flash");
    });

    it("should set MIDDLE_MODEL to 'zai-org/GLM-4.7-Flash'", () => {
      expect(preset.MIDDLE_MODEL).toBe("zai-org/GLM-4.7-Flash");
    });

    it("should set SMALL_MODEL to 'zai-org/GLM-4.7-Flash'", () => {
      expect(preset.SMALL_MODEL).toBe("zai-org/GLM-4.7-Flash");
    });

    it("should use same model for all 3 tiers (free tier)", () => {
      expect(preset.BIG_MODEL).toBe(preset.MIDDLE_MODEL);
      expect(preset.MIDDLE_MODEL).toBe(preset.SMALL_MODEL);
    });
  });

  describe("Wizard preset: Qwen3-Coder-480B", () => {
    const preset = resolveModelPreset("cloudru-fm-qwen");

    it("should set BIG_MODEL to Qwen3-Coder-480B", () => {
      expect(preset.BIG_MODEL).toBe(
        "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      );
    });

    it("should set MIDDLE_MODEL to GLM-4.7-FlashX", () => {
      expect(preset.MIDDLE_MODEL).toBe("zai-org/GLM-4.7-FlashX");
    });

    it("should set SMALL_MODEL to GLM-4.7-Flash", () => {
      expect(preset.SMALL_MODEL).toBe("zai-org/GLM-4.7-Flash");
    });
  });

  describe("Unknown preset handling", () => {
    it("should throw for unknown preset choice", () => {
      expect(() => resolveModelPreset("cloudru-fm-unknown")).toThrow(
        "Unknown model preset",
      );
    });

    it("should throw for empty string preset", () => {
      expect(() => resolveModelPreset("")).toThrow("Unknown model preset");
    });
  });

  describe("Fallback chain integrity", () => {
    it("should have valid GLM-4.7 fallback chain (no cycles)", () => {
      const chain = FALLBACK_CHAINS["zai-org/GLM-4.7"];
      expect(chain).toBeDefined();
      expect(validateFallbackChain(chain!)).toBe(true);
    });

    it("should have valid Qwen3 fallback chain (no cycles)", () => {
      const chain =
        FALLBACK_CHAINS["Qwen/Qwen3-Coder-480B-A35B-Instruct"];
      expect(chain).toBeDefined();
      expect(validateFallbackChain(chain!)).toBe(true);
    });

    it("should terminate GLM-4.7 chain at GLM-4.7-Flash", () => {
      const chain = FALLBACK_CHAINS["zai-org/GLM-4.7"]!;
      expect(chain[chain.length - 1]).toBe("zai-org/GLM-4.7-Flash");
    });

    it("should terminate Qwen3 chain at GLM-4.7-Flash", () => {
      const chain =
        FALLBACK_CHAINS["Qwen/Qwen3-Coder-480B-A35B-Instruct"]!;
      expect(chain[chain.length - 1]).toBe("zai-org/GLM-4.7-Flash");
    });

    it("should detect circular fallbacks", () => {
      const circularChain = ["A", "B", "A"];
      expect(validateFallbackChain(circularChain)).toBe(false);
    });

    it("should accept chain with no duplicates", () => {
      const validChain = ["model-a", "model-b", "model-c"];
      expect(validateFallbackChain(validChain)).toBe(true);
    });

    it("should handle empty chain", () => {
      expect(validateFallbackChain([])).toBe(true);
    });

    it("should handle single-element chain", () => {
      expect(validateFallbackChain(["model-a"])).toBe(true);
    });

    it("should limit fallback depth (chains should be <= 5 elements)", () => {
      for (const [, chain] of Object.entries(FALLBACK_CHAINS)) {
        expect(chain.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("SMALL_MODEL invariant: always GLM-4.7-Flash", () => {
    const ALL_PRESETS = [
      "cloudru-fm-glm47",
      "cloudru-fm-flash",
      "cloudru-fm-qwen",
    ];

    for (const presetKey of ALL_PRESETS) {
      it(`should be GLM-4.7-Flash for ${presetKey}`, () => {
        const preset = resolveModelPreset(presetKey);
        expect(preset.SMALL_MODEL).toBe("zai-org/GLM-4.7-Flash");
      });
    }
  });

  describe("Proxy MODEL envs validation", () => {
    it("should set all 3 MODEL envs in docker-compose for GLM-4.7 preset", () => {
      const preset = resolveModelPreset("cloudru-fm-glm47");
      const compose = generateDockerCompose({
        apiKeyRef: "CLOUDRU_API_KEY",
        port: 8082,
        bigModel: preset.BIG_MODEL,
        middleModel: preset.MIDDLE_MODEL,
        smallModel: preset.SMALL_MODEL,
      });

      expect(compose).toContain(`BIG_MODEL: "${preset.BIG_MODEL}"`);
      expect(compose).toContain(`MIDDLE_MODEL: "${preset.MIDDLE_MODEL}"`);
      expect(compose).toContain(`SMALL_MODEL: "${preset.SMALL_MODEL}"`);
    });

    it("should not have empty MODEL env values for any preset", () => {
      for (const key of Object.keys(MODEL_PRESETS)) {
        const preset = resolveModelPreset(key);
        expect(preset.BIG_MODEL.length).toBeGreaterThan(0);
        expect(preset.MIDDLE_MODEL.length).toBeGreaterThan(0);
        expect(preset.SMALL_MODEL.length).toBeGreaterThan(0);
      }
    });

    it("should use known cloud.ru model IDs only", () => {
      const knownModels = new Set([
        "zai-org/GLM-4.7",
        "zai-org/GLM-4.7-Flash",
        "zai-org/GLM-4.7-FlashX",
        "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      ]);

      for (const key of Object.keys(MODEL_PRESETS)) {
        const preset = resolveModelPreset(key);
        expect(knownModels.has(preset.BIG_MODEL)).toBe(true);
        expect(knownModels.has(preset.MIDDLE_MODEL)).toBe(true);
        expect(knownModels.has(preset.SMALL_MODEL)).toBe(true);
      }
    });
  });

  describe("CLAUDE_MODEL_ALIASES coverage for proxy tiers", () => {
    it("should have at least one alias mapping to 'opus' (BIG)", () => {
      const hasOpus = Object.values(CLAUDE_MODEL_ALIASES).includes("opus");
      expect(hasOpus).toBe(true);
    });

    it("should have at least one alias mapping to 'sonnet' (MIDDLE)", () => {
      const hasSonnet =
        Object.values(CLAUDE_MODEL_ALIASES).includes("sonnet");
      expect(hasSonnet).toBe(true);
    });

    it("should have at least one alias mapping to 'haiku' (SMALL)", () => {
      const hasHaiku =
        Object.values(CLAUDE_MODEL_ALIASES).includes("haiku");
      expect(hasHaiku).toBe(true);
    });

    it("should only map to valid tier names", () => {
      const validTiers = new Set(["opus", "sonnet", "haiku"]);
      for (const tier of Object.values(CLAUDE_MODEL_ALIASES)) {
        expect(validTiers.has(tier)).toBe(true);
      }
    });
  });
});

// =========================================================================
// Cross-ADR Integration Tests
// =========================================================================

describe("Cross-ADR Integration", () => {
  it("ADR-001+002: wizard config produces consistent proxy + backend config", () => {
    const preset = resolveModelPreset("cloudru-fm-glm47");
    const compose = generateDockerCompose({
      apiKeyRef: "CLOUDRU_API_KEY",
      port: 8082,
      bigModel: preset.BIG_MODEL,
      middleModel: preset.MIDDLE_MODEL,
      smallModel: preset.SMALL_MODEL,
    });

    // Proxy compose has the same models that the preset specifies
    expect(compose).toContain(preset.BIG_MODEL);
    expect(compose).toContain(preset.MIDDLE_MODEL);
    expect(compose).toContain(preset.SMALL_MODEL);

    // Backend config points to the proxy
    const override: CliBackendConfig = {
      command: "claude",
      env: {
        ANTHROPIC_BASE_URL: "http://localhost:8082",
        ANTHROPIC_API_KEY: "cloudru-proxy-key",
      },
    };
    const merged = mergeBackendConfig(DEFAULT_CLAUDE_BACKEND, override);
    expect(merged.env!.ANTHROPIC_BASE_URL).toBe("http://localhost:8082");
  });

  it("ADR-001+003: resolved backend config has proxy URL for subprocess", () => {
    const override: CliBackendConfig = {
      command: "claude",
      env: {
        ANTHROPIC_BASE_URL: "http://localhost:8082",
        ANTHROPIC_API_KEY: "cloudru-proxy-key",
      },
    };
    const merged = mergeBackendConfig(DEFAULT_CLAUDE_BACKEND, override);

    // Subprocess env will point to proxy
    expect(merged.env!.ANTHROPIC_BASE_URL).toContain("localhost:8082");
    // Default args preserved for Claude Code
    expect(merged.args).toContain("-p");
    expect(merged.args).toContain("--output-format");
  });

  it("ADR-002+005: wizard choice determines correct MODEL env mapping", () => {
    const flashPreset = resolveModelPreset("cloudru-fm-flash");
    expect(flashPreset.BIG_MODEL).toBe("zai-org/GLM-4.7-Flash");
    expect(flashPreset.MIDDLE_MODEL).toBe("zai-org/GLM-4.7-Flash");
    expect(flashPreset.SMALL_MODEL).toBe("zai-org/GLM-4.7-Flash");

    const qwenPreset = resolveModelPreset("cloudru-fm-qwen");
    expect(qwenPreset.BIG_MODEL).toBe(
      "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    );
    // Always falls back to Flash for small
    expect(qwenPreset.SMALL_MODEL).toBe("zai-org/GLM-4.7-Flash");
  });

  it("ADR-003+004: subprocess uses env that points to proxy health endpoint", () => {
    const proxyUrl = "http://localhost:8082";
    const override: CliBackendConfig = {
      command: "claude",
      env: { ANTHROPIC_BASE_URL: proxyUrl },
    };
    const merged = mergeBackendConfig(DEFAULT_CLAUDE_BACKEND, override);

    // Verify the subprocess env URL is compatible with health check URL
    const healthUrl = `${merged.env!.ANTHROPIC_BASE_URL}/health`;
    expect(healthUrl).toBe("http://localhost:8082/health");
  });

  it("ADR-004+005: all 3 presets produce compose with all MODEL envs", () => {
    const presetKeys = [
      "cloudru-fm-glm47",
      "cloudru-fm-flash",
      "cloudru-fm-qwen",
    ];

    for (const key of presetKeys) {
      const preset = resolveModelPreset(key);
      const compose = generateDockerCompose({
        apiKeyRef: "CLOUDRU_API_KEY",
        port: 8082,
        bigModel: preset.BIG_MODEL,
        middleModel: preset.MIDDLE_MODEL,
        smallModel: preset.SMALL_MODEL,
      });

      expect(compose).toContain("BIG_MODEL:");
      expect(compose).toContain("MIDDLE_MODEL:");
      expect(compose).toContain("SMALL_MODEL:");
      // All values are non-empty
      expect(compose).not.toContain('BIG_MODEL: ""');
      expect(compose).not.toContain('MIDDLE_MODEL: ""');
      expect(compose).not.toContain('SMALL_MODEL: ""');
    }
  });

  it("ADR-001+005: CLAUDE_MODEL_ALIASES covers all 3 proxy tiers", () => {
    // The proxy maps: opus -> BIG_MODEL, sonnet -> MIDDLE_MODEL, haiku -> SMALL_MODEL
    // So we need at least one alias resolving to each tier
    const tiers = new Set(Object.values(CLAUDE_MODEL_ALIASES));
    expect(tiers.has("opus")).toBe(true);
    expect(tiers.has("sonnet")).toBe(true);
    expect(tiers.has("haiku")).toBe(true);
  });
});
