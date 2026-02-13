import { z } from "zod";

export type SchemaCategory =
  | "object"
  | "array"
  | "record"
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "literal"
  | "union"
  | "unknown";

export type ChildEntry = {
  key: string;
  category: SchemaCategory;
  typeLabel: string;
  optional: boolean;
  options?: Array<string | number | boolean>;
};

export type TypeDescriptor = {
  category: SchemaCategory;
  typeLabel: string;
  options: Array<string | number | boolean>;
  constraints: string[];
};

export type ResolvedNode = {
  schema: z.ZodTypeAny;
  unwrapped: z.ZodTypeAny;
  category: SchemaCategory;
  optional: boolean;
};

export type ResolveSuccess = {
  ok: true;
  path: string[];
  node: ResolvedNode;
};

export type ResolveFailure = {
  ok: false;
  input: string[];
  matchedPath: string[];
  failedSegment: string;
  reason: "missing-key" | "not-traversable" | "expected-index";
  suggestions: string[];
};

export type ResolveResult = ResolveSuccess | ResolveFailure;

function getDef(schema: z.ZodTypeAny): Record<string, unknown> {
  return (schema as unknown as { _def?: Record<string, unknown> })._def ?? {};
}

function isZodType(value: unknown): value is z.ZodTypeAny {
  return Boolean(value) && typeof value === "object" && "safeParse" in (value as object);
}

export function unwrapSchema(schema: z.ZodTypeAny): {
  schema: z.ZodTypeAny;
  optional: boolean;
} {
  let current = schema;
  let optional = false;

  for (let i = 0; i < 32; i += 1) {
    const def = getDef(current);
    const type = def.type;

    if (type === "optional") {
      optional = true;
      const inner = def.innerType;
      if (isZodType(inner)) {
        current = inner;
        continue;
      }
      break;
    }

    if (
      type === "nullable" ||
      type === "default" ||
      type === "catch" ||
      type === "readonly" ||
      type === "nonoptional"
    ) {
      const inner = def.innerType;
      if (isZodType(inner)) {
        current = inner;
        continue;
      }
      break;
    }

    if (type === "pipe") {
      const out = def.out;
      if (isZodType(out)) {
        current = out;
        continue;
      }
      break;
    }

    if (type === "lazy") {
      const getter = def.getter;
      if (typeof getter === "function") {
        const next = getter();
        if (isZodType(next)) {
          current = next;
          continue;
        }
      }
      break;
    }

    break;
  }

  return { schema: current, optional };
}

function mapCategory(schema: z.ZodTypeAny): SchemaCategory {
  const type = getDef(schema).type;
  switch (type) {
    case "object":
    case "array":
    case "record":
    case "string":
    case "number":
    case "boolean":
    case "enum":
    case "literal":
    case "union":
      return type;
    default:
      return "unknown";
  }
}

function getObjectShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
  const def = getDef(schema);
  if (def.type !== "object") {
    return {};
  }
  const rawShape = def.shape;
  if (typeof rawShape === "function") {
    const resolved = rawShape();
    return (resolved as Record<string, z.ZodTypeAny>) ?? {};
  }
  return (rawShape as Record<string, z.ZodTypeAny>) ?? {};
}

function isUnionOfLiterals(schema: z.ZodTypeAny): boolean {
  const def = getDef(schema);
  if (def.type !== "union") {
    return false;
  }
  const options = Array.isArray(def.options) ? def.options : [];
  if (options.length === 0) {
    return false;
  }
  return options.every((option) => getDef(option as z.ZodTypeAny).type === "literal");
}

export function extractEnumOptions(schema: z.ZodTypeAny): Array<string | number | boolean> {
  const unwrapped = unwrapSchema(schema).schema;
  const def = getDef(unwrapped);

  if (def.type === "enum") {
    const entries = def.entries as Record<string, string> | undefined;
    if (!entries || typeof entries !== "object") {
      return [];
    }
    return Object.values(entries);
  }

  if (def.type === "literal") {
    const values = def.values;
    if (Array.isArray(values)) {
      return values as Array<string | number | boolean>;
    }
    return [];
  }

  if (def.type === "union") {
    if (!isUnionOfLiterals(unwrapped)) {
      return [];
    }
    const options = Array.isArray(def.options) ? def.options : [];
    return options
      .flatMap((option) => {
        const optionDef = getDef(option as z.ZodTypeAny);
        const values = optionDef.values;
        return Array.isArray(values) ? (values as Array<string | number | boolean>) : [];
      })
      .filter((value): value is string | number | boolean =>
        ["string", "number", "boolean"].includes(typeof value),
      );
  }

  return [];
}

function numberConstraints(schema: z.ZodTypeAny): string[] {
  const checks = (getDef(schema).checks as Array<Record<string, unknown>> | undefined) ?? [];
  const tags: string[] = [];

  for (const check of checks) {
    const raw = check;
    const inner = (raw as { _zod?: { def?: Record<string, unknown> } })._zod?.def;
    const def = inner ?? (raw.def as Record<string, unknown> | undefined) ?? raw;
    const kind = def.check;

    if (kind === "number_format" && def.format === "safeint" && !tags.includes("integer")) {
      tags.push("integer");
    }
    if (kind === "greater_than" && def.value === 0 && def.inclusive === false) {
      tags.push("positive");
    }
    if (kind === "greater_than" && def.value === 0 && def.inclusive === true) {
      tags.push("nonnegative");
    }
  }

  return tags;
}

