/**
 * Tests for `/expanso` command integration in the Discord native command handler.
 *
 * Verifies that:
 *   1. The `expanso` command appears in the native command spec list.
 *   2. The command is discoverable by name (findCommandByNativeName).
 *   3. The command's action argument menu is configured correctly.
 *   4. The command produces correctly formatted prompts for each action.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCommandTextFromArgs,
  findCommandByNativeName,
  listNativeCommandSpecs,
  parseCommandArgs,
  resolveCommandArgMenu,
} from "../../auto-reply/commands-registry.js";
import { setActivePluginRegistry } from "../../plugins/runtime.js";
import { createTestRegistry } from "../../test-utils/channel-plugins.js";

beforeEach(() => {
  setActivePluginRegistry(createTestRegistry([]));
});

afterEach(() => {
  setActivePluginRegistry(createTestRegistry([]));
});

describe("/expanso Discord native command integration", () => {
  it("includes expanso in the native command specs list", () => {
    const specs = listNativeCommandSpecs();
    const expanso = specs.find((spec) => spec.name === "expanso");
    expect(expanso).toBeTruthy();
    expect(expanso?.description).toContain("Expanso");
    expect(expanso?.acceptsArgs).toBe(true);
  });

  it("is findable by native name (discord routing)", () => {
    const cmd = findCommandByNativeName("expanso", "discord");
    expect(cmd).toBeTruthy();
    expect(cmd?.key).toBe("expanso");
    expect(cmd?.nativeName).toBe("expanso");
  });

  it("has build, validate, and fix action choices", () => {
    const cmd = findCommandByNativeName("expanso", "discord");
    expect(cmd).toBeTruthy();
    const actionArg = cmd!.args?.find((arg) => arg.name === "action");
    expect(actionArg).toBeTruthy();
    expect(Array.isArray(actionArg!.choices)).toBe(true);
    const choices = actionArg!.choices as Array<{ value: string; label: string }>;
    expect(choices.map((c) => c.value)).toContain("build");
    expect(choices.map((c) => c.value)).toContain("validate");
    expect(choices.map((c) => c.value)).toContain("fix");
  });

  it("has an input arg with captureRemaining", () => {
    const cmd = findCommandByNativeName("expanso", "discord");
    expect(cmd).toBeTruthy();
    const inputArg = cmd!.args?.find((arg) => arg.name === "input");
    expect(inputArg).toBeTruthy();
    expect(inputArg!.captureRemaining).toBe(true);
  });

  it("shows the action menu when no action is supplied", () => {
    const cmd = findCommandByNativeName("expanso", "discord");
    expect(cmd).toBeTruthy();
    const menu = resolveCommandArgMenu({ command: cmd!, args: undefined, cfg: {} });
    expect(menu).toBeTruthy();
    expect(menu!.arg.name).toBe("action");
    expect(menu!.choices.length).toBeGreaterThan(0);
  });

  it("does NOT show the menu when an action is already supplied", () => {
    const cmd = findCommandByNativeName("expanso", "discord");
    expect(cmd).toBeTruthy();
    const args = parseCommandArgs(cmd!, "build Read CSV files and write JSON to stdout");
    const menu = resolveCommandArgMenu({ command: cmd!, args, cfg: {} });
    expect(menu).toBeNull();
  });

  it("formats the build prompt correctly from args", () => {
    const cmd = findCommandByNativeName("expanso", "discord");
    expect(cmd).toBeTruthy();
    const args = parseCommandArgs(cmd!, "build Read CSV files from disk, write JSON to stdout");
    expect(args).toBeTruthy();
    const text = buildCommandTextFromArgs(cmd!, args);
    expect(text).toContain("/expanso");
    expect(text).toContain("build");
    expect(text).toContain("Read CSV files");
  });

  it("formats the validate prompt correctly from args", () => {
    const cmd = findCommandByNativeName("expanso", "discord");
    expect(cmd).toBeTruthy();
    const args = parseCommandArgs(cmd!, "validate name: my-pipeline\ninputs: []");
    expect(args).toBeTruthy();
    const text = buildCommandTextFromArgs(cmd!, args);
    expect(text).toContain("/expanso");
    expect(text).toContain("validate");
  });

  it("formats the fix prompt correctly from args", () => {
    const cmd = findCommandByNativeName("expanso", "discord");
    expect(cmd).toBeTruthy();
    const args = parseCommandArgs(cmd!, "fix Stream Kafka events to PostgreSQL");
    expect(args).toBeTruthy();
    const text = buildCommandTextFromArgs(cmd!, args);
    expect(text).toContain("/expanso");
    expect(text).toContain("fix");
    expect(text).toContain("Kafka");
  });

  it("has a descriptive argsMenu title", () => {
    const cmd = findCommandByNativeName("expanso", "discord");
    expect(cmd).toBeTruthy();
    const menu = resolveCommandArgMenu({ command: cmd!, args: undefined, cfg: {} });
    expect(menu).toBeTruthy();
    // The menu title should mention what actions are available
    const title = menu!.title ?? "";
    expect(title.toLowerCase()).toContain("build");
    expect(title.toLowerCase()).toContain("validate");
  });
});
