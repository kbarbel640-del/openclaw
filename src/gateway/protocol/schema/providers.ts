/**
 * Protocol schemas for providers endpoints.
 */

import { z } from "zod";
import { NonEmptyString } from "./primitives.js";

// Token validity enum
export const TokenValiditySchema = z.enum(["valid", "expiring", "expired", "unknown"]);

// Provider status schema
export const ProviderStatusSchema = z
  .object({
    id: NonEmptyString,
    name: NonEmptyString,
    detected: z.boolean(),
    authSource: z.enum(["env", "auth-profile", "aws-sdk", "config", "oauth"]).nullable(),
    authDetail: z.string().optional(),
    baseUrl: z.string().optional(),
    authMode: z.enum(["api-key", "oauth", "token", "aws-sdk", "mixed", "unknown"]).optional(),
    error: z.string().optional(),
    tokenValidity: TokenValiditySchema.optional(),
    tokenExpiresAt: z.string().optional(),
    tokenExpiresIn: z.string().optional(),
    lastUsed: z.string().optional(),
    inCooldown: z.boolean().optional(),
    cooldownEndsAt: z.string().optional(),
  })
  .strict();

// Usage period enum
export const UsagePeriodSchema = z.enum(["today", "week", "month", "all"]);

// Provider usage schema
export const ProviderUsageSchema = z
  .object({
    providerId: NonEmptyString,
    modelId: NonEmptyString,
    period: UsagePeriodSchema,
    requests: z.number().int().min(0),
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    cacheReadTokens: z.number().int().min(0).optional(),
    cacheWriteTokens: z.number().int().min(0).optional(),
    estimatedCost: z.number(),
    lastUsed: z.string().optional(),
  })
  .strict();

// Usage totals schema
export const UsageTotalsSchema = z
  .object({
    requests: z.number().int().min(0),
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    cacheReadTokens: z.number().int().min(0).optional(),
    cacheWriteTokens: z.number().int().min(0).optional(),
    estimatedCost: z.number(),
  })
  .strict();

// providers.list params/result
export const ProvidersListParamsSchema = z
  .object({
    all: z.boolean().optional(),
    providerId: NonEmptyString.optional(),
  })
  .strict();

export const ProvidersListResultSchema = z
  .object({
    providers: z.array(ProviderStatusSchema),
  })
  .strict();

// providers.usage params/result
export const ProvidersUsageParamsSchema = z
  .object({
    period: UsagePeriodSchema.optional(),
    providerId: NonEmptyString.optional(),
    modelId: NonEmptyString.optional(),
  })
  .strict();

export const ProvidersUsageResultSchema = z
  .object({
    usage: z.array(ProviderUsageSchema),
    totals: UsageTotalsSchema,
    period: UsagePeriodSchema,
  })
  .strict();

// Type exports
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type UsagePeriod = z.infer<typeof UsagePeriodSchema>;
export type ProviderUsage = z.infer<typeof ProviderUsageSchema>;
export type UsageTotals = z.infer<typeof UsageTotalsSchema>;
export type ProvidersListParams = z.infer<typeof ProvidersListParamsSchema>;
export type ProvidersListResult = z.infer<typeof ProvidersListResultSchema>;
export type ProvidersUsageParams = z.infer<typeof ProvidersUsageParamsSchema>;
export type ProvidersUsageResult = z.infer<typeof ProvidersUsageResultSchema>;
