import type { Command } from "commander";

export function hasExplicitOptions(command: Command, names: readonly string[]): boolean {
  if (typeof command.getOptionValueSource !== "function") {
    return false;
  }
  return names.some((name) => command.getOptionValueSource(name) === "cli");
}

function getOptionSource(command: Command, name: string): string | undefined {
  if (typeof command.getOptionValueSource !== "function") {
    return undefined;
  }
  return command.getOptionValueSource(name);
}

type InheritOptionConfig = {
  // Defensive default: only direct-parent inheritance unless callers opt into deeper traversal.
  maxDepth?: number;
};

export function inheritOptionFromParent<T = unknown>(
  command: Command | undefined,
  name: string,
  config?: InheritOptionConfig,
): T | undefined {
  if (!command) {
    return undefined;
  }

  const childSource = getOptionSource(command, name);
  if (childSource && childSource !== "default") {
    return undefined;
  }

  const rawMaxDepth = config?.maxDepth;
  const maxDepth =
    typeof rawMaxDepth === "number" && Number.isFinite(rawMaxDepth)
      ? Math.max(1, Math.floor(rawMaxDepth))
      : 1;

  let depth = 0;
  let ancestor = command.parent;
  while (ancestor && depth < maxDepth) {
    const source = getOptionSource(ancestor, name);
    if (source && source !== "default") {
      return ancestor.opts<Record<string, unknown>>()[name] as T | undefined;
    }
    depth += 1;
    ancestor = ancestor.parent;
  }
  return undefined;
}
