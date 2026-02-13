import type { Command } from "commander";
import { readConfigFileSnapshot } from "../config/config.js";
import { OpenClawSchema } from "../config/zod-schema.js";
import { danger } from "../globals.js";
import { defaultRuntime } from "../runtime.js";
import { theme } from "../terminal/theme.js";
import { formatCliCommand } from "./command-format.js";
import { buildLeafPresentation, printLeafPresentation } from "./tune/leaf-printer.js";
import {
  checkReloadStatus,
  formatReloadMessage,
  triggerGatewayRestart,
} from "./tune/reload-plan.js";
import {
  getChildren,
  isBranch,
  resolveSchemaPath,
  describeType,
  unwrapSchema,
} from "./tune/schema-walker.js";
import { formatSetError, setConfigValue } from "./tune/set-value.js";

function getAtPath(root: unknown, path: string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (Array.isArray(current)) {
      if (!/^[0-9]+$/.test(segment)) {
        return undefined;
      }
      current = current[Number.parseInt(segment, 10)];
      continue;
    }
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function printBranch(
  segments: string[],
  children: ReturnType<typeof getChildren>,
  json: boolean,
  metadata?: Record<string, string>,
): void {
  if (json) {
    const out = children.map((c) => ({
      key: c.key,
      type: c.typeLabel,
      category: c.category,
      optional: c.optional,
      options: c.options ?? undefined,
      description: metadata?.[segments.concat(c.key).join(".")] ?? undefined,
    }));
    console.log(JSON.stringify({ path: segments.join(".") || "<root>", children: out }, null, 2));
    return;
  }

  const prefix = segments.length > 0 ? segments.join(" ") + " " : "";
  console.log();
  const maxKeyLen = Math.max(...children.map((c) => c.key.length), 0);
  const maxTypeLen = Math.max(...children.map((c) => c.typeLabel.length), 0);

  for (const child of children) {
    const desc = metadata?.[segments.concat(child.key).join(".")] ?? "";
    const optionsStr =
      child.options && child.options.length > 0 ? ` ${theme.muted(child.options.join(" | "))}` : "";
    console.log(
      `  ${theme.heading(child.key.padEnd(maxKeyLen))}  ${theme.muted(child.typeLabel.padEnd(maxTypeLen))}  ${desc}${optionsStr}`,
    );
  }

  console.log();
  console.log(
    `  ${theme.muted("Use:")} ${formatCliCommand(`openclaw tune ${prefix}<key> [value]`)}`,
  );
  console.log();
}

function printLeaf(
  segments: string[],
  node: ReturnType<typeof resolveSchemaPath>,
  config: unknown,
  json: boolean,
  metadata?: Record<string, string>,
): void {
  if (!node.ok) {
    return;
  }

  const current = getAtPath(config, segments);
  const presentation = buildLeafPresentation(segments, node.node.schema, current);
  const desc = metadata?.[segments.join(".")] ?? undefined;

  if (json) {
    console.log(
      JSON.stringify(
        {
          path: segments.join("."),
          type: presentation.typeLabel,
          category: presentation.category,
          constraints: presentation.constraints,
          current,
          options: presentation.options.length > 0 ? presentation.options : undefined,
          description: desc,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (desc) {
    presentation.path; // we just use the standard printer + description
  }
  printLeafPresentation(presentation);
  if (desc) {
    console.log(`  ${theme.muted("Info:")}     ${desc}`);
    console.log();
  }
}

function printError(failure: Extract<ReturnType<typeof resolveSchemaPath>, { ok: false }>): void {
  const attempted = failure.input.join(" ") || "<root>";
  console.error();
  console.error(`  ${danger("Unknown path:")} ${attempted}`);

  if (failure.matchedPath.length > 0) {
    console.error(`  ${theme.muted("Matched:")} ${failure.matchedPath.join(".")}`);
  }

  if (failure.suggestions.length > 0) {
    console.error();
    console.error(`  ${theme.muted("Valid keys:")}`);
    for (const s of failure.suggestions.slice(0, 20)) {
      console.error(`    ${s}`);
    }
    if (failure.suggestions.length > 20) {
      console.error(`    ${theme.muted(`... and ${failure.suggestions.length - 20} more`)}`);
    }
  }
  console.error();
}

let metadataCache: Record<string, string> | undefined;
async function loadMetadata(): Promise<Record<string, string>> {
  if (metadataCache) {
    return metadataCache;
  }
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const metaPath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "tune",
      "metadata.json",
    );
    const raw = await fs.readFile(metaPath, "utf8");
    metadataCache = JSON.parse(raw) as Record<string, string>;
    return metadataCache;
  } catch {
    metadataCache = {};
    return metadataCache;
  }
}

export function registerTuneCli(program: Command): void {
  program
    .command("tune")
    .description("Navigate and set config values. Schema-driven, zero memorization needed.")
    .argument("[path...]", "Config path segments (e.g. gateway port)")
    .option("--json", "Output as JSON")
    .option("--restart", "Trigger gateway restart after set")
    .action(async (pathParts: string[], opts: { json?: boolean; restart?: boolean }) => {
      const metadata = await loadMetadata();
      const json = opts.json === true;

      // Separate path segments from a potential value
      // Strategy: try resolving the full path, if it works as a leaf then no value
      // If it fails, try removing the last segment as value
      const snapshot = await readConfigFileSnapshot();
      const config = snapshot.valid ? snapshot.config : {};

      if (pathParts.length === 0) {
        // Root: show all top-level namespaces
        const children = getChildren(OpenClawSchema);
        printBranch([], children, json, metadata);
        return;
      }

      // Try resolving the full path
      const fullResolve = resolveSchemaPath(OpenClawSchema, pathParts);

      if (fullResolve.ok) {
        // Path resolved — is it a branch or leaf?
        if (isBranch(fullResolve.node)) {
          const children = getChildren(fullResolve.node.unwrapped);
          printBranch(pathParts, children, json, metadata);
        } else {
          printLeaf(pathParts, fullResolve, config, json, metadata);
        }
        return;
      }

      // Path didn't resolve — maybe the last segment is a value to set?
      if (pathParts.length >= 2) {
        const valuePart = pathParts[pathParts.length - 1];
        const pathOnly = pathParts.slice(0, -1);
        const pathResolve = resolveSchemaPath(OpenClawSchema, pathOnly);

        if (pathResolve.ok && !isBranch(pathResolve.node)) {
          // It's a leaf + value → SET operation
          try {
            const oldConfig = snapshot.valid ? JSON.parse(JSON.stringify(snapshot.config)) : {};
            const result = await setConfigValue(pathOnly, valuePart);

            if (json) {
              console.log(
                JSON.stringify(
                  {
                    action: "set",
                    path: result.path.join("."),
                    previous: result.previous,
                    value: result.value,
                    type: result.typeLabel,
                  },
                  null,
                  2,
                ),
              );
            } else {
              console.log();
              console.log(
                `  ${theme.success("✅")} ${theme.heading(result.path.join("."))} set to ${theme.heading(String(result.value))}`,
              );
            }

            // Reload status
            const newSnapshot = await readConfigFileSnapshot();
            const newConfig = newSnapshot.valid ? newSnapshot.config : {};
            const reloadResult = await checkReloadStatus(oldConfig, newConfig, pathOnly.join("."));

            if (json) {
              console.log(
                JSON.stringify(
                  {
                    reload: reloadResult.status,
                    reasons: reloadResult.reasons,
                  },
                  null,
                  2,
                ),
              );
            } else {
              console.log();
              for (const line of formatReloadMessage(reloadResult, pathOnly.join("."))) {
                console.log(`  ${line}`);
              }
              console.log();
            }

            // --restart flag
            if (opts.restart && reloadResult.status === "restart") {
              const restarted = await triggerGatewayRestart();
              if (restarted) {
                console.log(`  ${theme.success("🔄 Gateway restart triggered")}`);
              } else {
                console.log(`  ${danger("❌ Failed to trigger restart")}`);
              }
              console.log();
            }
          } catch (error) {
            console.error();
            console.error(`  ${formatSetError(error)}`);
            console.error();
            defaultRuntime.exit(1);
          }
          return;
        }
      }

      // Truly unknown path — show error with suggestions
      printError(fullResolve);
      defaultRuntime.exit(1);
    });
}
