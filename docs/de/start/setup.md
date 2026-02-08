---
summary: "Erweiterte Einrichtung und Entwicklungs-Workflows für OpenClaw"
read_when:
  - Einrichten einer neuen Maschine
  - Sie möchten „latest + greatest“, ohne Ihr persönliches Setup zu beschädigen
title: "Einrichtung"
x-i18n:
  source_path: start/setup.md
  source_hash: 6620daddff099dc0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:43Z
---

# Einrichtung

<Note>
Wenn Sie zum ersten Mal einrichten, beginnen Sie mit [Erste Schritte](/start/getting-started).
Details zum Assistenten finden Sie unter [Einführungsassistent](/start/wizard).
</Note>

Zuletzt aktualisiert: 2026-01-01

## TL;DR

- **Anpassungen liegen außerhalb des Repos:** `~/.openclaw/workspace` (Workspace) + `~/.openclaw/openclaw.json` (Konfiguration).
- **Stabiler Workflow:** Installieren Sie die macOS-App; lassen Sie sie das mitgelieferte Gateway ausführen.
- **Bleeding-Edge-Workflow:** Führen Sie das Gateway selbst über `pnpm gateway:watch` aus und lassen Sie dann die macOS-App im Local-Modus andocken.

## Voraussetzungen (aus dem Quellcode)

- Node `>=22`
- `pnpm`
- Docker (optional; nur für containerisierte Einrichtung/E2E — siehe [Docker](/install/docker))

## Anpassungsstrategie (damit Updates nicht schaden)

Wenn Sie „100 % auf mich zugeschnitten“ _und_ einfache Updates möchten, halten Sie Ihre Anpassungen in:

- **Konfiguration:** `~/.openclaw/openclaw.json` (JSON/JSON5-ähnlich)
- **Workspace:** `~/.openclaw/workspace` (Skills, Prompts, Erinnerungen; als privates Git-Repo anlegen)

Einmalig bootstrappen:

```bash
openclaw setup
```

Verwenden Sie innerhalb dieses Repos den lokalen CLI-Einstieg:

```bash
openclaw setup
```

Wenn Sie noch keine globale Installation haben, führen Sie es über `pnpm openclaw setup` aus.

## Gateway aus diesem Repo ausführen

Nach `pnpm build` können Sie die paketierte CLI direkt ausführen:

```bash
node openclaw.mjs gateway --port 18789 --verbose
```

## Stabiler Workflow (macOS-App zuerst)

1. Installieren und starten Sie **OpenClaw.app** (Menüleiste).
2. Schließen Sie die Onboarding-/Berechtigungs-Checkliste ab (TCC-Aufforderungen).
3. Stellen Sie sicher, dass das Gateway **Local** ist und läuft (die App verwaltet es).
4. Verknüpfen Sie Oberflächen (Beispiel: WhatsApp):

```bash
openclaw channels login
```

5. Plausibilitätsprüfung:

```bash
openclaw health
```

Wenn Onboarding in Ihrem Build nicht verfügbar ist:

- Führen Sie `openclaw setup` aus, dann `openclaw channels login`, und starten Sie anschließend das Gateway manuell (`openclaw gateway`).

## Bleeding-Edge-Workflow (Gateway im Terminal)

Ziel: Am TypeScript-Gateway arbeiten, Hot Reload erhalten und die macOS-App-UI angedockt lassen.

### 0) (Optional) macOS-App ebenfalls aus dem Quellcode ausführen

Wenn Sie auch die macOS-App auf dem Bleeding Edge möchten:

```bash
./scripts/restart-mac.sh
```

### 1) Dev-Gateway starten

```bash
pnpm install
pnpm gateway:watch
```

`gateway:watch` führt das Gateway im Watch-Modus aus und lädt bei TypeScript-Änderungen neu.

### 2) macOS-App auf Ihr laufendes Gateway ausrichten

In **OpenClaw.app**:

- Verbindungsmodus: **Local**
  Die App verbindet sich mit dem laufenden Gateway auf dem konfigurierten Port.

### 3) Verifizieren

- Der Gateway-Status in der App sollte **„Using existing gateway …“** anzeigen
- Oder per CLI:

```bash
openclaw health
```

### Häufige Stolperfallen

- **Falscher Port:** Gateway-WS-Standard ist `ws://127.0.0.1:18789`; halten Sie App + CLI auf demselben Port.
- **Wo der Zustand liegt:**
  - Anmeldedaten: `~/.openclaw/credentials/`
  - Sitzungen: `~/.openclaw/agents/<agentId>/sessions/`
  - Logs: `/tmp/openclaw/`

## Karte der Anmeldedatenspeicherung

Verwenden Sie dies beim Debuggen der Authentifizierung oder bei der Entscheidung, was gesichert werden soll:

- **WhatsApp**: `~/.openclaw/credentials/whatsapp/<accountId>/creds.json`
- **Telegram-Bot-Token**: Konfiguration/Umgebungsvariablen oder `channels.telegram.tokenFile`
- **Discord-Bot-Token**: Konfiguration/Umgebungsvariablen (Token-Datei noch nicht unterstützt)
- **Slack-Tokens**: Konfiguration/Umgebungsvariablen (`channels.slack.*`)
- **Pairing-Allowlisten**: `~/.openclaw/credentials/<channel>-allowFrom.json`
- **Modell-Auth-Profile**: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- **Legacy-OAuth-Import**: `~/.openclaw/credentials/oauth.json`
  Weitere Details: [Sicherheit](/gateway/security#credential-storage-map).

## Aktualisieren (ohne Ihr Setup zu ruinieren)

- Halten Sie `~/.openclaw/workspace` und `~/.openclaw/` als „Ihre Dinge“; legen Sie keine persönlichen Prompts/Konfigurationen im `openclaw`-Repo ab.
- Quellcode aktualisieren: `git pull` + `pnpm install` (wenn sich die Lockfile geändert hat) + weiter `pnpm gateway:watch` verwenden.

## Linux (systemd-User-Service)

Linux-Installationen verwenden einen systemd-**User**-Service. Standardmäßig beendet systemd User-Services beim Abmelden/Leerlauf, wodurch das Gateway beendet wird. Das Onboarding versucht, „Lingering“ für Sie zu aktivieren (kann sudo anfordern). Falls es weiterhin aus ist, führen Sie aus:

```bash
sudo loginctl enable-linger $USER
```

Für Always-on- oder Multi-User-Server erwägen Sie einen **System**-Service statt eines User-Services (kein Lingering erforderlich). Siehe [Gateway-Runbook](/gateway) für die systemd-Hinweise.

## Verwandte Dokumente

- [Gateway-Runbook](/gateway) (Flags, Überwachung, Ports)
- [Gateway-Konfiguration](/gateway/configuration) (Konfigurationsschema + Beispiele)
- [Discord](/channels/discord) und [Telegram](/channels/telegram) (Antwort-Tags + replyToMode-Einstellungen)
- [OpenClaw-Assistant-Einrichtung](/start/openclaw)
- [macOS-App](/platforms/macos) (Gateway-Lebenszyklus)
