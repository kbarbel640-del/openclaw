/**
 * Branded type utilities for type-safe nominal typing.
 *
 * Branded types allow creating distinct types from the same base type,
 * preventing accidental mixing of semantically different values.
 *
 * @example
 * type UserId = Branded<string, 'UserId'>;
 * type Email = Branded<string, 'Email'>;
 *
 * const userId = brand<string, 'UserId'>('user-123');
 * const email = brand<string, 'Email'>('user@example.com');
 * // userId and email are incompatible despite both being strings
 */

declare const Brand: unique symbol;

/**
 * Brands a base type T with a unique brand identifier B.
 * Creates a nominal type that is distinct from other branded types.
 *
 * @typeParam T - The base type to brand
 * @typeParam B - A unique string literal identifying this branded type
 */
export type Branded<T, B extends string> = T & { readonly [Brand]: B };

/**
 * Creates a branded value from a base value.
 *
 * @param value - The value to brand
 * @returns The same value, branded with type B
 */
export function brand<T, B extends string>(value: T): Branded<T, B> {
  return value as Branded<T, B>;
}
