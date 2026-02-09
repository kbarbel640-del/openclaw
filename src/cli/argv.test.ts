import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it("detects help/version flags", () => {
    expect(hasHelpOrVersion(["node", "amigo", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "amigo", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "amigo", "status"])).toBe(false);
  });

  it("extracts command path ignoring flags and terminator", () => {
    expect(getCommandPath(["node", "amigo", "status", "--json"], 2)).toEqual(["status"]);
    expect(getCommandPath(["node", "amigo", "agents", "list"], 2)).toEqual(["agents", "list"]);
    expect(getCommandPath(["node", "amigo", "status", "--", "ignored"], 2)).toEqual(["status"]);
  });

  it("returns primary command", () => {
    expect(getPrimaryCommand(["node", "amigo", "agents", "list"])).toBe("agents");
    expect(getPrimaryCommand(["node", "amigo"])).toBeNull();
  });

  it("parses boolean flags and ignores terminator", () => {
    expect(hasFlag(["node", "amigo", "status", "--json"], "--json")).toBe(true);
    expect(hasFlag(["node", "amigo", "--", "--json"], "--json")).toBe(false);
  });

  it("extracts flag values with equals and missing values", () => {
    expect(getFlagValue(["node", "amigo", "status", "--timeout", "5000"], "--timeout")).toBe(
      "5000",
    );
    expect(getFlagValue(["node", "amigo", "status", "--timeout=2500"], "--timeout")).toBe(
      "2500",
    );
    expect(getFlagValue(["node", "amigo", "status", "--timeout"], "--timeout")).toBeNull();
    expect(getFlagValue(["node", "amigo", "status", "--timeout", "--json"], "--timeout")).toBe(
      null,
    );
    expect(getFlagValue(["node", "amigo", "--", "--timeout=99"], "--timeout")).toBeUndefined();
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "amigo", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "amigo", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "amigo", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it("parses positive integer flag values", () => {
    expect(getPositiveIntFlagValue(["node", "amigo", "status"], "--timeout")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "amigo", "status", "--timeout"], "--timeout"),
    ).toBeNull();
    expect(
      getPositiveIntFlagValue(["node", "amigo", "status", "--timeout", "5000"], "--timeout"),
    ).toBe(5000);
    expect(
      getPositiveIntFlagValue(["node", "amigo", "status", "--timeout", "nope"], "--timeout"),
    ).toBeUndefined();
  });

  it("builds parse argv from raw args", () => {
    const nodeArgv = buildParseArgv({
      programName: "amigo",
      rawArgs: ["node", "amigo", "status"],
    });
    expect(nodeArgv).toEqual(["node", "amigo", "status"]);

    const versionedNodeArgv = buildParseArgv({
      programName: "amigo",
      rawArgs: ["node-22", "amigo", "status"],
    });
    expect(versionedNodeArgv).toEqual(["node-22", "amigo", "status"]);

    const versionedNodeWindowsArgv = buildParseArgv({
      programName: "amigo",
      rawArgs: ["node-22.2.0.exe", "amigo", "status"],
    });
    expect(versionedNodeWindowsArgv).toEqual(["node-22.2.0.exe", "amigo", "status"]);

    const versionedNodePatchlessArgv = buildParseArgv({
      programName: "amigo",
      rawArgs: ["node-22.2", "amigo", "status"],
    });
    expect(versionedNodePatchlessArgv).toEqual(["node-22.2", "amigo", "status"]);

    const versionedNodeWindowsPatchlessArgv = buildParseArgv({
      programName: "amigo",
      rawArgs: ["node-22.2.exe", "amigo", "status"],
    });
    expect(versionedNodeWindowsPatchlessArgv).toEqual(["node-22.2.exe", "amigo", "status"]);

    const versionedNodeWithPathArgv = buildParseArgv({
      programName: "amigo",
      rawArgs: ["/usr/bin/node-22.2.0", "amigo", "status"],
    });
    expect(versionedNodeWithPathArgv).toEqual(["/usr/bin/node-22.2.0", "amigo", "status"]);

    const nodejsArgv = buildParseArgv({
      programName: "amigo",
      rawArgs: ["nodejs", "amigo", "status"],
    });
    expect(nodejsArgv).toEqual(["nodejs", "amigo", "status"]);

    const nonVersionedNodeArgv = buildParseArgv({
      programName: "amigo",
      rawArgs: ["node-dev", "amigo", "status"],
    });
    expect(nonVersionedNodeArgv).toEqual(["node", "amigo", "node-dev", "amigo", "status"]);

    const directArgv = buildParseArgv({
      programName: "amigo",
      rawArgs: ["amigo", "status"],
    });
    expect(directArgv).toEqual(["node", "amigo", "status"]);

    const bunArgv = buildParseArgv({
      programName: "amigo",
      rawArgs: ["bun", "src/entry.ts", "status"],
    });
    expect(bunArgv).toEqual(["bun", "src/entry.ts", "status"]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "amigo",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "amigo", "status"]);
  });

  it("decides when to migrate state", () => {
    expect(shouldMigrateState(["node", "amigo", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "amigo", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "amigo", "sessions"])).toBe(false);
    expect(shouldMigrateState(["node", "amigo", "memory", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "amigo", "agent", "--message", "hi"])).toBe(false);
    expect(shouldMigrateState(["node", "amigo", "agents", "list"])).toBe(true);
    expect(shouldMigrateState(["node", "amigo", "message", "send"])).toBe(true);
  });

  it("reuses command path for migrate state decisions", () => {
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agents", "list"])).toBe(true);
  });
});
