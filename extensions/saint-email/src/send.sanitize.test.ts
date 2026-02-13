import { describe, expect, it } from "vitest";
import { __testing } from "./send.js";

describe("MIME header sanitization", () => {
  it("strips CR/LF from header values", () => {
    expect(__testing.sanitizeHeaderValue("alice@test.com\r\nBcc: evil@attacker.com")).toBe(
      "alice@test.comBcc: evil@attacker.com",
    );
    expect(__testing.sanitizeHeaderValue("clean")).toBe("clean");
    expect(__testing.sanitizeHeaderValue("line\ninjection")).toBe("lineinjection");
    expect(__testing.sanitizeHeaderValue("cr\ronly")).toBe("cronly");
  });

  it("accepts valid MIME types", () => {
    expect(__testing.sanitizeMimeType("text/plain")).toBe("text/plain");
    expect(__testing.sanitizeMimeType("application/pdf")).toBe("application/pdf");
    expect(__testing.sanitizeMimeType("image/png")).toBe("image/png");
  });

  it("rejects invalid MIME types (no slash) and falls back to octet-stream", () => {
    expect(__testing.sanitizeMimeType("notavalidtype")).toBe("application/octet-stream");
    expect(__testing.sanitizeMimeType("")).toBe("application/octet-stream");
  });

  it("strips CRLF from MIME types (prevents header injection)", () => {
    const result = __testing.sanitizeMimeType("text/plain\r\nEvil: header");
    // CR/LF stripped — no newline-based header injection possible
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
  });

  it("sanitizes filenames by stripping CR/LF and escaping quotes", () => {
    expect(__testing.sanitizeFilename('report.txt')).toBe("report.txt");
    expect(__testing.sanitizeFilename('file"name.txt')).toBe("file'name.txt");
    expect(__testing.sanitizeFilename("file\r\nname.txt")).toBe("filename.txt");
    expect(__testing.sanitizeFilename('bad"\r\nheader: injection')).toBe("bad'header: injection");
  });

  it("buildMime sanitizes From/To headers with CRLF (no header injection)", () => {
    const mime = __testing.buildMime({
      from: "bot@test.com\r\nBcc: spy@evil.com",
      to: "user@test.com\r\nBcc: spy2@evil.com",
      payload: { text: "Hello" },
      channelData: {},
    });

    // CR/LF stripped — injected "Bcc:" is collapsed into the From/To value,
    // not a separate header line. Verify no line starts with "Bcc:"
    const lines = mime.split(/\r?\n/);
    const bccLines = lines.filter((line) => /^Bcc:/i.test(line));
    expect(bccLines).toHaveLength(0);

    // The From header is collapsed (CRLF stripped)
    expect(mime).toContain("From: bot@test.comBcc: spy@evil.com");
  });

  it("buildMime sanitizes subject with CRLF (no header injection)", () => {
    const mime = __testing.buildMime({
      from: "bot@test.com",
      to: "user@test.com",
      payload: { text: "Hello" },
      channelData: { subject: "Normal\r\nBcc: attacker@evil.com" },
    });

    // Collapsed into Subject value, no separate Bcc header line
    expect(mime).toContain("Subject: NormalBcc: attacker@evil.com");
    const lines = mime.split(/\r?\n/);
    const bccLines = lines.filter((line) => /^Bcc:/i.test(line));
    expect(bccLines).toHaveLength(0);
  });

  it("buildMime sanitizes attachment mimeType and filename with CRLF", () => {
    const mime = __testing.buildMime({
      from: "bot@test.com",
      to: "user@test.com",
      payload: { text: "See attached" },
      channelData: {
        attachments: [
          {
            filename: 'evil"\r\nX-Injected: true',
            mimeType: "text/plain\r\nX-Injected: true",
            contentBase64: Buffer.from("hello").toString("base64"),
          },
        ],
      },
    });

    // CR/LF stripped — no header injection possible (no separate header line)
    expect(mime).not.toContain("\r\nX-Injected");
    expect(mime).not.toContain("\nX-Injected");
    // Quotes in filename are escaped
    expect(mime).not.toContain('filename="evil"');
  });

  it("buildMime rejects completely invalid mimeType", () => {
    const mime = __testing.buildMime({
      from: "bot@test.com",
      to: "user@test.com",
      payload: { text: "See attached" },
      channelData: {
        attachments: [
          {
            filename: "file.bin",
            mimeType: "notavalidtype",
            contentBase64: Buffer.from("hello").toString("base64"),
          },
        ],
      },
    });

    expect(mime).toContain("application/octet-stream");
  });
});
