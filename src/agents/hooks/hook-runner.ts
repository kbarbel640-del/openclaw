import { exec } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { HooksFileSchema, type HookConfig, type HookAction } from "./types.js";

const execAsync = promisify(exec);

export class HookRunner {
  private hooks: HookConfig[] = [];
  private loaded = false;

  async loadHooks(cwd: string = process.cwd()) {
    const configPaths = [
      path.join(os.homedir(), ".openclaw", "hooks.json"),
      path.join(cwd, ".hooks.json"),
      path.join(cwd, "hooks.json"),
    ];

    for (const p of configPaths) {
      if (await this.fileExists(p)) {
        try {
          const content = await fs.readFile(p, "utf-8");
          const json = JSON.parse(content);
          const parsed = HooksFileSchema.parse(json);
          this.hooks.push(...parsed.hooks);
        } catch (error) {
          console.warn(`Failed to lead hooks from ${p}:`, error);
        }
      }
    }
    this.loaded = true;
  }

  async runHooks(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ action: HookAction; message?: string }> {
    if (!this.loaded) {
      await this.loadHooks();
    }

    for (const hook of this.hooks) {
      if (this.matches(hook, toolName, args)) {
        if (hook.command) {
          try {
            await execAsync(hook.command);
          } catch (e) {
            console.error(`Hook command failed: ${hook.command}`, e);
          }
        }

        if (hook.action === "deny" || hook.action === "ask") {
          return { action: hook.action, message: hook.message };
        }
      }
    }

    return { action: "allow" };
  }

  private matches(hook: HookConfig, toolName: string, args: Record<string, unknown>): boolean {
    if (hook.matcher.tool) {
      const toolRegex = new RegExp(hook.matcher.tool);
      if (!toolRegex.test(toolName)) {
        return false;
      }
    }

    if (hook.matcher.args) {
      for (const [key, pattern] of Object.entries(hook.matcher.args)) {
        const val = args?.[key];
        if (val === undefined) {
          return false;
        }
        const argRegex = new RegExp(String(pattern));
        if (!argRegex.test(String(val))) {
          return false;
        }
      }
    }

    return true;
  }

  private async fileExists(p: string) {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }
}
