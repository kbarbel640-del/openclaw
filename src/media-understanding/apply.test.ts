import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
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
    throw new Error(`No API key resolved for provider "${provider}" (auth mode: ${auth?.mode}).`);
  },
}));

vi.mock("../media/fetch.js", () => ({
  fetchRemoteMedia: vi.fn(),
}));

vi.mock("../process/exec.js", () => ({
  runExec: vi.fn(),
}));

async function loadApply() {
  return await import("./apply.js");
}

// Minimal valid PDF that pdfjs-dist can parse (1 blank page, no text)
const MINIMAL_PDF = [
  "%PDF-1.0",
  "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
  "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
  "3 0 obj<</Type/Page/MediaBox[0 0 3 3]/Parent 2 0 R>>endobj",
  "xref",
  "0 4",
  "0000000000 65535 f ",
  "0000000009 00000 n ",
  "0000000058 00000 n ",
  "0000000115 00000 n ",
  "trailer<</Size 4/Root 1 0 R>>",
  "startxref",
  "190",
  "%%EOF",
].join("\n");

describe("extractFileBlocks MIME resolution", () => {
  it("preserves application/pdf instead of overriding to text/plain", async () => {
    const { applyMediaUnderstanding } = await loadApply();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-media-pdf-"));
    const pdfPath = path.join(dir, "resume.pdf");
    await fs.writeFile(pdfPath, MINIMAL_PDF);

    const ctx: MsgContext = {
      Body: "<media:document>",
      MediaPath: pdfPath,
      MediaType: "application/pdf",
    };
    const cfg: OpenClawConfig = {
      tools: {
        media: {
          audio: { enabled: false },
          image: { enabled: false },
          video: { enabled: false },
        },
      },
    };

    const result = await applyMediaUnderstanding({ ctx, cfg });

    expect(result.appliedFile).toBe(true);
    // The MIME type in the output block must be application/pdf, not text/plain
    expect(ctx.Body).toContain('mime="application/pdf"');
    expect(ctx.Body).not.toContain('mime="text/plain"');
  });
});
