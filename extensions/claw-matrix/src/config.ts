import { z } from "zod";

export const MatrixConfigSchema = z.object({
  enabled: z.boolean().default(true),
  homeserver: z
    .string()
    .url()
    .refine((s) => s.startsWith("https://"), { message: "Must be HTTPS" })
    .transform((s) => s.replace(/\/+$/, "")),
  userId: z
    .string()
    .regex(/^@[\w.-]+:[\w.-]+$/, "Must be @user:domain format"),
  accessToken: z.string().min(1),
  password: z.string().optional(),
  encryption: z.boolean().default(true),
  deviceName: z.string().default("OpenClaw"),
  dm: z
    .object({
      policy: z
        .enum(["pairing", "allowlist", "open", "disabled"])
        .default("allowlist"),
      allowFrom: z.array(z.string()).default([]),
    })
    .default(() => ({ policy: "allowlist" as const, allowFrom: [] })),
  groupPolicy: z
    .enum(["allowlist", "open", "disabled"])
    .default("allowlist"),
  groups: z
    .record(z.string(),
      z.object({
        allow: z.boolean().default(true),
        requireMention: z.boolean().default(false),
      })
    )
    .default({}),
  groupAllowFrom: z.array(z.string()).default([]),
  chunkMode: z.enum(["length", "paragraph"]).default("length"),
  textChunkLimit: z.number().default(4096),
  recoveryKey: z.string().optional(),
  trustMode: z.enum(["tofu", "strict"]).default("tofu"),
});

export type MatrixConfig = z.infer<typeof MatrixConfigSchema>;

export interface ResolvedMatrixAccount {
  accountId: string;
  enabled: boolean;
  homeserver: string;
  userId: string;
  accessToken: string;
  password?: string;
  encryption: boolean;
  deviceName: string;
  dm: { policy: string; allowFrom: string[] };
  groupPolicy: string;
  groups: Record<string, { allow: boolean; requireMention: boolean }>;
  groupAllowFrom: string[];
  chunkMode: string;
  textChunkLimit: number;
  recoveryKey?: string;
  trustMode: string;
}

/**
 * Resolve Matrix account config from OpenClaw config.
 * Reads from channels.matrix in openclaw.json.
 *
 * Uses Zod schema for validation and defaults. Falls back to manual
 * extraction only if Zod parse fails (e.g., self-signed HTTPS URLs
 * that fail the URL validator).
 */
export function resolveMatrixAccount(
  cfg: unknown,
  accountId?: string | null
): ResolvedMatrixAccount {
  const matrixCfg = (cfg as any)?.channels?.matrix ?? {};

  // Try Zod parse first for proper validation + defaults
  const parseResult = MatrixConfigSchema.safeParse(matrixCfg);
  if (parseResult.success) {
    const parsed = parseResult.data;
    return {
      accountId: accountId ?? "default",
      enabled: parsed.enabled,
      homeserver: parsed.homeserver,
      userId: parsed.userId,
      accessToken: parsed.accessToken,
      password: parsed.password,
      encryption: parsed.encryption,
      deviceName: parsed.deviceName,
      dm: parsed.dm,
      groupPolicy: parsed.groupPolicy,
      groups: parsed.groups,
      groupAllowFrom: parsed.groupAllowFrom,
      chunkMode: parsed.chunkMode,
      textChunkLimit: parsed.textChunkLimit,
      recoveryKey: parsed.recoveryKey,
      trustMode: parsed.trustMode,
    };
  }

  // Fallback: manual extraction (for configs that fail strict validation)
  return {
    accountId: accountId ?? "default",
    enabled: matrixCfg.enabled !== false,
    homeserver: (matrixCfg.homeserver ?? "").replace(/\/+$/, ""),
    userId: matrixCfg.userId ?? "",
    accessToken: matrixCfg.accessToken ?? "",
    password: matrixCfg.password,
    encryption: matrixCfg.encryption !== false,
    deviceName: matrixCfg.deviceName ?? "OpenClaw",
    dm: {
      policy: matrixCfg.dm?.policy ?? "allowlist",
      allowFrom: matrixCfg.dm?.allowFrom ?? [],
    },
    groupPolicy: matrixCfg.groupPolicy ?? "allowlist",
    groups: matrixCfg.groups ?? {},
    groupAllowFrom: matrixCfg.groupAllowFrom ?? [],
    chunkMode: matrixCfg.chunkMode ?? "length",
    textChunkLimit: matrixCfg.textChunkLimit ?? 4096,
    recoveryKey: matrixCfg.recoveryKey,
    trustMode: matrixCfg.trustMode ?? "tofu",
  };
}
