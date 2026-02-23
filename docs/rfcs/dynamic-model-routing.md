# RFC: Dynamic Model Routing

**Author:** Anton Eicher
**Status:** Implemented
**Date:** 2026-02-11

## Problem

OpenClaw uses a single primary model for all interactive replies within a session. Quick tasks (greetings, running a predefined skill, confirmations) get the same expensive/slow model as complex tasks (analysis, summarization, multi-step reasoning). This wastes both latency and cost.

## Goal

A plugin-based model routing system where configurable strategies determine which model handles each message. Strategies receive full message context (text, media, channel, sender) and can route based on any signal. New strategies are added by implementing an interface and registering — no core code changes required.

**Example routing with the built-in `dynamic-tiered` strategy:**

| Message                                          | Classification | Model      |
| ------------------------------------------------ | -------------- | ---------- |
| "Good morning"                                   | FAST           | Haiku 4.5  |
| "thanks"                                         | FAST           | Haiku 4.5  |
| "How should I structure this PR?"                | STANDARD       | Sonnet 4.5 |
| "Run the surf report"                            | STANDARD       | Sonnet 4.5 |
| "For lunch I had a chicken salad and a banana"   | DEEP           | Opus 4.6   |
| "Summarize yesterday's logs and identify issues" | DEEP           | Opus 4.6   |

## Architecture

### Pipeline

```
Incoming message
  → resolveReplyDirectives()
    → createModelSelectionState()          # resolve primary model
    → resolveRoutingConfig()               # check if routing is configured
    → routeModel()                         # dispatch to strategy
        → strategy.route(ctx, config, options)
    → applyInlineDirectiveOverrides(effectiveModelDirective)
      → runEmbeddedPiAgent(provider, model)
        → resolveModel()
          → LLM call
```

The core router (`model-router.ts`) is a thin dispatcher (~30 lines). It:

1. Looks up the configured strategy by name from the registry
2. Calls `strategy.route()` with the full `MsgContext`
3. Injects the result as `effectiveModelDirective` — a parameter that `applyInlineDirectiveOverrides` already accepts

### Why This Insertion Point

`applyInlineDirectiveOverrides` already has an `effectiveModelDirective?: string` parameter designed for model overrides:

- Respects the existing override chain (explicit `/model` commands still win)
- Works with all channels (Telegram, WhatsApp, Discord, etc.)
- Sits after directive parsing, so user intents like `/model opus` bypass the router
- No changes needed to the agent runner or model resolution logic

### File Structure

```
src/auto-reply/reply/
├── model-router.ts                          # Strategy registry + dispatcher
├── model-router.test.ts                     # Registry + dispatcher tests
├── recent-context.ts                        # Session JSONL reader for classifier context
├── recent-context.test.ts                   # Context helper tests
└── model-router-strategies/
    ├── types.ts                             # ModelRoutingStrategy interface
    ├── passthrough.ts                       # No-op strategy
    ├── dynamic-tiered.ts                    # Haiku classifier strategy
    └── dynamic-tiered.test.ts              # Classifier strategy tests
```

## Strategy Interface

```typescript
// src/auto-reply/reply/model-router-strategies/types.ts

type RoutingResult = {
  tier: string; // strategy-specific label (e.g., "fast", "standard", "deep", "primary")
  provider: string;
  model: string;
  latencyMs: number;
  reason: string; // "classifier", "passthrough", "fallback:timeout", etc.
  detail?: string; // classifier reasoning (e.g., "simple greeting")
};

interface ModelRoutingStrategy {
  readonly name: string;
  route(params: {
    ctx: MsgContext; // full message context
    config: OpenClawConfig;
    options: Record<string, unknown>; // strategy-specific, opaque to core
    primaryProvider: string; // the model that would be used without routing
    primaryModel: string;
  }): Promise<RoutingResult>;
}
```

Strategies receive the full `MsgContext` which includes:

| Field                            | Use case                                       |
| -------------------------------- | ---------------------------------------------- |
| `Body`, `CommandBody`, `RawBody` | Text-based routing (complexity classification) |
| `MediaTypes[]`, `MediaPaths[]`   | Media-aware routing (images → vision model)    |
| `Transcript`                     | Audio transcription routing                    |
| `Provider`, `Surface`            | Channel-aware routing (Telegram vs WhatsApp)   |
| `ChatType`, `GroupSubject`       | Group vs DM routing                            |
| `SenderName`, `SenderId`         | Per-user routing preferences                   |

