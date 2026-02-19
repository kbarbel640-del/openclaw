import { Type } from "@sinclair/typebox";

export const EvidenceGateTypeSchema = Type.Union([
  Type.Literal("lsp"),
  Type.Literal("build"),
  Type.Literal("test"),
  Type.Literal("custom"),
]);

export const EvidenceGateSchema = Type.Object({
  type: EvidenceGateTypeSchema,
  enabled: Type.Boolean(),
  command: Type.Optional(Type.String()),
  required: Type.Optional(Type.Boolean()),
  timeoutMs: Type.Optional(Type.Integer({ minimum: 1000 })),
});

export const EvidenceConfigSchema = Type.Object({
  enabled: Type.Boolean(),
  gates: Type.Array(EvidenceGateSchema),
  failOnError: Type.Optional(Type.Boolean()),
});

export type EvidenceGateType = "lsp" | "build" | "test" | "custom";

export interface EvidenceConfig {
  enabled?: boolean;
  gates: EvidenceGate[];
  failOnError?: boolean;
}

export interface EvidenceGate {
  type: EvidenceGateType;
  enabled?: boolean;
  command?: string;
  required?: boolean;
  timeoutMs?: number;
}

export interface VerificationResult {
  type: EvidenceGateType;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  timestamp: number;
}
