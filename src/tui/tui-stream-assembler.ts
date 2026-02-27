import {
  composeThinkingAndContent,
  extractContentFromMessage,
  extractThinkingFromMessage,
  resolveFinalAssistantText,
} from "./tui-formatters.js";

type RunStreamState = {
  thinkingText: string;
  contentText: string;
  contentBlocks: string[];
  sawNonTextContentBlocks: boolean;
  displayText: string;
};

type BoundaryDropMode = "off" | "streamed-only" | "streamed-or-incoming";

function extractTextBlocksAndSignals(message: unknown): {
  textBlocks: string[];
  sawNonTextContentBlocks: boolean;
} {
  if (!message || typeof message !== "object") {
    return { textBlocks: [], sawNonTextContentBlocks: false };
  }
  const record = message as Record<string, unknown>;
  const content = record.content;

  if (typeof content === "string") {
    const text = content.trim();
    return {
      textBlocks: text ? [text] : [],
      sawNonTextContentBlocks: false,
    };
  }
  if (!Array.isArray(content)) {
    return { textBlocks: [], sawNonTextContentBlocks: false };
  }

  const textBlocks: string[] = [];
  let sawNonTextContentBlocks = false;
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const rec = block as Record<string, unknown>;
    if (rec.type === "text" && typeof rec.text === "string") {
      const text = rec.text.trim();
      if (text) {
        textBlocks.push(text);
      }
      continue;
    }
    if (typeof rec.type === "string" && rec.type !== "thinking") {
      sawNonTextContentBlocks = true;
    }
  }
  return { textBlocks, sawNonTextContentBlocks };
}

function isDroppedBoundaryTextBlockSubset(params: {
  streamedTextBlocks: string[];
  finalTextBlocks: string[];
}): boolean {
  const { streamedTextBlocks, finalTextBlocks } = params;
  if (finalTextBlocks.length === 0 || finalTextBlocks.length >= streamedTextBlocks.length) {
    return false;
  }

  const prefixMatches = finalTextBlocks.every(
    (block, index) => streamedTextBlocks[index] === block,
  );
  if (prefixMatches) {
    return true;
  }

  const suffixStart = streamedTextBlocks.length - finalTextBlocks.length;
  return finalTextBlocks.every((block, index) => streamedTextBlocks[suffixStart + index] === block);
}

/**
 * Detect whether `incomingText` is a boundary-aligned truncation of
 * `streamedText` — i.e. the incoming text is a strict prefix or suffix
 * of the streamed text.  This targets the single-block streaming
 * scenario from #28180 where the provider re-emits the message with a
 * shortened text block at the tool-call boundary.
 *
 * Unlike a length-only check, this ensures that intentional rewrites
 * (where the model replaces the text with completely different content
 * that happens to be shorter) are NOT mistaken for truncation.
 *
 * This guard is only used inside `ingestDelta` on the first
 * tool-boundary transition as a UI flicker prevention measure;
 * `finalize` always trusts the final payload, so any intentional
 * rewrite by the model will still be reflected in the final output.
 */
function isBoundaryAlignedTruncation(streamedText: string, incomingText: string): boolean {
  if (!streamedText || !incomingText || incomingText.length >= streamedText.length) {
    return false;
  }
  return streamedText.startsWith(incomingText) || streamedText.endsWith(incomingText);
}

function shouldPreserveBoundaryDroppedText(params: {
  boundaryDropMode: BoundaryDropMode;
  streamedSawNonTextContentBlocks: boolean;
  incomingSawNonTextContentBlocks: boolean;
  streamedTextBlocks: string[];
  nextContentBlocks: string[];
}) {
  if (params.boundaryDropMode === "off") {
    return false;
  }
  const sawEligibleNonTextContent =
    params.boundaryDropMode === "streamed-or-incoming"
      ? params.streamedSawNonTextContentBlocks || params.incomingSawNonTextContentBlocks
      : params.streamedSawNonTextContentBlocks;
  if (!sawEligibleNonTextContent) {
    return false;
  }
  return isDroppedBoundaryTextBlockSubset({
    streamedTextBlocks: params.streamedTextBlocks,
    finalTextBlocks: params.nextContentBlocks,
  });
}

export class TuiStreamAssembler {
  private runs = new Map<string, RunStreamState>();

  private getOrCreateRun(runId: string): RunStreamState {
    let state = this.runs.get(runId);
    if (!state) {
      state = {
        thinkingText: "",
        contentText: "",
        contentBlocks: [],
        sawNonTextContentBlocks: false,
        displayText: "",
      };
      this.runs.set(runId, state);
    }
    return state;
  }

