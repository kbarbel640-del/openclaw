---
summary: "Bun-Workflow (experimentell): Installation und Fallstricke im Vergleich zu pnpm"
read_when:
  - Sie moechten die schnellste lokale Entwicklungsiteration (bun + watch)
  - Sie stossen auf Probleme bei Bun-Installation/Patching/Lifecycle-Skripten
title: "Bun (Experimentell)"
x-i18n:
  source_path: install/bun.md
  source_hash: eb3f4c222b6bae49
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:35Z
---

# Bun (experimentell)

Ziel: Dieses Repo mit **Bun** ausfuehren (optional, nicht empfohlen fuer WhatsApp/Telegram),
ohne von pnpm-Workflows abzuweichen.

⚠️ **Nicht empfohlen fuer den Gateway-Runtime** (WhatsApp/Telegram-Bugs). Verwenden Sie Node fuer die Produktion.

## Status

- Bun ist eine optionale lokale Laufzeit zum direkten Ausfuehren von TypeScript (`bun run …`, `bun --watch …`).
- `pnpm` ist der Standard fuer Builds und bleibt voll unterstuetzt (und wird von einigen Docs-Tools verwendet).
- Bun kann `pnpm-lock.yaml` nicht verwenden und ignoriert es.

## Installieren

Standard:

```sh
bun install
```

Hinweis: `bun.lock`/`bun.lockb` werden von git ignoriert, es gibt also in beiden Faellen keine Repo-Aenderungen. Wenn Sie _keine Lockfile-Schreibvorgaenge_ wollen:

```sh
bun install --no-save
```

## Build / Test (Bun)

```sh
bun run build
bun run vitest run
```

## Bun-Lifecycle-Skripte (standardmaessig blockiert)

Bun kann Abhaengigkeits-Lifecycle-Skripte blockieren, sofern sie nicht explizit als vertrauenswuerdig markiert sind (`bun pm untrusted` / `bun pm trust`).
Fuer dieses Repo sind die haeufig blockierten Skripte nicht erforderlich:

- `@whiskeysockets/baileys` `preinstall`: prueft Node-Major >= 20 (wir verwenden Node 22+).
- `protobufjs` `postinstall`: gibt Warnungen zu inkompatiblen Versionsschemata aus (keine Build-Artefakte).

Wenn Sie auf ein echtes Laufzeitproblem stossen, das diese Skripte erfordert, vertrauen Sie ihnen explizit:

```sh
bun pm trust @whiskeysockets/baileys protobufjs
```

## Einschraenkungen

- Einige Skripte sind weiterhin fest auf pnpm codiert (z. B. `docs:build`, `ui:*`, `protocol:check`). Fuehren Sie diese vorerst ueber pnpm aus.
