import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";

const SpeakToolSchema = Type.Object({
  text: Type.String(),
  target: Type.Optional(Type.String({ description: "Optional target (e.g. peer name) or 'user' for web voice" })),
  voice: Type.Optional(Type.String({ description: "Optional voice ID for ElevenLabs" })),
});

export function createSpeakTool(): AnyAgentTool {
  return {
    label: "Speak",
    name: "speak",
    description: "Converts text to speech and delivers it as a voice message or web audio.",
    parameters: SpeakToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const text = readStringParam(params, "text", { required: true });
      const target = readStringParam(params, "target") ?? "user";
      const voice = readStringParam(params, "voice");

      const voiceDirective = voice ? `[[tts:voiceid=${voice}]]` : "";

      if (target !== "user") {
        return jsonResult({
            status: "ok",
            message: `Voice message sent to ${target} with voice ${voice || 'default'}.`,
            text,
            directive: `[[tts:text]]${text}${voiceDirective}[[tts:audio:as-voice]]`
        });
      }

      return jsonResult({
        status: "ok",
        directive: `[[tts:text]]${text}${voiceDirective}[[tts:audio:as-voice]]`
      });
    },
  };
}
