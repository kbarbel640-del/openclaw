import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { SharedContextConfig } from "../config/types.agents.js";
import {
  canAccessSharedContext,
  clearSharedContext,
  deleteSharedContextItem,
  getSharedContextItem,
  listSharedContextKeys,
  setSharedContextItem,
} from "./shared-context.js";

describe("shared-context", () => {
  let testStateDir: string;

  beforeEach(async () => {
    // Create temporary state directory for tests
    testStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "shared-context-test-"));
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testStateDir, { recursive: true, force: true });
  });

  describe("canAccessSharedContext", () => {
    it("should deny access when config is undefined", () => {
      expect(canAccessSharedContext("agent-a", undefined)).toBe(false);
    });

    it("should deny access when enabled is false", () => {
      const config: SharedContextConfig = { enabled: false };
      expect(canAccessSharedContext("agent-a", config)).toBe(false);
    });

    it("should deny access when enabled is not set", () => {
      const config: SharedContextConfig = {};
      expect(canAccessSharedContext("agent-a", config)).toBe(false);
    });

    it("should deny access when allowAgents is undefined", () => {
      const config: SharedContextConfig = { enabled: true };
      expect(canAccessSharedContext("agent-a", config)).toBe(false);
    });

    it("should deny access when allowAgents is empty", () => {
      const config: SharedContextConfig = { enabled: true, allowAgents: [] };
      expect(canAccessSharedContext("agent-a", config)).toBe(false);
    });

    it("should allow access with wildcard", () => {
      const config: SharedContextConfig = { enabled: true, allowAgents: ["*"] };
      expect(canAccessSharedContext("agent-a", config)).toBe(true);
      expect(canAccessSharedContext("agent-b", config)).toBe(true);
      expect(canAccessSharedContext("any-agent", config)).toBe(true);
    });

    it("should allow access for explicitly listed agent", () => {
      const config: SharedContextConfig = {
        enabled: true,
        allowAgents: ["agent-a", "agent-b"],
      };
      expect(canAccessSharedContext("agent-a", config)).toBe(true);
      expect(canAccessSharedContext("agent-b", config)).toBe(true);
    });

    it("should deny access for unlisted agent", () => {
      const config: SharedContextConfig = {
        enabled: true,
        allowAgents: ["agent-a", "agent-b"],
      };
      expect(canAccessSharedContext("agent-c", config)).toBe(false);
    });
  });

  describe("setSharedContextItem", () => {
    it("should create a new global context item", async () => {
      const item = await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "test-key",
        { foo: "bar" },
        { agentId: "owner-agent" },
      );

      expect(item.key).toBe("test-key");
      expect(item.value).toEqual({ foo: "bar" });
      expect(item.ownerId).toBe("owner-agent");
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
    });

    it("should create a new session-scoped context item", async () => {
      const item = await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-key",
        { session: "data" },
        { agentId: "owner-agent", scope: "session", sessionId: "session-123" },
      );

      expect(item.key).toBe("session-key");
      expect(item.value).toEqual({ session: "data" });
      expect(item.ownerId).toBe("owner-agent");
    });

    it("should update existing item and preserve createdAt", async () => {
      // Create initial item
      const first = await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "update-key",
        { version: 1 },
        { agentId: "owner-agent" },
      );

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update the item
      const second = await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "update-key",
        { version: 2 },
        { agentId: "owner-agent" },
      );

      expect(second.createdAt).toBe(first.createdAt);
      expect(second.updatedAt).not.toBe(first.updatedAt);
      expect(second.value).toEqual({ version: 2 });
    });

    it("should create directory structure if needed", async () => {
      await setSharedContextItem(
        testStateDir,
        "new-agent",
        "new-key",
        "value",
        { agentId: "new-agent" },
      );

      const dirPath = path.join(
        testStateDir,
        "agents",
        "shared-context",
        "new-agent",
        "global",
      );
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe("getSharedContextItem", () => {
    it("should retrieve existing global context item", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "get-key",
        { data: "value" },
        { agentId: "owner-agent" },
      );

      const item = await getSharedContextItem(
        testStateDir,
        "owner-agent",
        "get-key",
        { agentId: "reader-agent" },
      );

      expect(item).toBeDefined();
      expect(item?.key).toBe("get-key");
      expect(item?.value).toEqual({ data: "value" });
    });

    it("should retrieve existing session-scoped context item", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-get-key",
        { session: "value" },
        { agentId: "owner-agent", scope: "session", sessionId: "session-456" },
      );

      const item = await getSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-get-key",
        { agentId: "reader-agent", scope: "session", sessionId: "session-456" },
      );

      expect(item).toBeDefined();
      expect(item?.value).toEqual({ session: "value" });
    });

    it("should return null for non-existent item", async () => {
      const item = await getSharedContextItem(
        testStateDir,
        "owner-agent",
        "missing-key",
        { agentId: "reader-agent" },
      );

      expect(item).toBeNull();
    });

    it("should return null for different session scope", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-key",
        "value",
        { agentId: "owner-agent", scope: "session", sessionId: "session-1" },
      );

      const item = await getSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-key",
        { agentId: "reader-agent", scope: "session", sessionId: "session-2" },
      );

      expect(item).toBeNull();
    });
  });

  describe("deleteSharedContextItem", () => {
    it("should delete existing global context item", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "delete-key",
        "value",
        { agentId: "owner-agent" },
      );

      const deleted = await deleteSharedContextItem(
        testStateDir,
        "owner-agent",
        "delete-key",
        { agentId: "owner-agent" },
      );

      expect(deleted).toBe(true);

      const item = await getSharedContextItem(
        testStateDir,
        "owner-agent",
        "delete-key",
        { agentId: "owner-agent" },
      );
      expect(item).toBeNull();
    });

    it("should delete existing session-scoped context item", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-delete-key",
        "value",
        { agentId: "owner-agent", scope: "session", sessionId: "session-789" },
      );

      const deleted = await deleteSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-delete-key",
        { agentId: "owner-agent", scope: "session", sessionId: "session-789" },
      );

      expect(deleted).toBe(true);
    });

    it("should return false for non-existent item", async () => {
      const deleted = await deleteSharedContextItem(
        testStateDir,
        "owner-agent",
        "missing-key",
        { agentId: "owner-agent" },
      );

      expect(deleted).toBe(false);
    });
  });

  describe("listSharedContextKeys", () => {
    it("should list all global context keys", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "key-1",
        "value-1",
        { agentId: "owner-agent" },
      );
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "key-2",
        "value-2",
        { agentId: "owner-agent" },
      );
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "key-3",
        "value-3",
        { agentId: "owner-agent" },
      );

      const keys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "reader-agent",
      });

      expect(keys).toEqual(["key-1", "key-2", "key-3"]);
    });

    it("should list session-scoped context keys", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-key-1",
        "value-1",
        { agentId: "owner-agent", scope: "session", sessionId: "session-abc" },
      );
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-key-2",
        "value-2",
        { agentId: "owner-agent", scope: "session", sessionId: "session-abc" },
      );

      const keys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "reader-agent",
        scope: "session",
        sessionId: "session-abc",
      });

      expect(keys).toEqual(["session-key-1", "session-key-2"]);
    });

    it("should return empty array for non-existent context", async () => {
      const keys = await listSharedContextKeys(testStateDir, "missing-agent", {
        agentId: "reader-agent",
      });

      expect(keys).toEqual([]);
    });

    it("should return sorted keys", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "zebra",
        "value",
        { agentId: "owner-agent" },
      );
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "alpha",
        "value",
        { agentId: "owner-agent" },
      );
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "beta",
        "value",
        { agentId: "owner-agent" },
      );

      const keys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "reader-agent",
      });

      expect(keys).toEqual(["alpha", "beta", "zebra"]);
    });

    it("should not mix global and session scopes", async () => {
      // Add global items
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "global-key",
        "value",
        { agentId: "owner-agent" },
      );

      // Add session items
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-key",
        "value",
        { agentId: "owner-agent", scope: "session", sessionId: "session-xyz" },
      );

      // List global - should only see global
      const globalKeys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "reader-agent",
      });
      expect(globalKeys).toEqual(["global-key"]);

      // List session - should only see session
      const sessionKeys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "reader-agent",
        scope: "session",
        sessionId: "session-xyz",
      });
      expect(sessionKeys).toEqual(["session-key"]);
    });
  });

  describe("clearSharedContext", () => {
    it("should clear all context for an agent", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "key-1",
        "value",
        { agentId: "owner-agent" },
      );
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "key-2",
        "value",
        { agentId: "owner-agent", scope: "session", sessionId: "session-1" },
      );

      const count = await clearSharedContext(testStateDir, "owner-agent");

      expect(count).toBeGreaterThan(0);

      const globalKeys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "owner-agent",
      });
      expect(globalKeys).toEqual([]);

      const sessionKeys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "owner-agent",
        scope: "session",
        sessionId: "session-1",
      });
      expect(sessionKeys).toEqual([]);
    });

    it("should clear only global context when scope specified", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "global-key",
        "value",
        { agentId: "owner-agent" },
      );
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-key",
        "value",
        { agentId: "owner-agent", scope: "session", sessionId: "session-2" },
      );

      await clearSharedContext(testStateDir, "owner-agent", { scope: "global" });

      const globalKeys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "owner-agent",
      });
      expect(globalKeys).toEqual([]);

      const sessionKeys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "owner-agent",
        scope: "session",
        sessionId: "session-2",
      });
      expect(sessionKeys).toEqual(["session-key"]);
    });

    it("should clear only session context when scope and sessionId specified", async () => {
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "global-key",
        "value",
        { agentId: "owner-agent" },
      );
      await setSharedContextItem(
        testStateDir,
        "owner-agent",
        "session-key",
        "value",
        { agentId: "owner-agent", scope: "session", sessionId: "session-3" },
      );

      await clearSharedContext(testStateDir, "owner-agent", {
        scope: "session",
        sessionId: "session-3",
      });

      const globalKeys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "owner-agent",
      });
      expect(globalKeys).toEqual(["global-key"]);

      const sessionKeys = await listSharedContextKeys(testStateDir, "owner-agent", {
        agentId: "owner-agent",
        scope: "session",
        sessionId: "session-3",
      });
      expect(sessionKeys).toEqual([]);
    });

    it("should return 0 when clearing non-existent context", async () => {
      const count = await clearSharedContext(testStateDir, "missing-agent");
      expect(count).toBe(0);
    });
  });

  describe("scope isolation", () => {
    it("should keep session and global contexts separate", async () => {
      // Set global context
      await setSharedContextItem(
        testStateDir,
        "agent-1",
        "shared-key",
        { scope: "global" },
        { agentId: "agent-1" },
      );

      // Set session context with same key
      await setSharedContextItem(
        testStateDir,
        "agent-1",
        "shared-key",
        { scope: "session" },
        { agentId: "agent-1", scope: "session", sessionId: "session-isolate" },
      );

      // Get global
      const globalItem = await getSharedContextItem(
        testStateDir,
        "agent-1",
        "shared-key",
        { agentId: "agent-1" },
      );
      expect(globalItem?.value).toEqual({ scope: "global" });

      // Get session
      const sessionItem = await getSharedContextItem(
        testStateDir,
        "agent-1",
        "shared-key",
        { agentId: "agent-1", scope: "session", sessionId: "session-isolate" },
      );
      expect(sessionItem?.value).toEqual({ scope: "session" });
    });

    it("should isolate different sessions", async () => {
      await setSharedContextItem(
        testStateDir,
        "agent-1",
        "key",
        { session: "A" },
        { agentId: "agent-1", scope: "session", sessionId: "session-A" },
      );
      await setSharedContextItem(
        testStateDir,
        "agent-1",
        "key",
        { session: "B" },
        { agentId: "agent-1", scope: "session", sessionId: "session-B" },
      );

      const itemA = await getSharedContextItem(testStateDir, "agent-1", "key", {
        agentId: "agent-1",
        scope: "session",
        sessionId: "session-A",
      });
      expect(itemA?.value).toEqual({ session: "A" });

      const itemB = await getSharedContextItem(testStateDir, "agent-1", "key", {
        agentId: "agent-1",
        scope: "session",
        sessionId: "session-B",
      });
      expect(itemB?.value).toEqual({ session: "B" });
    });
  });
});
