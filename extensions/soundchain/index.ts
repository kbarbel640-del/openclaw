import { Type } from "@sinclair/typebox";
import type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginToolFactory,
} from "../../src/plugins/types.js";
import { createSoundChainApi, type SoundChainApi, type SoundChainConfig } from "./src/api.js";
import {
  createWarRoomClient,
  type WarRoomClient,
  type WarRoomConfig,
  OLLAMA_MODELS,
  FLEET_NODES,
  SPECIALISTS,
} from "./src/warroom.js";

function json(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// ---------------------------------------------------------------------------
// Music Tools (SoundChain Agent REST API)
// ---------------------------------------------------------------------------

function createSearchTool(api: SoundChainApi): AnyAgentTool {
  return {
    name: "soundchain_search",
    label: "SoundChain Search",
    description:
      "Search for music tracks on SoundChain by title, artist, or album. Returns track info including stream URLs, play counts, and SCID codes for streaming rewards.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (title, artist, or album). Minimum 2 characters.",
      }),
      limit: Type.Optional(
        Type.Number({ description: "Max results to return (1-50, default 10)." }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const query = typeof params.query === "string" ? params.query.trim() : "";
      if (!query || query.length < 2) {
        return json({ error: "Search query must be at least 2 characters." });
      }
      const limit = typeof params.limit === "number" ? Math.min(Math.max(params.limit, 1), 50) : 10;
      return json(await api.searchTracks(query, limit));
    },
  } as AnyAgentTool;
}

function createRadioTool(api: SoundChainApi): AnyAgentTool {
  return {
    name: "soundchain_radio",
    label: "OGUN Radio",
    description:
      "Get the currently playing track on OGUN Radio — a decentralized NFT radio station rotating 600+ tracks. Returns now-playing info, stream URL, SCID for rewards, and available genres.",
    parameters: Type.Object({}),
    async execute() {
      return json(await api.getRadio());
    },
  } as AnyAgentTool;
}

