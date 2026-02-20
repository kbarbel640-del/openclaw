/**
 * Add a skill from a Git URL: clone into managed skills dir and run npm install.
 * Used by CLI `openclaw skills add <url>` and Control UI "Add from URL".
 */

import fs from "node:fs";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import { runCommandWithTimeout, type CommandOptions } from "../process/exec.js";
import { CONFIG_DIR, ensureDir } from "../utils.js";
import { resolveSkillsInstallPreferences } from "./skills.js";

export type AddSkillFromUrlOptions = {
  url: string;
  managedSkillsDir?: string;
  config?: OpenClawConfig;
  cloneTimeoutMs?: number;
  installTimeoutMs?: number;
};

export type AddSkillFromUrlResult = {
  ok: boolean;
  name?: string;
  message: string;
};

const SAFE_NAME_REGEX = /^[a-zA-Z0-9_.-]+$/;

/**
 * Parse a Git repo URL and derive a safe directory name.
 * Only allows https URLs. Returns the last path segment (repo name) with .git stripped.
 */
export function parseSkillRepoUrl(url: string): { url: string; name: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }
  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  const segment = pathname.split("/").filter(Boolean).pop() ?? "";
  const name = segment.replace(/\.git$/i, "").trim();
  if (!name || !SAFE_NAME_REGEX.test(name)) {
    throw new Error(
      `Invalid repo name derived from URL (use only letters, numbers, dots, hyphens, underscores): ${name || "(empty)"}`,
    );
  }
  return { url: trimmed, name };
}

/**
 * Clone a Git repo into the managed skills directory, then run npm/pnpm install
 * in that directory if package.json exists.
 */
export async function addSkillFromUrl(
  opts: AddSkillFromUrlOptions,
): Promise<AddSkillFromUrlResult> {
  const managedDir = opts.managedSkillsDir ?? path.join(CONFIG_DIR, "skills");
  const cloneTimeoutMs = opts.cloneTimeoutMs ?? 120_000;
  const installTimeoutMs = opts.installTimeoutMs ?? 120_000;

  let url: string;
  let name: string;
  try {
    const parsed = parseSkillRepoUrl(opts.url);
    url = parsed.url;
    name = parsed.name;
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const targetDir = path.join(managedDir, name);
  const targetDirResolved = path.resolve(targetDir);
  const managedDirResolved = path.resolve(managedDir);
  if (
    !targetDirResolved.startsWith(managedDirResolved + path.sep) &&
    targetDirResolved !== managedDirResolved
  ) {
    return { ok: false, message: "Invalid target path" };
  }

  try {
    await ensureDir(managedDir);
  } catch (err) {
    return {
      ok: false,
      message: `Failed to create skills directory: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (fs.existsSync(targetDir)) {
    return {
      ok: false,
      name,
      message: `Skill directory already exists: ${name}. Remove it first or use a different URL.`,
    };
  }

  const cloneOpts: CommandOptions = { timeoutMs: cloneTimeoutMs, cwd: managedDir };
  const cloneResult = await runCommandWithTimeout(
    ["git", "clone", "--depth", "1", url, name],
    cloneOpts,
  );
  if (cloneResult.code !== 0) {
    const stderr = cloneResult.stderr.trim() || cloneResult.stdout.trim();
    try {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true });
      }
    } catch {
      // ignore cleanup failure
    }
    return {
      ok: false,
      name,
      message: stderr ? `Clone failed: ${stderr}` : "Clone failed",
    };
  }

  const packageJsonPath = path.join(targetDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const prefs = resolveSkillsInstallPreferences(opts.config);
    const installArgv = buildInstallArgv(prefs.nodeManager);
    const installResult = await runCommandWithTimeout(installArgv, {
      timeoutMs: installTimeoutMs,
      cwd: targetDir,
    });
    if (installResult.code !== 0) {
      const stderr = installResult.stderr.trim() || installResult.stdout.trim();
      return {
        ok: true,
        name,
        message: `Cloned successfully; dependency install failed: ${stderr || "unknown"}`,
      };
    }
  }

  return {
    ok: true,
    name,
    message: `Added skill "${name}". It will appear on the next refresh (no restart needed).`,
  };
}

function buildInstallArgv(nodeManager: "npm" | "pnpm" | "yarn" | "bun"): string[] {
  switch (nodeManager) {
    case "pnpm":
      return ["pnpm", "install", "--omit=dev"];
    case "yarn":
      return ["yarn", "install", "--production"];
    case "bun":
      return ["bun", "install", "--production"];
    default:
      return ["npm", "install", "--omit=dev"];
  }
}
