import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { __testing } from "./docker.js";

type TokenFile = {
  tokens?: Array<{
    token?: string;
    sessionKey?: string;
    containerName?: string;
  }>;
};

describe("cliport token registry writes", () => {
  it("serializes concurrent updates to avoid dropped token entries", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cliport-token-"));
    const tokensPath = path.join(tempRoot, "cliport", "tokens.json");

    try {
      await Promise.all([
        __testing.ensureCliportTokenAllowed(
          "token-a",
          { sessionKey: "session-a", containerName: "container-a" },
          { tokensPath, delayAfterReadMs: 40 },
        ),
        __testing.ensureCliportTokenAllowed(
          "token-b",
          { sessionKey: "session-b", containerName: "container-b" },
          { tokensPath, delayAfterReadMs: 40 },
        ),
      ]);

      const raw = await fs.readFile(tokensPath, "utf-8");
      const parsed = JSON.parse(raw) as TokenFile;
      const tokens = parsed.tokens ?? [];

      expect(tokens).toContainEqual({
        token: "token-a",
        sessionKey: "session-a",
        containerName: "container-a",
      });
      expect(tokens).toContainEqual({
        token: "token-b",
        sessionKey: "session-b",
        containerName: "container-b",
      });
      expect(tokens).toHaveLength(2);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("skips rewriting tokens file when token binding is unchanged", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cliport-token-noop-"));
    const tokensPath = path.join(tempRoot, "cliport", "tokens.json");

    try {
      await __testing.ensureCliportTokenAllowed(
        "token-a",
        { sessionKey: "session-a", containerName: "container-a" },
        { tokensPath },
      );
      const before = await fs.stat(tokensPath);
      const beforeContent = await fs.readFile(tokensPath, "utf-8");
      await new Promise((resolve) => setTimeout(resolve, 25));

      await __testing.ensureCliportTokenAllowed(
        "token-a",
        { sessionKey: "session-a", containerName: "container-a" },
        { tokensPath },
      );
      const after = await fs.stat(tokensPath);
      const afterContent = await fs.readFile(tokensPath, "utf-8");

      expect(afterContent).toBe(beforeContent);
      expect(after.mtimeMs).toBe(before.mtimeMs);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("recovers from stale lock files", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cliport-token-stale-"));
    const tokensPath = path.join(tempRoot, "cliport", "tokens.json");
    const lockPath = `${tokensPath}.lock`;

    try {
      await fs.mkdir(path.dirname(tokensPath), { recursive: true });
      const staleLock = {
        pid: 999_999_999,
        createdAtMs: Date.now() - 60_000,
      };
      await fs.writeFile(lockPath, `${JSON.stringify(staleLock)}\n`, "utf-8");

      await __testing.ensureCliportTokenAllowed(
        "token-stale",
        { sessionKey: "session-stale", containerName: "container-stale" },
        {
          tokensPath,
          lockTimeoutMs: 200,
          lockRetryMs: 10,
          lockStaleMs: 1_000,
        },
      );

      const raw = await fs.readFile(tokensPath, "utf-8");
      const parsed = JSON.parse(raw) as TokenFile;
      expect(parsed.tokens).toContainEqual({
        token: "token-stale",
        sessionKey: "session-stale",
        containerName: "container-stale",
      });
      await expect(fs.stat(lockPath)).rejects.toThrow();
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
