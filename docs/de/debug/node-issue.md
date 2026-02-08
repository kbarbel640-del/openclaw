---
summary: Hinweise und Workarounds zum Absturz „__name is not a function“ bei Node + tsx
read_when:
  - Debugging von Node-only-Dev-Skripten oder Watch-Mode-Fehlern
  - Untersuchung von tsx/esbuild-Loader-Abstürzen in OpenClaw
title: "Node + tsx-Absturz"
x-i18n:
  source_path: debug/node-issue.md
  source_hash: f9e9bd2281508337
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:14Z
---

# Node + tsx „\_\_name is not a function“-Absturz

## Zusammenfassung

Das Ausführen von OpenClaw über Node mit `tsx` schlägt beim Start fehl mit:

```
[openclaw] Failed to start CLI: TypeError: __name is not a function
    at createSubsystemLogger (.../src/logging/subsystem.ts:203:25)
    at .../src/agents/auth-profiles/constants.ts:25:20
```

Dies begann nach der Umstellung der Dev-Skripte von Bun auf `tsx` (Commit `2871657e`, 06.01.2026). Derselbe Laufzeitpfad funktionierte mit Bun.

## Umgebung

- Node: v25.x (beobachtet bei v25.3.0)
- tsx: 4.21.0
- OS: macOS (Reproduktion vermutlich auch auf anderen Plattformen, die Node 25 ausführen)

## Repro (nur Node)

```bash
# in repo root
node --version
pnpm install
node --import tsx src/entry.ts status
```

## Minimal-Repro im Repository

```bash
node --import tsx scripts/repro/tsx-name-repro.ts
```

## Node-Versionsprüfung

- Node 25.3.0: schlägt fehl
- Node 22.22.0 (Homebrew `node@22`): schlägt fehl
- Node 24: hier noch nicht installiert; Verifizierung erforderlich

## Hinweise / Hypothese

- `tsx` verwendet esbuild zur Transformation von TS/ESM. Esbuilds `keepNames` emittiert einen `__name`-Helper und umschließt Funktionsdefinitionen mit `__name(...)`.
- Der Absturz deutet darauf hin, dass `__name` existiert, zur Laufzeit jedoch keine Funktion ist, was impliziert, dass der Helper für dieses Modul im Node-25-Loader-Pfad fehlt oder überschrieben wird.
- Ähnliche Probleme mit dem `__name`-Helper wurden bei anderen esbuild-Nutzern gemeldet, wenn der Helper fehlt oder umgeschrieben wird.

## Regressionsverlauf

- `2871657e` (06.01.2026): Skripte von Bun auf tsx umgestellt, um Bun optional zu machen.
- Davor (Bun-Pfad) funktionierten `openclaw status` und `gateway:watch`.

## Workarounds

- Bun für Dev-Skripte verwenden (derzeitige temporäre Rückkehr).
- Node + tsc im Watch-Modus verwenden und anschließend das kompilierte Output ausführen:
  ```bash
  pnpm exec tsc --watch --preserveWatchOutput
  node --watch openclaw.mjs status
  ```
- Lokal bestätigt: `pnpm exec tsc -p tsconfig.json` + `node openclaw.mjs status` funktioniert unter Node 25.
- esbuild keepNames im TS-Loader deaktivieren, falls möglich (verhindert das Einfügen des `__name`-Helpers); tsx stellt dies derzeit nicht bereit.
- Node LTS (22/24) mit `tsx` testen, um zu prüfen, ob das Problem spezifisch für Node 25 ist.

## Referenzen

- https://opennext.js.org/cloudflare/howtos/keep_names
- https://esbuild.github.io/api/#keep-names
- https://github.com/evanw/esbuild/issues/1031

## Nächste Schritte

- Reproduktion unter Node 22/24, um eine Regression in Node 25 zu bestätigen.
- `tsx` Nightly testen oder auf eine frühere Version pinnen, falls eine bekannte Regression existiert.
- Falls es sich unter Node LTS reproduzieren lässt, ein minimales Repro upstream mit dem `__name`-Stacktrace einreichen.
