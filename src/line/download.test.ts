import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessageContentMock = vi.hoisted(() => vi.fn());
const saveMediaBufferMock = vi.hoisted(() => vi.fn());

vi.mock("@line/bot-sdk", () => ({
  messagingApi: {
    MessagingApiBlobClient: class {
      getMessageContent(messageId: string) {
        return getMessageContentMock(messageId);
      }
    },
  },
}));

vi.mock("../globals.js", () => ({
  logVerbose: () => {},
}));

vi.mock("../media/store.js", () => ({
  saveMediaBuffer: (...args: unknown[]) => saveMediaBufferMock(...args),
}));

import { downloadLineMedia } from "./download.js";

async function* chunks(parts: Buffer[]): AsyncGenerator<Buffer> {
  for (const part of parts) {
    yield part;
  }
}

describe("downloadLineMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves media via saveMediaBuffer to inbound directory", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    getMessageContentMock.mockResolvedValueOnce(chunks([jpeg]));
    saveMediaBufferMock.mockResolvedValueOnce({
      id: "test-uuid.jpg",
      path: "/home/user/.openclaw/media/inbound/test-uuid.jpg",
      size: jpeg.length,
      contentType: "image/jpeg",
    });

    const result = await downloadLineMedia("msg-123", "token");

    expect(saveMediaBufferMock).toHaveBeenCalledOnce();
    const [buffer, contentType, subdir, maxBytes] = saveMediaBufferMock.mock.calls[0];
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBe(jpeg.length);
    expect(contentType).toBeUndefined();
    expect(subdir).toBe("inbound");
    expect(maxBytes).toBe(10 * 1024 * 1024);

    expect(result.path).toBe("/home/user/.openclaw/media/inbound/test-uuid.jpg");
    expect(result.contentType).toBe("image/jpeg");
    expect(result.size).toBe(jpeg.length);
  });

  it("passes custom maxBytes to saveMediaBuffer", async () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    getMessageContentMock.mockResolvedValueOnce(chunks([buf]));
    saveMediaBufferMock.mockResolvedValueOnce({
      id: "uuid.png",
      path: "/home/user/.openclaw/media/inbound/uuid.png",
      size: buf.length,
      contentType: "image/png",
    });

    await downloadLineMedia("msg-456", "token", 5 * 1024 * 1024);

    const [, , , maxBytes] = saveMediaBufferMock.mock.calls[0];
    expect(maxBytes).toBe(5 * 1024 * 1024);
  });

  it("rejects oversized media during streaming before saving", async () => {
    getMessageContentMock.mockResolvedValueOnce(chunks([Buffer.alloc(4), Buffer.alloc(4)]));

    await expect(downloadLineMedia("mid", "token", 7)).rejects.toThrow(/Media exceeds/i);
    expect(saveMediaBufferMock).not.toHaveBeenCalled();
  });
});
