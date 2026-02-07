import { describe, expect, it } from "vitest";
import {
  extractThinkDirective,
  extractVerboseDirective,
  extractElevatedDirective,
  extractReasoningDirective,
  extractStatusDirective,
  extractNoticeDirective,
} from "./directives.js";

describe("extractThinkDirective", () => {
  it("returns no directive for plain text", () => {
    const result = extractThinkDirective("hello world");
    expect(result.hasDirective).toBe(false);
    expect(result.cleaned).toBe("hello world");
  });

  it("returns empty for undefined", () => {
    expect(extractThinkDirective(undefined).cleaned).toBe("");
  });

  it("extracts /think directive", () => {
    const result = extractThinkDirective("hello /think high");
    expect(result.hasDirective).toBe(true);
    expect(result.thinkLevel).toBe("high");
    expect(result.cleaned).toBe("hello");
  });

  it("extracts /thinking directive", () => {
    const result = extractThinkDirective("/thinking low message");
    expect(result.hasDirective).toBe(true);
    expect(result.thinkLevel).toBe("low");
    expect(result.cleaned).toBe("message");
  });

  it("extracts /t shorthand", () => {
    const result = extractThinkDirective("/t off");
    expect(result.hasDirective).toBe(true);
    expect(result.cleaned).toBe("");
  });

  it("handles colon separator", () => {
    const result = extractThinkDirective("/think: high rest");
    expect(result.hasDirective).toBe(true);
    expect(result.rawLevel).toBe("high");
  });
});

describe("extractVerboseDirective", () => {
  it("extracts /verbose directive", () => {
    const result = extractVerboseDirective("msg /verbose on");
    expect(result.hasDirective).toBe(true);
    expect(result.verboseLevel).toBe("on");
  });

  it("extracts /v shorthand", () => {
    const result = extractVerboseDirective("/v off");
    expect(result.hasDirective).toBe(true);
  });
});

describe("extractElevatedDirective", () => {
  it("extracts /elevated directive", () => {
    const result = extractElevatedDirective("msg /elevated full");
    expect(result.hasDirective).toBe(true);
    expect(result.elevatedLevel).toBe("full");
    expect(result.cleaned).toBe("msg");
  });

  it("extracts /elev shorthand", () => {
    const result = extractElevatedDirective("/elev on");
    expect(result.hasDirective).toBe(true);
  });

  it("returns no directive for undefined", () => {
    expect(extractElevatedDirective(undefined).hasDirective).toBe(false);
  });
});

describe("extractReasoningDirective", () => {
  it("extracts /reasoning directive", () => {
    const result = extractReasoningDirective("msg /reasoning stream");
    expect(result.hasDirective).toBe(true);
    expect(result.reasoningLevel).toBe("stream");
  });

  it("extracts /reason shorthand", () => {
    const result = extractReasoningDirective("/reason on text");
    expect(result.hasDirective).toBe(true);
    expect(result.cleaned).toBe("text");
  });
});

describe("extractStatusDirective", () => {
  it("extracts /status directive", () => {
    const result = extractStatusDirective("/status");
    expect(result.hasDirective).toBe(true);
    expect(result.cleaned).toBe("");
  });

  it("returns no directive for plain text", () => {
    expect(extractStatusDirective("hello").hasDirective).toBe(false);
  });

  it("returns empty for undefined", () => {
    expect(extractStatusDirective(undefined).cleaned).toBe("");
  });
});

describe("extractNoticeDirective", () => {
  it("extracts /notice directive", () => {
    const result = extractNoticeDirective("/notice off");
    expect(result.hasDirective).toBe(true);
  });

  it("extracts /notices directive", () => {
    const result = extractNoticeDirective("/notices on");
    expect(result.hasDirective).toBe(true);
  });
});
