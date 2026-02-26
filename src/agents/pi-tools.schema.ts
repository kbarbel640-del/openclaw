import type { AnyAgentTool } from "./pi-tools.types.js";
import { cleanSchemaForGemini } from "./schema/clean-for-gemini.js";

function extractEnumValues(schema: unknown): unknown[] | undefined {
  if (!schema || typeof schema !== "object") {
    return undefined;
  }
  const record = schema as Record<string, unknown>;
  if (Array.isArray(record.enum)) {
    return record.enum;
  }
  if ("const" in record) {
    return [record.const];
  }
  const variants = Array.isArray(record.anyOf)
    ? record.anyOf
    : Array.isArray(record.oneOf)
      ? record.oneOf
      : null;
  if (variants) {
    const values = variants.flatMap((variant) => {
      const extracted = extractEnumValues(variant);
      return extracted ?? [];
    });
    return values.length > 0 ? values : undefined;
  }
  return undefined;
}

function mergePropertySchemas(existing: unknown, incoming: unknown): unknown {
  if (!existing) {
    return incoming;
  }
  if (!incoming) {
    return existing;
  }

  const existingEnum = extractEnumValues(existing);
  const incomingEnum = extractEnumValues(incoming);
  if (existingEnum || incomingEnum) {
    const values = Array.from(new Set([...(existingEnum ?? []), ...(incomingEnum ?? [])]));
    const merged: Record<string, unknown> = {};
    for (const source of [existing, incoming]) {
      if (!source || typeof source !== "object") {
        continue;
      }
      const record = source as Record<string, unknown>;
      for (const key of ["title", "description", "default"]) {
        if (!(key in merged) && key in record) {
          merged[key] = record[key];
        }
      }
    }
    const types = new Set(values.map((value) => typeof value));
    if (types.size === 1) {
      merged.type = Array.from(types)[0];
    }
    merged.enum = values;
    return merged;
  }

  return existing;
}

/**
 * Converts the legacy array-of-parameter-descriptors format to a JSON Schema
 * object so all downstream schema processing can handle it uniformly.
 *
 * Array format: `[{ name, type, description, required }]`
 * JSON Schema:  `{ type: "object", properties: { … }, required: […] }`
 */
function arrayParametersToJsonSchema(params: unknown[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const param of params) {
    if (!param || typeof param !== "object") {
      continue;
    }
    const p = param as Record<string, unknown>;
    const name = typeof p.name === "string" ? p.name : undefined;
    if (!name) {
      continue;
    }
    const propSchema: Record<string, unknown> = {};
    if (typeof p.type === "string") {
      propSchema.type = p.type;
    }
    if (typeof p.description === "string") {
      propSchema.description = p.description;
    }
    // Carry through any other standard JSON Schema keywords (enum, default, …)
    for (const key of Object.keys(p)) {
      if (key !== "name" && key !== "required" && !(key in propSchema)) {
        propSchema[key] = p[key];
      }
    }
    properties[name] = propSchema;
    if (p.required === true) {
      required.push(name);
    }
  }
  const schema: Record<string, unknown> = { type: "object", properties };
  if (required.length > 0) {
    schema.required = required;
  }
  return schema;
}

