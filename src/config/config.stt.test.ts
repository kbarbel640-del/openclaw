import { describe, expect, it } from "vitest";
import { OpenClawSchema } from "./zod-schema.js";

describe("stt config schema", () => {
  it("accepts a minimal stt.provider string", () => {
    const result = OpenClawSchema.safeParse({ stt: { provider: "wav2vec2-stt" } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stt?.provider).toBe("wav2vec2-stt");
    }
  });

  it("accepts a full stt config block", () => {
    const result = OpenClawSchema.safeParse({
      stt: {
        provider: "wav2vec2-stt",
        language: "en-US",
        continuous: true,
        interimResults: false,
        timeoutMs: 30000,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stt?.provider).toBe("wav2vec2-stt");
      expect(result.data.stt?.language).toBe("en-US");
      expect(result.data.stt?.continuous).toBe(true);
      expect(result.data.stt?.interimResults).toBe(false);
      expect(result.data.stt?.timeoutMs).toBe(30000);
    }
  });

  it("accepts config without stt (optional)", () => {
    const result = OpenClawSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects unknown keys inside stt (strict)", () => {
    const result = OpenClawSchema.safeParse({
      stt: { provider: "wav2vec2-stt", unknownField: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty provider string", () => {
    const result = OpenClawSchema.safeParse({ stt: { provider: "" } });
    expect(result.success).toBe(false);
  });

  it("rejects timeoutMs below 1000", () => {
    const result = OpenClawSchema.safeParse({ stt: { timeoutMs: 500 } });
    expect(result.success).toBe(false);
  });

  it("rejects timeoutMs above 120000", () => {
    const result = OpenClawSchema.safeParse({ stt: { timeoutMs: 200000 } });
    expect(result.success).toBe(false);
  });

  it("accepts any string as provider (skill-provided)", () => {
    for (const provider of ["whisper", "deepgram-stt", "wav2vec2-stt", "my-custom-stt"]) {
      const result = OpenClawSchema.safeParse({ stt: { provider } });
      expect(result.success).toBe(true);
    }
  });
});
