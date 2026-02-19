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

export const EvidenceRunParamsSchema = Type.Object({});
export const EvidenceStatusParamsSchema = Type.Object({});
