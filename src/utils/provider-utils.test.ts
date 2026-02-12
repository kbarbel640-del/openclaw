import { describe, it, expect } from 'vitest';
import { isReasoningTagProvider } from './provider-utils';

describe('isReasoningTagProvider', () => {
  it('should return false for falsy or empty inputs', () => {
    expect(isReasoningTagProvider(null)).toBe(false);
    expect(isReasoningTagProvider(undefined)).toBe(false);
    expect(isReasoningTagProvider('')).toBe(false);
    expect(isReasoningTagProvider('   ')).toBe(false);
  });

  it('should return true for exact matches', () => {
    expect(isReasoningTagProvider('ollama')).toBe(true);
    expect(isReasoningTagProvider('google-gemini-cli')).toBe(true);
    expect(isReasoningTagProvider('google-generative-ai')).toBe(true);
  });

  it('should handle case insensitivity and whitespace for exact matches', () => {
    expect(isReasoningTagProvider('Ollama')).toBe(true);
    expect(isReasoningTagProvider('  ollama  ')).toBe(true);
    expect(isReasoningTagProvider('GOOGLE-GEMINI-CLI')).toBe(true);
  });

  it('should return true for providers containing "google-antigravity"', () => {
    expect(isReasoningTagProvider('google-antigravity')).toBe(true);
    expect(isReasoningTagProvider('google-antigravity/gemini-3')).toBe(true);
    expect(isReasoningTagProvider('prefix-google-antigravity')).toBe(true);
  });

  it('should return true for providers containing "minimax"', () => {
    expect(isReasoningTagProvider('minimax')).toBe(true);
    expect(isReasoningTagProvider('minimax/abab')).toBe(true);
    expect(isReasoningTagProvider('some-minimax-model')).toBe(true);
  });

  it('should return false for unknown providers', () => {
    expect(isReasoningTagProvider('openai')).toBe(false);
    expect(isReasoningTagProvider('anthropic')).toBe(false);
    expect(isReasoningTagProvider('google')).toBe(false); // Does not contain google-antigravity
    expect(isReasoningTagProvider('gemini')).toBe(false); // Exact match checks specifically for google-gemini-cli
    expect(isReasoningTagProvider('random-provider')).toBe(false);
  });
});
