import { describe, expect, it } from "vitest";
import { TuiStreamAssembler } from "./tui-stream-assembler.js";

const text = (value: string) => ({ type: "text", text: value }) as const;
const thinking = (value: string) => ({ type: "thinking", thinking: value }) as const;
const toolUse = () => ({ type: "tool_use", name: "search" }) as const;

const messageWithContent = (content: readonly Record<string, unknown>[]) =>
  ({
    role: "assistant",
    content,
  }) as const;

const TEXT_ONLY_TWO_BLOCKS = messageWithContent([text("Draft line 1"), text("Draft line 2")]);

type FinalizeBoundaryCase = {
  name: string;
  streamedContent: readonly Record<string, unknown>[];
  finalContent: readonly Record<string, unknown>[];
  expected: string;
};

const FINALIZE_BOUNDARY_CASES: FinalizeBoundaryCase[] = [
  {
    name: "preserves streamed text when tool-boundary final payload drops prefix blocks",
    streamedContent: [text("Before tool call"), toolUse(), text("After tool call")],
    finalContent: [toolUse(), text("After tool call")],
    expected: "Before tool call\nAfter tool call",
  },
  {
    name: "preserves streamed text when streamed run had non-text and final drops suffix blocks",
    streamedContent: [text("Before tool call"), toolUse(), text("After tool call")],
    finalContent: [text("Before tool call")],
    expected: "Before tool call\nAfter tool call",
  },
  {
    name: "prefers final text when non-text appears only in final payload",
    streamedContent: [text("Draft line 1"), text("Draft line 2")],
    finalContent: [toolUse(), text("Draft line 2")],
    expected: "Draft line 2",
  },
  {
    name: "keeps non-empty final text for plain text boundary drops",
    streamedContent: [text("Draft line 1"), text("Draft line 2")],
    finalContent: [text("Draft line 1")],
    expected: "Draft line 1",
  },
  {
    name: "prefers final replacement text when payload is not a boundary subset",
    streamedContent: [text("Before tool call"), toolUse(), text("After tool call")],
    finalContent: [toolUse(), text("Replacement")],
    expected: "Replacement",
  },
  {
    name: "accepts richer final payload when it extends streamed text",
    streamedContent: [text("Before tool call")],
    finalContent: [text("Before tool call"), text("After tool call")],
    expected: "Before tool call\nAfter tool call",
  },
];

