/**
 * Long message splitter for splitting messages that exceed maximum length.
 * Attempts to split at natural boundaries (paragraphs, sentences, words).
 */

/**
 * Splits long messages at optimal boundaries to maintain readability.
 */
export class LongMessageSplitter {
  /**
   * Split text into chunks not exceeding maxLength.
   * Prioritizes splitting at: paragraph > sentence > word > hard cut
   * @param text - Text to split
   * @param maxLength - Maximum length per chunk
   * @returns Array of text chunks, each <= maxLength
   */
  split(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to find best split point
      const chunk = remaining.slice(0, maxLength);
      const splitPoint = this.findBestSplitPoint(chunk);

      chunks.push(remaining.slice(0, splitPoint).trimEnd());
      remaining = remaining.slice(splitPoint).trimStart();
    }

    return chunks;
  }

  /**
   * Find the best point to split text within the chunk.
   * Priority: paragraph (\n\n) > sentence (. ) > word ( ) > hard cut
   */
  private findBestSplitPoint(chunk: string): number {
    // Try paragraph boundary
    const paragraphIdx = chunk.lastIndexOf('\n\n');
    if (paragraphIdx > chunk.length / 2) {
      return paragraphIdx + 2;
    }

    // Try sentence boundary
    const sentenceIdx = this.findLastSentenceBoundary(chunk);
    if (sentenceIdx > chunk.length / 3) {
      return sentenceIdx;
    }

    // Try word boundary
    const wordIdx = chunk.lastIndexOf(' ');
    if (wordIdx > chunk.length / 4) {
      return wordIdx + 1;
    }

    // Hard cut if no good boundary found
    return chunk.length;
  }

  /**
   * Find the last sentence boundary in the chunk.
   * Looks for '. ', '! ', or '? ' followed by space or newline.
   */
  private findLastSentenceBoundary(chunk: string): number {
    const patterns = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
    let bestIdx = -1;

    for (const pattern of patterns) {
      const idx = chunk.lastIndexOf(pattern);
      if (idx > bestIdx) {
        bestIdx = idx + pattern.length;
      }
    }

    return bestIdx;
  }
}
