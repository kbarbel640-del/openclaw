import { describe, expect, it } from "vitest";
import {
  mediaKindFromMime,
  maxBytesForKind,
  MAX_IMAGE_BYTES,
  MAX_AUDIO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_DOCUMENT_BYTES,
} from "./constants.js";

describe("mediaKindFromMime", () => {
  it("returns 'unknown' for null/undefined/empty", () => {
    expect(mediaKindFromMime(null)).toBe("unknown");
    expect(mediaKindFromMime(undefined)).toBe("unknown");
    expect(mediaKindFromMime("")).toBe("unknown");
  });

  it("classifies image types", () => {
    expect(mediaKindFromMime("image/png")).toBe("image");
    expect(mediaKindFromMime("image/jpeg")).toBe("image");
    expect(mediaKindFromMime("image/webp")).toBe("image");
  });

  it("classifies audio types", () => {
    expect(mediaKindFromMime("audio/mpeg")).toBe("audio");
    expect(mediaKindFromMime("audio/ogg")).toBe("audio");
    expect(mediaKindFromMime("audio/wav")).toBe("audio");
  });

  it("classifies video types", () => {
    expect(mediaKindFromMime("video/mp4")).toBe("video");
    expect(mediaKindFromMime("video/webm")).toBe("video");
  });

  it("classifies PDF as document", () => {
    expect(mediaKindFromMime("application/pdf")).toBe("document");
  });

  it("classifies other application types as document", () => {
    expect(mediaKindFromMime("application/zip")).toBe("document");
    expect(mediaKindFromMime("application/json")).toBe("document");
  });

  it("returns 'unknown' for text types", () => {
    expect(mediaKindFromMime("text/plain")).toBe("unknown");
    expect(mediaKindFromMime("text/html")).toBe("unknown");
  });
});

describe("maxBytesForKind", () => {
  it("returns correct limits for each kind", () => {
    expect(maxBytesForKind("image")).toBe(MAX_IMAGE_BYTES);
    expect(maxBytesForKind("audio")).toBe(MAX_AUDIO_BYTES);
    expect(maxBytesForKind("video")).toBe(MAX_VIDEO_BYTES);
    expect(maxBytesForKind("document")).toBe(MAX_DOCUMENT_BYTES);
  });

  it("returns document limit for unknown kind", () => {
    expect(maxBytesForKind("unknown")).toBe(MAX_DOCUMENT_BYTES);
  });
});
