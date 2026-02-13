import { z } from "zod";

export const DiscordVoiceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoJoinChannels: z.array(z.string()).optional(),
  transcriptionEnabled: z.boolean().default(true),
  ttsEnabled: z.boolean().default(true),
  silenceTimeoutMs: z.number().min(500).max(30000).default(2000),
  maxRecordingDurationMs: z.number().min(10000).max(3600000).optional(),
  audioConfig: z
    .object({
      sampleRate: z.number().default(48000),
      channels: z.number().min(1).max(2).default(2),
      bitrate: z.number().min(16).max(128).default(64),
    })
    .optional(),
  groqApiKey: z.string().optional(),
  transcriptionChannelId: z.string().optional(),
  whisperModel: z.string().default("whisper-large-v3-turbo"),
  summarizationModel: z.string().default("llama-3.3-70b-versatile"),
  autoJoin: z.boolean().default(false),
  autoJoinGuilds: z.array(z.string()).optional(),
});

export type DiscordVoiceConfig = z.infer<typeof DiscordVoiceConfigSchema>;

export const DEFAULT_DISCORD_VOICE_CONFIG: DiscordVoiceConfig = {
  enabled: true,
  transcriptionEnabled: true,
  ttsEnabled: true,
  silenceTimeoutMs: 2000,
  whisperModel: "whisper-large-v3-turbo",
  summarizationModel: "llama-3.3-70b-versatile",
  autoJoin: false,
};

export function parseDiscordVoiceConfig(value: unknown): DiscordVoiceConfig {
  return DiscordVoiceConfigSchema.parse(value ?? {});
}

export function mergeVoiceConfig(
  base: DiscordVoiceConfig,
  override: Partial<DiscordVoiceConfig>,
): DiscordVoiceConfig {
  const merged = {
    ...base,
    ...override,
  };
  if (base.audioConfig || override.audioConfig) {
    merged.audioConfig = {
      ...base.audioConfig,
      ...override.audioConfig,
    } as DiscordVoiceConfig["audioConfig"];
  }
  return merged;
}

export function resolveVoiceConfigFromPluginConfig(
  pluginConfig: Record<string, unknown> | undefined,
): DiscordVoiceConfig {
  if (!pluginConfig?.voice || typeof pluginConfig.voice !== "object") {
    return DEFAULT_DISCORD_VOICE_CONFIG;
  }
  return parseDiscordVoiceConfig(pluginConfig.voice);
}

/** Resolve the Groq API key from config or environment. */
export function resolveGroqApiKey(config: DiscordVoiceConfig): string | undefined {
  return config.groqApiKey || process.env.GROQ_API_KEY || undefined;
}
