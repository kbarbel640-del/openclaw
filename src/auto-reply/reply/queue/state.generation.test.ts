import { describe, it, expect, beforeEach } from "vitest";
import {
  getSessionGenerationId,
  incrementSessionGenerationId,
  isGenerationCurrent,
  SESSION_GENERATION_IDS,
} from "./state.js";

describe("session generation id helpers", () => {
  beforeEach(() => {
    SESSION_GENERATION_IDS.clear();
  });

  describe("getSessionGenerationId", () => {
    it("returns 0 for unknown keys", () => {
      expect(getSessionGenerationId("unknown-key")).toBe(0);
    });

    it("returns current value after increment", () => {
      incrementSessionGenerationId("key-1");
      expect(getSessionGenerationId("key-1")).toBe(1);
    });
  });

  describe("incrementSessionGenerationId", () => {
    it("increments from 0 to 1 on first call", () => {
      expect(incrementSessionGenerationId("key-a")).toBe(1);
    });

    it("increments sequentially", () => {
      incrementSessionGenerationId("key-b");
      incrementSessionGenerationId("key-b");
      expect(incrementSessionGenerationId("key-b")).toBe(3);
    });

    it("tracks keys independently", () => {
      incrementSessionGenerationId("key-x");
      incrementSessionGenerationId("key-x");
      incrementSessionGenerationId("key-y");
      expect(getSessionGenerationId("key-x")).toBe(2);
      expect(getSessionGenerationId("key-y")).toBe(1);
    });
  });

  describe("isGenerationCurrent", () => {
    it("returns true when generationId matches current", () => {
      expect(isGenerationCurrent("q1", 0)).toBe(true);
      incrementSessionGenerationId("q1");
      expect(isGenerationCurrent("q1", 1)).toBe(true);
    });

    it("returns false when generationId is stale", () => {
      incrementSessionGenerationId("q2");
      expect(isGenerationCurrent("q2", 0)).toBe(false);
    });

    it("returns false for future generationIds", () => {
      expect(isGenerationCurrent("q3", 5)).toBe(false);
    });
  });
});
