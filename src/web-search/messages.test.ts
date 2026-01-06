import { describe, it, expect } from 'vitest';
import { messages } from './messages.js';

describe('messages', () => {
  it('acknowledgment is plain text', () => {
    expect(messages.acknowledgment()).toBe('Выполняю веб-поиск...');
  });
  
  it('resultDelivery formats correctly', () => {
    const result = {
      response: 'Test response',
      session_id: 'abc-123',
      stats: { 
        models: {
          'gemini-1.5': {
            api: { totalRequests: 1, totalErrors: 0 },
            tokens: { input: 100, candidates: 50, total: 150 }
          }
        }
      }
    };
    
    const formatted = messages.resultDelivery(result);
    expect(formatted).toContain('🌐');
    expect(formatted).toContain('Результат поиска');
    expect(formatted).toContain('Test response');
  });
  
  it('error includes session ID', () => {
    const error = messages.error('Something went wrong', 'abc-123');
    expect(error).toContain('❌');
    expect(error).toContain('Search ID');
    // Check for parts of session ID separately (hyphen may be escaped)
    expect(error).toContain('abc');
    expect(error).toContain('123');
  });
  
  it('error truncates long messages', () => {
    const longError = 'A'.repeat(300);
    const error = messages.error(longError, 'abc-123');
    // Check for escaped ellipsis (\.\.\.) or actual ellipsis (...)
    expect(error).toMatch(/(\\?\.){3}/);
    expect(error.length).toBeLessThan(250);
  });
  
  it('timeout message is clear', () => {
    expect(messages.timeout()).toContain('◐');
    expect(messages.timeout()).toContain('слишком много времени');
  });
  
  it('cliNotFound includes path', () => {
    const error = messages.cliNotFound('/path/to/cli');
    expect(error).toContain('❌');
    expect(error).toContain('/path/to/cli');
    // Check for the configuration hint (dots may be escaped)
    expect(error).toContain('Проверьте настройки');
    expect(error).toMatch(/webSearch/);
  });
});
