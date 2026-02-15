import { z } from "zod";

export type HookAction = "allow" | "deny" | "ask";

export const HookConfigSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  matcher: z.object({
    tool: z.string().optional(), // Regex or exact match
    args: z.record(z.string(), z.string()).optional(), // Key-value regex match
  }),
  action: z.enum(["allow", "deny", "ask"]).default("allow"),
  message: z.string().optional(), // Message to show if denied or asked
  command: z.string().optional(), // Shell command to run (if valid)
});

export type HookConfig = z.infer<typeof HookConfigSchema>;

export const HooksFileSchema = z.object({
  hooks: z.array(HookConfigSchema),
});

export type HooksFile = z.infer<typeof HooksFileSchema>;
