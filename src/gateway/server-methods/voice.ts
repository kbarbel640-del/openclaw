/**
 * Voice mode WebSocket handlers for the gateway.
 *
 * Provides real-time voice interaction endpoints:
 * - voice.status: Check voice capabilities
 * - voice.config: Get/set voice configuration
 * - voice.process: Process audio through full pipeline
 * - voice.processText: Process text (skip STT)
 * - voice.transcribe: STT only
 * - voice.synthesize: TTS only
 */

import { loadConfig } from "../../config/config.js";
import type { VoiceConfig } from "../../config/types.voice.js";
import {
  resolveVoiceConfig,
  checkVoiceCapabilities,
  processVoiceInput,
  processTextToVoice,
} from "../../voice/voice.js";
import { transcribeWithWhisper, resolveWhisperConfig } from "../../voice/local-stt.js";
import { synthesizeWithLocalTts, resolveLocalTtsConfig } from "../../voice/local-tts.js";
import { routeVoiceRequest, resolveRouterConfig } from "../../voice/router.js";
import {
  resolvePersonaPlexConfig,
  isPersonaPlexInstalled,
  isPersonaPlexRunning,
  startPersonaPlexServer,
  stopPersonaPlexServer,
  processWithPersonaPlex,
  getPersonaPlexStatus,
} from "../../voice/personaplex.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

/**
 * Get voice configuration from OpenClaw config.
 */
function getVoiceConfig(): VoiceConfig {
  const cfg = loadConfig();
  return cfg.voice ?? {};
}

