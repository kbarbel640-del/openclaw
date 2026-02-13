import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCliportCli } from "./cli.js";

const originalRegistryEnv = process.env.CLIPORT_REGISTRY;
const originalLogPathEnv = process.env.CLIPORT_LOG_PATH;

afterEach(() => {
  if (originalRegistryEnv === undefined) {
    delete process.env.CLIPORT_REGISTRY;
  } else {
    process.env.CLIPORT_REGISTRY = originalRegistryEnv;
  }
  if (originalLogPathEnv === undefined) {
    delete process.env.CLIPORT_LOG_PATH;
  } else {
    process.env.CLIPORT_LOG_PATH = originalLogPathEnv;
  }
  vi.restoreAllMocks();
});

describe("cliport cli", () => {
  it("parses repeated --arg and --env values on install", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cliport-cli-install-"));
    const registryPath = path.join(tempDir, "registry.json");
    process.env.CLIPORT_REGISTRY = registryPath;

    const code = await runCliportCli([
      "node",
      "cliport",
      "install",
      "gog",
      "--cmd",
      "/usr/local/bin/gog",
      "--arg",
      "gmail",
      "--arg",
      "search",
      "--env",
      "GOG_ACCOUNT=owner@saint.work",
      "--env",
      "GOG_KEYRING_PASSWORD=secret",
    ]);

    expect(code).toBe(0);
    const registryRaw = await fs.readFile(registryPath, "utf-8");
    const registry = JSON.parse(registryRaw) as {
      clis: Record<string, { args?: string[]; env?: Record<string, string> }>;
    };

    expect(registry.clis.gog?.args).toEqual(["gmail", "search"]);
    expect(registry.clis.gog?.env).toEqual({
      GOG_ACCOUNT: "owner@saint.work",
      GOG_KEYRING_PASSWORD: "secret",
    });

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("reads porter logs with --last", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cliport-cli-log-"));
    const logPath = path.join(tempDir, "porter.jsonl");
    process.env.CLIPORT_LOG_PATH = logPath;
    await fs.writeFile(
      logPath,
      [
        JSON.stringify({ ts: "2026-02-10T00:00:00Z", requestId: "1", cli: "gog" }),
        JSON.stringify({ ts: "2026-02-10T00:00:01Z", requestId: "2", cli: "gh" }),
        JSON.stringify({ ts: "2026-02-10T00:00:02Z", requestId: "3", cli: "gog" }),
      ].join("\n"),
      "utf-8",
    );

    let output = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });

    const code = await runCliportCli(["node", "cliport", "log", "--last", "2"]);
    expect(code).toBe(0);

    const parsed = JSON.parse(output) as Array<{ requestId?: string }>;
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.requestId).toBe("2");
    expect(parsed[1]?.requestId).toBe("3");

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
