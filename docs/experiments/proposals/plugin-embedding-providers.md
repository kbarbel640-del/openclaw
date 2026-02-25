---
summary: "Exploration: plugin-level embedding providers decoupled from memory backends"
read_when:
  - Designing memory plugin APIs
  - Integrating memory-supabase and memory-lancedb
  - Extending plugin service dependency resolution
title: "Plugin Embedding Providers"
---

# Plugin Embedding Providers (Exploration)

Current implementation baseline is PR #26205 (memory-embedding-provider-refactor). This proposal documents the decoupled plugin-embedding-provider track and follow-up productionization work.

This proposal introduces a plugin-level embedding-provider layer so memory backends can share embedding adapters instead of owning provider-specific clients.

## Problem Statement

Today, memory backends duplicate embedding concerns (provider auth/model defaults/client wiring). That coupling causes:

- Backend-specific embedding code paths (`memory-lancedb` and `memory-supabase` evolve independently).
- Higher merge/conflict risk when backend PRs and embedding PRs land separately.
- Harder incremental rollout of shared provider behavior (e.g., env/auth fallback, provider defaults, local model support).

## Goals

- Add a shared embedding adapter abstraction in `openclaw/plugin-sdk`.
- Add plugin registry/service hooks to register and resolve plugin embedding providers.
- Keep existing memory slot semantics unchanged (`plugins.slots.memory` remains exclusive and compatible).
- Provide in-repo integration points aligned to current memory backend work (`memory-lancedb` now; `memory-supabase` id path prepared).

## Non-Goals

- Replacing memory slot ownership model in this spike.
- Forcing immediate migration of all memory plugins.
- Introducing breaking changes to existing plugin API consumers.
- Shipping final production policy for cross-plugin dependency ordering.

## Proposed SDK/API Shape

### Plugin SDK abstraction

- New `src/plugin-sdk/memory-embeddings.ts`:
  - `createPluginMemoryEmbeddingAdapter(...)`
  - `defaultMemoryEmbeddingModel(...)`
  - `resolveMemoryEmbeddingModel(...)`
  - `defaultMemoryEmbeddingApiKeyEnvVar(...)`
  - types: `MemoryEmbeddingProviderId`, `PluginMemoryEmbeddingConfig`, `PluginMemoryEmbeddingAdapter`

This centralizes provider/model defaults and delegates to core `createEmbeddingProvider(...)`.

### Plugin API extensions

- `OpenClawPluginEmbeddingProvider` type (plugin-registered embedding provider contract).
- Optional API methods on `OpenClawPluginApi`:
  - `registerEmbeddingProvider?(provider)`
  - `resolveEmbeddingProvider?(id)`

### Service context extension

- `OpenClawPluginServiceContext.resolveEmbeddingProvider(id)`

This exposes resolved embedding providers to plugin services at runtime startup.

## Lifecycle and Dependency Resolution Model

- During plugin `register(...)`, plugins may call `registerEmbeddingProvider`.
- Registry stores providers in `registry.embeddingProviders` with duplicate-id diagnostics.
- `resolveEmbeddingProvider` in plugin API resolves providers already present in registry (register-time lookup).
- At service start, `startPluginServices(...)` injects a resolver backed by registry providers.
- Memory slot gating remains unchanged and still applies only to `kind: "memory"` plugin selection.

## Compatibility and Migration Plan

1. Add shared SDK helper and registry/service resolver hooks (non-breaking; API additions are optional).
2. Move `memory-lancedb` embedding client wiring to shared SDK adapter.
3. Keep existing behavior compatible:
   - No changes to `plugins.slots.memory` semantics.
   - Existing plugin loading/enablement behavior unchanged.
4. Align with `memory-supabase` integration path by standardizing provider ids (for example `memory-supabase/default`) and resolver test coverage.
5. Follow-up: migrate `memory-supabase` to register/consume plugin-level embedding providers directly once that backend track lands in-tree.

## Open Questions

- Should plugin embedding provider resolution be strict (hard error) or best-effort (soft fallback) when ids are missing?
- Should we formalize provider dependency ordering (e.g., explicit `dependsOn`) beyond current register/start sequencing?
- Do we need scoped provider visibility (global vs plugin-private ids)?
- Should memory backends prefer plugin-registered providers before core provider auth resolution by default?
