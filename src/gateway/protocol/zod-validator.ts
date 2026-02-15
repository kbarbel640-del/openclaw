/**
 * Zod-based validator with AJV-compatible interface.
 *
 * Provides a drop-in replacement for `ajv.compile()` so that existing
 * gateway code using `validate(data) => boolean` + `.errors` keeps working.
 */
import type { z } from "zod";

export interface AjvLikeError {
  keyword: string;
  instancePath: string;
  message: string;
  params: Record<string, unknown>;
}

export type ValidateFn<T> = {
  (data: unknown): data is T;
  errors: AjvLikeError[] | null;
};

/**
 * Create an AJV-compatible validator from a Zod schema.
 *
 * Usage mirrors the previous `ajv.compile<T>(Schema)` pattern:
 * ```
 * export const validateFoo = createValidator<Foo>(FooSchema);
 * if (!validateFoo(data)) {
 *   const msg = formatValidationErrors(validateFoo.errors);
 * }
 * ```
 */
export function createValidator<T>(schema: z.ZodType<T>): ValidateFn<T> {
  const fn = function validate(data: unknown): data is T {
    const result = schema.safeParse(data);
    if (result.success) {
      fn.errors = null;
      return true;
    }
    fn.errors = result.error.issues.map((issue) => ({
      keyword: issue.code,
      instancePath: issue.path.length > 0 ? `/${issue.path.join("/")}` : "",
      message: issue.message,
      params: "unionErrors" in issue ? { unionErrors: issue.unionErrors } : {},
    }));
    return false;
  } as ValidateFn<T>;
  fn.errors = null;
  return fn;
}
