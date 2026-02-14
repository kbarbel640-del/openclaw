import { describe, expect, it } from "vitest";
import { isBinaryMediaMime } from "./apply.js";

describe("isBinaryMediaMime", () => {
  it("returns false for undefined/empty", () => {
    expect(isBinaryMediaMime(undefined)).toBe(false);
    expect(isBinaryMediaMime("")).toBe(false);
  });

  it("detects image/audio/video as binary", () => {
    expect(isBinaryMediaMime("image/png")).toBe(true);
    expect(isBinaryMediaMime("audio/mpeg")).toBe(true);
    expect(isBinaryMediaMime("video/mp4")).toBe(true);
  });

  it("detects application/vnd.* as binary (Office formats)", () => {
    expect(
      isBinaryMediaMime(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(true);
    expect(
      isBinaryMediaMime(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
    expect(isBinaryMediaMime("application/vnd.ms-excel")).toBe(true);
  });

  it("detects application/x-* as binary", () => {
    expect(isBinaryMediaMime("application/x-tar")).toBe(true);
    expect(isBinaryMediaMime("application/x-7z-compressed")).toBe(true);
  });

  it("detects exact binary MIME types", () => {
    expect(isBinaryMediaMime("application/zip")).toBe(true);
    expect(isBinaryMediaMime("application/gzip")).toBe(true);
    expect(isBinaryMediaMime("application/octet-stream")).toBe(true);
    expect(isBinaryMediaMime("application/pdf")).toBe(true);
    expect(isBinaryMediaMime("application/wasm")).toBe(true);
  });

  it("allows text types through", () => {
    expect(isBinaryMediaMime("text/plain")).toBe(false);
    expect(isBinaryMediaMime("text/html")).toBe(false);
    expect(isBinaryMediaMime("application/json")).toBe(false);
    expect(isBinaryMediaMime("application/javascript")).toBe(false);
    expect(isBinaryMediaMime("application/xml")).toBe(false);
  });
});
