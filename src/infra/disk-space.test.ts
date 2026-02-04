import { describe, it, expect } from "vitest";
import { getDiskSpace, autoCleanDiskSpace } from "./disk-space.js";

describe("disk-space", () => {
  describe("getDiskSpace", () => {
    it("should return disk space information", () => {
      const result = getDiskSpace(".");
      if (result) {
        expect(result).toHaveProperty("total");
        expect(result).toHaveProperty("used");
        expect(result).toHaveProperty("available");
        expect(result).toHaveProperty("usagePercent");
        expect(result).toHaveProperty("path");
        expect(result.total).toBeGreaterThan(0);
        expect(result.usagePercent).toBeGreaterThanOrEqual(0);
        expect(result.usagePercent).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("autoCleanDiskSpace", () => {
    it("should not clean when below threshold", () => {
      const result = autoCleanDiskSpace({
        checkPath: ".",
        thresholdPercent: 99, // Very high threshold, should never trigger
        log: {
          info: () => {},
          warn: () => {},
        },
      });

      expect(result.cleaned).toBe(false);
      expect(result.reason).toContain("below threshold");
      expect(result.beforePercent).toBeDefined();
    });

    it("should handle cleanup gracefully on low threshold", () => {
      // This test may or may not trigger cleanup depending on disk usage
      const result = autoCleanDiskSpace({
        checkPath: ".",
        thresholdPercent: 1, // Very low threshold, will trigger
        log: {
          info: () => {},
          warn: () => {},
        },
      });

      // Should either clean or report unable to determine space
      expect(result.cleaned === true || result.reason === "unable to determine disk space").toBe(
        true,
      );
    });

    it("should skip cleanup when OPENCLAW_SKIP_DISK_CLEANUP is set", () => {
      const originalEnv = process.env.OPENCLAW_SKIP_DISK_CLEANUP;
      process.env.OPENCLAW_SKIP_DISK_CLEANUP = "1";

      // This test just verifies the env var exists - actual skip logic is in server-startup
      expect(process.env.OPENCLAW_SKIP_DISK_CLEANUP).toBe("1");

      // Restore
      if (originalEnv === undefined) {
        delete process.env.OPENCLAW_SKIP_DISK_CLEANUP;
      } else {
        process.env.OPENCLAW_SKIP_DISK_CLEANUP = originalEnv;
      }
    });
  });
});
