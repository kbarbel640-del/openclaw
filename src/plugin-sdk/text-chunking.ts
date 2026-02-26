import { chunkTextByBreakResolver } from "../shared/text-chunking.js";

/**
 * @description Splits a long text string into chunks that each fit within
 * `limit` characters. Breaks preferentially on newlines, then on spaces, so
 * that word boundaries are preserved wherever possible.
 *
 * @param text - The text to split.
 * @param limit - Maximum character length of each chunk.
 * @returns An array of chunks. Returns `[""]` for empty input and a single-
 *   element array when the text fits within `limit`.
 *
 * @example
 * ```ts
 * const chunks = chunkTextForOutbound("Hello world\nThis is a test", 15);
 * // ["Hello world", "This is a test"]
 * ```
 */
export function chunkTextForOutbound(text: string, limit: number): string[] {
  return chunkTextByBreakResolver(text, limit, (window) => {
    const lastNewline = window.lastIndexOf("\n");
    const lastSpace = window.lastIndexOf(" ");
    return lastNewline > 0 ? lastNewline : lastSpace;
  });
}
