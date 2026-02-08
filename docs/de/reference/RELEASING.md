---
summary: "Schritt-für-Schritt-Release-Checkliste für npm + macOS-App"
read_when:
  - Schneiden eines neuen npm-Releases
  - Schneiden eines neuen macOS-App-Releases
  - Verifizieren von Metadaten vor der Veröffentlichung
x-i18n:
  source_path: reference/RELEASING.md
  source_hash: 54cb2b822bfa3c0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:31Z
---

# Release-Checkliste (npm + macOS)

Verwenden Sie `pnpm` (Node 22+) aus dem Repo-Root. Halten Sie den Working Tree vor dem Taggen/Veröffentlichen sauber.

## Operator-Trigger

Wenn der Operator „release“ sagt, führen Sie sofort diesen Preflight aus (keine Zusatzfragen, außer wenn blockiert):

- Lesen Sie dieses Dokument und `docs/platforms/mac/release.md`.
- Laden Sie die Umgebungsvariablen aus `~/.profile` und bestätigen Sie, dass `SPARKLE_PRIVATE_KEY_FILE` + App Store Connect-Variablen gesetzt sind (SPARKLE_PRIVATE_KEY_FILE sollte in `~/.profile` liegen).
- Verwenden Sie bei Bedarf Sparkle-Schlüssel aus `~/Library/CloudStorage/Dropbox/Backup/Sparkle`.

1. **Version & Metadaten**

