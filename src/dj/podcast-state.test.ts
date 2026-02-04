/**
 * Tests for Podcast State Management
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EpisodeId, PodcastState } from "./podcast-types.js";
import {
  allocateEpisodeId,
  DEFAULT_STATE_FILE,
  formatEpisodeId,
  getLastAllocatedId,
  getPodcastState,
  isEpisodeIdAvailable,
  isValidEpisodeId,
  loadPodcastState,
  parseEpisodeId,
  peekNextEpisodeId,
  reserveEpisodeId,
  resetPodcastState,
  rollbackEpisodeId,
  savePodcastState,
} from "./podcast-state.js";

// =============================================================================
// Test Helpers
// =============================================================================

function createTempStateFile(): string {
  const testDir = join(
    tmpdir(),
    "openclaw-test",
    `podcast-state-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(testDir, { recursive: true });
  return join(testDir, "dj-podcast.json");
}

function cleanupTempFile(filePath: string): void {
  try {
    const dir = dirname(filePath);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// Episode ID Formatting Tests
// =============================================================================

describe("formatEpisodeId", () => {
  it("should format single digit numbers with leading zeros", () => {
    expect(formatEpisodeId(1)).toBe("E001");
    expect(formatEpisodeId(5)).toBe("E005");
    expect(formatEpisodeId(9)).toBe("E009");
  });

  it("should format double digit numbers with leading zero", () => {
    expect(formatEpisodeId(10)).toBe("E010");
    expect(formatEpisodeId(42)).toBe("E042");
    expect(formatEpisodeId(99)).toBe("E099");
  });

  it("should format triple digit numbers without padding", () => {
    expect(formatEpisodeId(100)).toBe("E100");
    expect(formatEpisodeId(123)).toBe("E123");
    expect(formatEpisodeId(999)).toBe("E999");
  });

  it("should format four+ digit numbers correctly", () => {
    expect(formatEpisodeId(1000)).toBe("E1000");
    expect(formatEpisodeId(9999)).toBe("E9999");
    expect(formatEpisodeId(10000)).toBe("E10000");
  });

  it("should throw for zero", () => {
    expect(() => formatEpisodeId(0)).toThrow("Episode number must be >= 1");
  });

  it("should throw for negative numbers", () => {
    expect(() => formatEpisodeId(-1)).toThrow("Episode number must be >= 1");
  });
});

describe("parseEpisodeId", () => {
  it("should parse valid episode IDs", () => {
    expect(parseEpisodeId("E001")).toBe(1);
    expect(parseEpisodeId("E042")).toBe(42);
    expect(parseEpisodeId("E100")).toBe(100);
    expect(parseEpisodeId("E1000")).toBe(1000);
  });

  it("should throw for invalid formats", () => {
    expect(() => parseEpisodeId("E01")).toThrow("Invalid episode ID format");
    expect(() => parseEpisodeId("E1")).toThrow("Invalid episode ID format");
    expect(() => parseEpisodeId("001")).toThrow("Invalid episode ID format");
    expect(() => parseEpisodeId("EP001")).toThrow("Invalid episode ID format");
    expect(() => parseEpisodeId("e001")).toThrow("Invalid episode ID format");
    expect(() => parseEpisodeId("")).toThrow("Invalid episode ID format");
  });
});

describe("isValidEpisodeId", () => {
  it("should return true for valid IDs", () => {
    expect(isValidEpisodeId("E001")).toBe(true);
    expect(isValidEpisodeId("E042")).toBe(true);
    expect(isValidEpisodeId("E100")).toBe(true);
    expect(isValidEpisodeId("E1000")).toBe(true);
  });

  it("should return false for invalid IDs", () => {
    expect(isValidEpisodeId("E01")).toBe(false);
    expect(isValidEpisodeId("E1")).toBe(false);
    expect(isValidEpisodeId("001")).toBe(false);
    expect(isValidEpisodeId("EP001")).toBe(false);
    expect(isValidEpisodeId("e001")).toBe(false);
    expect(isValidEpisodeId("")).toBe(false);
  });
});

// =============================================================================
// State File Operations Tests
// =============================================================================

describe("loadPodcastState", () => {
  let testFile: string;

  beforeEach(() => {
    testFile = createTempStateFile();
  });

  afterEach(() => {
    cleanupTempFile(testFile);
  });

  it("should return fresh state when file does not exist", () => {
    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(1);
    expect(state.updatedAt).toBeDefined();
    expect(state.lastAllocatedId).toBeUndefined();
  });

  it("should load existing state from file", () => {
    const existingState: PodcastState = {
      nextEpisodeNumber: 42,
      lastAllocatedId: "E041" as EpisodeId,
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    mkdirSync(dirname(testFile), { recursive: true });
    writeFileSync(testFile, JSON.stringify(existingState), "utf-8");

    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(42);
    expect(state.lastAllocatedId).toBe("E041");
    expect(state.updatedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("should return fresh state on corrupted JSON", () => {
    mkdirSync(dirname(testFile), { recursive: true });
    writeFileSync(testFile, "not valid json", "utf-8");

    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(1);
  });

  it("should return fresh state on invalid state structure", () => {
    mkdirSync(dirname(testFile), { recursive: true });
    writeFileSync(testFile, JSON.stringify({ foo: "bar" }), "utf-8");

    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(1);
  });

  it("should return fresh state on negative nextEpisodeNumber", () => {
    mkdirSync(dirname(testFile), { recursive: true });
    writeFileSync(
      testFile,
      JSON.stringify({ nextEpisodeNumber: -1, updatedAt: "2024-01-01T00:00:00.000Z" }),
      "utf-8",
    );

    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(1);
  });
});

describe("savePodcastState", () => {
  let testFile: string;

  beforeEach(() => {
    testFile = createTempStateFile();
  });

  afterEach(() => {
    cleanupTempFile(testFile);
  });

  it("should save state to file", () => {
    const state: PodcastState = {
      nextEpisodeNumber: 42,
      lastAllocatedId: "E041" as EpisodeId,
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    savePodcastState(state, testFile);

    expect(existsSync(testFile)).toBe(true);
    const loaded = JSON.parse(readFileSync(testFile, "utf-8"));
    expect(loaded.nextEpisodeNumber).toBe(42);
    expect(loaded.lastAllocatedId).toBe("E041");
  });

  it("should create directory if it does not exist", () => {
    const deepPath = join(testFile, "..", "deep", "nested", "state.json");

    const state: PodcastState = {
      nextEpisodeNumber: 1,
      updatedAt: new Date().toISOString(),
    };

    savePodcastState(state, deepPath);
    expect(existsSync(deepPath)).toBe(true);
  });

  it("should overwrite existing file", () => {
    const state1: PodcastState = {
      nextEpisodeNumber: 1,
      updatedAt: new Date().toISOString(),
    };
    savePodcastState(state1, testFile);

    const state2: PodcastState = {
      nextEpisodeNumber: 42,
      updatedAt: new Date().toISOString(),
    };
    savePodcastState(state2, testFile);

    const loaded = JSON.parse(readFileSync(testFile, "utf-8"));
    expect(loaded.nextEpisodeNumber).toBe(42);
  });
});

// =============================================================================
// Episode ID Allocation Tests
// =============================================================================

describe("allocateEpisodeId", () => {
  let testFile: string;

  beforeEach(() => {
    testFile = createTempStateFile();
  });

  afterEach(() => {
    cleanupTempFile(testFile);
  });

  it("should allocate first episode as E001", () => {
    const id = allocateEpisodeId(testFile);
    expect(id).toBe("E001");
  });

  it("should allocate sequential IDs", () => {
    const id1 = allocateEpisodeId(testFile);
    const id2 = allocateEpisodeId(testFile);
    const id3 = allocateEpisodeId(testFile);

    expect(id1).toBe("E001");
    expect(id2).toBe("E002");
    expect(id3).toBe("E003");
  });

  it("should increment counter after allocation", () => {
    allocateEpisodeId(testFile);

    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(2);
    expect(state.lastAllocatedId).toBe("E001");
  });

  it("should persist state to file", () => {
    allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);

    // Load fresh instance
    const state = JSON.parse(readFileSync(testFile, "utf-8"));
    expect(state.nextEpisodeNumber).toBe(3);
    expect(state.lastAllocatedId).toBe("E002");
  });
});

describe("isEpisodeIdAvailable", () => {
  let testFile: string;

  beforeEach(() => {
    testFile = createTempStateFile();
  });

  afterEach(() => {
    cleanupTempFile(testFile);
  });

  it("should return true for ID higher than next", () => {
    const available = isEpisodeIdAvailable("E100" as EpisodeId, [], testFile);
    expect(available).toBe(true);
  });

  it("should return false for ID in existingIds", () => {
    const existingIds: EpisodeId[] = ["E001", "E002", "E005"];
    expect(isEpisodeIdAvailable("E001" as EpisodeId, existingIds, testFile)).toBe(false);
    expect(isEpisodeIdAvailable("E002" as EpisodeId, existingIds, testFile)).toBe(false);
    expect(isEpisodeIdAvailable("E005" as EpisodeId, existingIds, testFile)).toBe(false);
  });

  it("should return true for ID not in existingIds", () => {
    const existingIds: EpisodeId[] = ["E001", "E002"];
    expect(isEpisodeIdAvailable("E003" as EpisodeId, existingIds, testFile)).toBe(true);
    expect(isEpisodeIdAvailable("E100" as EpisodeId, existingIds, testFile)).toBe(true);
  });

  it("should check against state counter", () => {
    // Allocate some IDs
    allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);

    // E003 was allocated, but if not in existingIds, it might have failed
    // This simulates the case where E003 failed to create in Notion
    expect(isEpisodeIdAvailable("E003" as EpisodeId, [], testFile)).toBe(false);
    expect(isEpisodeIdAvailable("E004" as EpisodeId, [], testFile)).toBe(true);
  });
});

describe("reserveEpisodeId", () => {
  let testFile: string;

  beforeEach(() => {
    testFile = createTempStateFile();
  });

  afterEach(() => {
    cleanupTempFile(testFile);
  });

  it("should update counter for higher ID", () => {
    reserveEpisodeId("E042" as EpisodeId, testFile);

    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(43);
    expect(state.lastAllocatedId).toBe("E042");
  });

  it("should not decrease counter for lower ID", () => {
    allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);

    reserveEpisodeId("E001" as EpisodeId, testFile);

    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(4);
    expect(state.lastAllocatedId).toBe("E001");
  });
});

describe("rollbackEpisodeId", () => {
  let testFile: string;

  beforeEach(() => {
    testFile = createTempStateFile();
  });

  afterEach(() => {
    cleanupTempFile(testFile);
  });

  it("should rollback last allocated ID", () => {
    const id = allocateEpisodeId(testFile);
    expect(id).toBe("E001");

    const rolledBack = rollbackEpisodeId(id, testFile);
    expect(rolledBack).toBe(true);

    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(1);
    expect(state.lastAllocatedId).toBeUndefined();
  });

  it("should not rollback if ID does not match last allocated", () => {
    allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);

    // Try to rollback E001 when E002 was last allocated
    const rolledBack = rollbackEpisodeId("E001" as EpisodeId, testFile);
    expect(rolledBack).toBe(false);

    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(3);
  });

  it("should not rollback if counter advanced past allocation", () => {
    const id1 = allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);

    // Manually set lastAllocatedId to E001 to simulate out-of-order
    const state = loadPodcastState(testFile);
    state.lastAllocatedId = id1;
    savePodcastState(state, testFile);

    // Try to rollback E001 - should fail because counter is at 3
    const rolledBack = rollbackEpisodeId(id1, testFile);
    expect(rolledBack).toBe(false);
  });

  it("should allow re-allocation after rollback", () => {
    const id1 = allocateEpisodeId(testFile);
    rollbackEpisodeId(id1, testFile);

    const id2 = allocateEpisodeId(testFile);
    expect(id2).toBe("E001"); // Should get same ID again
  });
});

// =============================================================================
// Helper Functions Tests
// =============================================================================

describe("peekNextEpisodeId", () => {
  let testFile: string;

  beforeEach(() => {
    testFile = createTempStateFile();
  });

  afterEach(() => {
    cleanupTempFile(testFile);
  });

  it("should return next ID without allocating", () => {
    const peek1 = peekNextEpisodeId(testFile);
    const peek2 = peekNextEpisodeId(testFile);

    expect(peek1).toBe("E001");
    expect(peek2).toBe("E001"); // Should be same since not allocated
  });

  it("should reflect current state", () => {
    allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);

    const peek = peekNextEpisodeId(testFile);
    expect(peek).toBe("E003");
  });
});

describe("getLastAllocatedId", () => {
  let testFile: string;

  beforeEach(() => {
    testFile = createTempStateFile();
  });

  afterEach(() => {
    cleanupTempFile(testFile);
  });

  it("should return null when no episodes allocated", () => {
    const last = getLastAllocatedId(testFile);
    expect(last).toBeNull();
  });

  it("should return lastAllocatedId if set", () => {
    allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);

    const last = getLastAllocatedId(testFile);
    expect(last).toBe("E002");
  });

  it("should fallback to computed ID if lastAllocatedId not set", () => {
    // Manually create state without lastAllocatedId
    const state: PodcastState = {
      nextEpisodeNumber: 5,
      updatedAt: new Date().toISOString(),
    };
    savePodcastState(state, testFile);

    const last = getLastAllocatedId(testFile);
    expect(last).toBe("E004");
  });
});

describe("resetPodcastState", () => {
  let testFile: string;

  beforeEach(() => {
    testFile = createTempStateFile();
  });

  afterEach(() => {
    cleanupTempFile(testFile);
  });

  it("should reset state to initial values", () => {
    allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);
    allocateEpisodeId(testFile);

    resetPodcastState(testFile);

    const state = loadPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(1);
    expect(state.lastAllocatedId).toBeUndefined();
  });
});

describe("getPodcastState", () => {
  let testFile: string;

  beforeEach(() => {
    testFile = createTempStateFile();
  });

  afterEach(() => {
    cleanupTempFile(testFile);
  });

  it("should return current state", () => {
    allocateEpisodeId(testFile);

    const state = getPodcastState(testFile);
    expect(state.nextEpisodeNumber).toBe(2);
    expect(state.lastAllocatedId).toBe("E001");
  });
});

// =============================================================================
// Default State File Tests
// =============================================================================

describe("DEFAULT_STATE_FILE", () => {
  it("should be in .openclaw/state directory", () => {
    expect(DEFAULT_STATE_FILE).toContain(".openclaw");
    expect(DEFAULT_STATE_FILE).toContain("state");
    expect(DEFAULT_STATE_FILE).toContain("dj-podcast.json");
  });
});
