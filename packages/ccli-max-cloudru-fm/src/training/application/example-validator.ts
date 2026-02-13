import { randomUUID } from 'crypto';
import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { TrainingExample, ExampleCategory, QualityScore } from '../domain/types.js';
import { InvalidExampleError } from '../domain/errors.js';

const VALID_CATEGORIES: ExampleCategory[] = ['greeting', 'faq', 'task', 'error_handling', 'custom'];
const VALID_QUALITIES: QualityScore[] = [1, 2, 3, 4, 5];

export class ExampleValidator {
  validate(example: Partial<TrainingExample>): Result<TrainingExample, InvalidExampleError> {
    if (!example.input || example.input.trim() === '') {
      return err(new InvalidExampleError('Input cannot be empty'));
    }

    if (!example.expectedOutput || example.expectedOutput.trim() === '') {
      return err(new InvalidExampleError('Expected output cannot be empty'));
    }

    if (!example.tenantId) {
      return err(new InvalidExampleError('Tenant ID is required'));
    }

    if (!example.category || !VALID_CATEGORIES.includes(example.category)) {
      return err(new InvalidExampleError(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`));
    }

    if (example.quality === undefined || !VALID_QUALITIES.includes(example.quality)) {
      return err(new InvalidExampleError('Quality must be between 1 and 5'));
    }

    const validated: TrainingExample = {
      id: example.id || randomUUID(),
      tenantId: example.tenantId,
      input: example.input.trim(),
      expectedOutput: example.expectedOutput.trim(),
      category: example.category,
      quality: example.quality,
      createdAt: example.createdAt || new Date(),
      metadata: example.metadata,
    };

    return ok(validated);
  }
}
