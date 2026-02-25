---
summary: "Exploration: plugin-level embedding provider abstraction for memory backends"
read_when:
  - Planning plugin SDK capabilities for shared embedding providers
title: "Plugin Embedding Providers (Exploration)"
---

# Plugin Embedding Providers (Exploration)

This is a forward-looking proposal. It is not the current shipping behavior.

## Current behavior

- OpenClaw keeps a single active memory backend plugin in `plugins.slots.memory`.
- Memory backend plugins can share embedding behavior through a common adapter in
  `openclaw/plugin-sdk`.
- Provider auth/env resolution follows core OpenClaw conventions (provider auth
  profiles, config, env layers), not plugin-specific env variable names.

## Problem

- The memory backend plugin is currently responsible for both persistence and
  embedding orchestration.
- This works, but it couples concerns that could be independently swappable.

## Proposed direction

- Add a dedicated plugin-level embedding provider contract in SDK.
- Keep memory backends focused on persistence/query behavior.
- Let backends request embeddings through a stable SDK service boundary.

Potential shape:

- `PluginKind` adds an optional non-exclusive `embedding` service kind.
- SDK adds service discovery for typed plugin services (for example:
  `api.resolveService("embedding")`).
- Memory backends declare optional embedding-service dependency with fallback to
  core adapter.

## Design goals

- Preserve core auth/env resolution order and provider naming.
- Avoid vendor-specific key aliases in plugin configs.
- Keep one backend active in memory slot while allowing shared embedding
  services.
- Keep local embeddings first-class (`provider: local`) with same adapter
  semantics.

## Open questions

- Should embedding services be global or scoped per agent/plugin instance?
- How should dependency ordering and startup failures be reported?
- Should the memory slot hard-require an embedding service, or allow implicit
  fallback to core adapter for backward compatibility?
- What migration path minimizes breaking changes for existing third-party
  plugins?
