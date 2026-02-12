import path from "node:path";
import { describe, expect, it } from "vitest";
import type { IncludeResolver } from "./includes.js";
import { hasIncludeDirective, restoreIncludeDirectives } from "./include-preserve.js";

const ROOT_DIR = path.parse(process.cwd()).root;
const CONFIG_DIR = path.join(ROOT_DIR, "config");
const DEFAULT_CONFIG_PATH = path.join(CONFIG_DIR, "openclaw.json");

function createMockResolver(files: Record<string, unknown>): IncludeResolver {
  return {
    readFile: (filePath: string) => {
      if (filePath in files) {
        return JSON.stringify(files[filePath]);
      }
      throw new Error(`ENOENT: no such file: ${filePath}`);
    },
    parseJson: JSON.parse,
  };
}

function configPath(...parts: string[]) {
  return path.join(CONFIG_DIR, ...parts);
}

describe("hasIncludeDirective", () => {
  it("returns false for primitives", () => {
    expect(hasIncludeDirective("hello")).toBe(false);
    expect(hasIncludeDirective(42)).toBe(false);
    expect(hasIncludeDirective(null)).toBe(false);
  });

  it("returns false for objects without $include", () => {
    expect(hasIncludeDirective({ foo: "bar" })).toBe(false);
    expect(hasIncludeDirective({ nested: { deep: true } })).toBe(false);
  });

  it("returns true for top-level $include", () => {
    expect(hasIncludeDirective({ $include: "./base.json" })).toBe(true);
  });

  it("returns true for nested $include", () => {
    expect(hasIncludeDirective({ models: { $include: "./models.json" } })).toBe(true);
  });

  it("returns false for arrays", () => {
    expect(hasIncludeDirective([{ $include: "./base.json" }])).toBe(false);
  });
});

