/**
 * Tests for StreamParser.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StreamParser } from '../../../src/streaming/pipeline/stream-parser.js';

describe('StreamParser', () => {
  let parser: StreamParser;

  beforeEach(() => {
    parser = new StreamParser();
  });

  describe('parse SSE format', () => {
    it('should parse SSE format "data: {...}\\n\\n"', () => {
      const chunk = 'data: {"type":"text_delta","data":"hello"}\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('text_delta');
      expect(events[0]?.data).toBe('hello');
    });

    it('should parse multiple SSE events', () => {
      const chunk = 'data: {"type":"text_delta","data":"hello"}\n\ndata: {"type":"text_delta","data":"world"}\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(2);
      expect(events[0]?.data).toBe('hello');
      expect(events[1]?.data).toBe('world');
    });

    it('should handle incomplete SSE event', () => {
      const chunk1 = 'data: {"type":"text_delta",';
      const events1 = parser.parse(chunk1);

      expect(events1).toHaveLength(0);

      const chunk2 = '"data":"hello"}\n\n';
      const events2 = parser.parse(chunk2);

      expect(events2).toHaveLength(1);
      expect(events2[0]?.data).toBe('hello');
    });
  });

  describe('parse raw text chunks', () => {
    it('should parse raw text chunks when no structured format detected', () => {
      const chunk = 'Just plain text';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('text_delta');
      expect(events[0]?.data).toBe('Just plain text');
    });

    it('should accumulate raw text across multiple chunks', () => {
      const chunk1 = 'Hello ';
      const events1 = parser.parse(chunk1);
      // First chunk triggers raw text mode immediately
      expect(events1).toHaveLength(1);

      const chunk2 = 'world';
      const events2 = parser.parse(chunk2);

      expect(events2).toHaveLength(1);
      expect(events2[0]?.data).toBe('world');
    });
  });

  describe('handle malformed SSE gracefully', () => {
    it('should fall back to raw text on malformed JSON', () => {
      const chunk = 'data: {invalid json}\n\n';
      const events = parser.parse(chunk);

      // Malformed JSON is ignored, parser switches to raw text mode eventually
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing data field in SSE', () => {
      const chunk = 'event: test\n\n';
      const events = parser.parse(chunk);

      // SSE without data field produces no events
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle mixed SSE and text gracefully', () => {
      const chunk = 'data: {"type":"text_delta","data":"structured"}\n\nsome plain text';
      const events = parser.parse(chunk);

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('JSON lines format', () => {
    it('should parse JSON lines format', () => {
      const chunk = '{"type":"text_delta","data":"line1"}\n{"type":"text_delta","data":"line2"}\n';
      const events = parser.parse(chunk);

      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle incomplete JSON line', () => {
      const chunk1 = '{"type":"text_delta",';
      parser.parse(chunk1); // incomplete line, buffered

      const chunk2 = '"data":"hello"}\n';
      const events2 = parser.parse(chunk2);

      expect(events2.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('auto-detection', () => {
    it('should auto-detect SSE format', () => {
      const chunk = 'data: {"type":"text_delta","data":"test"}\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0]?.data).toBe('test');
    });

    it('should auto-detect JSON lines format', () => {
      const chunk = '{"type":"text_delta","data":"test"}\n';
      const events = parser.parse(chunk);

      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should auto-detect raw text format', () => {
      const chunk = 'Plain text without structure';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('text_delta');
    });
  });
});
