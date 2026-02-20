import { describe, expect, it } from "vitest";
import type { GmailMessage } from "./gmail-body.js";
import { extractBody, extractMetadata } from "./gmail-body.js";

/** Helper to encode text as base64url. */
function encode(text: string): string {
  return Buffer.from(text).toString("base64url");
}

describe("extractBody", () => {
  it("extracts single-part text/plain message", () => {
    const msg: GmailMessage = {
      id: "1",
      payload: {
        mimeType: "text/plain",
        body: { size: 13, data: encode("Hello, world!") },
      },
    };
    expect(extractBody(msg)).toBe("Hello, world!");
  });

  it("prefers text/plain over text/html in multipart/alternative", () => {
    const msg: GmailMessage = {
      id: "2",
      payload: {
        mimeType: "multipart/alternative",
        body: { size: 0 },
        parts: [
          {
            mimeType: "text/plain",
            body: { size: 18, data: encode("Plain text version") },
          },
          {
            mimeType: "text/html",
            body: { size: 19, data: encode("<p>HTML version</p>") },
          },
        ],
      },
    };
    expect(extractBody(msg)).toBe("Plain text version");
  });

  it("strips HTML for HTML-only message in parts", () => {
    const html =
      "<div><style>.cls{color:red}</style><p>Hello &amp; welcome</p><br><script>alert(1)</script><p>Goodbye &lt;world&gt;</p></div>";
    const msg: GmailMessage = {
      id: "3",
      payload: {
        mimeType: "multipart/alternative",
        body: { size: 0 },
        parts: [
          {
            mimeType: "text/html",
            body: { size: html.length, data: encode(html) },
          },
        ],
      },
    };
    const body = extractBody(msg);
    expect(body).toContain("Hello & welcome");
    expect(body).toContain("Goodbye <world>");
    expect(body).not.toContain("<style>");
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("alert(1)");
    expect(body).not.toContain(".cls{color:red}");
  });

  it("handles HTML-only single-part body (payload.body.data with text/html mimeType)", () => {
    const html = "<p>Hello &amp; world</p>";
    const msg: GmailMessage = {
      id: "3b",
      payload: {
        mimeType: "text/html",
        body: { size: html.length, data: encode(html) },
      },
    };
    const body = extractBody(msg);
    expect(body).toBe("Hello & world");
  });

  it("extracts text/plain from nested MIME (depth 3)", () => {
    const msg: GmailMessage = {
      id: "4",
      payload: {
        mimeType: "multipart/mixed",
        body: { size: 0 },
        parts: [
          {
            mimeType: "multipart/alternative",
            body: { size: 0 },
            parts: [
              {
                mimeType: "text/plain",
                body: { size: 22, data: encode("Deep nested plain text") },
              },
              {
                mimeType: "text/html",
                body: { size: 23, data: encode("<b>Deep nested HTML</b>") },
              },
            ],
          },
          {
            mimeType: "application/pdf",
            body: { size: 100, data: encode("fake-pdf") },
          },
        ],
      },
    };
    expect(extractBody(msg)).toBe("Deep nested plain text");
  });

  it("returns empty string for empty body", () => {
    const msg: GmailMessage = {
      id: "5",
      payload: {
        mimeType: "text/plain",
        body: { size: 0 },
      },
    };
    expect(extractBody(msg)).toBe("");
  });

  it("returns empty string when payload is missing", () => {
    const msg: GmailMessage = { id: "5b" };
    expect(extractBody(msg)).toBe("");
  });

  it("truncates body at 2000 chars with [...truncated] marker", () => {
    const longText = "A".repeat(3000);
    const msg: GmailMessage = {
      id: "6",
      payload: {
        mimeType: "text/plain",
        body: { size: longText.length, data: encode(longText) },
      },
    };
    const body = extractBody(msg);
    expect(body).toHaveLength(2000 + " [...truncated]".length);
    expect(body.startsWith("A".repeat(2000))).toBe(true);
    expect(body).toContain("[...truncated]");
  });

  it("handles corrupt/invalid base64 gracefully", () => {
    const msg: GmailMessage = {
      id: "7",
      payload: {
        mimeType: "text/plain",
        body: { size: 0, data: "!!!not-valid-base64===" },
      },
    };
    // Should not throw, returns whatever Buffer can decode or empty
    expect(() => extractBody(msg)).not.toThrow();
  });

  it("decodes &nbsp; and &quot; entities in HTML", () => {
    const html = "<p>Hello&nbsp;world &quot;quoted&quot;</p>";
    const msg: GmailMessage = {
      id: "8",
      payload: {
        mimeType: "multipart/alternative",
        body: { size: 0 },
        parts: [
          {
            mimeType: "text/html",
            body: { size: html.length, data: encode(html) },
          },
        ],
      },
    };
    const body = extractBody(msg);
    expect(body).toContain('Hello world "quoted"');
  });
});

describe("extractMetadata", () => {
  it("extracts From, Subject, Date headers", () => {
    const msg: GmailMessage = {
      id: "meta-1",
      payload: {
        mimeType: "text/plain",
        headers: [
          { name: "From", value: "Alice <alice@test.com>" },
          { name: "Subject", value: "Test Subject" },
          { name: "Date", value: "Mon, 20 Jan 2025 10:00:00 +0000" },
          { name: "To", value: "bob@test.com" },
        ],
        body: { size: 4, data: encode("body") },
      },
    };
    const meta = extractMetadata(msg);
    expect(meta.from).toBe("Alice <alice@test.com>");
    expect(meta.subject).toBe("Test Subject");
    expect(meta.date).toBe("Mon, 20 Jan 2025 10:00:00 +0000");
  });

  it("returns empty strings for missing headers", () => {
    const msg: GmailMessage = {
      id: "meta-2",
      payload: {
        mimeType: "text/plain",
        headers: [],
        body: { size: 0 },
      },
    };
    const meta = extractMetadata(msg);
    expect(meta.from).toBe("");
    expect(meta.subject).toBe("");
    expect(meta.date).toBe("");
  });

  it("returns empty strings when payload has no headers", () => {
    const msg: GmailMessage = { id: "meta-3" };
    const meta = extractMetadata(msg);
    expect(meta.from).toBe("");
    expect(meta.subject).toBe("");
    expect(meta.date).toBe("");
  });

  it("handles case-insensitive header lookup", () => {
    const msg: GmailMessage = {
      id: "meta-4",
      payload: {
        mimeType: "text/plain",
        headers: [
          { name: "from", value: "lowercase@test.com" },
          { name: "SUBJECT", value: "UPPERCASE" },
          { name: "dAtE", value: "mixed case date" },
        ],
        body: { size: 0 },
      },
    };
    const meta = extractMetadata(msg);
    expect(meta.from).toBe("lowercase@test.com");
    expect(meta.subject).toBe("UPPERCASE");
    expect(meta.date).toBe("mixed case date");
  });
});
