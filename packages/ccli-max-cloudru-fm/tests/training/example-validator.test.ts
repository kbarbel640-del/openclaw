/**
 * Tests for ExampleValidator.
 */

import { describe, it, expect } from 'vitest';
import { ExampleValidator } from '../../src/training/application/example-validator.js';
import type { TrainingExample } from '../../src/training/domain/types.js';
import type { TenantIdString } from '../../src/core/types/tenant-id.js';

describe('ExampleValidator', () => {
  const validator = new ExampleValidator();
  const tenantId: TenantIdString = 'telegram:123:456' as TenantIdString;

  describe('validate', () => {
    it('should validate valid example', () => {
      const example: Partial<TrainingExample> = {
        tenantId,
        input: 'Hello world',
        expectedOutput: 'Hi there!',
        category: 'greeting',
        quality: 5,
      };

      const result = validator.validate(example);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBeDefined();
        expect(result.value.tenantId).toBe(tenantId);
        expect(result.value.input).toBe('Hello world');
        expect(result.value.expectedOutput).toBe('Hi there!');
        expect(result.value.category).toBe('greeting');
        expect(result.value.quality).toBe(5);
        expect(result.value.createdAt).toBeInstanceOf(Date);
      }
    });

    it('should reject empty input', () => {
      const example: Partial<TrainingExample> = {
        tenantId,
        input: '',
        expectedOutput: 'Hi there!',
        category: 'greeting',
        quality: 5,
      };

      const result = validator.validate(example);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('InvalidExampleError');
        expect(result.error.message).toContain('Input cannot be empty');
      }
    });

    it('should reject empty output', () => {
      const example: Partial<TrainingExample> = {
        tenantId,
        input: 'Hello world',
        expectedOutput: '',
        category: 'greeting',
        quality: 5,
      };

      const result = validator.validate(example);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('InvalidExampleError');
        expect(result.error.message).toContain('Expected output cannot be empty');
      }
    });

    it('should reject invalid quality', () => {
      const example: Partial<TrainingExample> = {
        tenantId,
        input: 'Hello world',
        expectedOutput: 'Hi there!',
        category: 'greeting',
        quality: 6 as any,
      };

      const result = validator.validate(example);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('InvalidExampleError');
        expect(result.error.message).toContain('Quality must be between 1 and 5');
      }
    });

    it('should generate id when missing', () => {
      const example: Partial<TrainingExample> = {
        tenantId,
        input: 'Hello world',
        expectedOutput: 'Hi there!',
        category: 'greeting',
        quality: 5,
      };

      const result = validator.validate(example);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBeDefined();
        expect(result.value.id.length).toBeGreaterThan(0);
      }
    });

    it('should trim whitespace from input and output', () => {
      const example: Partial<TrainingExample> = {
        tenantId,
        input: '  Hello world  ',
        expectedOutput: '  Hi there!  ',
        category: 'greeting',
        quality: 5,
      };

      const result = validator.validate(example);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.input).toBe('Hello world');
        expect(result.value.expectedOutput).toBe('Hi there!');
      }
    });
  });
});
