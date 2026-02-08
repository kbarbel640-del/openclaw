---
summary: "OpenClaw installieren (empfohlener Installer, globale Installation oder aus dem Quellcode)"
read_when:
  - OpenClaw installieren
  - Sie moechten aus GitHub installieren
title: "Installationsuebersicht"
x-i18n:
  source_path: install/index.md
  source_hash: 228056bb0a2176b8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:44Z
---

# Installationsuebersicht

Verwenden Sie den Installer, sofern Sie keinen triftigen Grund haben, dies nicht zu tun. Er richtet die CLI ein und fuehrt die Einfuehrung aus.

## Schnellinstallation (empfohlen)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Windows (PowerShell):

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

Naechster Schritt (falls Sie die Einfuehrung uebersprungen haben):

```bash
openclaw onboard --install-daemon
```

## Systemanforderungen

- **Node >=22**
- macOS, Linux oder Windows ueber WSL2
- `pnpm` nur, wenn Sie aus dem Quellcode bauen

## Installationspfad waehlen

### 1) Installer-Skript (empfohlen)

Installiert `openclaw` global ueber npm und fuehrt die Einfuehrung aus.

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Installer-Flags:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Details: [Installer internals](/install/installer).

Nicht-interaktiv (Einfuehrung ueberspringen):

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

### 2) Globale Installation (manuell)

Wenn Sie Node bereits haben:

```bash
npm install -g openclaw@latest
```

Wenn Sie libvips global installiert haben (haeufig auf macOS ueber Homebrew) und `sharp` nicht installiert werden kann, erzwingen Sie vorgefertigte Binaerdateien:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
```

Wenn Sie `sharp: Please add node-gyp to your dependencies` sehen, installieren Sie entweder Build-Tools (macOS: Xcode CLT + `npm install -g node-gyp`) oder verwenden Sie die oben genannte Umgehung `SHARP_IGNORE_GLOBAL_LIBVIPS=1`, um den nativen Build zu ueberspringen.

Oder mit pnpm:

```bash
pnpm add -g openclaw@latest
pnpm approve-builds -g                # approve openclaw, node-llama-cpp, sharp, etc.
```

pnpm erfordert eine ausdrueckliche Genehmigung fuer Pakete mit Build-Skripten. Nachdem die erste Installation die Warnung „Ignored build scripts“ angezeigt hat, fuehren Sie `pnpm approve-builds -g` aus und waehlen Sie die aufgefuehrten Pakete aus.

Dann:

```bash
openclaw onboard --install-daemon
```

### 3) Aus dem Quellcode (Mitwirkende/Entwickler)

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard --install-daemon
```

Tipp: Wenn Sie noch keine globale Installation haben, fuehren Sie Repository-Befehle ueber `pnpm openclaw ...` aus.

Fuer tiefere Entwicklungs-Workflows siehe [Setup](/start/setup).

### 4) Weitere Installationsoptionen

- Docker: [Docker](/install/docker)
- Nix: [Nix](/install/nix)
- Ansible: [Ansible](/install/ansible)
- Bun (nur CLI): [Bun](/install/bun)

## Nach der Installation

- Einfuehrung ausfuehren: `openclaw onboard --install-daemon`
- Kurzcheck: `openclaw doctor`
- Gateway-Status pruefen: `openclaw status` + `openclaw health`
- Dashboard oeffnen: `openclaw dashboard`

## Installationsmethode: npm vs. git (Installer)

Der Installer unterstuetzt zwei Methoden:

- `npm` (Standard): `npm install -g openclaw@latest`
- `git`: aus GitHub klonen/erstellen und aus einem Source-Checkout ausfuehren

### CLI-Flags

```bash
# Explicit npm
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method npm

# Install from GitHub (source checkout)
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

Hauefige Flags:

- `--install-method npm|git`
- `--git-dir <path>` (Standard: `~/openclaw`)
- `--no-git-update` (ueberspringt `git pull` bei Verwendung eines bestehenden Checkouts)
- `--no-prompt` (deaktiviert Prompts; erforderlich in CI/Automatisierung)
- `--dry-run` (gibt aus, was passieren wuerde; nimmt keine Aenderungen vor)
- `--no-onboard` (Einfuehrung ueberspringen)

### Umgebungsvariablen

Entsprechende Umgebungsvariablen (nuetzlich fuer Automatisierung):

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`
- `OPENCLAW_GIT_UPDATE=0|1`
- `OPENCLAW_NO_PROMPT=1`
- `OPENCLAW_DRY_RUN=1`
- `OPENCLAW_NO_ONBOARD=1`
- `SHARP_IGNORE_GLOBAL_LIBVIPS=0|1` (Standard: `1`; vermeidet, dass `sharp` gegen systemweites libvips baut)

## Fehlerbehebung: `openclaw` nicht gefunden (PATH)

Schnelldiagnose:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

Wenn `$(npm prefix -g)/bin` (macOS/Linux) oder `$(npm prefix -g)` (Windows) **nicht** innerhalb von `echo "$PATH"` vorhanden ist, kann Ihre Shell globale npm-Binaerdateien (einschliesslich `openclaw`) nicht finden.

Behebung: Fuegen Sie es Ihrer Shell-Startdatei hinzu (zsh: `~/.zshrc`, bash: `~/.bashrc`):

```bash
# macOS / Linux
export PATH="$(npm prefix -g)/bin:$PATH"
```

Unter Windows fuegen Sie die Ausgabe von `npm prefix -g` zu Ihrem PATH hinzu.

Oeffnen Sie anschliessend ein neues Terminal (oder `rehash` in zsh / `hash -r` in bash).

## Update / Deinstallation

- Updates: [Updating](/install/updating)
- Migration auf einen neuen Rechner: [Migrating](/install/migrating)
- Deinstallation: [Uninstall](/install/uninstall)
