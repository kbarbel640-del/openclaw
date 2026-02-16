import { z } from "zod";

export type SkillScaffoldInvariantSpecV1 =
  | { id: "no_placeholders"; params?: { tokens?: string[] } }
  | { id: "max_length"; params: { field: string; max: number } };

export type SkillScaffoldManifestV1 = {
  version: 1;
  scaffolds: {
    executor: "g-v-p";
    budgets: {
      maxLlmCalls: number;
      maxRetries: number;
    };
    output: {
      answerField: string;
      // JSON Schema (draft-agnostic passthrough)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schema: any;
      invariants: SkillScaffoldInvariantSpecV1[];
    };
  };
};

const InvariantSchema = z
  .union([
    z
      .object({
        id: z.literal("no_placeholders"),
        params: z
          .object({
            tokens: z.array(z.string()).optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    z
      .object({
        id: z.literal("max_length"),
        params: z
          .object({
            field: z.string().min(1),
            max: z.number().int().positive(),
          })
          .strict(),
      })
      .strict(),
  ])
  .describe("Skill scaffold invariant");

const BudgetsSchema = z
  .object({
    maxLlmCalls: z.number().int().positive(),
    maxRetries: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((val, ctx) => {
    // Phase 1 algorithm: 1 generate + up to maxRetries patch calls
    if (val.maxLlmCalls < 1 + val.maxRetries) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "budgets.maxLlmCalls must be >= 1 + budgets.maxRetries",
        path: ["maxLlmCalls"],
      });
    }
  });

const SkillScaffoldManifestV1Schema = z
  .object({
    version: z.literal(1),
    scaffolds: z
      .object({
        executor: z.literal("g-v-p"),
        budgets: BudgetsSchema,
        output: z
          .object({
            answerField: z.string().min(1),
            schema: z.unknown(),
            invariants: z.array(InvariantSchema),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export function parseSkillScaffoldManifestV1(value: unknown): SkillScaffoldManifestV1 {
  // Fail-closed: no coercion, strict objects only.
  return SkillScaffoldManifestV1Schema.parse(value) as SkillScaffoldManifestV1;
}
