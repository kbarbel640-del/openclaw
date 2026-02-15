import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodOptionalStringEnum, zodStringEnum, zodToToolJsonSchema } from "./zod-tool-helpers.js";

describe("zod-tool-helpers", () => {
  describe("zodStringEnum", () => {
    it("creates a Zod enum from readonly array", () => {
      const Mode = zodStringEnum(["fast", "balanced", "creative"] as const);
      const schema = zodToToolJsonSchema(Mode);

      expect(schema).toEqual({
        type: "string",
        enum: ["fast", "balanced", "creative"],
      });
    });

    it("supports description option", () => {
      const Mode = zodStringEnum(["fast", "balanced"] as const, {
        description: "Execution mode",
      });
      const schema = zodToToolJsonSchema(Mode);

      expect(schema).toMatchObject({
        type: "string",
        enum: ["fast", "balanced"],
        description: "Execution mode",
      });
    });

    it("supports default option", () => {
      const Mode = zodStringEnum(["fast", "balanced"] as const, {
        default: "balanced",
      });
      const schema = zodToToolJsonSchema(Mode);

      expect(schema).toMatchObject({
        type: "string",
        enum: ["fast", "balanced"],
        default: "balanced",
      });
    });

    it("validates correct values", () => {
      const Mode = zodStringEnum(["fast", "balanced"] as const);
      expect(Mode.safeParse("fast").success).toBe(true);
      expect(Mode.safeParse("balanced").success).toBe(true);
      expect(Mode.safeParse("invalid").success).toBe(false);
    });
  });

  describe("zodOptionalStringEnum", () => {
    it("creates an optional Zod enum", () => {
      const Mode = zodOptionalStringEnum(["fast", "balanced"] as const);
      const schema = zodToToolJsonSchema(Mode);

      expect(schema).toMatchObject({
        type: "string",
        enum: ["fast", "balanced"],
      });
    });

    it("validates undefined", () => {
      const Mode = zodOptionalStringEnum(["fast", "balanced"] as const);
      expect(Mode.safeParse(undefined).success).toBe(true);
      expect(Mode.safeParse("fast").success).toBe(true);
      expect(Mode.safeParse("invalid").success).toBe(false);
    });

    it("supports description option", () => {
      const Mode = zodOptionalStringEnum(["fast", "balanced"] as const, {
        description: "Optional mode",
      });
      const schema = zodToToolJsonSchema(Mode);

      expect(schema).toMatchObject({
        type: "string",
        enum: ["fast", "balanced"],
        description: "Optional mode",
      });
    });
  });

  describe("type inference", () => {
    it("infers correct types for zodStringEnum", () => {
      const Mode = zodStringEnum(["fast", "balanced", "creative"] as const);
      type ModeType = z.infer<typeof Mode>;

      // Type test: this should compile
      const validMode: ModeType = "fast";
      expect(validMode).toBe("fast");

      // @ts-expect-error - invalid value should not compile
      const invalidMode: ModeType = "invalid";
      expect(invalidMode).toBeDefined(); // Just to use the variable
    });

    it("infers correct types for zodOptionalStringEnum", () => {
      const Mode = zodOptionalStringEnum(["fast", "balanced"] as const);
      type ModeType = z.infer<typeof Mode>;

      // Type test: this should compile
      const validMode: ModeType = "fast";
      const undefinedMode: ModeType = undefined;
      expect(validMode).toBe("fast");
      expect(undefinedMode).toBeUndefined();

      // @ts-expect-error - invalid value should not compile
      const invalidMode: ModeType = "invalid";
      expect(invalidMode).toBeDefined(); // Just to use the variable
    });
  });
});
