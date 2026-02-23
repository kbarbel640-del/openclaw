import { z } from "zod";

export const AgentModelRoutingSchema = z
  .object({
    strategy: z.string(),
    options: z.record(z.string(), z.unknown()).optional(),
    bypass: z
      .object({
        onExplicitModel: z.boolean().optional(),
        onHeartbeat: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const AgentModelSchema = z.union([
  z.string(),
  z
    .object({
      primary: z.string().optional(),
      fallbacks: z.array(z.string()).optional(),
      routing: AgentModelRoutingSchema.optional(),
    })
    .strict(),
]);
