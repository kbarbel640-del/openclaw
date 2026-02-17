---
summary: "Environment-based config composition with the $env directive"
read_when:
  - Setting up different configs for development, staging, production
  - Using OPENCLAW_ENV or NODE_ENV to switch config profiles
  - Overriding specific config values per environment
title: "Environment Profiles"
---

# Environment profiles

The `$env` directive lets you declare environment-specific config overrides in a single config file.
Instead of maintaining separate files per environment, define all variants inline and let the active
environment select the right overrides at load time.

## How it works

1. OpenClaw resolves the active environment from `OPENCLAW_ENV` → `NODE_ENV` → `"development"` (first non-empty value wins).
2. If your config contains a top-level `$env` object, the matching key is deep-merged into the root config.
3. The `$env` block is then removed — downstream code never sees it.

This runs **after** `$include` resolution and **before** `${VAR}` substitution, so environment
profiles can contain variable references that are resolved later.

## Configuration

```json5
{
  // Base config — always applied
  model: "claude-sonnet-4-20250514",
  tools: {
    exec: { security: "allowlist" },
  },

  // Environment overrides
  $env: {
    development: {
      model: "claude-haiku",
      diagnostics: { enabled: true },
    },
    staging: {
      model: "claude-sonnet-4-20250514",
      diagnostics: { enabled: true },
    },
    production: {
      model: "claude-sonnet-4-20250514",
      tools: {
        exec: { security: "deny" },
      },
    },
  },
}
```

## Environment resolution

| Priority | Source                 | Example                               |
| -------- | ---------------------- | ------------------------------------- |
| 1        | `OPENCLAW_ENV` env var | `OPENCLAW_ENV=staging openclaw start` |
| 2        | `NODE_ENV` env var     | `NODE_ENV=production openclaw start`  |
| 3        | Default                | `"development"`                       |

## Deep merge behavior

Environment overrides are **deep-merged** into the base config, not shallow-replaced.
This means you only need to specify the fields you want to override:

```json5
// Base
{
  tools: {
    exec: { security: "allowlist", ask: "on-miss" },
  },
  $env: {
    production: {
      tools: {
        exec: { security: "deny" },
        // ask: "on-miss" is preserved from base
      },
    },
  },
}

// Resolved (production):
// tools.exec.security = "deny"
// tools.exec.ask = "on-miss"  ← inherited from base
```

## Combining with `$include`

Since `$env` runs after `$include`, you can split shared config into included files and still
apply environment-specific overrides:

```json5
{
  $include: ["./shared/base.json5"],
  $env: {
    production: {
      model: "claude-sonnet-4-20250514",
    },
  },
}
```

## Combining with `${VAR}` substitution

Environment variables in profile values are resolved after `$env` merging:

```json5
{
  $env: {
    production: {
      providers: {
        anthropic: { apiKey: "${ANTHROPIC_API_KEY}" },
      },
    },
  },
}
```
