#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import type { CliportRegistry } from "./types.js";

const DEFAULT_REGISTRY_PATH = path.join(os.homedir(), ".openclaw", "cliport", "registry.json");
const DEFAULT_PORTER_LOG_LAST = 100;

function readArg(args: string[], key: string): string | undefined {
  const index = args.indexOf(key);
  if (index === -1 || index + 1 >= args.length) {
    return undefined;
  }
  return args[index + 1];
}

function readArgValues(args: string[], key: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== key) {
      continue;
    }
    const value = args[index + 1];
    if (typeof value !== "string") {
      continue;
    }
    values.push(value);
    index += 1;
  }
  return values;
}

function parseEnvPairs(entries: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const entry of entries) {
    const index = entry.indexOf("=");
    if (index <= 0) {
      continue;
    }
    env[entry.slice(0, index)] = entry.slice(index + 1);
  }
  return env;
}

async function readRegistry(filePath: string): Promise<CliportRegistry> {
  const raw = await fs.readFile(filePath, "utf-8").catch(() => "");
  if (!raw) {
    return { version: 1, clis: {} };
  }
  try {
    const parsed = JSON.parse(raw) as CliportRegistry;
    if (!parsed || typeof parsed !== "object" || !parsed.clis || typeof parsed.clis !== "object") {
      return { version: 1, clis: {} };
    }
    return parsed;
  } catch {
    return { version: 1, clis: {} };
  }
}

async function writeRegistry(filePath: string, registry: CliportRegistry) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
}

function printHelp() {
  process.stdout.write(`cliport <command> [args]\n\n`);
  process.stdout.write(`Commands:\n`);
  process.stdout.write(`  list\n`);
  process.stdout.write(
    `  install <name> --cmd <command> [--arg <value> ...] [--env KEY=VALUE ...]\n`,
  );
  process.stdout.write(`  remove <name>\n`);
  process.stdout.write(`  env <name> KEY=VALUE\n`);
  process.stdout.write(`  log [--last <count>]\n`);
}

export async function runCliportCli(argv = process.argv): Promise<number> {
  const args = argv.slice(2);
  const registryPath = process.env.CLIPORT_REGISTRY?.trim() || DEFAULT_REGISTRY_PATH;

  const command = args[0];
  if (!command || command === "help" || command === "--help") {
    printHelp();
    return 0;
  }

  const registry = await readRegistry(registryPath);

  if (command === "list") {
    const rows = Object.entries(registry.clis).map(([name, entry]) => ({
      name,
      command: entry.command,
      args: entry.args ?? [],
      envKeys: Object.keys(entry.env ?? {}),
    }));
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return 0;
  }

  if (command === "install") {
    const name = args[1]?.trim();
    const cmd = readArg(args, "--cmd")?.trim();
    if (!name || !cmd) {
      process.stderr.write("usage: cliport install <name> --cmd <command>\n");
      return 1;
    }
    const installArgs = readArgValues(args, "--arg");
    const env = parseEnvPairs(readArgValues(args, "--env"));
    registry.clis[name] = {
      command: cmd,
      args: installArgs,
      env,
    };
    await writeRegistry(registryPath, registry);
    process.stdout.write(`installed ${name}\n`);
    return 0;
  }

  if (command === "remove") {
    const name = args[1]?.trim();
    if (!name) {
      process.stderr.write("usage: cliport remove <name>\n");
      return 1;
    }
    delete registry.clis[name];
    await writeRegistry(registryPath, registry);
    process.stdout.write(`removed ${name}\n`);
    return 0;
  }

  if (command === "env") {
    const name = args[1]?.trim();
    const pair = args[2]?.trim();
    if (!name || !pair || !pair.includes("=")) {
      process.stderr.write("usage: cliport env <name> KEY=VALUE\n");
      return 1;
    }
    const existing = registry.clis[name];
    if (!existing) {
      process.stderr.write(`unknown cli: ${name}\n`);
      return 1;
    }
    const idx = pair.indexOf("=");
    const key = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    existing.env = { ...(existing.env ?? {}), [key]: value };
    registry.clis[name] = existing;
    await writeRegistry(registryPath, registry);
    process.stdout.write(`updated env for ${name}\n`);
    return 0;
  }

  if (command === "log") {
    const lastRaw = readArg(args, "--last");
    const last = lastRaw === undefined ? DEFAULT_PORTER_LOG_LAST : Number.parseInt(lastRaw, 10);
    if (!Number.isInteger(last) || last <= 0) {
      process.stderr.write("usage: cliport log [--last <count>]\n");
      return 1;
    }
    const logPath =
      process.env.CLIPORT_LOG_PATH?.trim() || path.join(process.cwd(), "logs", "porter.jsonl");
    const raw = await fs.readFile(logPath, "utf-8").catch(() => "");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const selected = lines.slice(-last);
    const parsed = selected.map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return { raw: line };
      }
    });
    process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
    return 0;
  }

  process.stderr.write(`unknown command: ${command}\n`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCliportCli().then((code) => {
    process.exitCode = code;
  });
}
