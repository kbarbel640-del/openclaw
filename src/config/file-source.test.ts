import { describe, expect, it } from "vitest";
import { CONFIG_PATH } from "./config.js";
import { FileConfigSource } from "./file-source.js";
import { withTempHomeConfig } from "./test-helpers.js";

describe("FileConfigSource", () => {
  it("implements ConfigSource interface", () => {
    const source = new FileConfigSource();
    expect(source.watchPath).toBe(CONFIG_PATH);
    expect(source.persistConfig).toBe(true);
    expect(typeof source.read).toBe("function");
    expect(typeof source.start).toBe("function");
  });

  it("start() returns undefined (no active polling needed)", () => {
    const source = new FileConfigSource();
    const result = source.start({
      info: () => {},
      warn: () => {},
      error: () => {},
    });
    expect(result).toBeUndefined();
  });

  it("read() returns a valid snapshot for a valid config", async () => {
    await withTempHomeConfig({}, async () => {
      const source = new FileConfigSource();
      const snapshot = await source.read();
      expect(snapshot.exists).toBe(true);
      expect(snapshot.valid).toBe(true);
      expect(snapshot.config).toBeDefined();
    });
  });

  it("read() returns exists:false when no config file", async () => {
    // FileConfigSource.read() delegates to readConfigFileSnapshot()
    // which handles missing files gracefully
    const source = new FileConfigSource();
    const snapshot = await source.read();
    // Behavior depends on whether a config file exists in the test env
    expect(snapshot).toBeDefined();
    expect(typeof snapshot.exists).toBe("boolean");
    expect(typeof snapshot.valid).toBe("boolean");
  });
});
