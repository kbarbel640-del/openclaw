import type { Api, Model } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { resolveForwardCompatModel } from "./model-forward-compat.js";
import type { ModelRegistry } from "./pi-model-discovery.js";

function createTemplateModel(provider: string, id: string): Model<Api> {
  return {
    id,
    name: id,
    provider,
    api: "anthropic-messages",
    input: ["text"],
    reasoning: true,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 8_192,
  } as Model<Api>;
}

function createRegistry(models: Record<string, Model<Api>>): ModelRegistry {
  return {
    find(provider: string, modelId: string) {
      return models[`${provider}/${modelId}`] ?? null;
    },
  } as ModelRegistry;
}

describe("agents/model-forward-compat", () => {
  it("resolves anthropic opus 4.6 via 4.5 template", () => {
    const registry = createRegistry({
      "anthropic/claude-opus-4-5": createTemplateModel("anthropic", "claude-opus-4-5"),
    });
    const model = resolveForwardCompatModel("anthropic", "claude-opus-4-6", registry);
    expect(model?.id).toBe("claude-opus-4-6");
    expect(model?.name).toBe("claude-opus-4-6");
    expect(model?.provider).toBe("anthropic");
  });

  it("resolves anthropic sonnet 4.6 dot variant with suffix", () => {
    const registry = createRegistry({
      "anthropic/claude-sonnet-4.5-20260219": createTemplateModel(
        "anthropic",
        "claude-sonnet-4.5-20260219",
      ),
    });
    const model = resolveForwardCompatModel("anthropic", "claude-sonnet-4.6-20260219", registry);
    expect(model?.id).toBe("claude-sonnet-4.6-20260219");
    expect(model?.name).toBe("claude-sonnet-4.6-20260219");
    expect(model?.provider).toBe("anthropic");
  });

  it("does not resolve anthropic 4.6 fallback for other providers", () => {
    const registry = createRegistry({
      "anthropic/claude-opus-4-5": createTemplateModel("anthropic", "claude-opus-4-5"),
    });
    const model = resolveForwardCompatModel("openai", "claude-opus-4-6", registry);
    expect(model).toBeUndefined();
  });

  it("resolves gemini 3.1 customtools via gemini 3 template", () => {
    const registry = createRegistry({
      "google/gemini-3-pro-preview": createTemplateModel("google", "gemini-3-pro-preview"),
    });
    const model = resolveForwardCompatModel(
      "google",
      "gemini-3.1-pro-preview-customtools",
      registry,
    );
    expect(model?.id).toBe("gemini-3.1-pro-preview-customtools");
    expect(model?.name).toBe("gemini-3.1-pro-preview-customtools");
    expect(model?.provider).toBe("google");
  });

  it("normalizes google gemini 3.1 low alias to preview id via gemini 3 template", () => {
    const registry = createRegistry({
      "google/gemini-3-pro-low": createTemplateModel("google", "gemini-3-pro-low"),
    });
    const model = resolveForwardCompatModel("google", "gemini-3.1-pro-low", registry);
    expect(model?.id).toBe("gemini-3.1-pro-low-preview");
    expect(model?.name).toBe("gemini-3.1-pro-low-preview");
    expect(model?.provider).toBe("google");
  });

  it("resolves antigravity gemini 3.1 via gemini 3 pro high template", () => {
    const registry = createRegistry({
      "google-antigravity/gemini-3-pro-high": createTemplateModel(
        "google-antigravity",
        "gemini-3-pro-high",
      ),
    });
    const model = resolveForwardCompatModel(
      "google-antigravity",
      "gemini-3.1-pro-low-preview",
      registry,
    );
    expect(model?.id).toBe("gemini-3.1-pro-low");
    expect(model?.name).toBe("gemini-3.1-pro-low-preview");
    expect(model?.provider).toBe("google-antigravity");
  });

  it("prefers low antigravity templates for gemini 3.1 low ids", () => {
    const registry = createRegistry({
      "google-antigravity/gemini-3-pro-high": createTemplateModel(
        "google-antigravity",
        "gemini-3-pro-high",
      ),
      "google-antigravity/gemini-3-pro-low": createTemplateModel(
        "google-antigravity",
        "gemini-3-pro-low",
      ),
    });
    const model = resolveForwardCompatModel(
      "google-antigravity",
      "gemini-3.1-pro-low-preview",
      registry,
    );
    expect(model?.id).toBe("gemini-3.1-pro-low");
    expect(model?.name).toBe("gemini-3.1-pro-low-preview");
    expect(model?.provider).toBe("google-antigravity");
  });

  it("resolves antigravity gemini 3.1 via gemini 3 pro high preview template", () => {
    const registry = createRegistry({
      "google-antigravity/gemini-3-pro-high-preview": createTemplateModel(
        "google-antigravity",
        "gemini-3-pro-high-preview",
      ),
    });
    const model = resolveForwardCompatModel(
      "google-antigravity",
      "gemini-3.1-pro-high-preview",
      registry,
    );
    expect(model?.id).toBe("gemini-3.1-pro-high");
    expect(model?.name).toBe("gemini-3.1-pro-high-preview");
    expect(model?.provider).toBe("google-antigravity");
  });

  it("resolves antigravity gemini 3.1 non-preview alias ids", () => {
    const registry = createRegistry({
      "google-antigravity/gemini-3.1-pro-high-preview": createTemplateModel(
        "google-antigravity",
        "gemini-3.1-pro-high-preview",
      ),
    });
    const model = resolveForwardCompatModel("google-antigravity", "gemini-3.1-pro-high", registry);
    expect(model?.id).toBe("gemini-3.1-pro-high");
    expect(model?.name).toBe("gemini-3.1-pro-high");
    expect(model?.provider).toBe("google-antigravity");
  });

  it("resolves antigravity direct gemini 3.1 pro id", () => {
    const registry = createRegistry({
      "google-antigravity/gemini-3-pro-high": createTemplateModel(
        "google-antigravity",
        "gemini-3-pro-high",
      ),
    });
    const model = resolveForwardCompatModel("google-antigravity", "gemini-3.1-pro", registry);
    expect(model?.id).toBe("gemini-3.1-pro-high");
    expect(model?.name).toBe("gemini-3.1-pro");
    expect(model?.provider).toBe("google-antigravity");
  });

  it("does not resolve gemini 3.1 customtools fallback for other providers", () => {
    const registry = createRegistry({
      "google/gemini-3-pro-preview": createTemplateModel("google", "gemini-3-pro-preview"),
    });
    const model = resolveForwardCompatModel(
      "openai",
      "gemini-3.1-pro-preview-customtools",
      registry,
    );
    expect(model).toBeUndefined();
  });
});