function createPlayTool(api: SoundChainApi): AnyAgentTool {
  return {
    name: "soundchain_play",
    label: "SoundChain Play",
    description:
      "Report a track play on SoundChain and trigger OGUN streaming rewards. Both the creator (70%) and listener (30%) earn OGUN tokens. Include the SCID code to activate rewards.",
    parameters: Type.Object({
      track_id: Type.String({ description: "Track ID from search or radio results." }),
      track_title: Type.String({ description: "Track title for display." }),
      scid: Type.Optional(
        Type.String({
          description: "SCID code (e.g. SC-POL-XXXX-XXXXXXX) to trigger OGUN rewards.",
        }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const trackId = typeof params.track_id === "string" ? params.track_id.trim() : "";
      const trackTitle = typeof params.track_title === "string" ? params.track_title.trim() : "";
      if (!trackId) return json({ error: "track_id is required." });
      if (!trackTitle) return json({ error: "track_title is required." });
      const scid = typeof params.scid === "string" ? params.scid.trim() : undefined;
      return json(await api.reportPlay(trackId, trackTitle, scid));
    },
  } as AnyAgentTool;
}

function createStatsTool(api: SoundChainApi): AnyAgentTool {
  return {
    name: "soundchain_stats",
    label: "SoundChain Stats",
    description:
      "Get SoundChain platform statistics: total tracks, IPFS-backed audio/artwork counts, NFT counts, and estimated totals.",
    parameters: Type.Object({}),
    async execute() {
      return json(await api.getPlatformStats());
    },
  } as AnyAgentTool;
}

function createTrendingTool(api: SoundChainApi): AnyAgentTool {
  return {
    name: "soundchain_trending",
    label: "SoundChain Trending",
    description:
      "Get trending content on SoundChain: hot tracks by play count, trending stories/reels, and rising artists by follower count.",
    parameters: Type.Object({}),
    async execute() {
      return json(await api.getTrending());
    },
  } as AnyAgentTool;
}

function createDiscoverTool(api: SoundChainApi): AnyAgentTool {
  return {
    name: "soundchain_discover",
    label: "SoundChain Discover",
    description:
      "Discover random tracks, posts, and artists on SoundChain. Returns a shuffled mix of content for serendipitous exploration — great for finding new music.",
    parameters: Type.Object({}),
    async execute() {
      return json(await api.getDiscover());
    },
  } as AnyAgentTool;
}

function createLeaderboardTool(api: SoundChainApi): AnyAgentTool {
  return {
    name: "soundchain_leaderboard",
    label: "SoundChain Leaderboard",
    description:
      "View the SoundChain agent leaderboard: top agents ranked by plays, comments, SCID mints, and OGUN earned. Shows whitelist status and airdrop eligibility.",
    parameters: Type.Object({}),
    async execute() {
      return json(await api.getLeaderboard());
    },
  } as AnyAgentTool;
}

// ---------------------------------------------------------------------------
// War Room Tools (SCid Worker + Ollama + Fleet)
// ---------------------------------------------------------------------------

function createWarRoomHealthTool(wr: WarRoomClient): AnyAgentTool {
  return {
    name: "warroom_health",
    label: "War Room Health",
    description:
      "Check the health of the entire War Room: SCid Worker (task router), Ollama (7 local LLM models), fleet nodes (mini/grater/rog), and specialist agent domains. Returns status of all systems.",
    parameters: Type.Object({}),
    async execute() {
      return json(await wr.fleetHealth());
    },
  } as AnyAgentTool;
}

function createOllamaThinkTool(wr: WarRoomClient): AnyAgentTool {
  return {
    name: "warroom_think",
    label: "War Room Think",
    description:
      "Quick reasoning via the War Room's Mistral model (First Responder). Fast queries, scan logs, instant patches. Routes through the SCid Worker task router on localhost:8787.",
    parameters: Type.Object({
      prompt: Type.String({ description: "The prompt to reason about." }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
      if (!prompt) return json({ error: "prompt is required." });
      return json(await wr.think(prompt));
    },
  } as AnyAgentTool;
}

function createOllamaCodeTool(wr: WarRoomClient): AnyAgentTool {
  return {
    name: "warroom_code",
    label: "War Room Code",
    description:
      "Code analysis via the War Room's Qwen model (Code Specialist). Understands syntax, patterns, and code structure. Routes through the SCid Worker task router.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Code question or snippet to analyze." }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
      if (!prompt) return json({ error: "prompt is required." });
      return json(await wr.code(prompt));
    },
  } as AnyAgentTool;
}

function createOllamaReasonTool(wr: WarRoomClient): AnyAgentTool {
  return {
    name: "warroom_reason",
    label: "War Room Reason",
    description:
      "Complex reasoning via the War Room's Llama 3.1 model (Team Captain). Deep analysis, multi-step logic, review consistency. Routes through the SCid Worker task router.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Complex question requiring deep reasoning." }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
      if (!prompt) return json({ error: "prompt is required." });
      return json(await wr.reason(prompt));
    },
  } as AnyAgentTool;
}

function createOllamaDirectTool(wr: WarRoomClient): AnyAgentTool {
  return {
    name: "warroom_ollama",
    label: "War Room Ollama",
    description:
      "Send a prompt directly to any Ollama model in the War Room. Available models: mistral (fast), qwen:7b (code), llama3.1 (reason), falcon:7b (syntax), gemma:7b (deps), mixtral:8x22b (architect, 79GB), jmorgan/grok (deep analysis, 116GB). Zero token cost — all local.",
    parameters: Type.Object({
      model: Type.String({
        description:
          "Model name (e.g. 'mistral:latest', 'llama3.1:latest', 'mixtral:8x22b', 'jmorgan/grok:latest'). Use warroom_health to see available models.",
      }),
      prompt: Type.String({ description: "The prompt to send to the model." }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const model = typeof params.model === "string" ? params.model.trim() : "";
      const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
      if (!model) return json({ error: "model is required." });
      if (!prompt) return json({ error: "prompt is required." });
      return json(await wr.ollamaGenerate(model, prompt));
    },
  } as AnyAgentTool;
}

function createWarRoomTaskTool(wr: WarRoomClient): AnyAgentTool {
  return {
    name: "warroom_task",
    label: "War Room Task",
    description:
      "Send a raw task to the SCid Worker (localhost:8787). The worker routes to the right Ollama model based on task prefix: 'think:', 'code:', 'reason:', 'bash:', 'read:', 'grep:', 'glob:', 'git:status', 'build', 'ping'. Returns the task result.",
    parameters: Type.Object({
      task: Type.String({
        description:
          "Task string. Examples: 'think:why is this failing?', 'bash:ls -la', 'read:src/index.ts', 'grep:TODO:src/', 'build', 'git:status', 'ping'.",
      }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const task = typeof params.task === "string" ? params.task.trim() : "";
      if (!task) return json({ error: "task is required." });
      return json(await wr.scidTask(task));
    },
  } as AnyAgentTool;
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

const plugin = {
  id: "soundchain",
  name: "SoundChain",
  description:
    "Search music, play tracks, earn OGUN streaming rewards, and command the War Room — 7 Ollama models + fleet nodes + SCid Worker — all from any OpenClaw channel.",

  register(api: OpenClawPluginApi) {
    const cfg = (api.pluginConfig ?? {}) as Record<string, unknown>;

    // Music API config
    const scConfig: SoundChainConfig = {
      apiUrl: typeof cfg.apiUrl === "string" && cfg.apiUrl ? cfg.apiUrl : "https://soundchain.io",
      agentName:
        typeof cfg.agentName === "string" && cfg.agentName ? cfg.agentName : "openclaw-agent",
      agentWallet:
        typeof cfg.agentWallet === "string" && cfg.agentWallet ? cfg.agentWallet : undefined,
    };

    // War Room config
    const wrConfig: WarRoomConfig = {
      scidWorkerUrl:
        typeof cfg.scidWorkerUrl === "string" && cfg.scidWorkerUrl
          ? cfg.scidWorkerUrl
          : "http://localhost:8787",
      ollamaUrl:
        typeof cfg.ollamaUrl === "string" && cfg.ollamaUrl
          ? cfg.ollamaUrl
          : "http://localhost:11434",
    };

    const scApi = createSoundChainApi(scConfig);
    const wrClient = createWarRoomClient(wrConfig);

    // Music tools (SoundChain Agent REST API)
    const musicTools = [
      createSearchTool,
      createRadioTool,
      createPlayTool,
      createStatsTool,
      createTrendingTool,
      createDiscoverTool,
      createLeaderboardTool,
    ];

    for (const createTool of musicTools) {
      api.registerTool(
        ((ctx) => {
          if (ctx.sandboxed) return null;
          return createTool(scApi);
        }) as OpenClawPluginToolFactory,
        { optional: true },
      );
    }

    // War Room tools (SCid Worker + Ollama + Fleet)
    const warRoomTools = [
      createWarRoomHealthTool,
      createOllamaThinkTool,
      createOllamaCodeTool,
      createOllamaReasonTool,
      createOllamaDirectTool,
      createWarRoomTaskTool,
    ];

    for (const createTool of warRoomTools) {
      api.registerTool(
        ((ctx) => {
          if (ctx.sandboxed) return null;
          return createTool(wrClient);
        }) as OpenClawPluginToolFactory,
        { optional: true },
      );
    }
  },
};

export default plugin;
