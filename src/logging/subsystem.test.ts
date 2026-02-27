import { afterEach, describe, expect, it, vi } from "vitest";
import { setConsoleSubsystemFilter } from "./console.js";
import { resetLogger, setLoggerOverride } from "./logger.js";
import { createSubsystemLogger } from "./subsystem.js";

afterEach(() => {
  setConsoleSubsystemFilter(null);
  setLoggerOverride(null);
  resetLogger();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("createSubsystemLogger().isEnabled", () => {
  it("returns true for any/file when only file logging would emit", () => {
    setLoggerOverride({ level: "debug", consoleLevel: "silent" });
    const log = createSubsystemLogger("agent/embedded");

    expect(log.isEnabled("debug")).toBe(true);
    expect(log.isEnabled("debug", "file")).toBe(true);
    expect(log.isEnabled("debug", "console")).toBe(false);
  });

  it("returns true for any/console when only console logging would emit", () => {
    setLoggerOverride({ level: "silent", consoleLevel: "debug" });
    const log = createSubsystemLogger("agent/embedded");

    expect(log.isEnabled("debug")).toBe(true);
    expect(log.isEnabled("debug", "console")).toBe(true);
    expect(log.isEnabled("debug", "file")).toBe(false);
  });

  it("returns false when neither console nor file logging would emit", () => {
    setLoggerOverride({ level: "silent", consoleLevel: "silent" });
    const log = createSubsystemLogger("agent/embedded");

    expect(log.isEnabled("debug")).toBe(false);
    expect(log.isEnabled("debug", "console")).toBe(false);
    expect(log.isEnabled("debug", "file")).toBe(false);
  });

  it("honors console subsystem filters for console target", () => {
    setLoggerOverride({ level: "silent", consoleLevel: "info" });
    setConsoleSubsystemFilter(["gateway"]);
    const log = createSubsystemLogger("agent/embedded");

    expect(log.isEnabled("info", "console")).toBe(false);
  });

  it("does not apply console subsystem filters to file target", () => {
    setLoggerOverride({ level: "info", consoleLevel: "silent" });
    setConsoleSubsystemFilter(["gateway"]);
    const log = createSubsystemLogger("agent/embedded");

    expect(log.isEnabled("info", "file")).toBe(true);
    expect(log.isEnabled("info")).toBe(true);
  });
});

describe("createSubsystemLogger console line timestamp", () => {
  it("pretty style emits local HH:MM:SS, not a UTC ISO-string slice", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-17T18:01:02.000Z"));
    setLoggerOverride({ level: "silent", consoleLevel: "info", consoleStyle: "pretty" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    createSubsystemLogger("test").info("hello");

    expect(logSpy).toHaveBeenCalledOnce();
    const output = String(logSpy.mock.calls[0]?.[0] ?? "");
    // Pretty style: timestamp must be HH:MM:SS (local), not a full UTC ISO string
    expect(output).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(output).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(output).not.toMatch(/Z$/);
  });
});