function stringConstraints(schema: z.ZodTypeAny): string[] {
  const checks = (getDef(schema).checks as Array<Record<string, unknown>> | undefined) ?? [];
  const tags: string[] = [];
  for (const check of checks) {
    const raw = check;
    const inner = (raw as { _zod?: { def?: Record<string, unknown> } })._zod?.def;
    const def = inner ?? (raw.def as Record<string, unknown> | undefined) ?? raw;
    if (def.check === "min_length" && typeof def.minimum === "number" && def.minimum > 0) {
      tags.push(`min ${def.minimum}`);
    }
    if (def.check === "max_length" && typeof def.maximum === "number") {
      tags.push(`max ${def.maximum}`);
    }
  }
  return tags;
}

export function describeType(schema: z.ZodTypeAny): TypeDescriptor {
  const unwrapped = unwrapSchema(schema).schema;
  const category = mapCategory(unwrapped);
  const options = extractEnumOptions(unwrapped);

  if (category === "enum" || category === "literal" || isUnionOfLiterals(unwrapped)) {
    return {
      category: "enum",
      typeLabel: "string",
      options,
      constraints: [],
    };
  }

  if (category === "number") {
    return {
      category,
      typeLabel: "number",
      options: [],
      constraints: numberConstraints(unwrapped),
    };
  }

  if (category === "string") {
    return {
      category,
      typeLabel: "string",
      options: [],
      constraints: stringConstraints(unwrapped),
    };
  }

  if (category === "array") {
    const element = (getDef(unwrapped).element as z.ZodTypeAny | undefined) ?? z.unknown();
    const elementDesc = describeType(element);
    return {
      category,
      typeLabel: `array<${elementDesc.typeLabel}>`,
      options: [],
      constraints: [],
    };
  }

  if (category === "record") {
    const valueType = (getDef(unwrapped).valueType as z.ZodTypeAny | undefined) ?? z.unknown();
    const valueDesc = describeType(valueType);
    return {
      category,
      typeLabel: `record<string, ${valueDesc.typeLabel}>`,
      options: [],
      constraints: [],
    };
  }

  return {
    category,
    typeLabel: category === "unknown" ? "unknown" : category,
    options: [],
    constraints: [],
  };
}

export function getChildren(schema: z.ZodTypeAny): ChildEntry[] {
  const { schema: unwrapped } = unwrapSchema(schema);
  if (mapCategory(unwrapped) !== "object") {
    return [];
  }

  const shape = getObjectShape(unwrapped);
  return Object.entries(shape)
    .map(([key, child]) => {
      const unwrappedChild = unwrapSchema(child);
      const desc = describeType(child);
      return {
        key,
        category: mapCategory(unwrappedChild.schema),
        typeLabel: desc.typeLabel,
        optional: unwrappedChild.optional,
        options: desc.options.length > 0 ? desc.options : undefined,
      };
    })
    .toSorted((a, b) => a.key.localeCompare(b.key));
}

function buildNode(schema: z.ZodTypeAny): ResolvedNode {
  const unwrapped = unwrapSchema(schema);
  return {
    schema,
    unwrapped: unwrapped.schema,
    category: mapCategory(unwrapped.schema),
    optional: unwrapped.optional,
  };
}

function getSuggestionsForNode(node: z.ZodTypeAny): string[] {
  const unwrapped = unwrapSchema(node).schema;
  const category = mapCategory(unwrapped);
  if (category === "object") {
    return Object.keys(getObjectShape(unwrapped)).toSorted((a, b) => a.localeCompare(b));
  }
  if (category === "array") {
    return ["<index>"];
  }
  if (category === "record") {
    return ["<key>"];
  }
  return [];
}

export function resolveSchemaPath(root: z.ZodTypeAny, segments: string[]): ResolveResult {
  let current = root;
  const matched: string[] = [];

  for (const segment of segments) {
    const node = buildNode(current);

    if (node.category === "object") {
      const shape = getObjectShape(node.unwrapped);
      const child = shape[segment];
      if (!child) {
        return {
          ok: false,
          input: segments,
          matchedPath: matched,
          failedSegment: segment,
          reason: "missing-key",
          suggestions: Object.keys(shape).toSorted((a, b) => a.localeCompare(b)),
        };
      }
      current = child;
      matched.push(segment);
      continue;
    }

    if (node.category === "record") {
      const valueType = getDef(node.unwrapped).valueType as z.ZodTypeAny | undefined;
      if (!valueType) {
        return {
          ok: false,
          input: segments,
          matchedPath: matched,
          failedSegment: segment,
          reason: "not-traversable",
          suggestions: [],
        };
      }
      current = valueType;
      matched.push(segment);
      continue;
    }

    if (node.category === "array") {
      if (!/^[0-9]+$/.test(segment)) {
        return {
          ok: false,
          input: segments,
          matchedPath: matched,
          failedSegment: segment,
          reason: "expected-index",
          suggestions: ["<index>"],
        };
      }
      const element = getDef(node.unwrapped).element as z.ZodTypeAny | undefined;
      if (!element) {
        return {
          ok: false,
          input: segments,
          matchedPath: matched,
          failedSegment: segment,
          reason: "not-traversable",
          suggestions: [],
        };
      }
      current = element;
      matched.push(segment);
      continue;
    }

    return {
      ok: false,
      input: segments,
      matchedPath: matched,
      failedSegment: segment,
      reason: "not-traversable",
      suggestions: getSuggestionsForNode(current),
    };
  }

  return {
    ok: true,
    path: segments,
    node: buildNode(current),
  };
}

export function isBranch(node: ResolvedNode): boolean {
  return node.category === "object";
}
