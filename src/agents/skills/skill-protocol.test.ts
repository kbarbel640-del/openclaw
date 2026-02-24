import { describe, expect, it, beforeEach } from "vitest";
import {
  cacheKey,
  clearCache,
  computeSkillDelta,
  computeWorkspaceHash,
  configureSkillProtocol,
  createSkillProtocolMessage,
  deserializeFromTransport,
  getCacheStats,
  getFromCache,
  invalidateCache,
  invalidateCachePattern,
  serializeForTransport,
  setCache,
  SKILL_PROTOCOL_VERSION,
  validateProtocolMessage,
  type SkillProtocolMessage,
} from "./skill-protocol.js";
import type { SkillEntry, SkillSnapshot } from "./types.js";

function createMockSkill(name: string): SkillEntry {
  return {
    skill: {
      name,
      description: `Description for ${name}`,
      filePath: `/skills/${name}/SKILL.md`,
      baseDir: `/skills/${name}`,
      source: "test",
      disableModelInvocation: false,
    },
    frontmatter: {},
    metadata: {},
    invocation: {
      userInvocable: true,
      disableModelInvocation: false,
    },
  };
}

function createMockSnapshot(): SkillSnapshot {
  return {
    prompt: "test skills prompt",
    skills: [{ name: "test-skill" }],
    version: 1,
  };
}

