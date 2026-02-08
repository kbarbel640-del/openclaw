---
summary: „Stabile, Beta- und Dev-Kanäle: Semantik, Wechsel und Tagging“
read_when:
  - Sie möchten zwischen Stable/Beta/Dev wechseln
  - Sie taggen oder veröffentlichen Vorabversionen
title: „Entwicklungskanäle“
x-i18n:
  source_path: install/development-channels.md
  source_hash: 2b01219b7e705044
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:37Z
---

# Entwicklungskanäle

Zuletzt aktualisiert: 2026-01-21

OpenClaw stellt drei Update-Kanäle bereit:

- **stable**: npm dist-tag `latest`.
- **beta**: npm dist-tag `beta` (Builds in der Testphase).
- **dev**: beweglicher Head von `main` (git). npm dist-tag: `dev` (wenn veröffentlicht).

Wir liefern Builds in **beta** aus, testen sie und **befördern dann einen geprüften Build zu `latest`**,
ohne die Versionsnummer zu ändern — dist-tags sind die maßgebliche Quelle für npm-Installationen.

## Kanäle wechseln

Git-Checkout:

```bash
openclaw update --channel stable
openclaw update --channel beta
openclaw update --channel dev
```

- `stable`/`beta` checken den neuesten passenden Tag aus (oft derselbe Tag).
- `dev` wechselt zu `main` und rebaset auf den Upstream.

Globale npm/pnpm-Installation:

```bash
openclaw update --channel stable
openclaw update --channel beta
openclaw update --channel dev
```

Dies aktualisiert über den entsprechenden npm dist-tag (`latest`, `beta`, `dev`).

Wenn Sie **explizit** mit `--channel` den Kanal wechseln, richtet OpenClaw auch
die Installationsmethode aus:

- `dev` stellt einen Git-Checkout sicher (Standard `~/openclaw`, Überschreiben mit `OPENCLAW_GIT_DIR`),
  aktualisiert ihn und installiert die globale CLI aus diesem Checkout.
- `stable`/`beta` installieren aus npm unter Verwendung des passenden dist-tags.

Tipp: Wenn Sie stable + dev parallel nutzen möchten, behalten Sie zwei Klone und richten Sie Ihr Gateway auf den stabilen aus.

## Plugins und Kanäle

Wenn Sie mit `openclaw update` den Kanal wechseln, synchronisiert OpenClaw auch die Plugin-Quellen:

- `dev` bevorzugt gebündelte Plugins aus dem Git-Checkout.
- `stable` und `beta` stellen per npm installierte Plugin-Pakete wieder her.

## Best Practices für Tagging

- Taggen Sie Releases, auf denen Git-Checkouts landen sollen (`vYYYY.M.D` oder `vYYYY.M.D-<patch>`).
- Halten Sie Tags unveränderlich: Verschieben oder verwenden Sie einen Tag niemals erneut.
- npm dist-tags bleiben die maßgebliche Quelle für npm-Installationen:
  - `latest` → stable
  - `beta` → Kandidaten-Build
  - `dev` → Main-Snapshot (optional)

## Verfügbarkeit der macOS-App

Beta- und Dev-Builds enthalten möglicherweise **keine** macOS-App-Veröffentlichung. Das ist in Ordnung:

- Der Git-Tag und der npm dist-tag können dennoch veröffentlicht werden.
- Weisen Sie in den Release Notes oder im Changelog auf „keine macOS-Builds für diese Beta“ hin.
