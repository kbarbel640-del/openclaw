import { OpenClawError } from '../../core/types/errors.js';

export class TrainingContextError extends OpenClawError {
  readonly code = 'TRAINING_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'Training context error. Please try again.';
  }
}

export class ExampleNotFoundError extends TrainingContextError {
  constructor(id: string) {
    super(`Training example not found: ${id}`);
    this.name = 'ExampleNotFoundError';
  }

  toUserMessage(): string {
    return 'The requested training example was not found.';
  }
}

export class InvalidExampleError extends TrainingContextError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidExampleError';
  }

  toUserMessage(): string {
    return 'Invalid training example provided.';
  }
}

export class ContextTooLargeError extends TrainingContextError {
  constructor(size: number, maxSize: number) {
    super(`Context size ${size} exceeds maximum ${maxSize}`);
    this.name = 'ContextTooLargeError';
  }

  toUserMessage(): string {
    return 'Training context is too large. Please reduce the number of examples.';
  }
}

export class FeedbackError extends TrainingContextError {
  constructor(message: string) {
    super(message);
    this.name = 'FeedbackError';
  }

  toUserMessage(): string {
    return 'Failed to process feedback. Please try again.';
  }
}
