import { z } from "zod";

export const ProjectsListParamsSchema = z
  .object({
    search: z.string().optional(),
    limit: z.number().int().min(1).optional(),
    rootDir: z.string().optional(),
    includeHidden: z.boolean().optional(),
  })
  .strict();
