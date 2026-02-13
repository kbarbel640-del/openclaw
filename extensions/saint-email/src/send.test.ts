import { describe, expect, it } from "vitest";
import { __testing } from "./send.js";

describe("saint-email MIME builder", () => {
  it("builds a plain text mime envelope", () => {
    const mime = __testing.buildMime({
      from: "bot@example.com",
      to: "client@example.com",
      payload: { text: "Hello from Saint" },
      channelData: {},
    });

    expect(mime).toContain("From: bot@example.com");
    expect(mime).toContain("To: client@example.com");
    expect(mime).toContain("Content-Type: text/plain");
    expect(mime).toContain("Hello from Saint");
  });

  it("builds multipart mime when attachments are provided", () => {
    const mime = __testing.buildMime({
      from: "bot@example.com",
      to: "client@example.com",
      payload: { text: "See attachment" },
      channelData: {
        attachments: [
          {
            filename: "report.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from("hello", "utf-8").toString("base64"),
          },
        ],
      },
    });

    expect(mime).toContain("multipart/mixed");
    expect(mime).toContain('filename="report.txt"');
    expect(mime).toContain("Content-Transfer-Encoding: base64");
  });

  it("uses Saint branding for empty-subject fallback", () => {
    const subject = __testing.buildSubject({
      payload: { text: "" },
      channelData: {},
    });
    expect(subject).toBe("Saint update");
  });
});
