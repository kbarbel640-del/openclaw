# Technical Guide: Extending OpenClaw Model Input Schema for Video/Audio

## 1. Problem Statement

OpenClaw gateway fails to start when `~/.openclaw/openclaw.json` declares video and audio input modalities for models like `gemini-3.1-pro-preview`:

```json
{
  "models": {
    "providers": {
      "google": {
        "models": [
          {
            "id": "gemini-3.1-pro-preview",
            "input": ["text", "image", "video", "audio"]
          }
        ]
      }
    }
  }
}
```

The Zod validation schema at `src/config/zod-schema.core.ts:41` only accepted `"text" | "image"`, causing a validation error during config parsing that prevented gateway startup.

## 2. Architecture Overview

The input modality type flows through the codebase in this chain:

```
openclaw.json (user config)
    |
    v
zod-schema.core.ts  ──  Zod validation (runtime)
    |
    v
types.models.ts  ──  ModelDefinitionConfig TypeScript type
    |
    v
model-catalog.ts  ──  ModelCatalogEntry / DiscoveredModel types
    |
    ├──> model-scan.ts  ──  parseModality() for OpenRouter discovery
    ├──> huggingface-models.ts  ──  HuggingFace model discovery
    ├──> cloudflare-ai-gateway.ts  ──  Cloudflare AI Gateway builder
    └──> onboard-auth.config-litellm.ts  ──  LiteLLM onboarding
    |
    v
runner.ts  ──  Media understanding skip logic (uses catalog helpers)
```

### Pre-existing Pattern

The codebase already defines `MediaUnderstandingCapability = "image" | "audio" | "video"` in `src/media-understanding/types.ts`, confirming video and audio are expected capabilities. The only gap was the config validation layer.

## 3. Changes Explained

### 3.1 Schema Layer (Zod + TypeScript)

**Zod schema** (`zod-schema.core.ts`): The `ModelDefinitionSchema.input` field was extended from a 2-member union to a 4-member union. This is purely additive — existing configs with only `"text"` and `"image"` continue to validate unchanged.

**TypeScript type** (`types.models.ts`): The `ModelDefinitionConfig.input` type was widened correspondingly. Since TypeScript union widening is a covariant change, all existing code that reads `input` continues to compile.

### 3.2 Discovery Layer

Three discovery modules parse external API responses into the internal model catalog:

| Module                           | Source                    | Change                                                        |
| -------------------------------- | ------------------------- | ------------------------------------------------------------- |
| `model-scan.ts`                  | OpenRouter `/v1/models`   | `parseModality()` now extracts `"video"` and `"audio"` tokens |
| `huggingface-models.ts`          | HuggingFace Inference API | Reads `architecture.input_modalities` for video/audio         |
| `cloudflare-ai-gateway.ts`       | Cloudflare AI Gateway     | Type annotation widened (no logic change)                     |
| `onboard-auth.config-litellm.ts` | LiteLLM setup             | Type annotation widened (no logic change)                     |

**Note on `model-scan.ts` type cast:** The `parseModality()` return type is now `Array<"text" | "image" | "video" | "audio">`, but the external `@mariozechner/pi-ai` library's `Model` type constrains `input` to `("text" | "image")[]`. A type assertion is used at the assignment site. This is safe because the pi-ai library ignores unknown modalities at runtime.

### 3.3 Capability Helpers

Two new exported functions in `model-catalog.ts`:

```ts
modelSupportsVideo(entry: ModelCatalogEntry | undefined): boolean
modelSupportsAudio(entry: ModelCatalogEntry | undefined): boolean
```

These follow the identical pattern of the existing `modelSupportsVision()`. They check `entry.input.includes("video")` and `entry.input.includes("audio")` respectively.

### 3.4 Media Understanding Runner

The runner at `src/media-understanding/runner.ts` already had a skip block for images (lines 689-720):

> "When the primary model supports vision natively, skip image understanding and let the model handle it directly."

Two analogous blocks were added for video and audio. The logic is identical:

1. Check if the current capability is `"video"` (or `"audio"`)
2. Look up the active model in the catalog
3. If the model supports that capability natively, return a `"skipped"` decision
4. Otherwise, fall through to the normal understanding pipeline

## 4. What Was NOT Changed

- **Config file** (`~/.openclaw/openclaw.json`): No changes needed — this is the file that exposed the bug.
- **Defaults**: The default `["text"]` remains correct for models without declared modalities.
- **Existing `.includes("image")` checks**: All runtime image checks continue to work; the union widening is additive.
- **Display logic**: The `join("+")` display pattern is generic and handles any number of modalities.
- **Gateway protocol schema**: The gateway wire format is unaffected by this change.
- **External library `@mariozechner/pi-ai`**: Not modified; type cast used at boundary.

## 5. Verification Procedures

### Type Check

```bash
cd ~/moltbot && npx tsc --noEmit
```

Expected: No new errors (pre-existing errors in `src/llm/` are unrelated).

### Gateway Startup

```bash
node openclaw.mjs gateway run --port 18789
```

Expected: Clean startup with no config validation errors.

### Port Check

```bash
ss -tlnp | grep :18789
```

Expected: Port is listening.

### Unit Tests

```bash
npx vitest run --config vitest.unit.config.ts
```

Expected: No regressions.

## 6. Upstream Compatibility

Fetched upstream `openclaw/openclaw` main as of 2026-02-19 (`6cdcb5904`). Of our 8 modified files, only `runner.ts` was also changed upstream. The upstream changes (import additions at lines 15-25 and a new `resolveMediaAttachmentLocalRoots` function at lines 79-101) do not overlap with our changes (import additions at lines 9-10 and skip blocks at lines 721-790). **Merge conflict risk: low.**

## 7. Risk Assessment

| Risk                                                  | Likelihood | Impact | Mitigation                                                         |
| ----------------------------------------------------- | :--------: | :----: | ------------------------------------------------------------------ |
| Config regression (existing `"text"+"image"` configs) |  Very Low  |  High  | Additive union extension; no removal                               |
| Type assertion in model-scan.ts                       |    Low     |  Low   | pi-ai ignores unknown modalities at runtime                        |
| Skip logic false positive                             |    Low     | Medium | Mirrors proven image skip pattern; catalog lookup is authoritative |
| Upstream merge conflict                               |    Low     |  Low   | Only runner.ts overlaps; different code regions                    |

## 8. File Inventory

| #   | File                                          | Lines Changed | Change Type                   |
| --- | --------------------------------------------- | :-----------: | ----------------------------- |
| 1   | `src/config/zod-schema.core.ts`               |       1       | Schema extension              |
| 2   | `src/config/types.models.ts`                  |       1       | Type widening                 |
| 3   | `src/agents/model-catalog.ts`                 |  2 + 14 new   | Type widening + new functions |
| 4   | `src/agents/model-scan.ts`                    |     8 + 1     | Logic extension + type cast   |
| 5   | `src/agents/huggingface-models.ts`            |       6       | Logic extension               |
| 6   | `src/commands/onboard-auth.config-litellm.ts` |       1       | Type widening                 |
| 7   | `src/agents/cloudflare-ai-gateway.ts`         |       1       | Type widening                 |
| 8   | `src/media-understanding/runner.ts`           |  2 + 68 new   | Imports + skip logic          |

**Total: 8 files, ~95 lines changed/added**
