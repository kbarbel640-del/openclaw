import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { resolveVisionInput } from "./vision-input.js";

describe("resolveVisionInput", () => {
  test("uses screen capture when available", async () => {
    const result = await resolveVisionInput({
      label: "x",
      captureScreen: async () => "/tmp/screen.png",
      fallbackImagePath: "/tmp/does-not-matter.jpg",
    });
    expect(result.kind).toBe("screen_capture");
    expect(result.path).toBe("/tmp/screen.png");
  });

  test("falls back to disk image when capture fails", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "thelab-vision-input-"));
    const jpgPath = path.join(tmpDir, "img.jpg");
    await fs.writeFile(jpgPath, "not-a-real-jpg", "utf-8");

    const result = await resolveVisionInput({
      label: "x",
      captureScreen: async () => {
        throw new Error("capture failed");
      },
      fallbackImagePath: jpgPath,
    });

    expect(result.kind).toBe("disk_fallback");
    expect(result.path).toBe(jpgPath);
  });
});
