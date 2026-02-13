/**
 * Unit tests for DependencyContainer
 *
 * London School TDD: all external collaborators are mocked.
 * The DI container itself has no external dependencies, so these
 * are pure behavioural tests against the public API.
 */

import { describe, it, expect, vi } from 'vitest';
import { DependencyContainer } from '../../../src/core/di/container.js';
import { InjectionToken } from '../../../src/core/di/injection-token.js';
import { NotRegisteredError } from '../../../src/core/di/container-errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convenience factory for typed tokens scoped to each test */
function token<T>(name: string): InjectionToken<T> {
  return new InjectionToken<T>(name);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DependencyContainer', () => {
  // -----------------------------------------------------------------------
  // register() + resolve()
  // -----------------------------------------------------------------------
  describe('register() + resolve()', () => {
    it('should register a value and resolve it', () => {
      const container = new DependencyContainer();
      const TOKEN = token<string>('Greeting');
      const factory = vi.fn(() => 'hello');

      container.register(TOKEN, factory);

      const result = container.resolve(TOKEN);

      expect(result).toBe('hello');
    });

    it('should resolve to the same singleton instance on repeated calls', () => {
      const container = new DependencyContainer();
      const TOKEN = token<{ id: number }>('Obj');

      container.register(TOKEN, () => ({ id: 42 }));

      const first = container.resolve(TOKEN);
      const second = container.resolve(TOKEN);

      expect(first).toBe(second); // reference equality
    });

    it('should create a new instance each time when singleton is false', () => {
      const container = new DependencyContainer();
      const TOKEN = token<{ id: number }>('Transient');

      container.register(TOKEN, () => ({ id: Math.random() }), {
        singleton: false,
      });

      const first = container.resolve(TOKEN);
      const second = container.resolve(TOKEN);

      expect(first).not.toBe(second);
    });
  });

  // -----------------------------------------------------------------------
  // register() - factory invocation timing
  // -----------------------------------------------------------------------
  describe('register() - factory behaviour', () => {
    it('should call the factory function only on resolve, not on register', () => {
      const container = new DependencyContainer();
      const TOKEN = token<number>('Lazy');
      const factory = vi.fn(() => 99);

      container.register(TOKEN, factory);

      expect(factory).not.toHaveBeenCalled();

      container.resolve(TOKEN);

      expect(factory).toHaveBeenCalledOnce();
    });

    it('should call singleton factory only once across multiple resolves', () => {
      const container = new DependencyContainer();
      const TOKEN = token<string>('SingletonFactory');
      const factory = vi.fn(() => 'value');

      container.register(TOKEN, factory);

      container.resolve(TOKEN);
      container.resolve(TOKEN);
      container.resolve(TOKEN);

      expect(factory).toHaveBeenCalledOnce();
    });

    it('should call transient factory on every resolve', () => {
      const container = new DependencyContainer();
      const TOKEN = token<string>('TransientFactory');
      const factory = vi.fn(() => 'value');

      container.register(TOKEN, factory, { singleton: false });

      container.resolve(TOKEN);
      container.resolve(TOKEN);
      container.resolve(TOKEN);

      expect(factory).toHaveBeenCalledTimes(3);
    });
  });

  // -----------------------------------------------------------------------
  // register() on frozen container
  // -----------------------------------------------------------------------
  describe('register() on a frozen container', () => {
    it('should throw an Error when registering after freeze()', () => {
      const container = new DependencyContainer();
      container.freeze();

      const TOKEN = token<string>('Late');

      expect(() => container.register(TOKEN, () => 'nope')).toThrow(
        'Container is frozen. Cannot register new providers.'
      );
    });

    it('should throw an Error that is a plain Error (not a custom subclass)', () => {
      const container = new DependencyContainer();
      container.freeze();

      const TOKEN = token<string>('Late');

      expect(() => container.register(TOKEN, () => 'nope')).toThrow(Error);
    });
  });

  // -----------------------------------------------------------------------
  // resolve() with unregistered token
  // -----------------------------------------------------------------------
  describe('resolve() with unregistered token', () => {
    it('should throw NotRegisteredError for an unknown token', () => {
      const container = new DependencyContainer();
      const TOKEN = token<string>('Unknown');

      expect(() => container.resolve(TOKEN)).toThrow(NotRegisteredError);
    });

    it('should include the token description in the error message', () => {
      const container = new DependencyContainer();
      const TOKEN = token<string>('MyService');

      expect(() => container.resolve(TOKEN)).toThrow(
        'No provider registered for token: MyService'
      );
    });

    it('should expose the token description on the error object', () => {
      const container = new DependencyContainer();
      const TOKEN = token<string>('SomeToken');

      try {
        container.resolve(TOKEN);
        expect.unreachable('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(NotRegisteredError);
        expect((e as NotRegisteredError).token).toBe('SomeToken');
      }
    });
  });

  // -----------------------------------------------------------------------
  // freeze()
  // -----------------------------------------------------------------------
  describe('freeze()', () => {
    it('should prevent further registrations', () => {
      const container = new DependencyContainer();
      const TOKEN_A = token<string>('A');
      const TOKEN_B = token<string>('B');

      container.register(TOKEN_A, () => 'a');
      container.freeze();

      expect(() => container.register(TOKEN_B, () => 'b')).toThrow();
    });

    it('should still allow resolving previously registered tokens', () => {
      const container = new DependencyContainer();
      const TOKEN = token<number>('Num');

      container.register(TOKEN, () => 42);
      container.freeze();

      expect(container.resolve(TOKEN)).toBe(42);
    });

    it('should report isFrozen() as true after freezing', () => {
      const container = new DependencyContainer();

      expect(container.isFrozen()).toBe(false);

      container.freeze();

      expect(container.isFrozen()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // has()
  // -----------------------------------------------------------------------
  describe('has()', () => {
    it('should return true for a registered token', () => {
      const container = new DependencyContainer();
      const TOKEN = token<string>('Exists');

      container.register(TOKEN, () => 'yes');

      expect(container.has(TOKEN)).toBe(true);
    });

    it('should return false for an unregistered token', () => {
      const container = new DependencyContainer();
      const TOKEN = token<string>('Missing');

      expect(container.has(TOKEN)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // createChildScope() - child inherits parent registrations
  // -----------------------------------------------------------------------
  describe('createChildScope() - inheritance', () => {
    it('should resolve tokens registered in the parent', () => {
      const parent = new DependencyContainer();
      const TOKEN = token<string>('Inherited');

      parent.register(TOKEN, () => 'from-parent');

      const child = parent.createChildScope();

      expect(child.resolve(TOKEN)).toBe('from-parent');
    });

    it('should report has() as true for parent tokens', () => {
      const parent = new DependencyContainer();
      const TOKEN = token<number>('ParentNum');

      parent.register(TOKEN, () => 7);

      const child = parent.createChildScope();

      expect(child.has(TOKEN)).toBe(true);
    });

    it('should resolve grandparent registrations through chained scopes', () => {
      const grandparent = new DependencyContainer();
      const TOKEN = token<string>('Deep');

      grandparent.register(TOKEN, () => 'deep-value');

      const parent = grandparent.createChildScope();
      const child = parent.createChildScope();

      expect(child.resolve(TOKEN)).toBe('deep-value');
    });
  });

  // -----------------------------------------------------------------------
  // createChildScope() - child can override parent registrations
  // -----------------------------------------------------------------------
  describe('createChildScope() - overrides', () => {
    it('should resolve the child registration when it overrides the parent', () => {
      const parent = new DependencyContainer();
      const TOKEN = token<string>('Overridden');

      parent.register(TOKEN, () => 'parent-value');

      const child = parent.createChildScope();
      child.register(TOKEN, () => 'child-value');

      expect(child.resolve(TOKEN)).toBe('child-value');
    });

    it('should use child factory, not parent factory, after override', () => {
      const parent = new DependencyContainer();
      const TOKEN = token<string>('FactoryCheck');

      const parentFactory = vi.fn(() => 'parent');
      const childFactory = vi.fn(() => 'child');

      parent.register(TOKEN, parentFactory);

      const child = parent.createChildScope();
      child.register(TOKEN, childFactory);

      child.resolve(TOKEN);

      expect(childFactory).toHaveBeenCalledOnce();
      expect(parentFactory).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // createChildScope() - child does not affect parent
  // -----------------------------------------------------------------------
  describe('createChildScope() - isolation', () => {
    it('should not expose child registrations to the parent', () => {
      const parent = new DependencyContainer();
      const CHILD_TOKEN = token<string>('ChildOnly');

      const child = parent.createChildScope();
      child.register(CHILD_TOKEN, () => 'child-only');

      expect(parent.has(CHILD_TOKEN)).toBe(false);
      expect(() => parent.resolve(CHILD_TOKEN)).toThrow(NotRegisteredError);
    });

    it('should not mutate parent singleton when child overrides same token', () => {
      const parent = new DependencyContainer();
      const TOKEN = token<string>('Shared');

      parent.register(TOKEN, () => 'parent-value');

      const child = parent.createChildScope();
      child.register(TOKEN, () => 'child-value');

      // Parent still resolves its own value
      expect(parent.resolve(TOKEN)).toBe('parent-value');
      // Child resolves its override
      expect(child.resolve(TOKEN)).toBe('child-value');
    });
  });

  // -----------------------------------------------------------------------
  // Multiple registrations - last one wins
  // -----------------------------------------------------------------------
  describe('multiple registrations', () => {
    it('should resolve to the last registered factory for a given token', () => {
      const container = new DependencyContainer();
      const TOKEN = token<string>('Replaced');

      container.register(TOKEN, () => 'first');
      container.register(TOKEN, () => 'second');
      container.register(TOKEN, () => 'third');

      expect(container.resolve(TOKEN)).toBe('third');
    });

    it('should not call earlier factories when the latest one is resolved', () => {
      const container = new DependencyContainer();
      const TOKEN = token<number>('Overwritten');

      const firstFactory = vi.fn(() => 1);
      const secondFactory = vi.fn(() => 2);

      container.register(TOKEN, firstFactory);
      container.register(TOKEN, secondFactory);

      container.resolve(TOKEN);

      expect(firstFactory).not.toHaveBeenCalled();
      expect(secondFactory).toHaveBeenCalledOnce();
    });

    it('should reset singleton cache when re-registering', () => {
      const container = new DependencyContainer();
      const TOKEN = token<number>('ReRegister');

      container.register(TOKEN, () => 1);

      // Resolve to cache the singleton
      expect(container.resolve(TOKEN)).toBe(1);

      // Re-register with a new factory
      container.register(TOKEN, () => 2);

      expect(container.resolve(TOKEN)).toBe(2);
    });
  });
});
