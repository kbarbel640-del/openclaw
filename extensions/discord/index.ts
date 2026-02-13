import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { z } from "zod";
import { discordPlugin } from "./src/channel.js";
import {
  setDiscordRuntime,
  setDiscordVoiceProvider,
  getDiscordVoiceProvider,
  setDiscordVoiceStateListener,
} from "./src/runtime.js";
import {
  DiscordVoiceProvider,
  DiscordVoiceConfigSchema,
  resolveVoiceConfigFromPluginConfig,
  resolveGroqApiKey,
  DiscordVoiceStateListener,
  VoiceSessionOrchestrator,
} from "./src/voice/index.js";

const DiscordPluginConfigSchema = z
  .object({
    voice: DiscordVoiceConfigSchema.optional(),
  })
  .passthrough();
// registerDiscordListener is called from src/discord/monitor/provider.ts
// where the Carbon client is available.

const plugin = {
  id: "discord",
  name: "Discord",
  description: "Discord channel plugin with voice support",
  configSchema: DiscordPluginConfigSchema,
  register(api: OpenClawPluginApi) {
    setDiscordRuntime(api.runtime);
    api.registerChannel({ plugin: discordPlugin });

    // Initialize voice provider from plugin config
    const voiceConfig = resolveVoiceConfigFromPluginConfig(api.pluginConfig);
    if (voiceConfig.enabled) {
      const voiceProvider = new DiscordVoiceProvider(voiceConfig);
      setDiscordVoiceProvider(voiceProvider);

      voiceProvider.on("error", (session, error) => {
        api.logger.error(`[voice] Error in guild ${session.guildId}: ${error.message}`);
      });

      // Register voice commands
      api.registerCommand({
        name: "voice-join",
        description: "Join a Discord voice channel",
        acceptsArgs: true,
        handler: async (ctx) => {
          const provider = getDiscordVoiceProvider();
          if (!provider) {
            return { text: "Voice provider is not enabled." };
          }
          const args = ctx.args?.trim() ?? "";
          const [guildId, channelId] = args.split(/\s+/);
          if (!guildId || !channelId) {
            return { text: "Usage: /voice-join <guildId> <channelId>" };
          }
          try {
            const session = await provider.joinChannel({ guildId, channelId });
            await provider.startListening(guildId);
            return {
              text: `Joined voice channel ${session.channelId} in guild ${session.guildId} (session: ${session.sessionId})`,
            };
          } catch (err) {
            return { text: `Failed to join: ${err instanceof Error ? err.message : String(err)}` };
          }
        },
      });

      api.registerCommand({
        name: "voice-leave",
        description: "Leave the current Discord voice channel",
        acceptsArgs: true,
        handler: async (ctx) => {
          const provider = getDiscordVoiceProvider();
          if (!provider) {
            return { text: "Voice provider is not enabled." };
          }
          const guildId = ctx.args?.trim();
          if (!guildId) {
            return { text: "Usage: /voice-leave <guildId>" };
          }
          try {
            await provider.leaveChannel({ guildId, reason: "user" });
            return { text: `Left voice channel in guild ${guildId}.` };
          } catch (err) {
            return { text: `Failed to leave: ${err instanceof Error ? err.message : String(err)}` };
          }
        },
      });

      api.registerCommand({
        name: "voice-status",
        description: "Show voice channel status",
        acceptsArgs: true,
        handler: (ctx) => {
          const provider = getDiscordVoiceProvider();
          if (!provider) {
            return { text: "Voice provider is not enabled." };
          }
          const guildId = ctx.args?.trim() || undefined;
          const status = provider.getStatus(guildId);
          return { text: JSON.stringify(status, null, 2) };
        },
      });

      // Initialize voice transcription orchestrator if Groq API key is available
      const groqApiKey = resolveGroqApiKey(voiceConfig);
      let orchestrator: VoiceSessionOrchestrator | undefined;
      let voiceStateListener: DiscordVoiceStateListener | undefined;

      if (groqApiKey && voiceConfig.autoJoin) {
        voiceStateListener = new DiscordVoiceStateListener({
          callbacks: {
            onUserJoined: (guildId, userId, channelId) => {
              void orchestrator?.onUserJoined(guildId, userId, channelId);
            },
            onUserLeft: (guildId, userId, channelId) => {
              void orchestrator?.onUserLeft(guildId, userId, channelId);
            },
          },
        });

        orchestrator = new VoiceSessionOrchestrator({
          voiceConfig,
          provider: voiceProvider,
          voiceStateListener,
        });

        // Store the listener so src/discord/monitor/provider.ts can register
        // it with the Carbon client (where registerDiscordListener is called).
        setDiscordVoiceStateListener(voiceStateListener);

        api.logger.info(
          `[voice] Auto-join transcription enabled${voiceConfig.transcriptionChannelId ? ` (thread channel: ${voiceConfig.transcriptionChannelId})` : ""}`,
        );
      } else if (!groqApiKey && voiceConfig.autoJoin) {
        api.logger.warn(
          "[voice] autoJoin is enabled but GROQ_API_KEY is missing — transcription disabled",
        );
      }

      // Clean up voice provider when the gateway stops
      api.on("gateway_stop", () => {
        orchestrator?.destroy();
        voiceStateListener?.destroy();
        setDiscordVoiceStateListener(null);
        const provider = getDiscordVoiceProvider();
        if (provider) {
          provider.destroy();
          setDiscordVoiceProvider(null);
        }
      });
    }
  },
};

export default plugin;
