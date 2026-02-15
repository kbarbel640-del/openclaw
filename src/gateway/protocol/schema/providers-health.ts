/**
 * Protocol schemas for providers.health endpoint.
 */

import { z } from "zod";
import { NonEmptyString } from "./primitives.js";

// Usage window entry (quota per time period)
export const UsageWindowSchema = z
  .object({
    label: z.string(),
    usedPercent: z.number(),
    resetAt: z.number().int().optional(),
  })
  .strict();

// Provider health entry
export const ProviderHealthEntrySchema = z
  .object({
    id: NonEmptyString,
    name: NonEmptyString,
    detected: z.boolean(),
    authSource: z.string().optional(),
    authMode: z.string().optional(),
    tokenValidity: z.string().optional(),
    tokenExpiresAt: z.number().int().optional(),
    tokenRemainingMs: z.number().int().optional(),
    healthStatus: z.string(),
    inCooldown: z.boolean().optional(),
    cooldownRemainingMs: z.number().int().optional(),
    cooldownEndsAt: z.number().int().optional(),
    errorCount: z.number().int().optional(),
    disabledReason: z.string().optional(),
    lastUsed: z.string().optional(),
    usageWindows: z.array(UsageWindowSchema).optional(),
    usagePlan: z.string().optional(),
    usageError: z.string().optional(),
    isLocal: z.boolean().optional(),
    authModes: z.array(z.string()).optional(),
    envVars: z.array(z.string()).optional(),
    configured: z.boolean().optional(),
    oauthAvailable: z.boolean().optional(),
  })
  .strict();

// providers.health params
export const ProvidersHealthParamsSchema = z
  .object({
    all: z.boolean().optional(),
    includeUsage: z.boolean().optional(),
  })
  .strict();

// providers.health result
export const ProvidersHealthResultSchema = z
  .object({
    providers: z.array(ProviderHealthEntrySchema),
    updatedAt: z.number().int(),
  })
  .strict();

// Type exports
export type UsageWindow = z.infer<typeof UsageWindowSchema>;
export type ProviderHealthEntry = z.infer<typeof ProviderHealthEntrySchema>;
export type ProvidersHealthParams = z.infer<typeof ProvidersHealthParamsSchema>;
export type ProvidersHealthResult = z.infer<typeof ProvidersHealthResultSchema>;
