---
summary: "Wie die Installer-Skripte funktionieren (install.sh + install-cli.sh), Flags und Automatisierung"
read_when:
  - Sie moechten `openclaw.ai/install.sh` verstehen
  - Sie moechten Installationen automatisieren (CI / headless)
  - Sie moechten aus einem GitHub-Checkout installieren
title: "Installer-Interna"
x-i18n:
  source_path: install/installer.md
  source_hash: 9e0a19ecb5da0a39
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:46Z
---

# Installer-Interna

OpenClaw liefert zwei Installer-Skripte (bereitgestellt unter `openclaw.ai`):

- `https://openclaw.ai/install.sh` — „empfohlener“ Installer (standardmaessig globale npm-Installation; kann auch aus einem GitHub-Checkout installieren)
- `https://openclaw.ai/install-cli.sh` — nicht-root-freundlicher CLI-Installer (installiert in ein Praefix mit eigenem Node)
- `https://openclaw.ai/install.ps1` — Windows-PowerShell-Installer (standardmaessig npm; optional Git-Installation)

Um die aktuellen Flags und das Verhalten zu sehen, fuehren Sie aus:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Windows- (PowerShell-)Hilfe:

```powershell
& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -?
```

Wenn der Installer erfolgreich durchlaeuft, aber `openclaw` in einem neuen Terminal nicht gefunden wird, handelt es sich meist um ein Node/npm-PATH-Problem. Siehe: [Install](/install#nodejs--npm-path-sanity).

## install.sh (empfohlen)

Was er tut (auf hoher Ebene):

- Erkennung des Betriebssystems (macOS / Linux / WSL).
- Sicherstellen von Node.js **22+** (macOS ueber Homebrew; Linux ueber NodeSource).
- Wahl der Installationsmethode:
  - `npm` (Standard): `npm install -g openclaw@latest`
  - `git`: Klonen/Build eines Source-Checkouts und Installation eines Wrapper-Skripts
- Unter Linux: Vermeidung globaler npm-Berechtigungsfehler durch Umstellen des npm-Praefixes auf `~/.npm-global`, falls erforderlich.
- Bei Upgrade einer bestehenden Installation: Ausfuehren von `openclaw doctor --non-interactive` (Best Effort).
- Bei Git-Installationen: Ausfuehren von `openclaw doctor --non-interactive` nach Installation/Aktualisierung (Best Effort).
- Mildert `sharp`-Native-Installationsfallen, indem standardmaessig `SHARP_IGNORE_GLOBAL_LIBVIPS=1` verwendet wird (vermeidet das Bauen gegen systemweites libvips).

Wenn Sie _moechten_, dass `sharp` gegen ein global installiertes libvips linkt (oder wenn Sie debuggen), setzen Sie:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=0 curl -fsSL https://openclaw.ai/install.sh | bash
```

### Auffindbarkeit / „Git-Install“-Prompt

Wenn Sie den Installer ausfuehren, waehrend Sie sich **bereits innerhalb eines OpenClaw-Source-Checkouts** befinden (erkannt ueber `package.json` + `pnpm-workspace.yaml`), erscheint eine Abfrage:

- dieses Checkout aktualisieren und verwenden (`git`)
- oder zur globalen npm-Installation migrieren (`npm`)

In nicht-interaktiven Kontexten (kein TTY / `--no-prompt`) muessen Sie `--install-method git|npm` uebergeben (oder `OPENCLAW_INSTALL_METHOD` setzen), andernfalls beendet sich das Skript mit Code `2`.

### Warum Git benoetigt wird

Git ist fuer den Pfad `--install-method git` erforderlich (Klonen / Pullen).

Fuer `npm`-Installationen ist Git _ueblicherweise_ nicht erforderlich, aber in manchen Umgebungen wird es dennoch benoetigt (z. B. wenn ein Paket oder eine Abhaengigkeit ueber eine Git-URL bezogen wird). Der Installer stellt derzeit sicher, dass Git vorhanden ist, um `spawn git ENOENT`-Ueberraschungen auf frischen Distributionen zu vermeiden.

### Warum npm auf frischem Linux auf `EACCES` stoesst

Auf manchen Linux-Setups (insbesondere nach der Installation von Node ueber den System-Paketmanager oder NodeSource) zeigt das globale npm-Praefix auf einen Root-eigenen Speicherort. Dann schlaegt `npm install -g ...` mit Berechtigungsfehlern wie `EACCES` / `mkdir` fehl.

`install.sh` mindert dies, indem das Praefix umgestellt wird auf:

- `~/.npm-global` (und Hinzufuegen zu `PATH` in `~/.bashrc` / `~/.zshrc`, sofern vorhanden)

## install-cli.sh (nicht-root CLI-Installer)

Dieses Skript installiert `openclaw` in ein Praefix (Standard: `~/.openclaw`) und installiert ausserdem eine dedizierte Node-Laufzeit unter diesem Praefix, sodass es auf Maschinen funktioniert, auf denen Sie das System-Node/npm nicht anfassen moechten.

Hilfe:

```bash
curl -fsSL https://openclaw.ai/install-cli.sh | bash -s -- --help
```

## install.ps1 (Windows PowerShell)

Was er tut (auf hoher Ebene):

- Sicherstellen von Node.js **22+** (winget/Chocolatey/Scoop oder manuell).
- Wahl der Installationsmethode:
  - `npm` (Standard): `npm install -g openclaw@latest`
  - `git`: Klonen/Build eines Source-Checkouts und Installation eines Wrapper-Skripts
- Fuehrt `openclaw doctor --non-interactive` bei Upgrades und Git-Installationen aus (Best Effort).

Beispiele:

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git -GitDir "C:\\openclaw"
```

Umgebungsvariablen:

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`

Git-Anforderung:

Wenn Sie `-InstallMethod git` waehlen und Git fehlt, gibt der Installer den
Git-for-Windows-Link (`https://git-scm.com/download/win`) aus und beendet sich.

Haeufige Windows-Probleme:

- **npm error spawn git / ENOENT**: Installieren Sie Git for Windows und oeffnen Sie PowerShell erneut, dann fuehren Sie den Installer erneut aus.
- **„openclaw“ wird nicht erkannt**: Ihr globaler npm-bin-Ordner ist nicht im PATH. Die meisten Systeme verwenden
  `%AppData%\\npm`. Sie koennen auch `npm config get prefix` ausfuehren und `\\bin` zum PATH hinzufuegen, dann PowerShell erneut oeffnen.
