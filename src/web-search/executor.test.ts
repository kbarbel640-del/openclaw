import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWebSearch } from './executor.js';

// Mock child_process since executor.ts uses it directly
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: (fn: any) => {
    return async (cmd: string, options: any) => {
      const mockExec = vi.mocked((await import('node:child_process')).exec);
      // Call the mock with original arguments
      return mockExec(cmd, options);
    };
  },
}));

describe('executeWebSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementation for each test
    vi.doMock('node:child_process', () => ({
      exec: vi.fn(),
    }));
  });

  it('executes CLI with query', async () => {
    const { exec } = await import('node:child_process');
    const mockExec = vi.mocked(exec);
    mockExec.mockResolvedValue({
      stdout: '{"response": "Test result", "session_id": "abc-123", "stats": {"models": {}}}',
      stderr: '',
    } as any);

    const result = await executeWebSearch('test query');

    expect(result.success).toBe(true);
    expect(result.result?.response).toBe('Test result');
    expect(mockExec).toHaveBeenCalled();
  });

  it('handles timeout error', async () => {
    const { exec } = await import('node:child_process');
    vi.mocked(exec).mockRejectedValue(new Error('timeout'));

    const result = await executeWebSearch('test query');

    expect(result.success).toBe(false);
    expect(result.error).toContain('⏱️');
  });

  it('handles CLI not found error', async () => {
    const { exec } = await import('node:child_process');
    vi.mocked(exec).mockRejectedValue(new Error('not found'));

    const result = await executeWebSearch('test query');

    expect(result.success).toBe(false);
    expect(result.error).toContain('не найден');
  });

  it('handles permission error', async () => {
    const { exec } = await import('node:child_process');
    vi.mocked(exec).mockRejectedValue(new Error('Permission denied'));

    const result = await executeWebSearch('test query');

    expect(result.success).toBe(false);
    expect(result.error).toContain('не удался');
  });

  it('supports dry run mode', async () => {
    const result = await executeWebSearch('test query', { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.result?.response).toContain('DRY RUN');
  });

  it('escapes special characters', async () => {
    const { exec } = await import('node:child_process');
    vi.mocked(exec).mockResolvedValue({
      stdout: '{"response": "ok", "session_id": "123", "stats": {"models": {}}}',
      stderr: '',
    } as any);

    await executeWebSearch('query with "quotes" and $dollar');

    expect(vi.mocked(exec)).toHaveBeenCalled();
  });

  it('handles API errors', async () => {
    const { exec } = await import('node:child_process');
    vi.mocked(exec).mockRejectedValue(new Error('API error'));

    const result = await executeWebSearch('test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('не удался');
  });

  /**
   * Regression test for WEB-SEARCH-INTERMITTENT
   *
   * Bug: When gemini CLI fails with non-zero exit code,
   * the shell script outputs plain error text.
   * The executor tries to parse this as JSON and fails.
   * User sees generic "Ошибка поиска" instead of actual error.
   */
  it('should handle non-JSON stdout from gemini CLI gracefully', async () => {
    const { exec } = await import('node:child_process');
    // Mock execAsync to return error text (simulating gemini CLI failure)
    vi.mocked(exec).mockResolvedValue({
      stdout: 'Error: gemini CLI failed with exit code 10',
      stderr: ''
    } as any);

    // Act
    const result = await executeWebSearch('test query');

    // Assert: Should NOT throw, should return structured error
    expect(result.success).toBe(false);
    expect(result.runId).toMatch(/^error-\d+$/);
    expect(result.error).toBeDefined();
    // Error should contain actual error info, not generic message
    expect(result.error).not.toContain('Ошибка при выполнении поиска');
  });

  it('should preserve actual error message from shell script when stdout is not JSON', async () => {
    const { exec } = await import('node:child_process');
    // Mock execAsync to return error text
    vi.mocked(exec).mockResolvedValue({
      stdout: 'Error: gemini CLI failed with exit code 10',
      stderr: ''
    } as any);

    const result = await executeWebSearch('test query');

    // Error should contain the actual error from gemini CLI
    expect(result.success).toBe(false);
    // The fix should include actual CLI output in error message
    expect(result.error).toContain('gemini CLI failed');
  });
});
