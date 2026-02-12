import { z } from "zod";

export const SectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  text: z.string(),
  tags: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  examples: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ResearchDocSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  sections: z.array(SectionSchema),
  template: z.string().optional(),
  provenance: z
    .object({
      method: z.enum(["headings", "heuristic", "llm"]),
      tool: z.string().optional(),
      cacheKey: z.string().optional(),
    })
    .optional(),
  schemaVersion: z.literal("research.v1"),
});

export type Section = z.infer<typeof SectionSchema>;
export type ResearchDoc = z.infer<typeof ResearchDocSchema>;
