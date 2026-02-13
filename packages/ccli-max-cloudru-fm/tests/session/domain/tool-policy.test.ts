/**
 * Tests for ToolAccessPolicy.
 */

import { describe, it, expect } from 'vitest';
import { getDefaultPolicy, isToolAllowed } from '../../../src/session/domain/tool-policy.js';

describe('getDefaultPolicy', () => {
  it('should return limited tools for free tier', () => {
    const policy = getDefaultPolicy('free');

    expect(policy.tier).toBe('free');
    expect(policy.allowedTools).toContain('Read');
    expect(policy.allowedTools).toContain('Grep');
    expect(policy.blockedTools).toContain('Write');
    expect(policy.blockedTools).toContain('Edit');
    expect(policy.blockedTools).toContain('Bash');
  });

  it('should require approval for free tier', () => {
    const policy = getDefaultPolicy('free');

    expect(policy.requiresApproval).toBe(true);
  });

  it('should allow 1 concurrent tool for free tier', () => {
    const policy = getDefaultPolicy('free');

    expect(policy.maxConcurrentTools).toBe(1);
  });

  it('should allow read and write tools for standard tier', () => {
    const policy = getDefaultPolicy('standard');

    expect(policy.tier).toBe('standard');
    expect(policy.allowedTools).toContain('Read');
    expect(policy.allowedTools).toContain('Write');
    expect(policy.allowedTools).toContain('Edit');
    expect(policy.blockedTools).toContain('Skill');
  });

  it('should allow 2 concurrent tools for standard tier', () => {
    const policy = getDefaultPolicy('standard');

    expect(policy.maxConcurrentTools).toBe(2);
    expect(policy.requiresApproval).toBe(false);
  });

  it('should allow all tools for premium tier', () => {
    const policy = getDefaultPolicy('premium');

    expect(policy.tier).toBe('premium');
    expect(policy.allowedTools).toContain('Read');
    expect(policy.allowedTools).toContain('Write');
    expect(policy.allowedTools).toContain('Bash');
    expect(policy.allowedTools).toContain('Skill');
    expect(policy.blockedTools).toHaveLength(0);
  });

  it('should allow 4 concurrent tools for premium tier', () => {
    const policy = getDefaultPolicy('premium');

    expect(policy.maxConcurrentTools).toBe(4);
    expect(policy.requiresApproval).toBe(false);
  });

  it('should allow unlimited concurrent tools for admin tier', () => {
    const policy = getDefaultPolicy('admin');

    expect(policy.tier).toBe('admin');
    expect(policy.maxConcurrentTools).toBe(Number.POSITIVE_INFINITY);
    expect(policy.requiresApproval).toBe(false);
    expect(policy.blockedTools).toHaveLength(0);
  });
});

describe('isToolAllowed', () => {
  it('should return true for allowed tools', () => {
    const policy = getDefaultPolicy('free');

    expect(isToolAllowed(policy, 'Read')).toBe(true);
    expect(isToolAllowed(policy, 'Glob')).toBe(true);
  });

  it('should return false for blocked tools', () => {
    const policy = getDefaultPolicy('free');

    expect(isToolAllowed(policy, 'Write')).toBe(false);
    expect(isToolAllowed(policy, 'Bash')).toBe(false);
  });

  it('should return false for tools not in allowed list', () => {
    const policy = getDefaultPolicy('free');

    expect(isToolAllowed(policy, 'UnknownTool')).toBe(false);
  });
});
