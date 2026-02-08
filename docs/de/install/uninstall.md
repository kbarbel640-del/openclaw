---
summary: "OpenClaw vollständig deinstallieren (CLI, Dienst, Status, Workspace)"
read_when:
  - Sie möchten OpenClaw von einem Rechner entfernen
  - Der Gateway-Dienst läuft nach der Deinstallation noch
title: "Deinstallation"
x-i18n:
  source_path: install/uninstall.md
  source_hash: 6673a755c5e1f90a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:44Z
---

# Deinstallation

Zwei Wege:

- **Einfacher Weg**, wenn `openclaw` noch installiert ist.
- **Manuelle Dienstentfernung**, wenn die CLI fehlt, der Dienst aber noch läuft.

## Einfacher Weg (CLI noch installiert)

Empfohlen: Verwenden Sie den integrierten Deinstaller:

```bash
openclaw uninstall
```

Nicht-interaktiv (Automatisierung / npx):

```bash
openclaw uninstall --all --yes --non-interactive
npx -y openclaw uninstall --all --yes --non-interactive
```

Manuelle Schritte (gleiches Ergebnis):

1. Stoppen Sie den Gateway-Dienst:

```bash
openclaw gateway stop
```

2. Deinstallieren Sie den Gateway-Dienst (launchd/systemd/schtasks):

```bash
openclaw gateway uninstall
```

3. Status + Konfiguration löschen:

```bash
rm -rf "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
```

Wenn Sie `OPENCLAW_CONFIG_PATH` auf einen benutzerdefinierten Speicherort außerhalb des Statusverzeichnisses gesetzt haben, löschen Sie diese Datei ebenfalls.

4. Löschen Sie Ihren Workspace (optional, entfernt Agent-Dateien):

```bash
rm -rf ~/.openclaw/workspace
```

5. Entfernen Sie die CLI-Installation (wählen Sie die verwendete Methode):

```bash
npm rm -g openclaw
pnpm remove -g openclaw
bun remove -g openclaw
```

6. Wenn Sie die macOS-App installiert haben:

```bash
rm -rf /Applications/OpenClaw.app
```

Hinweise:

- Wenn Sie Profile verwendet haben (`--profile` / `OPENCLAW_PROFILE`), wiederholen Sie Schritt 3 für jedes Statusverzeichnis (Standardwerte sind `~/.openclaw-<profile>`).
- Im Remote-Modus befindet sich das Statusverzeichnis auf dem **Gateway-Host**; führen Sie die Schritte 1–4 daher auch dort aus.

## Manuelle Dienstentfernung (CLI nicht installiert)

Verwenden Sie dies, wenn der Gateway-Dienst weiterläuft, `openclaw` jedoch fehlt.

### macOS (launchd)

Standard-Label ist `bot.molt.gateway` (oder `bot.molt.<profile>`; das Legacy-Label `com.openclaw.*` kann noch existieren):

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

Wenn Sie ein Profil verwendet haben, ersetzen Sie Label und Plist-Namen durch `bot.molt.<profile>`. Entfernen Sie vorhandene Legacy-`com.openclaw.*`-Plists.

### Linux (systemd User-Unit)

Standard-Unit-Name ist `openclaw-gateway.service` (oder `openclaw-gateway-<profile>.service`):

```bash
systemctl --user disable --now openclaw-gateway.service
rm -f ~/.config/systemd/user/openclaw-gateway.service
systemctl --user daemon-reload
```

### Windows (Geplante Aufgabe)

Standard-Taskname ist `OpenClaw Gateway` (oder `OpenClaw Gateway (<profile>)`).
Das Task-Skript befindet sich unter Ihrem Statusverzeichnis.

```powershell
schtasks /Delete /F /TN "OpenClaw Gateway"
Remove-Item -Force "$env:USERPROFILE\.openclaw\gateway.cmd"
```

Wenn Sie ein Profil verwendet haben, löschen Sie den entsprechenden Tasknamen und `~\.openclaw-<profile>\gateway.cmd`.

## Normale Installation vs. Quellcode-Checkout

### Normale Installation (install.sh / npm / pnpm / bun)

Wenn Sie `https://openclaw.ai/install.sh` oder `install.ps1` verwendet haben, wurde die CLI mit `npm install -g openclaw@latest` installiert.
Entfernen Sie sie mit `npm rm -g openclaw` (oder `pnpm remove -g` / `bun remove -g`, falls Sie diese Methode verwendet haben).

### Quellcode-Checkout (git clone)

Wenn Sie aus einem Repo-Checkout ausführen (`git clone` + `openclaw ...` / `bun run openclaw ...`):

1. Deinstallieren Sie den Gateway-Dienst **vor** dem Löschen des Repos (verwenden Sie den einfachen Weg oben oder die manuelle Dienstentfernung).
2. Löschen Sie das Repo-Verzeichnis.
3. Entfernen Sie Status + Workspace wie oben beschrieben.