## Strategy Registry

```typescript
// src/auto-reply/reply/model-router.ts

registerRoutingStrategy(strategy: ModelRoutingStrategy): void
getRoutingStrategy(name: string): ModelRoutingStrategy | undefined
listRoutingStrategies(): string[]
```

Built-in strategies are registered at module load. Custom strategies call `registerRoutingStrategy()`.

## Built-in Strategies

### `passthrough`

Returns the primary model unchanged. Use as an explicit "no routing" config, or as the default when no routing is configured.

### `dynamic-tiered`

Classifies messages using a fast LLM call (e.g., Haiku) and routes to one of three tier models.

**Classifier prompt:**

The classifier prompt is assembled from two parts: a **prompt template** and a **heuristics** block. Both can be loaded from markdown files in the workspace, or fall back to built-in defaults.

File resolution order:

1. Custom path from `classifier.promptFile` / `classifier.heuristicsFile` (supports `~`)
2. Default workspace paths: `~/.openclaw/workspace/ROUTER.md` and `~/.openclaw/workspace/ROUTER-HEURISTICS.md`
3. Built-in defaults (below)

When using the default workspace paths (no custom `promptFile`/`heuristicsFile`), missing files are **auto-seeded** with the built-in defaults on first classifier invocation. This makes the files discoverable and immediately editable. Seeding is fire-and-forget (uses exclusive-create `wx` flag, never overwrites, errors silently swallowed).

**Default prompt template** (`ROUTER.md`):

```
Classify this user message by the complexity of response needed.

{{HEURISTICS}}

{{CONTEXT}}
User message:
"""
{{MESSAGE}}
"""

Respond with the tier followed by a colon and a brief reason (1-5 words).
Format: TIER: reason
Example: FAST: simple greeting
```

