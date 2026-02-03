/**
 * Protocol schemas for providers endpoints.
 */

import { Type, type Static } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

// Token validity enum
export const TokenValiditySchema = Type.Union([
  Type.Literal("valid"),
  Type.Literal("expiring"),
  Type.Literal("expired"),
  Type.Literal("unknown"),
]);

// Provider status schema
export const ProviderStatusSchema = Type.Object(
  {
    id: NonEmptyString,
    name: NonEmptyString,
    detected: Type.Boolean(),
    authSource: Type.Union([
      Type.Literal("env"),
      Type.Literal("auth-profile"),
      Type.Literal("aws-sdk"),
      Type.Literal("config"),
      Type.Literal("oauth"),
      Type.Null(),
    ]),
    authDetail: Type.Optional(Type.String()),
    baseUrl: Type.Optional(Type.String()),
    authMode: Type.Optional(
      Type.Union([
        Type.Literal("api-key"),
        Type.Literal("oauth"),
        Type.Literal("token"),
        Type.Literal("aws-sdk"),
        Type.Literal("mixed"),
        Type.Literal("unknown"),
      ]),
    ),
    error: Type.Optional(Type.String()),
    tokenValidity: Type.Optional(TokenValiditySchema),
    tokenExpiresAt: Type.Optional(Type.String()),
    tokenExpiresIn: Type.Optional(Type.String()),
    lastUsed: Type.Optional(Type.String()),
    inCooldown: Type.Optional(Type.Boolean()),
    cooldownEndsAt: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

// Usage period enum
export const UsagePeriodSchema = Type.Union([
  Type.Literal("today"),
  Type.Literal("week"),
  Type.Literal("month"),
  Type.Literal("all"),
]);

// Provider usage schema
export const ProviderUsageSchema = Type.Object(
  {
    providerId: NonEmptyString,
    modelId: NonEmptyString,
    period: UsagePeriodSchema,
    requests: Type.Integer({ minimum: 0 }),
    inputTokens: Type.Integer({ minimum: 0 }),
    outputTokens: Type.Integer({ minimum: 0 }),
    cacheReadTokens: Type.Optional(Type.Integer({ minimum: 0 })),
    cacheWriteTokens: Type.Optional(Type.Integer({ minimum: 0 })),
    estimatedCost: Type.Number(),
    lastUsed: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

// Usage totals schema
export const UsageTotalsSchema = Type.Object(
  {
    requests: Type.Integer({ minimum: 0 }),
    inputTokens: Type.Integer({ minimum: 0 }),
    outputTokens: Type.Integer({ minimum: 0 }),
    cacheReadTokens: Type.Optional(Type.Integer({ minimum: 0 })),
    cacheWriteTokens: Type.Optional(Type.Integer({ minimum: 0 })),
    estimatedCost: Type.Number(),
  },
  { additionalProperties: false },
);

// providers.list params/result
export const ProvidersListParamsSchema = Type.Object(
  {
    all: Type.Optional(Type.Boolean()),
    providerId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ProvidersListResultSchema = Type.Object(
  {
    providers: Type.Array(ProviderStatusSchema),
  },
  { additionalProperties: false },
);

// providers.usage params/result
export const ProvidersUsageParamsSchema = Type.Object(
  {
    period: Type.Optional(UsagePeriodSchema),
    providerId: Type.Optional(NonEmptyString),
    modelId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ProvidersUsageResultSchema = Type.Object(
  {
    usage: Type.Array(ProviderUsageSchema),
    totals: UsageTotalsSchema,
    period: UsagePeriodSchema,
  },
  { additionalProperties: false },
);

// Type exports
export type ProviderStatus = Static<typeof ProviderStatusSchema>;
export type UsagePeriod = Static<typeof UsagePeriodSchema>;
export type ProviderUsage = Static<typeof ProviderUsageSchema>;
export type UsageTotals = Static<typeof UsageTotalsSchema>;
export type ProvidersListParams = Static<typeof ProvidersListParamsSchema>;
export type ProvidersListResult = Static<typeof ProvidersListResultSchema>;
export type ProvidersUsageParams = Static<typeof ProvidersUsageParamsSchema>;
export type ProvidersUsageResult = Static<typeof ProvidersUsageResultSchema>;