- [ ] Erhöhen Sie die `package.json`-Version (z. B. `2026.1.29`).
- [ ] Führen Sie `pnpm plugins:sync` aus, um Erweiterungs-Paketversionen + Changelogs abzugleichen.
- [ ] Aktualisieren Sie CLI-/Versionsstrings: [`src/cli/program.ts`](https://github.com/openclaw/openclaw/blob/main/src/cli/program.ts) und den Baileys-User-Agent in [`src/provider-web.ts`](https://github.com/openclaw/openclaw/blob/main/src/provider-web.ts).
- [ ] Bestätigen Sie Paketmetadaten (Name, Beschreibung, Repository, Keywords, Lizenz) und dass die `bin`-Map für `openclaw` auf [`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs) zeigt.
- [ ] Wenn Abhängigkeiten geändert wurden, führen Sie `pnpm install` aus, damit `pnpm-lock.yaml` aktuell ist.

2. **Build & Artefakte**

- [ ] Wenn sich A2UI-Inputs geändert haben, führen Sie `pnpm canvas:a2ui:bundle` aus und committen Sie ggf. aktualisierte [`src/canvas-host/a2ui/a2ui.bundle.js`](https://github.com/openclaw/openclaw/blob/main/src/canvas-host/a2ui/a2ui.bundle.js).
- [ ] `pnpm run build` (regeneriert `dist/`).
- [ ] Verifizieren Sie, dass das npm-Paket `files` alle erforderlichen `dist/*`-Ordner enthält (insbesondere `dist/node-host/**` und `dist/acp/**` für headless node + ACP CLI).
- [ ] Bestätigen Sie, dass `dist/build-info.json` existiert und den erwarteten `commit`-Hash enthält (das CLI-Banner verwendet dies für npm-Installationen).
- [ ] Optional: `npm pack --pack-destination /tmp` nach dem Build; inspizieren Sie den Tarball-Inhalt und halten Sie ihn für den GitHub-Release bereit (nicht committen).

3. **Changelog & Doku**

- [ ] Aktualisieren Sie `CHANGELOG.md` mit benutzerseitigen Highlights (Datei bei Bedarf anlegen); Einträge strikt absteigend nach Version sortieren.
- [ ] Stellen Sie sicher, dass README-Beispiele/-Flags dem aktuellen CLI-Verhalten entsprechen (insbesondere neue Befehle oder Optionen).

4. **Validierung**

- [ ] `pnpm build`
- [ ] `pnpm check`
- [ ] `pnpm test` (oder `pnpm test:coverage`, wenn Sie Coverage-Ausgaben benötigen)
- [ ] `pnpm release:check` (verifiziert npm-pack-Inhalte)
- [ ] `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke` (Docker-Installations-Smoke-Test, schneller Pfad; vor dem Release erforderlich)
  - Wenn das unmittelbar vorherige npm-Release bekanntermaßen defekt ist, setzen Sie `OPENCLAW_INSTALL_SMOKE_PREVIOUS=<last-good-version>` oder `OPENCLAW_INSTALL_SMOKE_SKIP_PREVIOUS=1` für den Preinstall-Schritt.
- [ ] (Optional) Vollständiger Installer-Smoke (fügt Non-Root- + CLI-Abdeckung hinzu): `pnpm test:install:smoke`
- [ ] (Optional) Installer-E2E (Docker, führt `curl -fsSL https://openclaw.ai/install.sh | bash` aus, onboardet und führt dann echte Tool-Aufrufe aus):
  - `pnpm test:install:e2e:openai` (erfordert `OPENAI_API_KEY`)
  - `pnpm test:install:e2e:anthropic` (erfordert `ANTHROPIC_API_KEY`)
  - `pnpm test:install:e2e` (erfordert beide Schlüssel; führt beide Anbieter aus)
- [ ] (Optional) Stichprobenprüfung des Web-Gateways, wenn Ihre Änderungen Sende-/Empfangspfade betreffen.

5. **macOS-App (Sparkle)**

- [ ] macOS-App bauen + signieren und anschließend für die Distribution zippen.
- [ ] Sparkle-Appcast generieren (HTML-Notes via [`scripts/make_appcast.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/make_appcast.sh)) und `appcast.xml` aktualisieren.
- [ ] App-Zip (und optionales dSYM-Zip) bereithalten, um es dem GitHub-Release anzuhängen.
- [ ] Folgen Sie [macOS release](/platforms/mac/release) für die exakten Befehle und erforderlichen Umgebungsvariablen.
  - `APP_BUILD` muss numerisch + monoton sein (kein `-beta`), damit Sparkle Versionen korrekt vergleicht.
  - Falls notariert wird, verwenden Sie das `openclaw-notary`-Schlüsselbundprofil, das aus App Store Connect API-Umgebungsvariablen erstellt wurde (siehe [macOS release](/platforms/mac/release)).

6. **Veröffentlichen (npm)**

- [ ] Bestätigen Sie, dass der Git-Status sauber ist; committen und pushen Sie bei Bedarf.
- [ ] `npm login` (2FA verifizieren), falls erforderlich.
- [ ] `npm publish --access public` (verwenden Sie `--tag beta` für Pre-Releases).
- [ ] Verifizieren Sie die Registry: `npm view openclaw version`, `npm view openclaw dist-tags` und `npx -y openclaw@X.Y.Z --version` (oder `--help`).

### Fehlerbehebung (Notizen aus dem 2.0.0-beta2-Release)

- **npm pack/publish hängt oder erzeugt einen riesigen Tarball**: Das macOS-App-Bundle in `dist/OpenClaw.app` (und Release-Zips) werden in das Paket aufgenommen. Beheben Sie dies, indem Sie die Veröffentlichungsinhalte über `package.json` `files` whitelisten (dist-Unterverzeichnisse, Doku, Skills einschließen; App-Bundles ausschließen). Bestätigen Sie mit `npm pack --dry-run`, dass `dist/OpenClaw.app` nicht aufgeführt ist.
- **npm auth Web-Loop für dist-tags**: Verwenden Sie Legacy-Auth, um eine OTP-Aufforderung zu erhalten:
  - `NPM_CONFIG_AUTH_TYPE=legacy npm dist-tag add openclaw@X.Y.Z latest`
- **`npx`-Verifizierung schlägt mit `ECOMPROMISED: Lock compromised` fehl**: Mit frischem Cache erneut versuchen:
  - `NPM_CONFIG_CACHE=/tmp/npm-cache-$(date +%s) npx -y openclaw@X.Y.Z --version`
- **Tag muss nach einer späten Korrektur neu ausgerichtet werden**: Tag erzwingen, aktualisieren und pushen; stellen Sie anschließend sicher, dass die GitHub-Release-Artefakte weiterhin passen:
  - `git tag -f vX.Y.Z && git push -f origin vX.Y.Z`

7. **GitHub-Release + Appcast**

- [ ] Taggen und pushen: `git tag vX.Y.Z && git push origin vX.Y.Z` (oder `git push --tags`).
- [ ] GitHub-Release für `vX.Y.Z` erstellen/aktualisieren mit **Titel `openclaw X.Y.Z`** (nicht nur der Tag); der Textkörper sollte den **vollständigen** Changelog-Abschnitt für diese Version enthalten (Highlights + Changes + Fixes), inline (keine bloßen Links), und **darf den Titel im Textkörper nicht wiederholen**.
- [ ] Artefakte anhängen: `npm pack`-Tarball (optional), `OpenClaw-X.Y.Z.zip` und `OpenClaw-X.Y.Z.dSYM.zip` (falls erzeugt).
- [ ] Das aktualisierte `appcast.xml` committen und pushen (Sparkle speist aus main).
- [ ] Aus einem sauberen temporären Verzeichnis (kein `package.json`) `npx -y openclaw@X.Y.Z send --help` ausführen, um zu bestätigen, dass Installation/CLI-Einstiegspunkte funktionieren.
- [ ] Release-Notes ankündigen/teilen.

## Plugin-Publish-Scope (npm)

Wir veröffentlichen nur **bestehende npm-Plugins** unter dem Scope `@openclaw/*`. Gebündelte
Plugins, die nicht auf npm sind, bleiben **nur im Verzeichnisbaum** (werden weiterhin in
`extensions/**` ausgeliefert).

Vorgehen zur Ermittlung der Liste:

1. `npm search @openclaw --json` ausführen und die Paketnamen erfassen.
2. Mit den `extensions/*/package.json`-Namen vergleichen.
3. Nur die **Schnittmenge** veröffentlichen (bereits auf npm).

Aktuelle npm-Plugin-Liste (bei Bedarf aktualisieren):

- @openclaw/bluebubbles
- @openclaw/diagnostics-otel
- @openclaw/discord
- @openclaw/feishu
- @openclaw/lobster
- @openclaw/matrix
- @openclaw/msteams
- @openclaw/nextcloud-talk
- @openclaw/nostr
- @openclaw/voice-call
- @openclaw/zalo
- @openclaw/zalouser

Release-Notes müssen außerdem **neue optionale gebündelte Plugins** hervorheben, die **nicht standardmäßig aktiviert** sind (Beispiel: `tlon`).
