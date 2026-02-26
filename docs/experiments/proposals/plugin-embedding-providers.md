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
- Provide in-repo integration points for both `memory-lancedb` and `memory-supabase`.

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

## Implementation Status

The following is already implemented in PR #26205:

1. Shared embedding adapter abstraction in `openclaw/plugin-sdk` (`createPluginMemoryEmbeddingAdapter` and related defaults/helpers).
2. Plugin registry/runtime hooks for embedding provider registration and lookup (`registerEmbeddingProvider`, `resolveEmbeddingProvider`, service-context resolver).
3. Memory backend integrations for both `memory-lancedb` and `memory-supabase` via the shared adapter.
4. Unit and plugin tests covering adapter behavior, resolver registration, and service resolution.
5. Compatibility preservation:
   - No changes to `plugins.slots.memory` semantics.
   - Existing plugin loading/enablement behavior remains unchanged.
   - Plugin API additions are optional and non-breaking.

## Compatibility and Migration Plan

### Current-compatible behavior

1. Memory backends continue to own their plugin configs and can instantiate embeddings through the shared SDK adapter.
2. Plugin-level embedding provider registration/resolution exists, but use is additive and not required by existing memory plugins.

### Productionization follow-ups

1. Standardize provider id conventions for cross-plugin consumption (for example `memory-supabase/default`) and document ownership rules.
2. Decide and document cross-plugin dependency ordering guarantees (or explicit `dependsOn`) for provider consumers.
3. Decide strict-vs-fallback policy when `resolveEmbeddingProvider(id)` misses.
4. Add migration examples for third-party memory plugins that want to expose or consume plugin-level embedding providers.

## Open Questions

- Should plugin embedding provider resolution be strict (hard error) or best-effort (soft fallback) when ids are missing?
- Should we formalize provider dependency ordering (e.g., explicit `dependsOn`) beyond current register/start sequencing?
- Do we need scoped provider visibility (global vs plugin-private ids)?
- Should memory backends prefer plugin-registered providers before core provider auth resolution by default?
