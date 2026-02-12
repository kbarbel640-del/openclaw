import { describe, expect, it, vi } from "vitest";
import { resolveMedia } from "./delivery.js";

vi.mock("../../globals.js", () => ({
  logVerbose: vi.fn(),
  shouldLogVerbose: () => false,
}));

vi.mock("../../media/fetch.js", () => ({
  fetchRemoteMedia: vi.fn(),
}));

vi.mock("../../media/store.js", () => ({
  saveMediaBuffer: vi.fn(),
}));

vi.mock("../sticker-cache.js", () => ({
  getCachedSticker: vi.fn(),
  cacheSticker: vi.fn(),
}));

vi.mock("../api-logging.js", () => ({
  withTelegramApiErrorLogging: vi.fn(({ fn }) => fn()),
}));

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    message: {
      sticker: null,
      photo: null,
      video: null,
      video_note: null,
      document: null,
      audio: null,
      voice: null,
      ...overrides,
    },
    me: { username: "testbot" },
    getFile: vi.fn(),
  };
}

describe("resolveMedia with maxBytes=0", () => {
  it("throws when document is present and maxBytes is 0", async () => {
    const ctx = makeCtx({
      document: { file_id: "abc123", file_unique_id: "u1" },
    });

    await expect(resolveMedia(ctx as never, 0, "tok")).rejects.toThrow("Media exceeds 0MB limit");
  });

  it("throws when photo is present and maxBytes is 0", async () => {
    const ctx = makeCtx({
      photo: [{ file_id: "abc123", file_unique_id: "u1", width: 100, height: 100 }],
    });

    await expect(resolveMedia(ctx as never, 0, "tok")).rejects.toThrow("Media exceeds 0MB limit");
  });

  it("throws when sticker is present and maxBytes is 0", async () => {
    const ctx = makeCtx({
      sticker: {
        file_id: "abc123",
        file_unique_id: "u1",
        is_animated: false,
        is_video: false,
        type: "regular",
        width: 100,
        height: 100,
      },
    });

    await expect(resolveMedia(ctx as never, 0, "tok")).rejects.toThrow("Media exceeds 0MB limit");
  });

  it("throws when audio is present and maxBytes is 0", async () => {
    const ctx = makeCtx({
      audio: { file_id: "abc123", file_unique_id: "u1" },
    });

    await expect(resolveMedia(ctx as never, 0, "tok")).rejects.toThrow("Media exceeds 0MB limit");
  });

  it("returns null for text-only messages when maxBytes is 0", async () => {
    const ctx = makeCtx();
    const result = await resolveMedia(ctx as never, 0, "tok");
    expect(result).toBeNull();
  });
});
