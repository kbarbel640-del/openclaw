import { InjectionToken } from './injection-token.js';
import { NotRegisteredError } from './container-errors.js';

interface Registration<T> {
  factory: () => T;
  singleton: boolean;
  instance?: T;
}

/**
 * Lightweight dependency injection container with singleton and transient support
 */
export class DependencyContainer {
  private readonly registrations = new Map<InjectionToken<unknown>, Registration<unknown>>();
  private readonly parent?: DependencyContainer;
  private frozen = false;

  constructor(parent?: DependencyContainer) {
    this.parent = parent;
  }

  /**
   * Register a factory for a given token
   * @param token The injection token
   * @param factory Factory function to create instances
   * @param options Configuration options
   */
  register<T>(
    token: InjectionToken<T>,
    factory: () => T,
    options?: { singleton?: boolean }
  ): void {
    if (this.frozen) {
      throw new Error('Container is frozen. Cannot register new providers.');
    }

    this.registrations.set(token, {
      factory,
      singleton: options?.singleton ?? true,
      instance: undefined,
    });
  }

  /**
   * Resolve an instance for the given token
   * @param token The injection token to resolve
   * @returns The resolved instance
   * @throws {NotRegisteredError} If token is not registered
   */
  resolve<T>(token: InjectionToken<T>): T {
    const registration = this.findRegistration(token);

    if (!registration) {
      throw new NotRegisteredError(token.description);
    }

    if (registration.singleton) {
      if (!registration.instance) {
        registration.instance = registration.factory();
      }
      return registration.instance;
    }

    return registration.factory();
  }

  /**
   * Check if a token is registered in this container or parent
   * @param token The token to check
   */
  has(token: InjectionToken<unknown>): boolean {
    return this.findRegistration(token) !== undefined;
  }

  /**
   * Create a child scope that inherits parent registrations
   * @returns A new child container
   */
  createChildScope(): DependencyContainer {
    return new DependencyContainer(this);
  }

  /**
   * Freeze the container to prevent further registrations
   */
  freeze(): void {
    this.frozen = true;
  }

  /**
   * Check if the container is frozen
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  private findRegistration<T>(token: InjectionToken<T>): Registration<T> | undefined {
    const registration = this.registrations.get(token);
    if (registration) {
      // Type safety is guaranteed by register<T> pairing InjectionToken<T> with Registration<T>
      return registration as Registration<T>;
    }
    return this.parent?.findRegistration(token);
  }
}
