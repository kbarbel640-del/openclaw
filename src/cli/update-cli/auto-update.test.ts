import fs from "node:fs/promises";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadAutoUpdateConfig,
  saveAutoUpdateConfig,
  getAutoUpdateConfigPath,
  handleAutoUpdateOptions,
  displayAutoUpdateStatus,
  recordUpdateCheck,
  shouldSkipVersion,
  getNextCheckTime,
} from "./auto-update.js";

vi.mock("node:fs/promises");
vi.mock("../../config/paths.js", () => ({
  resolveStateDir: vi.fn(() => "/tmp/test-openclaw"),
}));
vi.mock("../../logger.js", () => ({
  logInfo: vi.fn(),
  logSuccess: vi.fn(),
  logWarn: vi.fn(),
}));
vi.mock("../../runtime.js", () => ({
  defaultRuntime: { log: vi.fn(), error: vi.fn(), exit: vi.fn() },
}));

describe("auto-update config", () => {
  const testConfigPath = "/tmp/test-openclaw/auto-update.json";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("loadAutoUpdateConfig", () => {
    it("returns default config when file does not exist", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      const config = await loadAutoUpdateConfig();

      expect(config.enabled).toBe(false);
      expect(config.interval).toBe("weekly");
      expect(config.skipVersions).toEqual([]);
      expect(config.notifyOnUpdate).toBe(true);
    });

    it("loads config from file when it exists", async () => {
      const mockConfig = {
        enabled: true,
        interval: "daily" as const,
        skipVersions: ["v1.0.0"],
        notifyOnUpdate: false,
      };
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const config = await loadAutoUpdateConfig();

      expect(config.enabled).toBe(true);
      expect(config.interval).toBe("daily");
      expect(config.skipVersions).toEqual(["v1.0.0"]);
      expect(config.notifyOnUpdate).toBe(false);
    });

    it("falls back to defaults when JSON is invalid", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue("invalid json");

      const config = await loadAutoUpdateConfig();

      expect(config.enabled).toBe(false);
      expect(config.interval).toBe("weekly");
    });
  });

  describe("saveAutoUpdateConfig", () => {
    it("writes config to file", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await saveAutoUpdateConfig({
        enabled: false,
        interval: "manual",
        skipVersions: ["v2.0.0"],
        notifyOnUpdate: false,
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        testConfigPath,
        JSON.stringify(
          {
            enabled: false,
            interval: "manual",
            skipVersions: ["v2.0.0"],
            notifyOnUpdate: false,
          },
          null,
          2,
        ),
      );
    });
  });

  describe("getAutoUpdateConfigPath", () => {
    it("returns path to auto-update.json in state dir", () => {
      const path = getAutoUpdateConfigPath();
      expect(path).toBe("/tmp/test-openclaw/auto-update.json");
    });
  });

  describe("handleAutoUpdateOptions", () => {
    it("returns false when no auto-update options are provided", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      const result = await handleAutoUpdateOptions({});
      expect(result).toBe(false);
    });

    it("saves config when --auto is provided", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await handleAutoUpdateOptions({ auto: "on" });

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("filters empty strings from --skip", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await handleAutoUpdateOptions({ skip: "v1.0.0,,v2.0.0" });

      expect(fs.writeFile).toHaveBeenCalled();
      const callArgs = vi.mocked(fs.writeFile).mock.calls[0];
      const savedConfig = JSON.parse(callArgs[1] as string);
      expect(savedConfig.skipVersions).toEqual(["v1.0.0", "v2.0.0"]);
    });

    it("filters empty strings from --skip with comma only", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await handleAutoUpdateOptions({ skip: "," });

      expect(fs.writeFile).toHaveBeenCalled();
      const callArgs = vi.mocked(fs.writeFile).mock.calls[0];
      const savedConfig = JSON.parse(callArgs[1] as string);
      expect(savedConfig.skipVersions).toEqual([]);
    });
  });

  describe("shouldSkipVersion", () => {
    it("returns true when version is in skip list", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          enabled: true,
          interval: "weekly",
          skipVersions: ["v1.0.0", "v2.0.0"],
          notifyOnUpdate: true,
        }),
      );

      const result = await shouldSkipVersion("v1.0.0");
      expect(result).toBe(true);
    });

    it("returns false when version is not in skip list", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          enabled: true,
          interval: "weekly",
          skipVersions: ["v1.0.0"],
          notifyOnUpdate: true,
        }),
      );

      const result = await shouldSkipVersion("v2.0.0");
      expect(result).toBe(false);
    });
  });

  describe("getNextCheckTime", () => {
    it("returns null when auto-update is disabled", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          enabled: false,
          interval: "weekly",
          skipVersions: [],
          notifyOnUpdate: true,
        }),
      );

      const result = await getNextCheckTime();
      expect(result).toBeNull();
    });

    it("returns null when interval is manual", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          enabled: true,
          interval: "manual",
          skipVersions: [],
          notifyOnUpdate: true,
        }),
      );

      const result = await getNextCheckTime();
      expect(result).toBeNull();
    });

    it("returns null when no lastCheck exists", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          enabled: true,
          interval: "daily",
          skipVersions: [],
          notifyOnUpdate: true,
        }),
      );

      const result = await getNextCheckTime();
      expect(result).toBeNull();
    });

    it("returns next check time based on interval", async () => {
      const lastCheck = new Date("2024-01-01T00:00:00Z");
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          enabled: true,
          interval: "daily",
          skipVersions: [],
          notifyOnUpdate: true,
          lastCheck: lastCheck.toISOString(),
        }),
      );

      const result = await getNextCheckTime();
      expect(result).not.toBeNull();
      expect(result?.getTime()).toBe(lastCheck.getTime() + 24 * 60 * 60 * 1000);
    });
  });

  describe("recordUpdateCheck", () => {
    it("updates lastCheck timestamp", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          enabled: true,
          interval: "weekly",
          skipVersions: [],
          notifyOnUpdate: true,
        }),
      );
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await recordUpdateCheck();

      expect(fs.writeFile).toHaveBeenCalled();
      const callArgs = vi.mocked(fs.writeFile).mock.calls[0];
      const savedConfig = JSON.parse(callArgs[1] as string);
      expect(savedConfig.lastCheck).toBeDefined();
      expect(new Date(savedConfig.lastCheck).getTime()).toBeCloseTo(Date.now(), -3);
    });
  });

  describe("displayAutoUpdateStatus", () => {
    it("displays auto-update status", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          enabled: true,
          interval: "weekly",
          skipVersions: ["v1.0.0"],
          notifyOnUpdate: true,
        }),
      );

      await displayAutoUpdateStatus();
    });
  });
});
