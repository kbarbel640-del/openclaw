/**
 * Error thrown when a circular dependency is detected during resolution
 */
export class CircularDependencyError extends Error {
  constructor(public readonly chain: string[]) {
    super(`Circular dependency detected: ${chain.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Error thrown when attempting to resolve an unregistered token
 */
export class NotRegisteredError extends Error {
  constructor(public readonly token: string) {
    super(`No provider registered for token: ${token}`);
    this.name = 'NotRegisteredError';
  }
}
