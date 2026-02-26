import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonSchema = {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: JsonSchema | boolean;
  items?: JsonSchema;
  default?: unknown;
  description?: string;
  definitions?: Record<string, JsonSchema>;
};

type UiHint = {
  label?: string;
  help?: string;
  order?: number;
};

type Entry = {
  key: string;
  type: string;
  required: boolean;
  defaultValue: string;
  description: string;
  order: number;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(repoRoot, "dist", "config.schema.json");
const hintsPath = path.join(repoRoot, "dist", "config.uihints.json");
const outPath = path.join(repoRoot, "docs", "gateway", "configuration-schema-reference.md");

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 220): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

function sanitizeMarkdownText(value: string): string {
  const urlTokens: string[] = [];
  const withPlaceholders = value.replace(/https?:\/\/[^\s)]+/g, (match) => {
    let url = match;
    let trailing = "";
    while (/[.,;:]$/.test(url)) {
      trailing = `${url.slice(-1)}${trailing}`;
      url = url.slice(0, -1);
    }
    const token = `@@URL_${urlTokens.length}@@`;
    urlTokens.push(`[${url}](${url})${trailing}`);
    return token;
  });

  let sanitized = withPlaceholders
    .replaceAll("<", "\\<")
    .replaceAll(">", "\\>")
    .replaceAll("*", "\\*")
    .replaceAll("|", "\\|");

  for (let i = 0; i < urlTokens.length; i += 1) {
    sanitized = sanitized.replace(`@@URL_${i}@@`, urlTokens[i] ?? "");
  }

  return sanitized;
}

function defaultToString(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return `\`${value}\``;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `\`${String(value)}\``;
  }
  try {
    return `\`${JSON.stringify(value)}\``;
  } catch {
    return "`<complex>`";
  }
}

