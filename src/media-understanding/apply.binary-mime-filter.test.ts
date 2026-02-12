import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MsgContext } from "../auto-reply/templating.js";
import type { OpenClawConfig } from "../config/config.js";

vi.mock("../agents/model-auth.js", () => ({
  resolveApiKeyForProvider: vi.fn(async () => ({
    apiKey: "test-key",
    source: "test",
    mode: "api-key",
  })),
  requireApiKey: (auth: { apiKey?: string; mode?: string }, provider: string) => {
    if (auth?.apiKey) {
      return auth.apiKey;
    }
    throw new Error(`No API key for "${provider}"`);
  },
}));

vi.mock("../media/fetch.js", () => ({
  fetchRemoteMedia: vi.fn(),
}));

vi.mock("../process/exec.js", () => ({
  runExec: vi.fn(),
}));

const NO_MEDIA_CFG: OpenClawConfig = {
  tools: {
    media: {
      audio: { enabled: false },
      image: { enabled: false },
      video: { enabled: false },
    },
  },
};

async function loadApply() {
  return await import("./apply.js");
}

describe("extractFileBlocks binary MIME filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips .docx file with specific binary MIME type", async () => {
    const { applyMediaUnderstanding } = await loadApply();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-media-"));
    // Create a fake .docx file (ZIP header + some data that might look text-like in parts)
    const zipHeader = Buffer.from("PK\x03\x04");
    const padding = Buffer.alloc(200, 0x41); // 'A' bytes — text-like
    const filePath = path.join(dir, "report.docx");
    await fs.writeFile(filePath, Buffer.concat([zipHeader, padding]));

    const ctx: MsgContext = {
      Body: "<media:document>",
      MediaPath: filePath,
      MediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    const result = await applyMediaUnderstanding({ ctx, cfg: NO_MEDIA_CFG });

    expect(result.appliedFile).toBe(false);
    expect(ctx.Body).not.toContain("<file");
    expect(ctx.Body).toBe("<media:document>");
  });

  it("skips .xlsx file with specific binary MIME type", async () => {
    const { applyMediaUnderstanding } = await loadApply();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-media-"));
    const filePath = path.join(dir, "data.xlsx");
    const zipHeader = Buffer.from("PK\x03\x04");
    const padding = Buffer.alloc(200, 0x41);
    await fs.writeFile(filePath, Buffer.concat([zipHeader, padding]));

    const ctx: MsgContext = {
      Body: "<media:document>",
      MediaPath: filePath,
      MediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    const result = await applyMediaUnderstanding({ ctx, cfg: NO_MEDIA_CFG });

    expect(result.appliedFile).toBe(false);
    expect(ctx.Body).not.toContain("<file");
  });

  it("skips application/zip even if byte content looks text-like", async () => {
    const { applyMediaUnderstanding } = await loadApply();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-media-"));
    const filePath = path.join(dir, "archive.zip");
    // Fill with mostly printable ASCII chars to trick text detection
    const textLikeContent = Buffer.from("Hello world this is all ASCII text ".repeat(100));
    await fs.writeFile(filePath, textLikeContent);

    const ctx: MsgContext = {
      Body: "<media:document>",
      MediaPath: filePath,
      MediaType: "application/zip",
    };

    const result = await applyMediaUnderstanding({ ctx, cfg: NO_MEDIA_CFG });

    expect(result.appliedFile).toBe(false);
    expect(ctx.Body).not.toContain("<file");
  });

  it("still allows application/json files through", async () => {
    const { applyMediaUnderstanding } = await loadApply();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-media-"));
    const filePath = path.join(dir, "data.json");
    await fs.writeFile(filePath, JSON.stringify({ hello: "world" }));

    const ctx: MsgContext = {
      Body: "<media:document>",
      MediaPath: filePath,
      MediaType: "application/json",
    };

    const result = await applyMediaUnderstanding({ ctx, cfg: NO_MEDIA_CFG });

    expect(result.appliedFile).toBe(true);
    expect(ctx.Body).toContain("<file");
    expect(ctx.Body).toContain("hello");
  });

  it("still allows text/plain files through", async () => {
    const { applyMediaUnderstanding } = await loadApply();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-media-"));
    const filePath = path.join(dir, "readme.txt");
    await fs.writeFile(filePath, "Important information here");

    const ctx: MsgContext = {
      Body: "<media:document>",
      MediaPath: filePath,
      MediaType: "text/plain",
    };

    const result = await applyMediaUnderstanding({ ctx, cfg: NO_MEDIA_CFG });

    expect(result.appliedFile).toBe(true);
    expect(ctx.Body).toContain("<file");
    expect(ctx.Body).toContain("Important information here");
  });

  it("still allows application/octet-stream with text-like content through", async () => {
    const { applyMediaUnderstanding } = await loadApply();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-media-"));
    const filePath = path.join(dir, "unknown.bin");
    await fs.writeFile(filePath, "This is actually plain text content");

    const ctx: MsgContext = {
      Body: "<media:document>",
      MediaPath: filePath,
      MediaType: "application/octet-stream",
    };

    const result = await applyMediaUnderstanding({ ctx, cfg: NO_MEDIA_CFG });

    expect(result.appliedFile).toBe(true);
    expect(ctx.Body).toContain("<file");
    expect(ctx.Body).toContain("This is actually plain text");
  });
});