The `{{CONTEXT}}` placeholder is replaced with recent conversation history when available (see [Conversation Context](#conversation-context)), or removed entirely for new sessions.

**Default heuristics** (`ROUTER-HEURISTICS.md`):

```
FAST — ONLY use for standalone greetings ("hi", "hey"), standalone thanks ("thanks", "cheers"), and trivial chitchat that needs no tools, no lookups, and no context from prior messages. If the message could be a reply to something, it is NOT fast.

STANDARD — The default tier. Use for: questions, requests, follow-ups, corrections, instructions, web searches, skill execution, image descriptions, any message that references prior conversation ("it was", "move that", "change it", "actually", "no"), any message shorter than 10 words that isn't a clear greeting/thanks, and anything ambiguous.

DEEP — Food/diary logging (including corrections and follow-ups about meals), skill execution that involves data entry or multi-step scripting, complex multi-step reasoning, debugging code, architectural analysis, long-form writing, detailed summarization, or tasks requiring careful thought across multiple domains.

IMPORTANT RULES:
- When recent conversation context is provided, ALWAYS consider it. A short message in an ongoing task (food logging, debugging, planning) is STANDARD, not FAST.
- When in doubt between FAST and STANDARD, choose STANDARD.
- Messages with images or attachments are STANDARD at minimum.
- Corrections ("it was one slice", "no the other one", "actually...") are STANDARD because they require understanding and modifying prior work.
- Confirmations ("yes", "ok", "do it") in an ongoing task are STANDARD because the confirmed action needs execution.
```

The `{{HEURISTICS}}` placeholder in the template is replaced with the heuristics content, and `{{MESSAGE}}` is replaced with the user message (truncated to 2000 chars). This separation allows editing routing rules without touching the prompt structure, and enables a future background Opus improvement loop that rewrites `ROUTER-HEURISTICS.md`.

The classifier uses `completeSimple()` from pi-ai with `maxTokens: 30` and a configurable timeout (default 3000ms). The response format is `TIER: reason` (e.g., `FAST: simple greeting`), though bare tier names are accepted for backwards compatibility. On any failure (timeout, parse error, model resolution error), falls back to the configured fallback tier.

**Options:**

```typescript
{
  classifier: {
    model: string;            // e.g., "amazon-bedrock/us.anthropic.claude-haiku-4-5-..."
    timeoutMs?: number;       // default: 3000
    promptFile?: string;      // path to prompt template file (supports ~)
    heuristicsFile?: string;  // path to heuristics file (supports ~)
  };
  tiers: {
    fast: string;         // model ref for FAST classification
    standard: string;     // model ref for STANDARD classification
    deep: string;         // model ref for DEEP classification
  };
  fallback?: "fast" | "standard" | "deep";  // default: "standard"
}
```

## Configuration

### Schema

Extended `AgentDefaultsSchema` in `src/config/zod-schema.agent-defaults.ts`:

```typescript
routing: z.object({
  strategy: z.string(),
  options: z.record(z.string(), z.unknown()).optional(),
  bypass: z.object({
    onExplicitModel: z.boolean().optional(),
    onHeartbeat: z.boolean().optional(),
  }).strict().optional(),
}).strict().optional(),
```

The `options` field is opaque — validated by the strategy, not the schema. This means new strategies can define their own options without changing the core config schema.

### Type

```typescript
// src/config/types.agent-defaults.ts

type AgentModelRoutingConfig = {
  strategy: string;
  options?: Record<string, unknown>;
  bypass?: {
    onExplicitModel?: boolean; // skip when user has explicit /model override (default: true)
    onHeartbeat?: boolean; // skip for heartbeat runs (default: true)
  };
};

type AgentModelListConfig = {
  primary?: string;
  fallbacks?: string[];
  routing?: AgentModelRoutingConfig;
};
```

### Example User Config

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "amazon-bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        "fallbacks": ["amazon-bedrock/us.anthropic.claude-opus-4-6-v1"],
        "routing": {
          "strategy": "dynamic-tiered",
          "options": {
            "classifier": {
              "model": "amazon-bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0",
              "timeoutMs": 3000,
              "promptFile": "~/.openclaw/workspace/ROUTER.md",
              "heuristicsFile": "~/.openclaw/workspace/ROUTER-HEURISTICS.md"
            },
            "tiers": {
              "fast": "amazon-bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0",
              "standard": "amazon-bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0",
              "deep": "amazon-bedrock/us.anthropic.claude-opus-4-6-v1"
            },
            "fallback": "standard"
          },
          "bypass": {
            "onExplicitModel": true,
            "onHeartbeat": true
          }
        }
      }
    }
  }
}
```

## Bypass Logic

The core dispatcher (not the strategy) handles bypass before calling the strategy:

| Condition                        | Why                                        | Default       |
| -------------------------------- | ------------------------------------------ | ------------- |
| User sent `/model opus`          | Explicit override takes priority           | bypass (true) |
| Session has a model override set | User previously ran `/model`               | bypass (true) |
| Heartbeat message                | Background task, uses its own model config | bypass (true) |
| Strategy is `"passthrough"`      | No routing needed                          | skip entirely |
| No routing config                | Feature not enabled                        | skip entirely |

Strategy-level failures (timeout, parse error, model resolution) are handled within each strategy via fallback logic.

## Pipeline Integration

In `resolveReplyDirectives()` (`src/auto-reply/reply/get-reply-directives.ts`):

```typescript
let routingResult: RoutingResult | undefined;
const routingConfig = resolveRoutingConfig(cfg);
if (routingConfig) {
  const bypassExplicit = routingConfig.bypass?.onExplicitModel !== false;
  const bypassHeartbeat = routingConfig.bypass?.onHeartbeat !== false;
  const hasExplicitOverride = directives.hasModelDirective || Boolean(sessionEntry?.modelOverride);
  const shouldBypass =
    (bypassExplicit && hasExplicitOverride) || (bypassHeartbeat && opts?.isHeartbeat === true);

  if (!shouldBypass) {
    routingResult = await routeModel({
      ctx: sessionCtx,
      config: cfg,
      routing: routingConfig,
      primaryProvider: provider,
      primaryModel: model,
    });
    if (!effectiveModelDirective) {
      effectiveModelDirective = `${routingResult.provider}/${routingResult.model}`;
      provider = routingResult.provider;
      model = routingResult.model;
    }
  }
}
```

The `routingResult` is passed through to `ReplyDirectiveContinuation` for logging and telemetry.

## Adding a New Strategy

Implement the `ModelRoutingStrategy` interface and register it:

```typescript
// src/auto-reply/reply/model-router-strategies/media-aware.ts

