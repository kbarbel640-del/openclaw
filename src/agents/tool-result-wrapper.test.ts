import { describe, expect, it } from "vitest";
import type { AnyAgentTool } from "./pi-tools.types.js";
import { wrapToolWithToonEncoding } from "./tool-result-wrapper.js";

describe("wrapToolWithToonEncoding", () => {
  it("should encode details object as TOON in content", async () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () => ({
        content: [{ type: "text" as const, text: "Original text" }],
        details: {
          status: "completed",
          exitCode: 0,
          count: 42,
        },
      }),
    };

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    // Verify TOON encoding was applied
    expect(result.content[0].type).toBe("text");
    const firstBlock = result.content[0];
    if (firstBlock.type === "text") {
      const toonText = firstBlock.text;
      expect(toonText).toContain("# toon\n");
      expect(toonText).toContain("status: completed");
      expect(toonText).toContain("exitCode: 0");
      expect(toonText).toContain("count: 42");

      expect(toonText).not.toContain("{");
      expect(toonText).not.toContain("}");
    }

    expect(result.details).toEqual({
      status: "completed",
      exitCode: 0,
      count: 42,
    });
  });

  it("should not re-encode already TOON-formatted content", async () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () => ({
        content: [
          {
            type: "text" as const,
            text: "# toon\nstatus: ok\ncount: 5",
          },
        ],
        details: { status: "ok", count: 5 },
      }),
    };

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    // Should return exact same text because sentinel was present
    expect(result.content[0].type).toBe("text");
    if (result.content[0].type === "text") {
      expect(result.content[0].text).toBe("# toon\nstatus: ok\ncount: 5");
    }
  });

  it("should pass through results without details", async () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () =>
        ({
          content: [{ type: "text" as const, text: "Simple text result" }],
        }) as any, // Cast to any to simulate tool returning invalid result (missing details)
    };

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    expect(result.content[0].type).toBe("text");
    if (result.content[0].type === "text") {
      expect(result.content[0].text).toBe("Simple text result");
    }
  });

  it("should return tool unchanged if it has no execute function", () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
    } as any;

    const wrapped = wrapToolWithToonEncoding(mockTool);
    expect(wrapped).toBe(mockTool);
  });

  it("should encode nested objects in TOON format", async () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () => ({
        content: [{ type: "text" as const, text: "Original" }],
        details: {
          user: {
            name: "Alice",
            age: 30,
          },
          items: ["apple", "banana"],
        },
      }),
    };

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    const firstBlock = result.content[0];
    if (firstBlock.type === "text") {
      const toonText = firstBlock.text;
      expect(toonText).toContain("user:");
      expect(toonText).toContain("name: Alice");
      expect(toonText).toContain("age: 30");
      expect(toonText).toContain("items[2]:");
      expect(toonText).toContain("apple");
      expect(toonText).toContain("banana");
    }
  });

  it("should preserve non-text content blocks (images)", async () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () => ({
        content: [
          { type: "text" as const, text: "Result text" },
          { type: "image" as const, data: "base64data...", mimeType: "image/png" },
        ],
        details: { status: "ok" },
      }),
    };

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    // Filter by type for robust assertions
    const textBlocks = result.content.filter((b) => b.type === "text");
    const imageBlocks = result.content.filter((b) => b.type === "image");

    // Should have 1 TOON text block and 1 preserved image block
    expect(textBlocks).toHaveLength(1);
    expect(imageBlocks).toHaveLength(1);

    // TOON text block should be first
    expect(result.content[0].type).toBe("text");
    if (result.content[0].type === "text") {
      expect(result.content[0].text).toContain("# toon");
      expect(result.content[0].text).toContain("status: ok");
    }

    // Image block should be preserved
    if (imageBlocks[0].type === "image") {
      expect(imageBlocks[0].data).toBe("base64data...");
      expect(imageBlocks[0].mimeType).toBe("image/png");
    }
  });

  it("should truncate output if it exceeds max length", async () => {
    const longString = "a".repeat(10000);
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () => ({
        content: [{ type: "text" as const, text: "placeholder" }],
        details: { data: longString },
      }),
    };

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    expect(result.content[0].type).toBe("text");
    const firstBlock = result.content[0];
    if (firstBlock.type === "text") {
      expect(firstBlock.text).toContain("# truncated");
      expect(firstBlock.text.length).toBeLessThan(10000);
    }
  });

  it("should respect disableToonEncoding flag", async () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () => ({
        content: [{ type: "text" as const, text: "Original Text" }],
        details: { status: "ok" },
      }),
    };
    (mockTool as any).disableToonEncoding = true;

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    // Should be untouched
    expect(result.content[0].type).toBe("text");
    const firstBlock = result.content[0];
    if (firstBlock.type === "text") {
      expect(firstBlock.text).toBe("Original Text");
    }
  });

  it("should replace all text blocks with single TOON block from details", async () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () => ({
        content: [
          { type: "text" as const, text: "Part 1" },
          { type: "text" as const, text: "Part 2" },
        ],
        details: { status: "ok" },
      }),
    };

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    // All text blocks are replaced by TOON encoding of details
    expect(result.content).toHaveLength(1);
    const firstBlock = result.content[0];
    expect(firstBlock.type).toBe("text");
    if (firstBlock.type === "text") {
      expect(firstBlock.text).toContain("# toon");
      expect(firstBlock.text).toContain("status: ok");
      // Original text blocks are NOT preserved
      expect(firstBlock.text).not.toContain("Part 1");
      expect(firstBlock.text).not.toContain("Part 2");
    }
  });

  it("should handle empty details object gracefully", async () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () => ({
        content: [{ type: "text" as const, text: "Original" }],
        details: {},
      }),
    };

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    const firstBlock = result.content[0];
    expect(firstBlock.type).toBe("text");
    if (firstBlock.type === "text") {
      const lines = firstBlock.text.split("\n");
      expect(lines[0]).toBe("# toon");
      // Empty object should produce minimal TOON output
      expect(firstBlock.text.length).toBeLessThan(50);
    }
  });

  it("should not encode when details is an array (not a plain object)", async () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () =>
        ({
          content: [{ type: "text" as const, text: "Array result" }],
          details: ["item1", "item2"], // Array, not plain object
        }) as any,
    };

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    // Should NOT be TOON-encoded since details is not a plain object
    expect(result.content[0].type).toBe("text");
    if (result.content[0].type === "text") {
      expect(result.content[0].text).toBe("Array result");
      expect(result.content[0].text).not.toContain("# toon");
    }
  });

  it("should not encode when details is null", async () => {
    const mockTool: AnyAgentTool = {
      name: "test_tool",
      label: "Test Label",
      description: "Test tool",
      parameters: {} as any,
      execute: async () =>
        ({
          content: [{ type: "text" as const, text: "Null result" }],
          details: null,
        }) as any,
    };

    const wrapped = wrapToolWithToonEncoding(mockTool);
    const result = await wrapped.execute("test-id", {});

    // Should NOT be TOON-encoded
    expect(result.content[0].type).toBe("text");
    if (result.content[0].type === "text") {
      expect(result.content[0].text).toBe("Null result");
      expect(result.content[0].text).not.toContain("# toon");
    }
  });
});