describe("TuiStreamAssembler", () => {
  it("keeps thinking before content even when thinking arrives later", () => {
    const assembler = new TuiStreamAssembler();
    const first = assembler.ingestDelta("run-1", messageWithContent([text("Hello")]), true);
    expect(first).toBe("Hello");

    const second = assembler.ingestDelta("run-1", messageWithContent([thinking("Brain")]), true);
    expect(second).toBe("[thinking]\nBrain\n\nHello");
  });

  it("omits thinking when showThinking is false", () => {
    const assembler = new TuiStreamAssembler();
    const output = assembler.ingestDelta(
      "run-2",
      messageWithContent([thinking("Hidden"), text("Visible")]),
      false,
    );
    expect(output).toBe("Visible");
  });

  it("falls back to streamed text on empty final payload", () => {
    const assembler = new TuiStreamAssembler();
    assembler.ingestDelta("run-3", messageWithContent([text("Streamed")]), false);
    const finalText = assembler.finalize("run-3", { role: "assistant", content: [] }, false);
    expect(finalText).toBe("Streamed");
  });

  it("returns null when delta text is unchanged", () => {
    const assembler = new TuiStreamAssembler();
    const first = assembler.ingestDelta("run-4", messageWithContent([text("Repeat")]), false);
    expect(first).toBe("Repeat");
    const second = assembler.ingestDelta("run-4", messageWithContent([text("Repeat")]), false);
    expect(second).toBeNull();
  });

  it("keeps streamed delta text when incoming tool boundary drops a block", () => {
    const assembler = new TuiStreamAssembler();
    const first = assembler.ingestDelta("run-delta-boundary", TEXT_ONLY_TWO_BLOCKS, false);
    expect(first).toBe("Draft line 1\nDraft line 2");

    const second = assembler.ingestDelta(
      "run-delta-boundary",
      messageWithContent([toolUse(), text("Draft line 2")]),
      false,
    );
    expect(second).toBeNull();
  });

  for (const testCase of FINALIZE_BOUNDARY_CASES) {
    it(testCase.name, () => {
      const assembler = new TuiStreamAssembler();
      assembler.ingestDelta("run-boundary", messageWithContent(testCase.streamedContent), false);
      const finalText = assembler.finalize(
        "run-boundary",
        messageWithContent(testCase.finalContent),
        false,
      );
      expect(finalText).toBe(testCase.expected);
    });
  }

  // --- Single-block boundary-aligned truncation guard (#28180) ---

  it("preserves streamed text when first tool delta truncates to a suffix", () => {
    // Core #28180 scenario: provider re-emits a shorter text block at tool boundary.
    // "consectetur adipiscing elit." is a suffix of the full streamed text.
    const assembler = new TuiStreamAssembler();
    assembler.ingestDelta(
      "run-shrink",
      messageWithContent([text("Lorem ipsum dolor sit amet, consectetur adipiscing elit.")]),
      false,
    );

    // Tool appears and text is truncated to only the suffix.
    const afterTool = assembler.ingestDelta(
      "run-shrink",
      messageWithContent([toolUse(), text("consectetur adipiscing elit.")]),
      false,
    );
    // Suffix match → boundary-aligned truncation → preserve streamed text.
    expect(afterTool).toBeNull();
  });

  it("preserves streamed text when first tool delta truncates to a prefix", () => {
    const assembler = new TuiStreamAssembler();
    assembler.ingestDelta(
      "run-shrink-prefix",
      messageWithContent([text("Lorem ipsum dolor sit amet, consectetur adipiscing elit.")]),
      false,
    );

    const afterTool = assembler.ingestDelta(
      "run-shrink-prefix",
      messageWithContent([toolUse(), text("Lorem ipsum dolor sit amet,")]),
      false,
    );
    // Prefix match → boundary-aligned truncation → preserve streamed text.
    expect(afterTool).toBeNull();
  });

  it("allows text growth when tool_use first appears", () => {
    const assembler = new TuiStreamAssembler();
    assembler.ingestDelta("run-grow", messageWithContent([text("Hello world")]), false);

    // Tool appears but text grows — should update normally.
    const second = assembler.ingestDelta(
      "run-grow",
      messageWithContent([text("Hello world"), toolUse(), text("New content after tool")]),
      false,
    );
    expect(second).toBe("Hello world\nNew content after tool");
  });

  it("allows intentional rewrite at first tool boundary (non-boundary-aligned)", () => {
    // Codex's key concern: model intentionally rewrites
    // "Need to verify; answer is 42" (28 chars) to
    // "The answer is definitely 42" (27 chars).
    // The new text is shorter but is NOT a prefix or suffix of the old text,
    // so it should pass through as a legitimate rewrite.
    const assembler = new TuiStreamAssembler();
    assembler.ingestDelta(
      "run-rewrite",
      messageWithContent([text("Need to verify; answer is 42")]),
      false,
    );

    const second = assembler.ingestDelta(
      "run-rewrite",
      messageWithContent([toolUse(), text("The answer is definitely 42")]),
      false,
    );
    // NOT a prefix or suffix → intentional rewrite → update normally.
    expect(second).toBe("The answer is definitely 42");
  });

  it("does not guard on second tool delta (only first transition)", () => {
    const assembler = new TuiStreamAssembler();
    // Phase 1: pre-tool text.
    assembler.ingestDelta(
      "run-second",
      messageWithContent([text("Need to verify; answer is 42")]),
      false,
    );

    // Phase 2: first tool transition — text grows (not a truncation).
    assembler.ingestDelta(
      "run-second",
      messageWithContent([text("Need to verify; answer is 42"), toolUse()]),
      false,
    );

    // Phase 3: second delta with tool — model intentionally rewrites to
    // shorter text.  NOT the first tool transition → should go through.
    const rewrite = assembler.ingestDelta(
      "run-second",
      messageWithContent([toolUse(), text("42")]),
      false,
    );
    expect(rewrite).toBe("42");
  });

  it("finalize honours intentional rewrite even when text is a suffix", () => {
    // Model intentionally rewrites "Need to verify; answer is 42" → "42"
    // at tool boundary.  ingestDelta guards it (suffix match), but
    // finalize must honour the authoritative payload.
    const assembler = new TuiStreamAssembler();
    assembler.ingestDelta(
      "run-final-rewrite",
      messageWithContent([text("Need to verify; answer is 42")]),
      false,
    );

    // First tool transition — "42" is a suffix → ingestDelta guards it.
    assembler.ingestDelta("run-final-rewrite", messageWithContent([toolUse(), text("42")]), false);

    // finalize sends the authoritative "42" — must be honoured.
    const finalText = assembler.finalize(
      "run-final-rewrite",
      messageWithContent([toolUse(), text("42")]),
      false,
    );
    expect(finalText).toBe("42");
  });

  it("finalize honours intentional rewrite when no truncation during streaming", () => {
    const assembler = new TuiStreamAssembler();
    assembler.ingestDelta(
      "run-final-rewrite-2",
      messageWithContent([text("Need to verify; answer is 42")]),
      false,
    );

    // First tool transition with text growth (not truncation).
    assembler.ingestDelta(
      "run-final-rewrite-2",
      messageWithContent([text("Need to verify; answer is 42"), toolUse()]),
      false,
    );

    // finalize with shorter text — intentional rewrite.
    const finalText = assembler.finalize(
      "run-final-rewrite-2",
      messageWithContent([toolUse(), text("42")]),
      false,
    );
    expect(finalText).toBe("42");
  });

  it("preserves streamed text through finalize when multi-tool truncation occurs", () => {
    // Streaming had two tools with text blocks, finalize drops some.
    const assembler = new TuiStreamAssembler();
    assembler.ingestDelta(
      "run-multi-tool",
      messageWithContent([
        text("Step 1 result"),
        toolUse(),
        text("Step 2 result"),
        toolUse(),
        text("Step 3 result"),
      ]),
      false,
    );

    // finalize drops the last block (suffix subset).
    const finalText = assembler.finalize(
      "run-multi-tool",
      messageWithContent([text("Step 1 result"), toolUse(), text("Step 2 result")]),
      false,
    );
    expect(finalText).toBe("Step 1 result\nStep 2 result\nStep 3 result");
  });
});
