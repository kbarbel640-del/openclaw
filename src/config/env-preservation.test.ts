import { describe, expect, it } from "vitest";
import {
  collectEnvVarReferences,
  createEnvVarPreservationMap,
  restoreFromPreservationMap,
} from "./env-preservation.js";

describe("collectEnvVarReferences", () => {
  it("collects single env var reference", () => {
    const raw = {
      models: {
        providers: {
          anthropic: {
            apiKey: "${ANTHROPIC_API_KEY}",
          },
        },
      },
    };

    const refs = collectEnvVarReferences(raw);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      path: "models.providers.anthropic.apiKey",
      varName: "ANTHROPIC_API_KEY",
      originalValue: "${ANTHROPIC_API_KEY}",
    });
  });

  it("collects multiple env var references", () => {
    const raw = {
      models: {
        providers: {
          anthropic: { apiKey: "${ANTHROPIC_API_KEY}" },
          openai: { apiKey: "${OPENAI_API_KEY}" },
        },
      },
      gateway: {
        auth: {
          token: "${GATEWAY_TOKEN}",
        },
      },
    };

    const refs = collectEnvVarReferences(raw);
    expect(refs).toHaveLength(3);
    expect(refs.map((r) => r.varName).toSorted()).toEqual([
      "ANTHROPIC_API_KEY",
      "GATEWAY_TOKEN",
      "OPENAI_API_KEY",
    ]);
  });

  it("collects env vars in arrays", () => {
    const raw = {
      items: [{ key: "${VAR_ONE}" }, { key: "${VAR_TWO}" }],
    };

    const refs = collectEnvVarReferences(raw);
    expect(refs).toHaveLength(2);
    expect(refs[0].path).toBe("items[0].key");
    expect(refs[1].path).toBe("items[1].key");
  });

  it("ignores non-env-var strings", () => {
    const raw = {
      name: "my-agent",
      version: "1.0.0",
      nested: {
        value: "plain text",
      },
    };

    const refs = collectEnvVarReferences(raw);
    expect(refs).toHaveLength(0);
  });

  it("handles embedded env vars in strings", () => {
    const raw = {
      url: "https://api.example.com?key=${API_KEY}",
    };

    const refs = collectEnvVarReferences(raw);
    expect(refs).toHaveLength(1);
    expect(refs[0].varName).toBe("API_KEY");
  });
});

describe("createEnvVarPreservationMap", () => {
  it("creates map with paths and original values", () => {
    const raw = {
      models: {
        providers: {
          anthropic: { apiKey: "${ANTHROPIC_API_KEY}" },
        },
      },
    };

    const map = createEnvVarPreservationMap(raw);
    expect(map.size).toBe(1);
    expect(map.get("models.providers.anthropic.apiKey")).toBe("${ANTHROPIC_API_KEY}");
  });
});

describe("restoreFromPreservationMap", () => {
  it("restores env var references when values match", () => {
    const env = {
      ANTHROPIC_API_KEY: "sk-ant-secret-key",
    };

    const config = {
      models: {
        providers: {
          anthropic: { apiKey: "sk-ant-secret-key" },
        },
      },
    };

    const preservationMap = new Map([
      ["models.providers.anthropic.apiKey", "${ANTHROPIC_API_KEY}"],
    ]);

    const restored = restoreFromPreservationMap(config, preservationMap, env);
    expect((restored as typeof config).models.providers.anthropic.apiKey).toBe(
      "${ANTHROPIC_API_KEY}",
    );
  });

  it("does not restore when value has changed", () => {
    const env = {
      ANTHROPIC_API_KEY: "sk-ant-original",
    };

    const config = {
      models: {
        providers: {
          anthropic: { apiKey: "sk-ant-new-key" },
        },
      },
    };

    const preservationMap = new Map([
      ["models.providers.anthropic.apiKey", "${ANTHROPIC_API_KEY}"],
    ]);

    const restored = restoreFromPreservationMap(config, preservationMap, env);
    expect((restored as typeof config).models.providers.anthropic.apiKey).toBe("sk-ant-new-key");
  });

  it("handles multiple env vars", () => {
    const env = {
      ANTHROPIC_API_KEY: "sk-ant-key",
      OPENAI_API_KEY: "sk-openai-key",
    };

    const config = {
      models: {
        providers: {
          anthropic: { apiKey: "sk-ant-key" },
          openai: { apiKey: "sk-openai-key" },
        },
      },
    };

    const preservationMap = new Map([
      ["models.providers.anthropic.apiKey", "${ANTHROPIC_API_KEY}"],
      ["models.providers.openai.apiKey", "${OPENAI_API_KEY}"],
    ]);

    const restored = restoreFromPreservationMap(config, preservationMap, env) as typeof config;
    expect(restored.models.providers.anthropic.apiKey).toBe("${ANTHROPIC_API_KEY}");
    expect(restored.models.providers.openai.apiKey).toBe("${OPENAI_API_KEY}");
  });

  it("does not mutate the original config", () => {
    const env = {
      API_KEY: "secret",
    };

    const config = {
      key: "secret",
    };

    const preservationMap = new Map([["key", "${API_KEY}"]]);

    const restored = restoreFromPreservationMap(config, preservationMap, env);
    expect(config.key).toBe("secret");
    expect((restored as typeof config).key).toBe("${API_KEY}");
  });

  it("handles embedded env vars in strings", () => {
    const env = {
      API_KEY: "my-secret",
    };

    const config = {
      url: "https://api.example.com?key=my-secret",
    };

    const preservationMap = new Map([["url", "https://api.example.com?key=${API_KEY}"]]);

    const restored = restoreFromPreservationMap(config, preservationMap, env);
    expect((restored as typeof config).url).toBe("https://api.example.com?key=${API_KEY}");
  });

  it("handles array paths", () => {
    const env = {
      TOKEN: "secret-token",
    };

    const config = {
      items: [{ token: "secret-token" }, { token: "other" }],
    };

    const preservationMap = new Map([["items[0].token", "${TOKEN}"]]);

    const restored = restoreFromPreservationMap(config, preservationMap, env) as typeof config;
    expect(restored.items[0].token).toBe("${TOKEN}");
    expect(restored.items[1].token).toBe("other");
  });

  it("returns config as-is when preservation map is empty", () => {
    const config = { key: "value" };
    const restored = restoreFromPreservationMap(config, new Map(), {});
    expect(restored).toEqual(config);
  });

  it("skips restoration when env var is not set", () => {
    const config = {
      key: "some-value",
    };

    const preservationMap = new Map([["key", "${MISSING_VAR}"]]);

    const restored = restoreFromPreservationMap(config, preservationMap, {});
    expect((restored as typeof config).key).toBe("some-value");
  });
});
