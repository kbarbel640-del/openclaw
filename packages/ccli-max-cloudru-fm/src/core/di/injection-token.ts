/**
 * Type-safe injection token for DI container
 * @template T The type of value this token represents
 */
export class InjectionToken<T> {
  constructor(public readonly description: string) {}

  /** Type brand — never used at runtime */
  readonly _type!: T;
}
