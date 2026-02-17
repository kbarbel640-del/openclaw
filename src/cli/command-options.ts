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

export function inheritOptionFromParent<T = unknown>(
  command: Command | undefined,
  name: string,
): T | undefined {
  if (!command) {
    return undefined;
  }

  const childSource = getOptionSource(command, name);
  if (childSource && childSource !== "default") {
    return undefined;
  }

  const parent = command.parent;
  if (!parent) {
    return undefined;
  }
  const parentSource = getOptionSource(parent, name);
  if (!parentSource || parentSource === "default") {
    return undefined;
  }
  return parent.opts<Record<string, unknown>>()[name] as T | undefined;
}