describe("skill-protocol", () => {
  beforeEach(() => {
    clearCache();
    configureSkillProtocol({
      cacheMaxSize: 10,
      cacheTtlMs: 60000,
    });
  });

  describe("SKILL_PROTOCOL_VERSION", () => {
    it("is defined and numeric", () => {
      expect(SKILL_PROTOCOL_VERSION).toBe(2);
      expect(typeof SKILL_PROTOCOL_VERSION).toBe("number");
    });
  });

  describe("computeWorkspaceHash", () => {
    it("produces consistent hash for same input", () => {
      const hash1 = computeWorkspaceHash("/workspace/project1");
      const hash2 = computeWorkspaceHash("/workspace/project1");
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different inputs", () => {
      const hash1 = computeWorkspaceHash("/workspace/project1");
      const hash2 = computeWorkspaceHash("/workspace/project2");
      expect(hash1).not.toBe(hash2);
    });

    it("incorporates config hash", () => {
      const hash1 = computeWorkspaceHash("/workspace/project1", "config-a");
      const hash2 = computeWorkspaceHash("/workspace/project1", "config-b");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("createSkillProtocolMessage", () => {
    it("creates a valid protocol message", () => {
      const snapshot = createMockSnapshot();
      const message = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });

      expect(message.header.version).toBe(SKILL_PROTOCOL_VERSION);
      expect(message.header.encoding).toBe("json");
      expect(message.header.checksum).toBeTruthy();
      expect(message.header.workspaceHash).toBeTruthy();
      expect(message.header.createdAt).toBeGreaterThan(0);
      expect(message.payload).toEqual(snapshot);
      expect(message.metadata.skillCount).toBe(1);
      expect(message.metadata.buildTimeMs).toBe(50);
    });

    it("sets expiration time", () => {
      const snapshot = createMockSnapshot();
      const message = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });

      expect(message.header.expiresAt).toBeGreaterThan(message.header.createdAt);
    });
  });

  describe("validateProtocolMessage", () => {
    it("validates a fresh message", () => {
      const snapshot = createMockSnapshot();
      const message = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });

      const result = validateProtocolMessage(message);
      expect(result.valid).toBe(true);
    });

    it("rejects message with wrong version", () => {
      const snapshot = createMockSnapshot();
      const message = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });
      message.header.version = 999;

      const result = validateProtocolMessage(message);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("unsupported protocol version");
    });

    it("rejects message with invalid checksum", () => {
      const snapshot = createMockSnapshot();
      const message = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });
      message.header.checksum = "invalid";

      const result = validateProtocolMessage(message);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("checksum mismatch");
    });

    it("rejects expired message", () => {
      const snapshot = createMockSnapshot();
      const message = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });
      message.header.expiresAt = Date.now() - 1000;

      const result = validateProtocolMessage(message);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("message expired");
    });
  });

  describe("cache operations", () => {
    it("generates consistent cache keys", () => {
      const key1 = cacheKey("/workspace/test", ["skill-a", "skill-b"]);
      const key2 = cacheKey("/workspace/test", ["skill-b", "skill-a"]);
      expect(key1).toBe(key2);
    });

    it("sets and gets from cache", () => {
      const snapshot = createMockSnapshot();
      const message = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });
      const key = cacheKey("/workspace/test");

      setCache(key, message);
      const cached = getFromCache<SkillSnapshot>(key);

      expect(cached).not.toBeNull();
      expect(cached!.payload).toEqual(snapshot);
    });

    it("returns null for missing cache entry", () => {
      const cached = getFromCache("/nonexistent");
      expect(cached).toBeNull();
    });

    it("invalidates by key", () => {
      const snapshot = createMockSnapshot();
      const message = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });
      const key = cacheKey("/workspace/test");

      setCache(key, message);
      expect(getFromCache(key)).not.toBeNull();

      invalidateCache(key);
      expect(getFromCache(key)).toBeNull();
    });

    it("invalidates by pattern", () => {
      const snapshot = createMockSnapshot();
      const message = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });

      setCache("/workspace/a:*", message);
      setCache("/workspace/b:*", message);

      const removed = invalidateCachePattern("/workspace/a:*");
      expect(removed).toBe(1);
      expect(getFromCache("/workspace/a:*")).toBeNull();
      expect(getFromCache("/workspace/b:*")).not.toBeNull();
    });

    it("evicts old entries when cache is full", () => {
      clearCache();
      configureSkillProtocol({ cacheMaxSize: 3 });

      for (let i = 0; i < 5; i++) {
        const snapshot = createMockSnapshot();
        const message = createSkillProtocolMessage(snapshot, {
          workspaceDir: `/workspace/test${i}`,
          buildTimeMs: 50,
        });
        setCache(`key-${i}`, message);
      }

      const stats = getCacheStats();
      expect(stats.maxSize).toBe(3);
      expect(stats.size).toBeLessThanOrEqual(3);
    });
  });

  describe("getCacheStats", () => {
    it("returns empty stats for empty cache", () => {
      const stats = getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it("tracks hits and calculates hit rate", () => {
      const snapshot = createMockSnapshot();
      const message = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });
      const key = cacheKey("/workspace/test");
      setCache(key, message);

      getFromCache(key);
      getFromCache(key);
      getFromCache(key);

      const stats = getCacheStats();
      expect(stats.totalHits).toBe(3);
      expect(stats.hitRate).toBe(3);
    });
  });

  describe("computeSkillDelta", () => {
    it("detects added skills", () => {
      const previous = [createMockSkill("skill-a")];
      const current = [createMockSkill("skill-a"), createMockSkill("skill-b")];

      const delta = computeSkillDelta(previous, current);
      expect(delta.added).toEqual(["skill-b"]);
      expect(delta.removed).toEqual([]);
      expect(delta.modified).toEqual([]);
    });

    it("detects removed skills", () => {
      const previous = [createMockSkill("skill-a"), createMockSkill("skill-b")];
      const current = [createMockSkill("skill-a")];

      const delta = computeSkillDelta(previous, current);
      expect(delta.added).toEqual([]);
      expect(delta.removed).toEqual(["skill-b"]);
      expect(delta.modified).toEqual([]);
    });

    it("detects modified skills", () => {
      const previous = [createMockSkill("skill-a")];
      const current = [createMockSkill("skill-a")];
      current[0].skill.description = "Modified description";

      const delta = computeSkillDelta(previous, current);
      expect(delta.modified).toContain("skill-a");
    });
  });

  describe("serializeForTransport / deserializeFromTransport", () => {
    it("round-trips message correctly", () => {
      const snapshot = createMockSnapshot();
      const original = createSkillProtocolMessage(snapshot, {
        workspaceDir: "/workspace/test",
        buildTimeMs: 50,
      });

      const serialized = serializeForTransport(original);
      expect(serialized.version).toBe(SKILL_PROTOCOL_VERSION);
      expect(serialized.payloadJson).toBeTruthy();

      const deserialized = deserializeFromTransport<SkillSnapshot>(serialized);
      expect(deserialized.header).toEqual(original.header);
      expect(deserialized.payload).toEqual(original.payload);
    });
  });

  describe("configureSkillProtocol", () => {
    it("applies configuration", () => {
      configureSkillProtocol({
        cacheMaxSize: 100,
        cacheTtlMs: 120000,
        enableCompression: true,
      });

      const stats = getCacheStats();
      expect(stats.maxSize).toBe(100);
    });
  });
});