function getJsonPointer(root: unknown, pointer: string): unknown {
  const segments = pointer
    .replace(/^#\//, "")
    .split("/")
    .map((seg) => seg.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current: unknown = root;
  for (const seg of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function resolveRef(root: JsonSchema, node: JsonSchema, seen = new Set<string>()): JsonSchema {
  if (!node.$ref || typeof node.$ref !== "string") {
    return node;
  }
  const ref = node.$ref;
  if (!ref.startsWith("#/")) {
    return node;
  }
  if (seen.has(ref)) {
    return node;
  }
  const target = getJsonPointer(root, ref);
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return node;
  }
  const { $ref: _ref, ...overrides } = node;
  const base = resolveRef(root, target as JsonSchema, new Set([...seen, ref]));
  return { ...base, ...overrides };
}

function typeSummary(root: JsonSchema, node: JsonSchema): string {
  const resolved = resolveRef(root, node);
  if (resolved.enum && resolved.enum.length > 0) {
    return resolved.enum.map((v) => (typeof v === "string" ? `"${v}"` : String(v))).join(" | ");
  }
  if (resolved.oneOf && resolved.oneOf.length > 0) {
    const union = new Set(resolved.oneOf.map((item) => typeSummary(root, item)));
    return [...union].join(" | ");
  }
  if (resolved.anyOf && resolved.anyOf.length > 0) {
    const union = new Set(resolved.anyOf.map((item) => typeSummary(root, item)));
    return [...union].join(" | ");
  }
  if (resolved.allOf && resolved.allOf.length > 0) {
    const union = new Set(resolved.allOf.map((item) => typeSummary(root, item)));
    return [...union].join(" & ");
  }
  if (resolved.type === "array") {
    const itemType = resolved.items ? typeSummary(root, resolved.items) : "any";
    return `array<${itemType}>`;
  }
  if (Array.isArray(resolved.type)) {
    return resolved.type.join(" | ");
  }
  if (typeof resolved.type === "string") {
    return resolved.type;
  }
  if (resolved.properties || resolved.additionalProperties) {
    return "object";
  }
  return "any";
}

function flattenSchema(params: { root: JsonSchema; hints: Record<string, UiHint> }): Entry[] {
  const { root, hints } = params;
  const entries = new Map<string, Entry>();
  const visited = new Set<string>();

  const upsert = (key: string, node: JsonSchema, required: boolean) => {
    const hint = hints[key] ?? {};
    const description = normalizeWhitespace(
      hint.help ?? (typeof node.description === "string" ? node.description : ""),
    );
    const next: Entry = {
      key,
      type: typeSummary(root, node),
      required,
      defaultValue: defaultToString(node.default),
      description: truncate(description),
      order: hint.order ?? 10000,
    };
    const existing = entries.get(key);
    if (!existing) {
      entries.set(key, next);
      return;
    }
    entries.set(key, {
      ...existing,
      required: existing.required || next.required,
      defaultValue: existing.defaultValue || next.defaultValue,
      description:
        existing.description.length >= next.description.length
          ? existing.description
          : next.description,
      type: existing.type === "any" ? next.type : existing.type,
      order: Math.min(existing.order, next.order),
    });
  };

  const walk = (nodeIn: JsonSchema, key: string, required: boolean) => {
    const node = resolveRef(root, nodeIn);
    const marker = `${key}::${node.$ref ?? typeSummary(root, node)}`;
    if (visited.has(marker)) {
      return;
    }
    visited.add(marker);

    if (key) {
      upsert(key, node, required);
    }

    if (node.oneOf) {
      for (const item of node.oneOf) {
        walk(item, key, required);
      }
    }
    if (node.anyOf) {
      for (const item of node.anyOf) {
        walk(item, key, required);
      }
    }
    if (node.allOf) {
      for (const item of node.allOf) {
        walk(item, key, required);
      }
    }

    const requiredSet = new Set(node.required ?? []);
    if (node.properties) {
      for (const [prop, propSchema] of Object.entries(node.properties)) {
        const nextKey = key ? `${key}.${prop}` : prop;
        walk(propSchema, nextKey, requiredSet.has(prop));
      }
    }
    if (node.items && typeof node.items === "object" && !Array.isArray(node.items)) {
      const nextKey = key ? `${key}[]` : "[]";
      walk(node.items, nextKey, false);
    }
    if (
      node.additionalProperties &&
      typeof node.additionalProperties === "object" &&
      !Array.isArray(node.additionalProperties)
    ) {
      const nextKey = key ? `${key}.*` : "*";
      walk(node.additionalProperties, nextKey, false);
    }
  };

  walk(root, "", false);
  return [...entries.values()];
}

function sectionTitle(rootKey: string, hints: Record<string, UiHint>): string {
  return hints[rootKey]?.label ?? rootKey;
}

function sortRoots(a: string, b: string, hints: Record<string, UiHint>): number {
  const orderA = hints[a]?.order ?? 10000;
  const orderB = hints[b]?.order ?? 10000;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return a.localeCompare(b);
}

function buildDoc(params: {
  schema: JsonSchema;
  hints: Record<string, UiHint>;
  entries: Entry[];
}): string {
  const { schema, hints, entries } = params;
  const byRoot = new Map<string, Entry[]>();
  for (const entry of entries) {
    const root = entry.key.split(".")[0] ?? entry.key;
    const list = byRoot.get(root) ?? [];
    list.push(entry);
    byRoot.set(root, list);
  }

  const rootKeys = [...byRoot.keys()].toSorted((a, b) => sortRoots(a, b, hints));
  const sections: string[] = [];

  for (const root of rootKeys) {
    const list = byRoot.get(root) ?? [];
    list.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.key.localeCompare(b.key);
    });

    const heading = sectionTitle(root, hints);
    const sectionHint = hints[root]?.help
      ? `${sanitizeMarkdownText(truncate(normalizeWhitespace(hints[root].help ?? "")))}\n\n`
      : "";
    const blocks = list
      .map((entry) => {
        const defaultValue = entry.defaultValue || "_none_";
        const description = entry.description
          ? sanitizeMarkdownText(entry.description)
          : "_No description provided._";
        return `### \`${entry.key}\`

- Type: \`${entry.type}\`
- Required: ${entry.required ? "yes" : "no"}
- Default: ${defaultValue}
- Description: ${description}
`;
      })
      .join("\n");
    sections.push(`## ${heading}\n\n${sectionHint}${blocks}`);
  }

  const rootCount = Object.keys(schema.properties ?? {}).length;
  const doc = `---
title: "Configuration Schema Reference"
summary: "Generated key-by-key reference for openclaw.json from config schema"
read_when:
  - You need a complete generated list of every config key
  - You want schema-sourced docs instead of handwritten key lists
---

# Configuration Schema Reference

Generated from:

- \`dist/config.schema.json\`
- \`dist/config.uihints.json\`

This page is generated by \`pnpm config-spec:gen\`.

Totals:

- Root sections: ${rootCount}
- Documented keys: ${entries.length}

${sections.join("\n")}
`;

  const collapsed = doc.replace(/(?:[ \t]*\n){3,}/g, "\n\n");
  return `${collapsed.trimEnd()}\n`;
}

async function main() {
  const schema = JSON.parse(await fs.readFile(schemaPath, "utf8")) as JsonSchema;
  const hints = JSON.parse(await fs.readFile(hintsPath, "utf8")) as Record<string, UiHint>;
  const entries = flattenSchema({ root: schema, hints });
  const markdown = buildDoc({ schema, hints, entries });
  await fs.writeFile(outPath, markdown, "utf8");
  console.log(`wrote ${path.relative(repoRoot, outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
