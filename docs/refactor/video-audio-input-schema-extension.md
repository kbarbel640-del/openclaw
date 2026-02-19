# Modification Cards: Video/Audio Input Schema Extension

**Date:** 2026-02-19
**Branch:** `fix/extend-model-input-schema-video-audio`
**Issue:** Gateway startup fails when `openclaw.json` declares `"video"` / `"audio"` input modalities

---

## MOD-001: Zod Validation Schema

| Field                   | Value                           |
| ----------------------- | ------------------------------- |
| **File**                | `src/config/zod-schema.core.ts` |
| **Line**                | 41                              |
| **Type**                | Schema Extension                |
| **Risk**                | Low                             |
| **Backward Compatible** | Yes                             |

**Before:**

```ts
input: z.array(z.union([z.literal("text"), z.literal("image")])).optional(),
```

**After:**

```ts
input: z.array(z.union([z.literal("text"), z.literal("image"), z.literal("video"), z.literal("audio")])).optional(),
```

**Rationale:** Root cause of the startup crash. Config files declaring `"video"` or `"audio"` modalities failed Zod validation.

---

## MOD-002: TypeScript Model Definition Type

| Field                   | Value                        |
| ----------------------- | ---------------------------- |
| **File**                | `src/config/types.models.ts` |
| **Line**                | 31                           |
| **Type**                | Type Widening                |
| **Risk**                | Low                          |
| **Backward Compatible** | Yes                          |

**Before:**

```ts
input: Array<"text" | "image">;
```

**After:**

```ts
input: Array<"text" | "image" | "video" | "audio">;
```

**Rationale:** Keep the TypeScript type in sync with the Zod schema.

---

## MOD-003: Model Catalog Entry Types

| Field                   | Value                         |
| ----------------------- | ----------------------------- |
| **File**                | `src/agents/model-catalog.ts` |
| **Lines**               | 11, 20                        |
| **Type**                | Type Widening                 |
| **Risk**                | Low                           |
| **Backward Compatible** | Yes                           |

**Change:** Widened `ModelCatalogEntry.input` and `DiscoveredModel.input` from `Array<"text" | "image">` to `Array<"text" | "image" | "video" | "audio">`.

**Rationale:** These types flow from `ModelDefinitionConfig` and must accept the same union.

---

## MOD-004: Model Scan Modality Parser

| Field                   | Value                      |
| ----------------------- | -------------------------- |
| **File**                | `src/agents/model-scan.ts` |
| **Lines**               | 101-109, 472               |
| **Type**                | Logic Extension            |
| **Risk**                | Low                        |
| **Backward Compatible** | Yes                        |

**Change:** `parseModality()` now detects `"video"` and `"audio"` tokens in addition to `"image"`. The call site at line 472 adds a type cast `as ("text" | "image")[]` because the external `@mariozechner/pi-ai` library's `Model` type only accepts `("text" | "image")[]`.

**Rationale:** OpenRouter and similar discovery endpoints may report video/audio modalities that should be preserved in the catalog.

---

## MOD-005: HuggingFace Models Discovery

| Field                   | Value                              |
| ----------------------- | ---------------------------------- |
| **File**                | `src/agents/huggingface-models.ts` |
| **Lines**               | 201-203                            |
| **Type**                | Logic Extension                    |
| **Risk**                | Low                                |
| **Backward Compatible** | Yes                                |

**Before:**

```ts
const input: Array<"text" | "image"> =
  Array.isArray(modalities) && modalities.includes("image") ? ["text", "image"] : ["text"];
```

**After:**

```ts
const input: Array<"text" | "image" | "video" | "audio"> = ["text"];
if (Array.isArray(modalities)) {
  if (modalities.includes("image")) input.push("image");
  if (modalities.includes("video")) input.push("video");
  if (modalities.includes("audio")) input.push("audio");
}
```

**Rationale:** HuggingFace `architecture.input_modalities` can include `"video"` and `"audio"` for multimodal models (e.g. Gemini).

---

## MOD-006: LiteLLM Onboarding Config

| Field                   | Value                                         |
| ----------------------- | --------------------------------------------- |
| **File**                | `src/commands/onboard-auth.config-litellm.ts` |
| **Line**                | 23                                            |
| **Type**                | Type Widening                                 |
| **Risk**                | Low                                           |
| **Backward Compatible** | Yes                                           |

**Change:** Local return type annotation widened to match `ModelDefinitionConfig.input`.

---

## MOD-007: Cloudflare AI Gateway

| Field                   | Value                                 |
| ----------------------- | ------------------------------------- |
| **File**                | `src/agents/cloudflare-ai-gateway.ts` |
| **Line**                | 20                                    |
| **Type**                | Type Widening                         |
| **Risk**                | Low                                   |
| **Backward Compatible** | Yes                                   |

**Change:** Parameter type annotation widened to match `ModelDefinitionConfig.input`.

---

## MOD-008: Capability Helper Functions

| Field                   | Value                         |
| ----------------------- | ----------------------------- |
| **File**                | `src/agents/model-catalog.ts` |
| **Lines**               | 174-185 (new)                 |
| **Type**                | New Functions                 |
| **Risk**                | None                          |
| **Backward Compatible** | Yes                           |

**Added:**

```ts
export function modelSupportsVideo(entry: ModelCatalogEntry | undefined): boolean;
export function modelSupportsAudio(entry: ModelCatalogEntry | undefined): boolean;
```

**Rationale:** Symmetric helpers alongside existing `modelSupportsVision()`. Used by the runner skip logic.

---

## MOD-009: Media Understanding Runner Skip Logic

| Field                   | Value                               |
| ----------------------- | ----------------------------------- |
| **File**                | `src/media-understanding/runner.ts` |
| **Lines**               | 721-790 (new), 9-10 (imports)       |
| **Type**                | Logic Extension                     |
| **Risk**                | Low                                 |
| **Backward Compatible** | Yes                                 |

**Change:** Added two new skip blocks (for `"video"` and `"audio"` capabilities) that mirror the existing `"image"` skip block. When the primary model natively supports the capability, the runner returns a `"skipped"` decision instead of dispatching to a separate understanding provider.

**Imports added:** `modelSupportsAudio`, `modelSupportsVideo` from `../agents/model-catalog.js`.

---

## Upstream Comparison Summary

| File                                          | Modified by Us | Also Modified Upstream |        Conflict Risk        |
| --------------------------------------------- | :------------: | :--------------------: | :-------------------------: |
| `src/config/zod-schema.core.ts`               |      Yes       |           No           |            None             |
| `src/config/types.models.ts`                  |      Yes       |           No           |            None             |
| `src/agents/model-catalog.ts`                 |      Yes       |           No           |            None             |
| `src/agents/model-scan.ts`                    |      Yes       |           No           |            None             |
| `src/agents/huggingface-models.ts`            |      Yes       |           No           |            None             |
| `src/commands/onboard-auth.config-litellm.ts` |      Yes       |           No           |            None             |
| `src/agents/cloudflare-ai-gateway.ts`         |      Yes       |           No           |            None             |
| `src/media-understanding/runner.ts`           |      Yes       |        **Yes**         | **Low** (different regions) |

**runner.ts upstream changes:** Import additions (`mergeInboundPathRoots`, `resolveIMessageAttachmentRoots`, `MediaAttachmentCacheOptions`) and new `resolveMediaAttachmentLocalRoots()` function. These are in the import block and lines 79-101 — no overlap with our changes at lines 9-10 (imports) and 721-790 (skip blocks).
