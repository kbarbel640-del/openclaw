import { describe, expect, it } from "vitest";
import type { JsonSchema } from "../../views/config-form.shared.ts";
import { coerceFormValues } from "./form-coerce.ts";
import { cloneConfigObject, serializeConfigForm, setPathValue } from "./form-utils.ts";

/**
 * Minimal model provider schema matching the Zod-generated JSON Schema for
 * `models.providers` (see zod-schema.core.ts → ModelDefinitionSchema).
 */
const modelDefinitionSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    reasoning: { type: "boolean" },
    contextWindow: { type: "number" },
    maxTokens: { type: "number" },
    cost: {
      type: "object",
      properties: {
        input: { type: "number" },
        output: { type: "number" },
        cacheRead: { type: "number" },
        cacheWrite: { type: "number" },
      },
    },
  },
};

const modelProviderSchema: JsonSchema = {
  type: "object",
  properties: {
    baseUrl: { type: "string" },
    apiKey: { type: "string" },
    models: {
      type: "array",
      items: modelDefinitionSchema,
    },
  },
};

const modelsConfigSchema: JsonSchema = {
  type: "object",
  properties: {
    providers: {
      type: "object",
      additionalProperties: modelProviderSchema,
    },
  },
};

const topLevelSchema: JsonSchema = {
  type: "object",
  properties: {
    gateway: {
      type: "object",
      properties: {
        auth: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
        },
      },
    },
    models: modelsConfigSchema,
  },
};

function makeConfigWithProvider(): Record<string, unknown> {
  return {
    gateway: { auth: { token: "test-token" } },
    models: {
      providers: {
        xai: {
          baseUrl: "https://api.x.ai/v1",
          models: [
            {
              id: "grok-4",
              name: "Grok 4",
              contextWindow: 131072,
              maxTokens: 8192,
              cost: { input: 0.5, output: 1.0, cacheRead: 0.1, cacheWrite: 0.2 },
            },
          ],
        },
      },
    },
  };
}

describe("form-utils preserves numeric types", () => {
  it("serializeConfigForm preserves numbers in JSON output", () => {
    const form = makeConfigWithProvider();
    const raw = serializeConfigForm(form);
    const parsed = JSON.parse(raw);
    const model = parsed.models.providers.xai.models[0];

    expect(typeof model.maxTokens).toBe("number");
    expect(model.maxTokens).toBe(8192);
    expect(typeof model.contextWindow).toBe("number");
    expect(model.contextWindow).toBe(131072);
    expect(typeof model.cost.input).toBe("number");
    expect(model.cost.input).toBe(0.5);
  });

  it("cloneConfigObject + setPathValue preserves unrelated numeric fields", () => {
    const form = makeConfigWithProvider();
    const cloned = cloneConfigObject(form);
    setPathValue(cloned, ["gateway", "auth", "token"], "new-token");

    const model = cloned.models as Record<string, unknown>;
    const providers = model.providers as Record<string, unknown>;
    const xai = providers.xai as Record<string, unknown>;
    const models = xai.models as Array<Record<string, unknown>>;
    const first = models[0];

    expect(typeof first.maxTokens).toBe("number");
    expect(first.maxTokens).toBe(8192);
    expect(typeof first.contextWindow).toBe("number");
    expect(typeof first.cost).toBe("object");
    expect(typeof (first.cost as Record<string, unknown>).input).toBe("number");
  });
});

