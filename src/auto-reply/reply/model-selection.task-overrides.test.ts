import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions/types.js";
import { createModelSelectionState } from "./model-selection.js";

vi.mock("../../agents/model-catalog.js", () => ({
  loadModelCatalog: vi.fn(async () => [
    { provider: "openai", id: "gpt-4o-mini", name: "GPT-4o mini" },
    { provider: "openai", id: "gpt-4o", name: "GPT-4o" },
    { provider: "anthropic", id: "claude-opus-4-5", name: "Claude Opus 4.5" },
  ]),
}));

const defaultProvider = "openai";
const defaultModel = "gpt-4o-mini";

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  sessionId: "session-id",
  updatedAt: Date.now(),
  ...overrides,
});

async function resolveState(params: {
  cfg: OpenClawConfig;
  sessionEntry: ReturnType<typeof makeEntry>;
  prompt: string;
}) {
  const entry = params.sessionEntry as unknown as SessionEntry;
  return createModelSelectionState({
    cfg: params.cfg,
    agentCfg: params.cfg.agents?.defaults,
    sessionEntry: entry,
    sessionStore: { "agent:main:main": entry } as Record<string, SessionEntry>,
    sessionKey: "agent:main:main",
    defaultProvider,
    defaultModel,
    provider: defaultProvider,
    model: defaultModel,
    hasModelDirective: false,
    prompt: params.prompt,
  });
}

describe("createModelSelectionState task overrides", () => {
  it("uses thinkingModelOverride for reasoning/general tasks", async () => {
    const cfg = {} as OpenClawConfig;
    const entry = makeEntry({
      thinkingModelOverride: "anthropic/claude-opus-4-5",
    });

    const state = await resolveState({ cfg, sessionEntry: entry, prompt: "why is the sky blue?" });
    expect(state.provider).toBe("anthropic");
    expect(state.model).toBe("claude-opus-4-5");
  });

  it("uses codingModelOverride for coding tasks", async () => {
    const cfg = {} as OpenClawConfig;
    const entry = makeEntry({
      codingModelOverride: "openai/gpt-4o",
    });

    const state = await resolveState({
      cfg,
      sessionEntry: entry,
      prompt: "write code to parse csv",
    });
    expect(state.provider).toBe("openai");
    expect(state.model).toBe("gpt-4o");
  });

  it("ignores task override when disallowed by allowlist", async () => {
    const cfg = {
      agents: {
        defaults: {
          models: {
            "openai/gpt-4o-mini": {},
          },
        },
      },
    } as OpenClawConfig;
    const entry = makeEntry({
      thinkingModelOverride: "anthropic/claude-opus-4-5",
    });

    const state = await resolveState({ cfg, sessionEntry: entry, prompt: "explain recursion" });
    expect(state.provider).toBe(defaultProvider);
    expect(state.model).toBe(defaultModel);
  });

  it("keeps explicit modelOverride over per-task overrides", async () => {
    const cfg = {} as OpenClawConfig;
    const entry = makeEntry({
      providerOverride: "openai",
      modelOverride: "gpt-4o",
      thinkingModelOverride: "anthropic/claude-opus-4-5",
      codingModelOverride: "anthropic/claude-opus-4-5",
    });

    const state = await resolveState({
      cfg,
      sessionEntry: entry,
      prompt: "write code to sort array",
    });
    expect(state.provider).toBe("openai");
    expect(state.model).toBe("gpt-4o");
  });
});
