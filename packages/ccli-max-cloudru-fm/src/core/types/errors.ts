/**
 * Base error class for all OpenClaw errors.
 * Provides a consistent error taxonomy with error codes, recoverability flags,
 * and user-safe error messages.
 */
export abstract class OpenClawError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;

  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  abstract toUserMessage(): string;
}

export class ValidationError extends OpenClawError {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'Invalid input provided. Please check your data and try again.';
  }
}

export class SecurityError extends OpenClawError {
  readonly code = 'SECURITY_ERROR' as const;
  readonly recoverable = false;

  toUserMessage(): string {
    return 'A security violation was detected. This action cannot be completed.';
  }
}

export class SessionError extends OpenClawError {
  readonly code = 'SESSION_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'Session error occurred. Please try again or start a new session.';
  }
}

export class ConcurrencyError extends OpenClawError {
  readonly code = 'CONCURRENCY_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'A concurrent operation conflict occurred. Please retry your request.';
  }
}

export class StreamError extends OpenClawError {
  readonly code = 'STREAM_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'Stream processing failed. The operation may need to be restarted.';
  }
}

export class ProviderError extends OpenClawError {
  readonly code = 'PROVIDER_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'External provider error. Please try again later.';
  }
}

export class PluginError extends OpenClawError {
  readonly code = 'PLUGIN_ERROR' as const;
  readonly recoverable = false;

  toUserMessage(): string {
    return 'Plugin error occurred. Please check plugin configuration.';
  }
}

export class TrainingError extends OpenClawError {
  readonly code = 'TRAINING_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'Training operation failed. Please verify training data and retry.';
  }
}
