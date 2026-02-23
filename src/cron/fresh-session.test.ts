import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveCronSession } from "./isolated-agent/session.js";
import { normalizeCronJobCreate, normalizeCronJobPatch } from "./normalize.js";

describe("freshSession — cron job option (#20092)", () => {
  describe("normalize", () => {
    const baseJob = {
      name: "test",
      enabled: true,
      schedule: { kind: "cron" as const, expr: "0 * * * *" },
      sessionTarget: "isolated" as const,
      wakeMode: "now" as const,
      payload: { kind: "agentTurn" as const, message: "run" },
    };

    it("accepts freshSession: true in create", () => {
      const result = normalizeCronJobCreate({ ...baseJob, freshSession: true });
      expect(result).not.toBeNull();
      expect((result as Record<string, unknown>).freshSession).toBe(true);
    });

    it("accepts freshSession: false in create", () => {
      const result = normalizeCronJobCreate({ ...baseJob, freshSession: false });
      expect(result).not.toBeNull();
      expect((result as Record<string, unknown>).freshSession).toBe(false);
    });

    it("coerces string 'true' to boolean true", () => {
      const result = normalizeCronJobCreate({ ...baseJob, freshSession: "true" });
      expect(result).not.toBeNull();
      expect((result as Record<string, unknown>).freshSession).toBe(true);
    });

    it("coerces string 'false' to boolean false", () => {
      const result = normalizeCronJobCreate({ ...baseJob, freshSession: "false" });
      expect(result).not.toBeNull();
      expect((result as Record<string, unknown>).freshSession).toBe(false);
    });

    it("strips non-boolean/non-string freshSession values", () => {
      const result = normalizeCronJobCreate({ ...baseJob, freshSession: 42 });
      expect(result).not.toBeNull();
      expect((result as Record<string, unknown>).freshSession).toBeUndefined();
    });

    it("omits freshSession when not provided", () => {
      const result = normalizeCronJobCreate(baseJob);
      expect(result).not.toBeNull();
      expect("freshSession" in (result as Record<string, unknown>)).toBe(false);
    });

    it("accepts freshSession in patch", () => {
      const result = normalizeCronJobPatch({ freshSession: false });
      expect(result).not.toBeNull();
      expect((result as Record<string, unknown>).freshSession).toBe(false);
    });
  });

  describe("resolveCronSession", () => {
    const minimalCfg = { session: {} } as unknown as OpenClawConfig;

    it("ignores existing session entry when freshSession is true (default)", () => {
      const result = resolveCronSession({
        cfg: minimalCfg,
        sessionKey: "cron:test-job",
        agentId: "main",
        nowMs: Date.now(),
        freshSession: true,
      });

      // Session entry should have no carried-over state
      expect(result.sessionEntry.thinkingLevel).toBeUndefined();
      expect(result.sessionEntry.model).toBeUndefined();
      expect(result.sessionEntry.modelOverride).toBeUndefined();
      expect(result.sessionEntry.providerOverride).toBeUndefined();
      expect(result.isNewSession).toBe(true);
    });

    it("defaults to fresh session when freshSession is not specified", () => {
      const result = resolveCronSession({
        cfg: minimalCfg,
        sessionKey: "cron:test-job",
        agentId: "main",
        nowMs: Date.now(),
        // freshSession not specified — should default to true (fresh)
      });

      expect(result.sessionEntry.thinkingLevel).toBeUndefined();
      expect(result.sessionEntry.model).toBeUndefined();
      expect(result.isNewSession).toBe(true);
    });
  });
});
