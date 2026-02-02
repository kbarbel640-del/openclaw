import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadImageFromRef, type DetectedImageRef } from "./images.js";

// Minimal valid PNG (1x1 pixel)
const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe("loadImageFromRef sandbox validation", () => {
  let testDir: string;
  let workspaceDir: string;
  let outsideFile: string;
  let insideFile: string;

  beforeEach(async () => {
    // Create temp directories
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-test-"));
    workspaceDir = path.join(testDir, "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });

    // Create test image inside workspace
    insideFile = path.join(workspaceDir, "inside.png");
    await fs.writeFile(insideFile, MINIMAL_PNG);

    // Create test image outside workspace
    outsideFile = path.join(testDir, "outside.png");
    await fs.writeFile(outsideFile, MINIMAL_PNG);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("blocks files outside sandbox when sandboxRoot is set", async () => {
    const ref: DetectedImageRef = {
      type: "path",
      raw: outsideFile,
      resolved: outsideFile,
    };

    const result = await loadImageFromRef(ref, workspaceDir, {
      sandboxRoot: workspaceDir,
    });

    expect(result).toBeNull();
  });

  it("allows files inside sandbox when sandboxRoot is set", async () => {
    const ref: DetectedImageRef = {
      type: "path",
      raw: insideFile,
      resolved: insideFile,
    };

    const result = await loadImageFromRef(ref, workspaceDir, {
      sandboxRoot: workspaceDir,
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("image");
  });

  it("blocks path traversal attempts when sandboxRoot is set", async () => {
    const ref: DetectedImageRef = {
      type: "path",
      raw: "../outside.png",
      resolved: "../outside.png",
    };

    const result = await loadImageFromRef(ref, workspaceDir, {
      sandboxRoot: workspaceDir,
    });

    expect(result).toBeNull();
  });

  it("blocks absolute paths outside sandbox when sandboxRoot is set", async () => {
    // Use outsideFile which is an absolute path to a real file outside the sandbox
    const ref: DetectedImageRef = {
      type: "path",
      raw: outsideFile,
      resolved: outsideFile,
    };

    // Verify it's an absolute path for this test's intent
    expect(path.isAbsolute(outsideFile)).toBe(true);

    const result = await loadImageFromRef(ref, workspaceDir, {
      sandboxRoot: workspaceDir,
    });

    expect(result).toBeNull();
  });
});
