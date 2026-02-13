/**
 * Integration tests for core types
 */

import { describe, it, expect } from 'vitest';
import {
  createTenantId,
  parseTenantId,
  createSessionId,
  parseSessionId,
  mapToSandboxTier,
  isTierAtLeast,
  ValidationError,
  type TenantIdString,
  type SessionIdString,
} from '../../../src/core/types/index.js';

describe('Core Types Integration', () => {
  describe('TenantId', () => {
    it('should create and parse TenantId correctly', () => {
      const components = {
        platform: 'telegram' as const,
        userId: '12345',
        chatId: '67890',
      };

      const tenantId = createTenantId(components);
      expect(tenantId).toBe('telegram:12345:67890');

      const parsed = parseTenantId(tenantId);
      expect(parsed).toEqual(components);
    });

    it('should throw ValidationError for invalid format', () => {
      const invalidId = 'invalid:format' as TenantIdString;
      expect(() => parseTenantId(invalidId)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid platform', () => {
      const invalidId = 'invalid:12345:67890' as TenantIdString;
      expect(() => parseTenantId(invalidId)).toThrow(ValidationError);
    });
  });

  describe('SessionId', () => {
    it('should create and parse SessionId correctly', () => {
      const tenantId = createTenantId({
        platform: 'web',
        userId: 'user123',
        chatId: 'chat456',
      });

      const sessionId = createSessionId(tenantId);
      expect(sessionId).toBe('session:web:user123:chat456');

      const parsed = parseSessionId(sessionId);
      expect(parsed.tenantId).toBe(tenantId);
    });

    it('should throw Error for invalid SessionId format', () => {
      const invalidId = 'invalid:format' as SessionIdString;
      expect(() => parseSessionId(invalidId)).toThrow(Error);
    });
  });

  describe('AccessTier', () => {
    it('should map access tiers to sandbox tiers correctly', () => {
      expect(mapToSandboxTier('free')).toBe('restricted');
      expect(mapToSandboxTier('standard')).toBe('standard');
      expect(mapToSandboxTier('premium')).toBe('full');
      expect(mapToSandboxTier('admin')).toBe('full');
    });

    it('should check tier hierarchy correctly', () => {
      expect(isTierAtLeast('admin', 'free')).toBe(true);
      expect(isTierAtLeast('premium', 'standard')).toBe(true);
      expect(isTierAtLeast('standard', 'standard')).toBe(true);
      expect(isTierAtLeast('free', 'premium')).toBe(false);
      expect(isTierAtLeast('standard', 'admin')).toBe(false);
    });
  });

  describe('End-to-End Flow', () => {
    it('should handle complete tenant creation flow', () => {
      // Create tenant
      const tenantId = createTenantId({
        platform: 'telegram',
        userId: 'user123',
        chatId: 'chat456',
      });

      // Create session from tenant
      const sessionId = createSessionId(tenantId);

      // Parse both back
      const tenantComponents = parseTenantId(tenantId);
      const sessionComponents = parseSessionId(sessionId);

      // Verify
      expect(tenantComponents.platform).toBe('telegram');
      expect(tenantComponents.userId).toBe('user123');
      expect(tenantComponents.chatId).toBe('chat456');
      expect(sessionComponents.tenantId).toBe(tenantId);
    });
  });
});
