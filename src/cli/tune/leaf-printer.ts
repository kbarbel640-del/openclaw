import type { z } from "zod";
import { theme } from "../../terminal/theme.js";
import { formatCliCommand } from "../command-format.js";
import { describeType } from "./schema-walker.js";

export type LeafPresentation = {
  path: string[];
  category: string;
  typeLabel: string;
  constraints: string[];
  current: unknown;
  options: Array<string | number | boolean>;
  hints: string[];
};

function printable(value: unknown): string {
  if (value === undefined) {
    return theme.muted("<unset>");
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function collectHints(path: string[], schema: z.ZodTypeAny, current: unknown): string[] {
  const desc = describeType(schema);
  const base = formatCliCommand(`openclaw tune ${path.join(" ")}`);

  if (desc.category === "array") {
    return [`${base} add <value>`, `${base} remove <value>`, `${base} <json-array>`];
  }

  if (desc.category === "record") {
    const keyHint =
      current && typeof current === "object" && !Array.isArray(current)
        ? Object.keys(current as Record<string, unknown>).slice(0, 5)
        : [];
    const sample = keyHint.length > 0 ? keyHint.join(" | ") : "<key>";
    return [`${base} set ${sample} <value>`, `${base} <json-object>`];
  }

  return [`${base} <value>`];
}

export function buildLeafPresentation(
  path: string[],
  schema: z.ZodTypeAny,
  current: unknown,
): LeafPresentation {
  const desc = describeType(schema);
  const options = [...desc.options];
  if (desc.category === "boolean" && options.length === 0) {
    options.push(true, false);
  }

  return {
    path,
    category: desc.category,
    typeLabel: desc.typeLabel,
    constraints: desc.constraints,
    current,
    options,
    hints: collectHints(path, schema, current),
  };
}

export function printLeafPresentation(presentation: LeafPresentation): void {
  const dottedPath = presentation.path.join(".");
  const typeBits =
    presentation.constraints.length > 0
      ? `${presentation.typeLabel} (${presentation.constraints.join(", ")})`
      : presentation.typeLabel;

  console.log();
  console.log(`  ${theme.muted("Path:")}     ${theme.heading(dottedPath)}`);
  console.log(`  ${theme.muted("Type:")}     ${typeBits}`);
  console.log(`  ${theme.muted("Current:")}  ${printable(presentation.current)}`);
  if (presentation.options.length > 0) {
    console.log(`  ${theme.muted("Options:")}  ${presentation.options.join(" | ")}`);
  }
  if (presentation.category === "array" && Array.isArray(presentation.current)) {
    console.log(`  ${theme.muted("Items:")}    ${presentation.current.length}`);
  }
  if (
    presentation.category === "record" &&
    presentation.current &&
    typeof presentation.current === "object" &&
    !Array.isArray(presentation.current)
  ) {
    const keys = Object.keys(presentation.current as Record<string, unknown>);
    console.log(
      `  ${theme.muted("Keys:")}     ${keys.length > 0 ? keys.join(", ") : theme.muted("<none>")}`,
    );
  }
  if (presentation.hints.length > 0) {
    console.log(`  ${theme.muted("Set:")}      ${presentation.hints[0]}`);
    for (const hint of presentation.hints.slice(1)) {
      console.log(`            ${theme.muted("or")} ${hint}`);
    }
  }
  console.log();
}