import type { ModelRoutingStrategy, RoutingResult } from "./types.js";

export const mediaAwareStrategy: ModelRoutingStrategy = {
  name: "media-aware",

  async route(params): Promise<RoutingResult> {
    const hasImages = params.ctx.MediaTypes?.some((t) => t.startsWith("image/"));

    if (hasImages) {
      const visionModel = params.options.visionModel as string;
      // ... resolve and return vision model
    }

    return {
      tier: "primary",
      provider: params.primaryProvider,
      model: params.primaryModel,
      latencyMs: 0,
      reason: "no-media",
    };
  },
};
```

Register in `model-router.ts`:

```typescript
import { mediaAwareStrategy } from "./model-router-strategies/media-aware.js";
registerRoutingStrategy(mediaAwareStrategy);
```

Config:

```json
{
  "routing": {
    "strategy": "media-aware",
    "options": {
      "visionModel": "anthropic/claude-sonnet-4-5",
      "default": "anthropic/claude-haiku-4-5"
    }
  }
}
```

## Edge Cases

**Multi-turn conversations:** The `dynamic-tiered` classifier sees the current message plus recent conversation context (last 5 messages, each truncated to 200 chars, with model labels). This prevents short replies like "yes" mid-debugging from being misclassified as FAST. If the session has a model override from a previous `/model` command, routing is bypassed entirely.

**Strategy not found:** If the config references an unregistered strategy name, the dispatcher returns the primary model with reason `"fallback:unknown-strategy:{name}"`.

**Classifier failures (dynamic-tiered):** Timeout, parse error, or model resolution error all fall back to the configured `fallback` tier. The reply pipeline is never blocked.

**Cost of classification:** The `dynamic-tiered` strategy adds one Haiku call per message (~200-400ms, ~$0.0001). The `passthrough` strategy adds zero overhead.

## Future Strategies

| Strategy         | Routes on                      | Description                                         |
| ---------------- | ------------------------------ | --------------------------------------------------- |
| `sticky-session` | First message                  | Classifies once, then session sticks with that tier |
| `media-aware`    | `ctx.MediaTypes`               | Images → vision model, audio → audio model          |
| `channel-aware`  | `ctx.Provider`, `ctx.ChatType` | Fast model for groups, deep for DMs                 |
| `skill-aware`    | `ctx.CommandBody`              | Skill triggers → fast, everything else → classify   |
| `composite`      | Multiple                       | Chain multiple strategies with priority rules       |

## Conversation Context

The classifier receives recent conversation history so it can make context-aware routing decisions. Without this, short replies like "yes" mid-debugging would be classified as FAST in isolation.

**How it works:**

1. Before calling the classifier, `get-reply-directives.ts` loads recent messages from the session JSONL file via `loadRecentSessionContext()` (`recent-context.ts`)
2. The helper reads the last ~16KB of the file (efficient tail), parses message entries, and formats the last N messages with model labels
3. The result is passed as `recentContext` through `routeModel()` to the strategy
4. The strategy injects it into the prompt template via the `{{CONTEXT}}` placeholder

**Format example:**

```
Recent conversation:
User: I'm debugging the distributed cache inv...
Assistant [sonnet]: Let me look at the cache invalidation lo...
User: yes
```

**Configuration** (optional fields in `classifier` options):

| Field             | Default | Description                                  |
| ----------------- | ------- | -------------------------------------------- |
| `contextMessages` | 5       | Number of recent messages to include         |
| `contextChars`    | 200     | Max characters per message before truncation |

**Behavior:**

- Returns `undefined` (no context injected) if the session file doesn't exist or has fewer than 2 messages
- Model labels are extracted from the `message.model` field (e.g., `us.anthropic.claude-haiku-4-5-20251001-v1:0` → `haiku`)
- All errors are swallowed — context is best-effort and never blocks routing

## Testing

65 tests across 3 test files:

**`model-router.test.ts`** (12 tests — unchanged):

- Config resolution (null when missing, null for passthrough, returns config for other strategies)
- Registry (built-in strategies, lookup, custom registration)
- Dispatcher (unknown strategy fallback, correct dispatch, options passthrough, MsgContext passthrough, recentContext forwarding)

**`dynamic-tiered.test.ts`** (36 tests):

- Classification routing (FAST → fast tier, STANDARD → standard tier, DEEP → deep tier)
- Classifier response parsing (extra whitespace, `TIER: reason` format, `TIER - reason` format, bare tier backwards compat)
- Detail field populated from classifier reasoning
- Fallback paths (unparseable response, API error, timeout, model resolution error, empty message, invalid options)
- Configuration (custom fallback tier, latency tracking, maxTokens is 30, aws-sdk auth mode)
- File loading (custom promptFile, custom heuristicsFile, falls back to built-in defaults when files missing)
- File seeding (seeds ROUTER.md when missing, seeds ROUTER-HEURISTICS.md when missing, skips seeding with custom paths, skips seeding when files exist)
- Recent context (included in prompt when provided, omitted when absent, context-awareness guidance in heuristics)
- Real-world routing scenarios (food diary logging with context, confirmations in ongoing tasks, follow-up web searches, image analysis with action, simple messages stay FAST, heuristics content validation)

**`recent-context.test.ts`** (17 tests):

- Model label extraction (known models, truncation of unknown IDs, undefined input)
- JSONL parsing (user/assistant messages, array-of-blocks content format)
- Message truncation and count limits
- Filtering (skips session headers, custom records, malformed JSON)
- Edge cases (missing file, empty file, fewer than 2 messages, missing model field)

**Manual test plan:** See [dynamic-model-routing-test-plan.md](./dynamic-model-routing-test-plan.md)

## Files Changed

| File                                                                  | Change                                                                            |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/auto-reply/reply/model-router-strategies/types.ts`               | **New** — `ModelRoutingStrategy` interface, `RoutingResult` type (incl. `detail`) |
| `src/auto-reply/reply/model-router-strategies/passthrough.ts`         | **New** — passthrough strategy                                                    |
| `src/auto-reply/reply/model-router-strategies/dynamic-tiered.ts`      | **New** — Haiku classifier strategy with externalized prompt/heuristics           |
| `src/auto-reply/reply/model-router-strategies/dynamic-tiered.test.ts` | **New** — 28 classifier tests                                                     |
| `src/auto-reply/reply/model-router.ts`                                | **New** — strategy registry + dispatcher                                          |
| `src/auto-reply/reply/model-router.test.ts`                           | **New** — 12 registry/dispatcher tests                                            |
| `src/auto-reply/reply/recent-context.ts`                              | **New** — session JSONL reader for classifier context                             |
| `src/auto-reply/reply/recent-context.test.ts`                         | **New** — 14 context helper tests                                                 |
| `src/auto-reply/reply/get-reply-directives.ts`                        | Wire `routeModel()` + context loading into pipeline                               |
| `src/config/types.agent-defaults.ts`                                  | `AgentModelRoutingConfig` type (strategy + options + bypass)                      |
| `src/config/zod-schema.agent-defaults.ts`                             | Zod validation for routing config                                                 |

## FAQ

**Q: How much context does the classifier see?**
The current message (truncated to 2000 chars) plus the last 5 messages from the session (each truncated to 200 chars), including which model was used for each assistant reply.

**Q: What happens if I use `/model` to switch models?**
Routing is bypassed entirely when an explicit model override is active (`bypass.onExplicitModel: true` by default). The override persists on the session until cleared with `/model`.

**Q: What happens with short replies like "yes" mid-conversation?**
The classifier sees recent conversation context including model labels, so it can match the complexity of the ongoing discussion rather than classifying the short message in isolation.

**Q: What if the classifier fails or times out?**
Falls back to the configured fallback tier (default: "standard"/Sonnet). All failures are non-blocking.

**Q: Can I customize the classification rules?**
Edit `ROUTER-HEURISTICS.md` in the agent workspace. It's auto-seeded on first use and can be freely modified.

**Q: Does routing work in group chats?**
Yes, same behavior. Group `InboundHistory` is not currently used by the classifier (it uses session JSONL history instead).
