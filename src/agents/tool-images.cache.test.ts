import { describe, expect, it, vi } from "vitest";

// Test that the image sanitization cache prevents redundant processing.
// We test indirectly via sanitizeToolResultImages since the cache is internal.
// See: https://github.com/openclaw/openclaw/issues/23590

// We need to mock the image-ops module to track calls without real image processing
vi.mock("../media/image-ops.js", () => ({
  getImageMetadata: vi.fn().mockResolvedValue({ width: 100, height: 100, format: "png" }),
  buildImageResizeSideGrid: vi.fn().mockReturnValue([1280]),
  IMAGE_REDUCE_QUALITY_STEPS: [85],
  resizeToJpeg: vi.fn().mockResolvedValue(Buffer.from("resized")),
}));

import { getImageMetadata } from "../media/image-ops.js";
import { sanitizeToolResultImages } from "./tool-images.js";

describe("image sanitization caching", () => {
  it("should not re-process identical images on subsequent calls", async () => {
    const mockedGetMetadata = vi.mocked(getImageMetadata);
    mockedGetMetadata.mockClear();

    // Small 100x100 image within limits — should pass through without resize
    const fakeBase64 = Buffer.from("test-image-data-that-is-small").toString("base64");
    const result = {
      content: [{ type: "image" as const, data: fakeBase64, mimeType: "image/png" }],
      details: {},
    };

    // First call — should process the image (calls getImageMetadata)
    await sanitizeToolResultImages(result, "test:first");
    const callsAfterFirst = mockedGetMetadata.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // Second call with same image — should hit cache, NOT call getImageMetadata again
    await sanitizeToolResultImages(result, "test:second");
    const callsAfterSecond = mockedGetMetadata.mock.calls.length;
    expect(callsAfterSecond).toBe(callsAfterFirst);
  });
});
