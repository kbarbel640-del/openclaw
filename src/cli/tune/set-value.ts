import type { z } from "zod";
import JSON5 from "json5";
import { readConfigFileSnapshot, writeConfigFile } from "../../config/config.js";
import { OpenClawSchema } from "../../config/zod-schema.js";
import { danger } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import {
  describeType,
  resolveSchemaPath,
  type ResolveFailure,
  type ResolveSuccess,
} from "./schema-walker.js";

function formatFailure(failure: ResolveFailure): string {
  const attempted = failure.input.join(" ") || "<root>";
  const matched = failure.matchedPath.join(".") || "<root>";
  const suggestionLine =
    failure.suggestions.length > 0
      ? `\nValid keys at ${matched}: ${failure.suggestions.join(", ")}`
      : "";
  return `Unknown config path: ${attempted}${suggestionLine}`;
}

function getAtPath(root: unknown, path: string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (Array.isArray(current)) {
      if (!/^[0-9]+$/.test(segment)) {
        return undefined;
      }
      const idx = Number.parseInt(segment, 10);
      current = current[idx];
      continue;
    }
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function ensureContainer(
  parent: unknown,
  segment: string,
  nextSegment: string | undefined,
): unknown {
  const nextShouldArray = Boolean(nextSegment && /^[0-9]+$/.test(nextSegment));

  if (Array.isArray(parent)) {
    const index = Number.parseInt(segment, 10);
    if (!Number.isFinite(index) || index < 0) {
      throw new Error(`Invalid array index: ${segment}`);
    }
    const existing = parent[index];
    if (!existing || typeof existing !== "object") {
      parent[index] = nextShouldArray ? [] : {};
    }
    return parent[index];
  }

  if (!parent || typeof parent !== "object") {
    throw new Error(`Cannot set path segment: ${segment}`);
  }

  const record = parent as Record<string, unknown>;
  const existing = record[segment];
  if (!existing || typeof existing !== "object") {
    record[segment] = nextShouldArray ? [] : {};
  }
  return record[segment];
}

function setAtPath(root: Record<string, unknown>, path: string[], value: unknown): void {
  if (path.length === 0) {
    throw new Error("Path is empty.");
  }
  let current: unknown = root;

  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    current = ensureContainer(current, segment, path[i + 1]);
  }

  const leaf = path[path.length - 1];
  if (Array.isArray(current)) {
    const index = Number.parseInt(leaf, 10);
    if (!Number.isFinite(index) || index < 0) {
      throw new Error(`Invalid array index: ${leaf}`);
    }
    current[index] = value;
    return;
  }

  if (!current || typeof current !== "object") {
    throw new Error(`Cannot write config at ${path.join(".")}`);
  }

  (current as Record<string, unknown>)[leaf] = value;
}

function parseInput(raw: string): unknown {
  try {
    return JSON5.parse(raw);
  } catch {
    return raw;
  }
}

function ensureLeafNode(result: ResolveSuccess, path: string[]): ResolveSuccess {
  if (result.node.category === "object") {
    throw new Error(`Path ${path.join(".")} is a namespace, not a leaf value.`);
  }
  return result;
}

function formatZodIssue(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) {
    return "Validation failed.";
  }
  const path = first.path.length > 0 ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}

export async function setConfigValue(
  path: string[],
  rawValue: string,
): Promise<{
  path: string[];
  previous: unknown;
  value: unknown;
  typeLabel: string;
}> {
  const resolved = resolveSchemaPath(OpenClawSchema, path);
  if (!resolved.ok) {
    throw new Error(formatFailure(resolved));
  }

  const leaf = ensureLeafNode(resolved, path);
  const parsed = parseInput(rawValue);
  const validated = leaf.node.schema.safeParse(parsed);

  if (!validated.success) {
    throw new Error(formatZodIssue(validated.error));
  }

  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    defaultRuntime.error(`Config invalid at ${snapshot.path}.`);
    for (const issue of snapshot.issues) {
      defaultRuntime.error(`- ${issue.path || "<root>"}: ${issue.message}`);
    }
    defaultRuntime.error("Fix config errors, then retry.");
    defaultRuntime.exit(1);
  }

  const next = snapshot.config as Record<string, unknown>;
  const previous = getAtPath(next, path);
  setAtPath(next, path, validated.data);
  await writeConfigFile(next);

  const desc = describeType(leaf.node.schema);
  return {
    path,
    previous,
    value: validated.data,
    typeLabel: desc.typeLabel,
  };
}

export function formatSetError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return danger(message);
}