export function normalizeToolParameters(
  tool: AnyAgentTool,
  options?: { modelProvider?: string },
): AnyAgentTool {
  // Plugins/skills sometimes pass parameters as an array of descriptor objects
  // (e.g. [{ name, type, description, required }]). typeof [] === "object" so the
  // array would pass the guard below, but the subsequent JSON Schema checks
  // ("type" in schema, "properties" in schema) all fail for arrays, causing the
  // raw array to be forwarded to the provider — which rejects it (e.g. Gemini
  // returns "schema at top-level must be a boolean or an object").  Convert to
  // a proper JSON Schema before any other normalisation runs.
  const rawParams = tool.parameters;
  const normalizedTool: AnyAgentTool = Array.isArray(rawParams)
    ? { ...tool, parameters: arrayParametersToJsonSchema(rawParams as unknown[]) }
    : tool;

  const schema =
    normalizedTool.parameters && typeof normalizedTool.parameters === "object"
      ? (normalizedTool.parameters as Record<string, unknown>)
      : undefined;
  if (!schema) {
    return normalizedTool;
  }

  // Provider quirks:
  // - Gemini rejects several JSON Schema keywords, so we scrub those.
  // - OpenAI rejects function tool schemas unless the *top-level* is `type: "object"`.
  //   (TypeBox root unions compile to `{ anyOf: [...] }` without `type`).
  // - Anthropic expects full JSON Schema draft 2020-12 compliance.
  //
  // Normalize once here so callers can always pass `tools` through unchanged.

  const isGeminiProvider =
    options?.modelProvider?.toLowerCase().includes("google") ||
    options?.modelProvider?.toLowerCase().includes("gemini");
  const isAnthropicProvider = options?.modelProvider?.toLowerCase().includes("anthropic");

  // If schema already has type + properties (no top-level anyOf to merge),
  // clean it for Gemini compatibility (but only if using Gemini, not Anthropic)
  if ("type" in schema && "properties" in schema && !Array.isArray(schema.anyOf)) {
    return {
      ...normalizedTool,
      parameters: isGeminiProvider && !isAnthropicProvider ? cleanSchemaForGemini(schema) : schema,
    };
  }

  // Some tool schemas (esp. unions) may omit `type` at the top-level. If we see
  // object-ish fields, force `type: "object"` so OpenAI accepts the schema.
  if (
    !("type" in schema) &&
    (typeof schema.properties === "object" || Array.isArray(schema.required)) &&
    !Array.isArray(schema.anyOf) &&
    !Array.isArray(schema.oneOf)
  ) {
    const schemaWithType = { ...schema, type: "object" };
    return {
      ...normalizedTool,
      parameters:
        isGeminiProvider && !isAnthropicProvider
          ? cleanSchemaForGemini(schemaWithType)
          : schemaWithType,
    };
  }

  const variantKey = Array.isArray(schema.anyOf)
    ? "anyOf"
    : Array.isArray(schema.oneOf)
      ? "oneOf"
      : null;
  if (!variantKey) {
    return normalizedTool;
  }
  const variants = schema[variantKey] as unknown[];
  const mergedProperties: Record<string, unknown> = {};
  const requiredCounts = new Map<string, number>();
  let objectVariants = 0;

  for (const entry of variants) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const props = (entry as { properties?: unknown }).properties;
    if (!props || typeof props !== "object") {
      continue;
    }
    objectVariants += 1;
    for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
      if (!(key in mergedProperties)) {
        mergedProperties[key] = value;
        continue;
      }
      mergedProperties[key] = mergePropertySchemas(mergedProperties[key], value);
    }
    const required = Array.isArray((entry as { required?: unknown }).required)
      ? (entry as { required: unknown[] }).required
      : [];
    for (const key of required) {
      if (typeof key !== "string") {
        continue;
      }
      requiredCounts.set(key, (requiredCounts.get(key) ?? 0) + 1);
    }
  }

  const baseRequired = Array.isArray(schema.required)
    ? schema.required.filter((key) => typeof key === "string")
    : undefined;
  const mergedRequired =
    baseRequired && baseRequired.length > 0
      ? baseRequired
      : objectVariants > 0
        ? Array.from(requiredCounts.entries())
            .filter(([, count]) => count === objectVariants)
            .map(([key]) => key)
        : undefined;

  const nextSchema: Record<string, unknown> = { ...schema };
  const flattenedSchema = {
    type: "object",
    ...(typeof nextSchema.title === "string" ? { title: nextSchema.title } : {}),
    ...(typeof nextSchema.description === "string" ? { description: nextSchema.description } : {}),
    properties:
      Object.keys(mergedProperties).length > 0 ? mergedProperties : (schema.properties ?? {}),
    ...(mergedRequired && mergedRequired.length > 0 ? { required: mergedRequired } : {}),
    additionalProperties: "additionalProperties" in schema ? schema.additionalProperties : true,
  };

  return {
    ...normalizedTool,
    // Flatten union schemas into a single object schema:
    // - Gemini doesn't allow top-level `type` together with `anyOf`.
    // - OpenAI rejects schemas without top-level `type: "object"`.
    // - Anthropic accepts proper JSON Schema with constraints.
    // Merging properties preserves useful enums like `action` while keeping schemas portable.
    parameters:
      isGeminiProvider && !isAnthropicProvider
        ? cleanSchemaForGemini(flattenedSchema)
        : flattenedSchema,
  };
}

/**
 * @deprecated Use normalizeToolParameters with modelProvider instead.
 * This function should only be used for Gemini providers.
 */
export function cleanToolSchemaForGemini(schema: Record<string, unknown>): unknown {
  return cleanSchemaForGemini(schema);
}