describe("coerceFormValues", () => {
  it("coerces string numbers to numbers based on schema", () => {
    const form = {
      models: {
        providers: {
          xai: {
            baseUrl: "https://api.x.ai/v1",
            models: [
              {
                id: "grok-4",
                name: "Grok 4",
                contextWindow: "131072",
                maxTokens: "8192",
                cost: { input: "0.5", output: "1.0", cacheRead: "0.1", cacheWrite: "0.2" },
              },
            ],
          },
        },
      },
    };

    const coerced = coerceFormValues(form, topLevelSchema) as Record<string, unknown>;
    const model = (
      ((coerced.models as Record<string, unknown>).providers as Record<string, unknown>)
        .xai as Record<string, unknown>
    ).models as Array<Record<string, unknown>>;
    const first = model[0];

    expect(typeof first.maxTokens).toBe("number");
    expect(first.maxTokens).toBe(8192);
    expect(typeof first.contextWindow).toBe("number");
    expect(first.contextWindow).toBe(131072);
    expect(typeof first.cost).toBe("object");
    const cost = first.cost as Record<string, number>;
    expect(typeof cost.input).toBe("number");
    expect(cost.input).toBe(0.5);
    expect(typeof cost.output).toBe("number");
    expect(cost.output).toBe(1);
    expect(typeof cost.cacheRead).toBe("number");
    expect(cost.cacheRead).toBe(0.1);
    expect(typeof cost.cacheWrite).toBe("number");
    expect(cost.cacheWrite).toBe(0.2);
  });

  it("preserves already-correct numeric values", () => {
    const form = makeConfigWithProvider();
    const coerced = coerceFormValues(form, topLevelSchema) as Record<string, unknown>;
    const model = (
      ((coerced.models as Record<string, unknown>).providers as Record<string, unknown>)
        .xai as Record<string, unknown>
    ).models as Array<Record<string, unknown>>;
    const first = model[0];

    expect(typeof first.maxTokens).toBe("number");
    expect(first.maxTokens).toBe(8192);
  });

  it("does not coerce non-numeric strings to numbers", () => {
    const form = {
      models: {
        providers: {
          xai: {
            baseUrl: "https://api.x.ai/v1",
            models: [
              {
                id: "grok-4",
                name: "Grok 4",
                maxTokens: "not-a-number",
              },
            ],
          },
        },
      },
    };

    const coerced = coerceFormValues(form, topLevelSchema) as Record<string, unknown>;
    const model = (
      ((coerced.models as Record<string, unknown>).providers as Record<string, unknown>)
        .xai as Record<string, unknown>
    ).models as Array<Record<string, unknown>>;
    const first = model[0];

    expect(first.maxTokens).toBe("not-a-number");
  });

  it("coerces string booleans to booleans based on schema", () => {
    const form = {
      models: {
        providers: {
          xai: {
            baseUrl: "https://api.x.ai/v1",
            models: [
              {
                id: "grok-4",
                name: "Grok 4",
                reasoning: "true",
              },
            ],
          },
        },
      },
    };

    const coerced = coerceFormValues(form, topLevelSchema) as Record<string, unknown>;
    const model = (
      ((coerced.models as Record<string, unknown>).providers as Record<string, unknown>)
        .xai as Record<string, unknown>
    ).models as Array<Record<string, unknown>>;
    expect(model[0].reasoning).toBe(true);
  });

  it("handles empty string for number fields as undefined", () => {
    const form = {
      models: {
        providers: {
          xai: {
            baseUrl: "https://api.x.ai/v1",
            models: [
              {
                id: "grok-4",
                name: "Grok 4",
                maxTokens: "",
              },
            ],
          },
        },
      },
    };

    const coerced = coerceFormValues(form, topLevelSchema) as Record<string, unknown>;
    const model = (
      ((coerced.models as Record<string, unknown>).providers as Record<string, unknown>)
        .xai as Record<string, unknown>
    ).models as Array<Record<string, unknown>>;
    expect(model[0].maxTokens).toBeUndefined();
  });

  it("passes through null and undefined values untouched", () => {
    expect(coerceFormValues(null, topLevelSchema)).toBeNull();
    expect(coerceFormValues(undefined, topLevelSchema)).toBeUndefined();
  });

  it("handles anyOf schemas with number variant", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        timeout: {
          anyOf: [{ type: "number" }, { type: "string" }],
        },
      },
    };
    const form = { timeout: "30" };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    expect(typeof coerced.timeout).toBe("number");
    expect(coerced.timeout).toBe(30);
  });

  it("handles integer schema type", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        count: { type: "integer" },
      },
    };
    const form = { count: "42" };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    expect(typeof coerced.count).toBe("number");
    expect(coerced.count).toBe(42);
  });

  it("rejects non-integer string for integer schema type", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        count: { type: "integer" },
      },
    };
    const form = { count: "1.5" };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    expect(coerced.count).toBe("1.5");
  });

  it("does not coerce non-finite numeric strings", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        timeout: { type: "number" },
      },
    };
    const form = { timeout: "Infinity" };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    expect(coerced.timeout).toBe("Infinity");
  });

  it("supports allOf schema composition", () => {
    const schema: JsonSchema = {
      allOf: [
        {
          type: "object",
          properties: {
            port: { type: "number" },
          },
        },
        {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
        },
      ],
    };
    const form = { port: "8080", enabled: "true" };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    expect(coerced.port).toBe(8080);
    expect(coerced.enabled).toBe(true);
  });

  it("recurses into object inside anyOf (nullable pattern)", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        settings: {
          anyOf: [
            {
              type: "object",
              properties: {
                port: { type: "number" },
                enabled: { type: "boolean" },
              },
            },
            { type: "null" },
          ],
        },
      },
    };
    const form = { settings: { port: "8080", enabled: "true" } };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    const settings = coerced.settings as Record<string, unknown>;
    expect(typeof settings.port).toBe("number");
    expect(settings.port).toBe(8080);
    expect(settings.enabled).toBe(true);
  });

  it("recurses into array inside anyOf", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        items: {
          anyOf: [
            {
              type: "array",
              items: { type: "object", properties: { count: { type: "number" } } },
            },
            { type: "null" },
          ],
        },
      },
    };
    const form = { items: [{ count: "5" }] };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    const items = coerced.items as Array<Record<string, unknown>>;
    expect(typeof items[0].count).toBe("number");
    expect(items[0].count).toBe(5);
  });

  it("handles tuple array schemas by index", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        pair: {
          type: "array",
          items: [{ type: "string" }, { type: "number" }],
        },
      },
    };
    const form = { pair: ["hello", "42"] };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    const pair = coerced.pair as unknown[];
    expect(pair[0]).toBe("hello");
    expect(typeof pair[1]).toBe("number");
    expect(pair[1]).toBe(42);
  });

  it("preserves tuple indexes when a value is cleared", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        tuple: {
          type: "array",
          items: [{ type: "string" }, { type: "number" }, { type: "string" }],
        },
      },
    };
    const form = { tuple: ["left", "", "right"] };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    const tuple = coerced.tuple as unknown[];
    expect(tuple).toHaveLength(3);
    expect(tuple[0]).toBe("left");
    expect(tuple[1]).toBeUndefined();
    expect(tuple[2]).toBe("right");
  });

  it("omits cleared number field from object output", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        port: { type: "number" },
      },
    };
    const form = { name: "test", port: "" };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    expect(coerced.name).toBe("test");
    expect("port" in coerced).toBe(false);
  });

  it("filters undefined from array when number item is cleared", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        values: {
          type: "array",
          items: { type: "number" },
        },
      },
    };
    const form = { values: ["1", "", "3"] };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    const values = coerced.values as number[];
    expect(values).toEqual([1, 3]);
  });

  it("preserves large integer strings to avoid precision loss (Discord snowflake IDs)", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        guilds: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              users: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    };
    // Discord snowflake IDs that exceed Number.MAX_SAFE_INTEGER
    const form = {
      guilds: {
        "1475864306469048424": {
          users: ["823475887319941131", "648702641379082240", "648871246523662342"],
        },
      },
    };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    const guilds = coerced.guilds as Record<string, Record<string, unknown>>;
    const users = guilds["1475864306469048424"].users as string[];
    // All IDs should remain as strings, not converted to numbers
    expect(typeof users[0]).toBe("string");
    expect(users[0]).toBe("823475887319941131");
    expect(typeof users[1]).toBe("string");
    expect(users[1]).toBe("648702641379082240");
    expect(typeof users[2]).toBe("string");
    expect(users[2]).toBe("648871246523662342");
  });

  it("preserves large integers in number schema when they exceed MAX_SAFE_INTEGER", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        id: { type: "number" },
      },
    };
    // A number larger than Number.MAX_SAFE_INTEGER (2^53 - 1 = 9007199254740991)
    const form = { id: "9007199254740992" };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    // Should remain as string to preserve precision
    expect(typeof coerced.id).toBe("string");
    expect(coerced.id).toBe("9007199254740992");
  });

  it("coerces scientific notation normally even for large values", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        value: { type: "number" },
      },
    };
    // Scientific notation should be coerced to number even if the value is large
    const form = { value: "1e20" };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    expect(typeof coerced.value).toBe("number");
    expect(coerced.value).toBe(1e20);
  });

  it("coerces small integers normally even with number schema", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        port: { type: "number" },
      },
    };
    const form = { port: "8080" };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    expect(typeof coerced.port).toBe("number");
    expect(coerced.port).toBe(8080);
  });

  it("coerces boolean in anyOf union", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        flag: {
          anyOf: [{ type: "boolean" }, { type: "string" }],
        },
      },
    };
    const form = { flag: "true" };
    const coerced = coerceFormValues(form, schema) as Record<string, unknown>;
    expect(coerced.flag).toBe(true);
  });
});
