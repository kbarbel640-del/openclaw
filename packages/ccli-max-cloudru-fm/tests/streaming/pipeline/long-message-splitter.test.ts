/**
 * Tests for LongMessageSplitter.
 */

import { describe, it, expect } from 'vitest';
import { LongMessageSplitter } from '../../../src/streaming/pipeline/long-message-splitter.js';

describe('LongMessageSplitter', () => {
  const splitter = new LongMessageSplitter();

  it('should return single chunk for short text', () => {
    const text = 'Short message';
    const chunks = splitter.split(text, 100);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('should split long text at paragraph boundary', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const chunks = splitter.split(text, 30);

    expect(chunks.length).toBeGreaterThan(1);
    // Should split at paragraph boundaries
    expect(chunks[0]).not.toContain('Second');
  });

  it('should split at sentence boundary if no paragraph', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = splitter.split(text, 25);

    expect(chunks.length).toBeGreaterThan(1);
    // First chunk should end at sentence boundary
    expect(chunks[0]).toMatch(/\.\s*$/);
  });

  it('should split at word boundary if no sentence', () => {
    const text = 'word1 word2 word3 word4 word5 word6 word7 word8';
    const chunks = splitter.split(text, 20);

    expect(chunks.length).toBeGreaterThan(1);
    // Should split at word boundaries
    expect(chunks[0]).not.toContain('word8');
  });

  it('should hard split if no good boundary found', () => {
    const text = 'verylongwordwithnospacestosplitat';
    const chunks = splitter.split(text, 15);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.length).toBeLessThanOrEqual(15);
  });

  it('should respect maxLength for all chunks', () => {
    const text = 'a'.repeat(1000);
    const maxLength = 50;
    const chunks = splitter.split(text, maxLength);

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(maxLength);
    }
  });

  it('should handle text with multiple paragraph breaks', () => {
    const text = 'Para 1.\n\nPara 2.\n\nPara 3.\n\nPara 4.';
    const chunks = splitter.split(text, 15);

    expect(chunks.length).toBeGreaterThan(1);
    // Should split at \n\n boundaries
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(15);
    }
  });

  it('should preserve content across splits', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = splitter.split(text, 25);

    const rejoined = chunks.join(' ').replace(/\s+/g, ' ').trim();
    const original = text.replace(/\s+/g, ' ').trim();

    expect(rejoined).toBe(original);
  });

  it('should handle empty text', () => {
    const chunks = splitter.split('', 100);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('');
  });

  it('should trim whitespace at chunk boundaries', () => {
    const text = 'First paragraph.  \n\n  Second paragraph.';
    const chunks = splitter.split(text, 30);

    for (const chunk of chunks) {
      expect(chunk).toBe(chunk.trim());
    }
  });

  it('should prioritize paragraph over sentence boundary', () => {
    const text = 'Sentence one. Sentence two.\n\nNew paragraph here.';
    const chunks = splitter.split(text, 35);

    // Should split at \n\n rather than at sentence
    expect(chunks[0]).toContain('Sentence two.');
    expect(chunks[0]).not.toContain('New paragraph');
  });

  it('should handle question and exclamation marks as sentence boundaries', () => {
    const text = 'Question? Exclamation! Another sentence.';
    const chunks = splitter.split(text, 20);

    expect(chunks.length).toBeGreaterThan(1);
    // Should recognize ? and ! as sentence boundaries
    expect(chunks[0]).toMatch(/[?!]\s*$/);
  });
});
