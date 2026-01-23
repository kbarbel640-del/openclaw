import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareSessionManagerForRun } from "./session-manager-init.js";

describe("prepareSessionManagerForRun", () => {
  let tmpDir: string;
  let sessionFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-test-"));
    sessionFile = path.join(tmpDir, "test-session.jsonl");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function createMockSessionManager(fileEntries: unknown[] = []) {
    return {
      sessionId: "old-session-id",
      flushed: true,
      fileEntries,
      byId: new Map(),
      labelsById: new Map(),
      leafId: "some-leaf",
    };
  }

  describe("when hadSessionFile && header && !hasAssistant", () => {
    it("writes session header atomically to file", async () => {
      // Create existing file (simulating the condition)
      await fs.writeFile(sessionFile, "", "utf-8");

      const header = { type: "session", id: "old-id", cwd: "/old/cwd" };
      const sm = createMockSessionManager([header]);

      await prepareSessionManagerForRun({
        sessionManager: sm,
        sessionFile,
        hadSessionFile: true,
        sessionId: "new-session-id",
        cwd: "/new/cwd",
      });

      // Verify file was written with header
      const content = await fs.readFile(sessionFile, "utf-8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(1);

      const writtenHeader = JSON.parse(lines[0]);
      expect(writtenHeader.type).toBe("session");
      expect(writtenHeader.version).toBe(3);
      expect(writtenHeader.id).toBe("new-session-id");
      expect(writtenHeader.cwd).toBe("/new/cwd");
      expect(writtenHeader.timestamp).toBeDefined();
    });

    it("preserves existing header fields like parentSession", async () => {
      await fs.writeFile(sessionFile, "", "utf-8");

      const header = {
        type: "session",
        id: "old-id",
        cwd: "/old/cwd",
        parentSession: "parent-123",
        customField: "should-be-preserved",
      };
      const sm = createMockSessionManager([header]);

      await prepareSessionManagerForRun({
        sessionManager: sm,
        sessionFile,
        hadSessionFile: true,
        sessionId: "new-session-id",
        cwd: "/new/cwd",
      });

      const content = await fs.readFile(sessionFile, "utf-8");
      const writtenHeader = JSON.parse(content.trim());

      // New values should be set
      expect(writtenHeader.id).toBe("new-session-id");
      expect(writtenHeader.cwd).toBe("/new/cwd");

      // Existing fields should be preserved
      expect(writtenHeader.parentSession).toBe("parent-123");
      expect(writtenHeader.customField).toBe("should-be-preserved");
    });

    it("resets session manager state correctly", async () => {
      await fs.writeFile(sessionFile, "", "utf-8");

      const header = { type: "session", id: "old-id", cwd: "/old/cwd" };
      const sm = createMockSessionManager([header, { type: "message", message: { role: "user" } }]);
      sm.byId.set("msg-1", {});
      sm.labelsById.set("label-1", "msg-1");

      await prepareSessionManagerForRun({
        sessionManager: sm,
        sessionFile,
        hadSessionFile: true,
        sessionId: "new-session-id",
        cwd: "/new/cwd",
      });

      expect(sm.fileEntries).toHaveLength(1);
      expect(sm.fileEntries[0]).toBe(header);
      expect(sm.sessionId).toBe("new-session-id");
      expect(sm.byId.size).toBe(0);
      expect(sm.labelsById.size).toBe(0);
      expect(sm.leafId).toBeNull();
      expect(sm.flushed).toBe(false);
    });
  });

  describe("when !hadSessionFile && header", () => {
    it("updates header in memory without writing to file", async () => {
      const header = { type: "session", id: "old-id", cwd: "/old/cwd" };
      const sm = createMockSessionManager([header]);

      await prepareSessionManagerForRun({
        sessionManager: sm,
        sessionFile,
        hadSessionFile: false,
        sessionId: "new-session-id",
        cwd: "/new/cwd",
      });

      // Header should be updated in memory
      expect(header.id).toBe("new-session-id");
      expect(header.cwd).toBe("/new/cwd");
      expect(sm.sessionId).toBe("new-session-id");

      // File should not exist (no write)
      await expect(fs.stat(sessionFile)).rejects.toThrow();
    });
  });

  describe("when hasAssistant is true", () => {
    it("does not reset file when assistant message exists", async () => {
      const originalContent =
        '{"type":"session","id":"original"}\n{"type":"message","message":{"role":"assistant"}}\n';
      await fs.writeFile(sessionFile, originalContent, "utf-8");

      const header = { type: "session", id: "original", cwd: "/cwd" };
      const assistantMsg = { type: "message", message: { role: "assistant" } };
      const sm = createMockSessionManager([header, assistantMsg]);

      await prepareSessionManagerForRun({
        sessionManager: sm,
        sessionFile,
        hadSessionFile: true,
        sessionId: "new-session-id",
        cwd: "/new/cwd",
      });

      // File should be unchanged
      const content = await fs.readFile(sessionFile, "utf-8");
      expect(content).toBe(originalContent);
    });
  });
});