describe("restoreIncludeDirectives", () => {
  it("returns incoming unchanged when rawParsed has no $include", () => {
    const incoming = { name: "bot", models: { default: "claude-3" } };
    const rawParsed = { name: "bot", models: { default: "claude-3" } };
    const resolver = createMockResolver({});

    const result = restoreIncludeDirectives(incoming, rawParsed, DEFAULT_CONFIG_PATH, resolver);
    expect(result).toEqual(incoming);
  });

  it("preserves $include directive on roundtrip", () => {
    const baseFile = configPath("base.json");
    const files = {
      [baseFile]: { models: { default: "claude-3" }, gateway: { port: 3000 } },
    };
    const resolver = createMockResolver(files);

    const rawParsed = {
      $include: "./base.json",
      name: "my-bot",
    };

    // Simulates what the caller gets after full resolution + defaults
    const incoming = {
      models: { default: "claude-3" },
      gateway: { port: 3000 },
      name: "updated-bot",
    };

    const result = restoreIncludeDirectives(incoming, rawParsed, DEFAULT_CONFIG_PATH, resolver);

    // $include should be preserved
    expect((result as Record<string, unknown>).$include).toBe("./base.json");
    // Sibling key should be updated
    expect((result as Record<string, unknown>).name).toBe("updated-bot");
    // Keys from include should NOT be inlined (they match include content)
    expect((result as Record<string, unknown>).models).toBeUndefined();
    expect((result as Record<string, unknown>).gateway).toBeUndefined();
  });

  it("writes override when included key value is changed", () => {
    const baseFile = configPath("base.json");
    const files = {
      [baseFile]: { models: { default: "claude-3" } },
    };
    const resolver = createMockResolver(files);

    const rawParsed = {
      $include: "./base.json",
      name: "my-bot",
    };

    const incoming = {
      models: { default: "gpt-4" }, // Changed from include value
      name: "my-bot",
    };

    const result = restoreIncludeDirectives(
      incoming,
      rawParsed,
      DEFAULT_CONFIG_PATH,
      resolver,
    ) as Record<string, unknown>;

    expect(result.$include).toBe("./base.json");
    expect(result.name).toBe("my-bot");
    // Changed included key should be written as sibling override
    expect(result.models).toEqual({ default: "gpt-4" });
  });

  it("adds new keys not from includes", () => {
    const baseFile = configPath("base.json");
    const files = {
      [baseFile]: { models: { default: "claude-3" } },
    };
    const resolver = createMockResolver(files);

    const rawParsed = {
      $include: "./base.json",
    };

    const incoming = {
      models: { default: "claude-3" },
      newFeature: { enabled: true }, // New key not from include
    };

    const result = restoreIncludeDirectives(
      incoming,
      rawParsed,
      DEFAULT_CONFIG_PATH,
      resolver,
    ) as Record<string, unknown>;

    expect(result.$include).toBe("./base.json");
    expect(result.models).toBeUndefined(); // From include, unchanged
    expect(result.newFeature).toEqual({ enabled: true }); // New, should be written
  });

  it("handles array $include", () => {
    const aFile = configPath("a.json");
    const bFile = configPath("b.json");
    const files = {
      [aFile]: { models: { default: "claude-3" } },
      [bFile]: { gateway: { port: 3000 } },
    };
    const resolver = createMockResolver(files);

    const rawParsed = {
      $include: ["./a.json", "./b.json"],
      name: "my-bot",
    };

    const incoming = {
      models: { default: "claude-3" },
      gateway: { port: 3000 },
      name: "updated-bot",
    };

    const result = restoreIncludeDirectives(
      incoming,
      rawParsed,
      DEFAULT_CONFIG_PATH,
      resolver,
    ) as Record<string, unknown>;

    expect(result.$include).toEqual(["./a.json", "./b.json"]);
    expect(result.name).toBe("updated-bot");
    expect(result.models).toBeUndefined();
    expect(result.gateway).toBeUndefined();
  });

  it("handles nested $include in sub-objects", () => {
    const modelsFile = configPath("models.json");
    const files = {
      [modelsFile]: {
        default: "claude-3",
        providers: { anthropic: { apiKey: "sk-123" } },
      },
    };
    const resolver = createMockResolver(files);

    const rawParsed = {
      name: "my-bot",
      models: {
        $include: "./models.json",
      },
    };

    const incoming = {
      name: "my-bot",
      models: {
        default: "claude-3",
        providers: { anthropic: { apiKey: "sk-123" } },
      },
    };

    const result = restoreIncludeDirectives(
      incoming,
      rawParsed,
      DEFAULT_CONFIG_PATH,
      resolver,
    ) as Record<string, unknown>;

    expect(result.name).toBe("my-bot");
    // Nested $include should be preserved
    const models = result.models as Record<string, unknown>;
    expect(models.$include).toBe("./models.json");
    // Keys from the nested include should not be inlined
    expect(models.default).toBeUndefined();
    expect(models.providers).toBeUndefined();
  });

  it("preserves sibling overrides alongside nested $include", () => {
    const modelsFile = configPath("models.json");
    const files = {
      [modelsFile]: { default: "claude-3" },
    };
    const resolver = createMockResolver(files);

    const rawParsed = {
      models: {
        $include: "./models.json",
        temperature: 0.7, // Sibling override
      },
    };

    const incoming = {
      models: {
        default: "claude-3",
        temperature: 0.9, // Updated sibling
      },
    };

    const result = restoreIncludeDirectives(
      incoming,
      rawParsed,
      DEFAULT_CONFIG_PATH,
      resolver,
    ) as Record<string, unknown>;

    const models = result.models as Record<string, unknown>;
    expect(models.$include).toBe("./models.json");
    expect(models.temperature).toBe(0.9);
    expect(models.default).toBeUndefined(); // From include, unchanged
  });

  it("falls back to incoming when include resolution fails", () => {
    const resolver = createMockResolver({}); // No files available

    const rawParsed = {
      $include: "./missing.json",
      name: "my-bot",
    };

    const incoming = {
      name: "my-bot",
      extra: "value",
    };

    const result = restoreIncludeDirectives(incoming, rawParsed, DEFAULT_CONFIG_PATH, resolver);
    expect(result).toEqual(incoming);
  });

  it("handles non-object incoming gracefully", () => {
    const resolver = createMockResolver({});
    const rawParsed = { $include: "./base.json" };

    expect(restoreIncludeDirectives("string", rawParsed, DEFAULT_CONFIG_PATH, resolver)).toBe(
      "string",
    );
    expect(restoreIncludeDirectives(42, rawParsed, DEFAULT_CONFIG_PATH, resolver)).toBe(42);
    expect(restoreIncludeDirectives(null, rawParsed, DEFAULT_CONFIG_PATH, resolver)).toBe(null);
  });

  it("handles non-object rawParsed gracefully", () => {
    const resolver = createMockResolver({});
    const incoming = { name: "bot" };

    expect(restoreIncludeDirectives(incoming, "string", DEFAULT_CONFIG_PATH, resolver)).toEqual(
      incoming,
    );
    expect(restoreIncludeDirectives(incoming, null, DEFAULT_CONFIG_PATH, resolver)).toEqual(
      incoming,
    );
  });

  it("removes sibling keys that were deleted from incoming", () => {
    const baseFile = configPath("base.json");
    const files = { [baseFile]: { models: { default: "claude-3" } } };
    const resolver = createMockResolver(files);

    const rawParsed = {
      $include: "./base.json",
      name: "my-bot",
      obsoleteKey: "old-value",
    };

    const incoming = {
      models: { default: "claude-3" },
      name: "my-bot",
      // obsoleteKey intentionally removed
    };

    const result = restoreIncludeDirectives(
      incoming,
      rawParsed,
      DEFAULT_CONFIG_PATH,
      resolver,
    ) as Record<string, unknown>;

    expect(result.$include).toBe("./base.json");
    expect(result.name).toBe("my-bot");
    expect(result.obsoleteKey).toBeUndefined();
  });

  it("preserves $include with multiple levels of nesting", () => {
    const baseFile = configPath("base.json");
    const modelsFile = configPath("models.json");
    const files = {
      [baseFile]: { gateway: { port: 3000 } },
      [modelsFile]: { default: "claude-3" },
    };
    const resolver = createMockResolver(files);

    const rawParsed = {
      $include: "./base.json",
      name: "my-bot",
      models: {
        $include: "./models.json",
        temperature: 0.5,
      },
    };

    const incoming = {
      gateway: { port: 3000 },
      name: "updated",
      models: {
        default: "claude-3",
        temperature: 0.8,
      },
    };

    const result = restoreIncludeDirectives(
      incoming,
      rawParsed,
      DEFAULT_CONFIG_PATH,
      resolver,
    ) as Record<string, unknown>;

    // Top-level $include preserved
    expect(result.$include).toBe("./base.json");
    expect(result.name).toBe("updated");
    expect(result.gateway).toBeUndefined(); // From top-level include

    // Nested $include preserved
    const models = result.models as Record<string, unknown>;
    expect(models.$include).toBe("./models.json");
    expect(models.temperature).toBe(0.8);
    expect(models.default).toBeUndefined(); // From nested include
  });
});
