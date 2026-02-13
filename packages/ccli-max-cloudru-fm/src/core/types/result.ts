import type { OpenClawError } from './errors.js';

/**
 * Discriminated union for type-safe error handling.
 * Represents either a successful result with a value or a failure with an error.
 */
export type Result<T, E extends OpenClawError = OpenClawError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Creates a successful Result with the given value.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Creates a failed Result with the given error.
 */
export function err<E extends OpenClawError>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Type guard to check if a Result is successful.
 */
export function isOk<T, E extends OpenClawError>(
  result: Result<T, E>
): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Type guard to check if a Result is a failure.
 */
export function isErr<T, E extends OpenClawError>(
  result: Result<T, E>
): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Unwraps a Result, returning the value or throwing the error.
 * Use with caution - prefer pattern matching with isOk/isErr.
 */
export function unwrap<T, E extends OpenClawError>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error;
}