export const voiceHandlers: GatewayRequestHandlers = {
  /**
   * Get voice mode status and capabilities.
   */
  "voice.status": async ({ respond }) => {
    try {
      const voiceConfig = getVoiceConfig();
      const config = resolveVoiceConfig(voiceConfig);
      const capabilities = await checkVoiceCapabilities(config);

      respond(true, {
        enabled: config.enabled,
        mode: config.mode,
        sttProvider: config.sttProvider,
        ttsProvider: config.ttsProvider,
        capabilities,
        streaming: config.streaming,
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Get voice configuration.
   */
  "voice.config": async ({ respond }) => {
    try {
      const voiceConfig = getVoiceConfig();
      const config = resolveVoiceConfig(voiceConfig);

      respond(true, {
        mode: config.mode,
        enabled: config.enabled,
        sttProvider: config.sttProvider,
        ttsProvider: config.ttsProvider,
        whisper: {
          modelPath: config.whisper.modelPath,
          language: config.whisper.language,
          threads: config.whisper.threads,
        },
        localTts: {
          useSag: config.localTts.useSag,
          voiceId: config.localTts.voiceId,
          fallbackToMacos: config.localTts.fallbackToMacos,
        },
        router: {
          mode: config.router.mode,
          detectSensitive: config.router.detectSensitive,
          useComplexity: config.router.useComplexity,
          localModel: config.router.localModel,
          complexityThreshold: config.router.complexityThreshold,
        },
        personaplex: {
          enabled: config.personaplex.enabled,
          port: config.personaplex.port,
          useSsl: config.personaplex.useSsl,
          cpuOffload: config.personaplex.cpuOffload,
          voicePrompt: config.personaplex.voicePrompt,
          textPrompt: config.personaplex.textPrompt,
          seed: config.personaplex.seed,
        },
        streaming: config.streaming,
        bufferMs: config.bufferMs,
        maxRecordingSeconds: config.maxRecordingSeconds,
        vadSensitivity: config.vadSensitivity,
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Process audio through full voice pipeline (STT -> Route -> LLM -> TTS).
   *
   * Params:
   * - audio: Base64-encoded audio data (WAV format)
   * - sessionKey: Optional session key for chat context
   */
  "voice.process": async ({ params, respond, context }) => {
    const audioBase64 = typeof params.audio === "string" ? params.audio : "";
    if (!audioBase64) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "voice.process requires audio (base64)"),
      );
      return;
    }

    const sessionKey = typeof params.sessionKey === "string" ? params.sessionKey : "webchat-voice";
    const textPrompt = typeof params.textPrompt === "string" ? params.textPrompt.trim() : "";
    const voicePrompt = typeof params.voicePrompt === "string" ? params.voicePrompt.trim() : "";
    const seed =
      typeof params.seed === "number" && Number.isFinite(params.seed)
        ? Math.trunc(params.seed)
        : undefined;
    const cpuOffload = typeof params.cpuOffload === "boolean" ? params.cpuOffload : undefined;

    try {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const voiceConfig = getVoiceConfig();
      const personaplexOverrides: VoiceConfig["personaplex"] = {
        ...(voiceConfig.personaplex ?? {}),
        ...(textPrompt ? { textPrompt } : {}),
        ...(voicePrompt ? { voicePrompt } : {}),
        ...(seed !== undefined ? { seed } : {}),
        ...(cpuOffload !== undefined ? { cpuOffload } : {}),
      };
      const config = resolveVoiceConfig({
        ...voiceConfig,
        personaplex: personaplexOverrides,
      });

      // LLM invocation that integrates with the chat system
      const llmInvoke = async (text: string, model?: string): Promise<string> => {
        // Use dispatchInboundMessage pattern from chat.ts
        // For now, use a simpler approach via the chat completion system
        const { completeSimple } = await import("@mariozechner/pi-ai");
        const { getApiKeyForModel, requireApiKey } = await import("../../agents/model-auth.js");
        const { resolveDefaultModelForAgent } = await import("../../agents/model-selection.js");
        const { resolveModel } = await import("../../agents/pi-embedded-runner/model.js");

        const cfg = loadConfig();
        const defaultRef = resolveDefaultModelForAgent({ cfg });

        // Use routed model if specified, otherwise use default
        const provider = model?.includes("/") ? model.split("/")[0] : defaultRef.provider;
        const modelName = model?.includes("/") ? model.split("/")[1] : (model ?? defaultRef.model);

        const resolved = resolveModel(provider, modelName, undefined, cfg);
        if (!resolved.model) {
          throw new Error(resolved.error ?? `Unknown model: ${provider}/${modelName}`);
        }

        const apiKey = requireApiKey(
          await getApiKeyForModel({ model: resolved.model, cfg }),
          provider,
        );

        const res = await completeSimple(
          resolved.model,
          {
            messages: [
              {
                role: "user",
                content: text,
                timestamp: Date.now(),
              },
            ],
          },
          {
            apiKey,
            maxTokens: 500, // Keep voice responses concise
            temperature: 0.7,
          },
        );

        // Filter for text content blocks
        const isTextBlock = (block: { type: string }): block is { type: "text"; text: string } =>
          block.type === "text";

        return res.content
          .filter(isTextBlock)
          .map((block) => block.text.trim())
          .filter(Boolean)
          .join(" ")
          .trim();
      };

      const result = await processVoiceInput(audioBuffer, config, llmInvoke);

      if (result.success) {
        respond(true, {
          sessionId: result.sessionId,
          transcription: result.transcription,
          response: result.response,
          audioBase64: result.audioBuffer?.toString("base64"),
          route: result.routerDecision?.route,
          model: result.routerDecision?.model,
          timings: result.timings,
        });
      } else {
        respond(
          false,
          {
            sessionId: result.sessionId,
            transcription: result.transcription,
            timings: result.timings,
          },
          errorShape(ErrorCodes.UNAVAILABLE, result.error ?? "Voice processing failed"),
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Process text through voice pipeline (skip STT).
   *
   * Params:
   * - text: Text to process
   * - sessionKey: Optional session key for chat context
   */
  "voice.processText": async ({ params, respond }) => {
    const text = typeof params.text === "string" ? params.text.trim() : "";
    if (!text) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "voice.processText requires text"),
      );
      return;
    }

    try {
      const voiceConfig = getVoiceConfig();
      const config = resolveVoiceConfig(voiceConfig);

      // LLM invocation using the chat completion system
      const llmInvoke = async (inputText: string, model?: string): Promise<string> => {
        const { completeSimple } = await import("@mariozechner/pi-ai");
        const { getApiKeyForModel, requireApiKey } = await import("../../agents/model-auth.js");
        const { resolveDefaultModelForAgent } = await import("../../agents/model-selection.js");
        const { resolveModel } = await import("../../agents/pi-embedded-runner/model.js");

        const cfg = loadConfig();
        const defaultRef = resolveDefaultModelForAgent({ cfg });

        const provider = model?.includes("/") ? model.split("/")[0] : defaultRef.provider;
        const modelName = model?.includes("/") ? model.split("/")[1] : (model ?? defaultRef.model);

        const resolved = resolveModel(provider, modelName, undefined, cfg);
        if (!resolved.model) {
          throw new Error(resolved.error ?? `Unknown model: ${provider}/${modelName}`);
        }

        const apiKey = requireApiKey(
          await getApiKeyForModel({ model: resolved.model, cfg }),
          provider,
        );

        const res = await completeSimple(
          resolved.model,
          {
            messages: [
              {
                role: "user",
                content: inputText,
                timestamp: Date.now(),
              },
            ],
          },
          {
            apiKey,
            maxTokens: 500,
            temperature: 0.7,
          },
        );

        // Filter for text content blocks
        const isTextBlock = (block: { type: string }): block is { type: "text"; text: string } =>
          block.type === "text";

        return res.content
          .filter(isTextBlock)
          .map((block) => block.text.trim())
          .filter(Boolean)
          .join(" ")
          .trim();
      };

      const result = await processTextToVoice(text, config, llmInvoke);

      if (result.success) {
        respond(true, {
          sessionId: result.sessionId,
          transcription: result.transcription,
          response: result.response,
          audioBase64: result.audioBuffer?.toString("base64"),
          route: result.routerDecision?.route,
          model: result.routerDecision?.model,
          timings: result.timings,
        });
      } else {
        respond(
          false,
          { sessionId: result.sessionId, timings: result.timings },
          errorShape(ErrorCodes.UNAVAILABLE, result.error ?? "Voice processing failed"),
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Transcribe audio using local STT (whisper-cpp).
   *
   * Params:
   * - audio: Base64-encoded audio data
   */
  "voice.transcribe": async ({ params, respond }) => {
    const audioBase64 = typeof params.audio === "string" ? params.audio : "";
    if (!audioBase64) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "voice.transcribe requires audio (base64)"),
      );
      return;
    }

    try {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const voiceConfig = getVoiceConfig();
      const config = resolveWhisperConfig(voiceConfig.whisper);

      const result = await transcribeWithWhisper(audioBuffer, config);

      if (result.success) {
        respond(true, {
          text: result.text,
          model: result.model,
          latencyMs: result.latencyMs,
        });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, result.error ?? "Transcription failed"),
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Synthesize speech from text using local TTS.
   *
   * Params:
   * - text: Text to synthesize
   */
  "voice.synthesize": async ({ params, respond }) => {
    const text = typeof params.text === "string" ? params.text.trim() : "";
    if (!text) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "voice.synthesize requires text"),
      );
      return;
    }

    try {
      const voiceConfig = getVoiceConfig();
      const config = resolveLocalTtsConfig(voiceConfig.localTts);

      const result = await synthesizeWithLocalTts(text, config);

      if (result.success) {
        respond(true, {
          audioBase64: result.audioBuffer?.toString("base64"),
          audioPath: result.audioPath,
          provider: result.provider,
          latencyMs: result.latencyMs,
          warning: result.warning,
        });
      } else {
        respond(
          false,
          { provider: result.provider },
          errorShape(ErrorCodes.UNAVAILABLE, result.error ?? "Speech synthesis failed"),
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Route a text query (for testing routing logic).
   *
   * Params:
   * - text: Text to analyze for routing
   */
  "voice.route": async ({ params, respond }) => {
    const text = typeof params.text === "string" ? params.text.trim() : "";
    if (!text) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "voice.route requires text"),
      );
      return;
    }

    try {
      const voiceConfig = getVoiceConfig();
      const config = resolveRouterConfig(voiceConfig.router);

      const decision = routeVoiceRequest(text, config);

      respond(true, {
        route: decision.route,
        reason: decision.reason,
        sensitiveDetected: decision.sensitiveDetected,
        complexityScore: decision.complexityScore,
        model: decision.model,
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  // ============================================
  // PersonaPlex S2S (Experimental)
  // ============================================

  /**
   * Get PersonaPlex status.
   */
  "voice.personaplex.status": async ({ respond }) => {
    try {
      const voiceConfig = getVoiceConfig();
      const config = resolvePersonaPlexConfig(voiceConfig.personaplex);

      const status = await getPersonaPlexStatus(config);

      respond(true, {
        enabled: config.enabled,
        installed: status.installed,
        running: status.running,
        device: status.device,
        hasToken: status.hasToken,
        port: config.port,
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Start PersonaPlex server.
   */
  "voice.personaplex.start": async ({ respond }) => {
    try {
      const voiceConfig = getVoiceConfig();
      const config = resolvePersonaPlexConfig(voiceConfig.personaplex);

      if (!config.enabled) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "PersonaPlex is not enabled"),
        );
        return;
      }

      const result = await startPersonaPlexServer(config);

      if (result.success) {
        respond(true, { ok: true, port: config.port });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, result.error ?? "Failed to start PersonaPlex"),
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Stop PersonaPlex server.
   */
  "voice.personaplex.stop": async ({ respond }) => {
    try {
      stopPersonaPlexServer();
      respond(true, { ok: true });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Process audio through PersonaPlex S2S.
   *
   * Params:
   * - audio: Base64-encoded audio data
   */
  "voice.personaplex.process": async ({ params, respond }) => {
    const audioBase64 = typeof params.audio === "string" ? params.audio : "";
    if (!audioBase64) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "voice.personaplex.process requires audio (base64)"),
      );
      return;
    }

    try {
      const voiceConfig = getVoiceConfig();
      const textPrompt = typeof params.textPrompt === "string" ? params.textPrompt.trim() : "";
      const voicePrompt = typeof params.voicePrompt === "string" ? params.voicePrompt.trim() : "";
      const seed =
        typeof params.seed === "number" && Number.isFinite(params.seed)
          ? Math.trunc(params.seed)
          : undefined;
      const cpuOffload = typeof params.cpuOffload === "boolean" ? params.cpuOffload : undefined;
      const config = resolvePersonaPlexConfig({
        ...(voiceConfig.personaplex ?? {}),
        ...(textPrompt ? { textPrompt } : {}),
        ...(voicePrompt ? { voicePrompt } : {}),
        ...(seed !== undefined ? { seed } : {}),
        ...(cpuOffload !== undefined ? { cpuOffload } : {}),
      });

      if (!config.enabled) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "PersonaPlex is not enabled"),
        );
        return;
      }

      const audioBuffer = Buffer.from(audioBase64, "base64");
      const result = await processWithPersonaPlex(audioBuffer, config);

      if (result.success) {
        respond(true, {
          audioBase64: result.audioBuffer?.toString("base64"),
          audioPath: result.audioPath,
          latencyMs: result.latencyMs,
        });
      } else {
        respond(
          false,
          { latencyMs: result.latencyMs },
          errorShape(ErrorCodes.UNAVAILABLE, result.error ?? "PersonaPlex processing failed"),
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
};
