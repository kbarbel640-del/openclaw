import { describe, expect, it } from "vitest";
import { AgentDefaultsSchema } from "./zod-schema.agent-defaults.js";

describe("mediaMaxMb schema validation", () => {
  it("accepts mediaMaxMb=0", () => {
    const result = AgentDefaultsSchema.safeParse({ mediaMaxMb: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts mediaMaxMb=1", () => {
    const result = AgentDefaultsSchema.safeParse({ mediaMaxMb: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts mediaMaxMb=50", () => {
    const result = AgentDefaultsSchema.safeParse({ mediaMaxMb: 50 });
    expect(result.success).toBe(true);
  });

  it("rejects negative mediaMaxMb", () => {
    const result = AgentDefaultsSchema.safeParse({ mediaMaxMb: -1 });
    expect(result.success).toBe(false);
  });
});