  private updateRunState(
    state: RunStreamState,
    message: unknown,
    showThinking: boolean,
    opts?: {
      boundaryDropMode?: BoundaryDropMode;
      /**
       * When true, enables the single-block boundary-aligned truncation
       * guard that prevents text from visibly shrinking on the first
       * tool-boundary transition.  Only `ingestDelta` sets this —
       * `finalize` always trusts the final payload so intentional
       * rewrites are honoured.
       */
      guardSingleBlockTruncation?: boolean;
    },
  ) {
    const thinkingText = extractThinkingFromMessage(message);
    const contentText = extractContentFromMessage(message);
    const { textBlocks, sawNonTextContentBlocks } = extractTextBlocksAndSignals(message);

    if (thinkingText) {
      state.thinkingText = thinkingText;
    }
    if (contentText) {
      const nextContentBlocks = textBlocks.length > 0 ? textBlocks : [contentText];
      const boundaryDropMode = opts?.boundaryDropMode ?? "off";

      // Single-block boundary-aligned truncation guard (#28180).
      //
      // During live streaming, when a tool_use block first appears the
      // provider may re-emit the message with a shortened text block
      // that is a strict prefix or suffix of the already-streamed text.
      // The existing multi-block subset check (`isDroppedBoundaryTextBlockSubset`)
      // does not catch this because the block count stays 1 → 1.
      //
      // To prevent visible text shrinkage we keep the already-streamed
      // text when ALL of the following hold:
      //   1. Called from ingestDelta (guardSingleBlockTruncation === true)
      //   2. This is the first tool-boundary transition
      //      (sawNonTextContentBlocks flips from false to true)
      //   3. The incoming text is a strict prefix or suffix of the
      //      streamed text (boundary-aligned truncation pattern)
      //
      // Condition 3 ensures that intentional rewrites — where the model
      // replaces text with completely different (possibly shorter) content —
      // are NOT blocked.  For example, "Need to verify; answer is 42"
      // rewritten to "The answer is definitely 42" is not a prefix or
      // suffix match, so it passes through normally.
      //
      // This is a pure UI flicker prevention measure.  finalize() never
      // enables this guard, so the final output always reflects the
      // authoritative server payload.
      let keepForSingleBlockTruncation = false;
      if (opts?.guardSingleBlockTruncation && boundaryDropMode !== "off") {
        const isFirstToolTransition =
          !state.sawNonTextContentBlocks && sawNonTextContentBlocks && state.contentText;
        if (isFirstToolTransition) {
          keepForSingleBlockTruncation = isBoundaryAlignedTruncation(
            state.contentText,
            contentText,
          );
        }
      }

      const shouldKeepStreamedBoundaryText =
        shouldPreserveBoundaryDroppedText({
          boundaryDropMode,
          streamedSawNonTextContentBlocks: state.sawNonTextContentBlocks,
          incomingSawNonTextContentBlocks: sawNonTextContentBlocks,
          streamedTextBlocks: state.contentBlocks,
          nextContentBlocks,
        }) || keepForSingleBlockTruncation;

      if (!shouldKeepStreamedBoundaryText) {
        state.contentText = contentText;
        state.contentBlocks = nextContentBlocks;
      }
    }
    if (sawNonTextContentBlocks) {
      state.sawNonTextContentBlocks = true;
    }

    const displayText = composeThinkingAndContent({
      thinkingText: state.thinkingText,
      contentText: state.contentText,
      showThinking,
    });

    state.displayText = displayText;
  }

  ingestDelta(runId: string, message: unknown, showThinking: boolean): string | null {
    const state = this.getOrCreateRun(runId);
    const previousDisplayText = state.displayText;
    this.updateRunState(state, message, showThinking, {
      boundaryDropMode: "streamed-or-incoming",
      guardSingleBlockTruncation: true,
    });

    if (!state.displayText || state.displayText === previousDisplayText) {
      return null;
    }

    return state.displayText;
  }

  finalize(runId: string, message: unknown, showThinking: boolean): string {
    const state = this.getOrCreateRun(runId);
    const streamedDisplayText = state.displayText;
    const streamedTextBlocks = [...state.contentBlocks];
    const streamedSawNonTextContentBlocks = state.sawNonTextContentBlocks;
    this.updateRunState(state, message, showThinking, {
      boundaryDropMode: "streamed-only",
      // guardSingleBlockTruncation is intentionally NOT set here.
      // finalize always trusts the final payload from the server,
      // ensuring that intentional model rewrites are honoured.
    });
    const finalComposed = state.displayText;
    const shouldKeepStreamedText =
      streamedSawNonTextContentBlocks &&
      isDroppedBoundaryTextBlockSubset({
        streamedTextBlocks,
        finalTextBlocks: state.contentBlocks,
      });
    const finalText = resolveFinalAssistantText({
      finalText: shouldKeepStreamedText ? streamedDisplayText : finalComposed,
      streamedText: streamedDisplayText,
    });

    this.runs.delete(runId);
    return finalText;
  }

  drop(runId: string) {
    this.runs.delete(runId);
  }
}
