import { z } from "zod";

export const FsPickDirectoryParamsSchema = z
  .object({
    prompt: z.string().optional(),
    defaultDir: z.string().optional(),
  })
  .strict();
