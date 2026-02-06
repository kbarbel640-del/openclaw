/**
 * Personality profiles for OpenClaw agents.
 *
 * Personality works through system prompt guidance only — the AI is instructed
 * how to behave. No post-processing or text mutation is applied to responses.
 */

import type { OpenClawConfig } from "../config/config.js";
import type { PersonalityConfig, PersonalityTone } from "../config/types.base.js";

export interface PersonalityProfile {
  id: PersonalityTone;
  name: string;
  defaults: Required<
    Pick<
      PersonalityConfig,
      | "tone"
      | "verbosity"
      | "useContractions"
      | "useFragments"
      | "emojiLevel"
      | "useResponseVariation"
      | "useSpeechPatterns"
    >
  >;
}

export const personalityProfiles: Record<PersonalityTone, PersonalityProfile> = {
  friendly: {
    id: "friendly",
    name: "Friendly",
    defaults: {
      tone: "friendly",
      verbosity: "normal",
      useContractions: true,
      useFragments: false,
      emojiLevel: "minimal",
      useResponseVariation: true,
      useSpeechPatterns: false,
    },
  },
  professional: {
    id: "professional",
    name: "Professional",
    defaults: {
      tone: "professional",
      verbosity: "normal",
      useContractions: false,
      useFragments: false,
      emojiLevel: "none",
      useResponseVariation: true,
      useSpeechPatterns: false,
    },
  },
  casual: {
    id: "casual",
    name: "Casual",
    defaults: {
      tone: "casual",
      verbosity: "concise",
      useContractions: true,
      useFragments: true,
      emojiLevel: "moderate",
      useResponseVariation: true,
      useSpeechPatterns: false,
    },
  },
  witty: {
    id: "witty",
    name: "Witty",
    defaults: {
      tone: "witty",
      verbosity: "normal",
      useContractions: true,
      useFragments: true,
      emojiLevel: "minimal",
      useResponseVariation: true,
      useSpeechPatterns: false,
    },
  },
  empathetic: {
    id: "empathetic",
    name: "Empathetic",
    defaults: {
      tone: "empathetic",
      verbosity: "normal",
      useContractions: true,
      useFragments: false,
      emojiLevel: "minimal",
      useResponseVariation: true,
      useSpeechPatterns: false,
    },
  },
  enthusiastic: {
    id: "enthusiastic",
    name: "Enthusiastic",
    defaults: {
      tone: "enthusiastic",
      verbosity: "normal",
      useContractions: true,
      useFragments: true,
      emojiLevel: "moderate",
      useResponseVariation: true,
      useSpeechPatterns: false,
    },
  },
  voice: {
    id: "voice",
    name: "Voice",
    defaults: {
      tone: "voice",
      verbosity: "concise",
      useContractions: true,
      useFragments: true,
      emojiLevel: "none",
      useResponseVariation: true,
      useSpeechPatterns: true,
    },
  },
};

/** Get a profile by tone id. */
export function getPersonalityProfile(tone: PersonalityTone): PersonalityProfile {
  return personalityProfiles[tone];
}

/**
 * Resolve the effective personality for an agent, checking (in order):
 * 1. Session-level override (from /personality command)
 * 2. Per-agent config
 * 3. Agent defaults config
 *
 * Returns undefined if no personality is configured anywhere.
 */
export function resolvePersonality(
  config: OpenClawConfig | undefined,
  agentId: string | undefined,
  sessionPersonality?: PersonalityConfig,
): PersonalityConfig | undefined {
  // Session override takes priority
  if (sessionPersonality) {
    return sessionPersonality;
  }

  if (!config) {
    return undefined;
  }

  // Per-agent config
  const effectiveId = agentId ?? "main";
  const agentConfig = config.agents?.list?.find((a) => a.id === effectiveId);
  if (agentConfig?.personality) {
    return agentConfig.personality;
  }

  // Agent defaults
  if (config.agents?.defaults?.personality) {
    return config.agents.defaults.personality;
  }

  return undefined;
}
