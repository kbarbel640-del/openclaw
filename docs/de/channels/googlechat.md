---
summary: „Status, Funktionen und Konfiguration der Google-Chat-App-Unterstützung“
read_when:
  - Arbeiten an Funktionen für den Google-Chat-Kanal
title: „Google Chat“
x-i18n:
  source_path: channels/googlechat.md
  source_hash: 3b2bb116cdd12614
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:33Z
---

# Google Chat (Chat API)

Status: Bereit für Direktnachrichten und Spaces über Google Chat API Webhooks (nur HTTP).

## Schnellstart (Anfänger)

1. Erstellen Sie ein Google-Cloud-Projekt und aktivieren Sie die **Google Chat API**.
   - Gehen Sie zu: [Google Chat API Credentials](https://console.cloud.google.com/apis/api/chat.googleapis.com/credentials)
   - Aktivieren Sie die API, falls sie noch nicht aktiviert ist.
2. Erstellen Sie ein **Servicekonto**:
   - Klicken Sie auf **Anmeldedaten erstellen** > **Servicekonto**.
   - Benennen Sie es nach Belieben (z. B. `openclaw-chat`).
   - Lassen Sie die Berechtigungen leer (klicken Sie auf **Weiter**).
   - Lassen Sie die Prinzipale mit Zugriff leer (klicken Sie auf **Fertig**).
3. Erstellen und laden Sie den **JSON-Schlüssel** herunter:
   - Klicken Sie in der Liste der Servicekonten auf das soeben erstellte Konto.
   - Wechseln Sie zum Tab **Schlüssel**.
   - Klicken Sie auf **Schlüssel hinzufügen** > **Neuen Schlüssel erstellen**.
   - Wählen Sie **JSON** und klicken Sie auf **Erstellen**.
4. Speichern Sie die heruntergeladene JSON-Datei auf Ihrem Gateway-Host (z. B. `~/.openclaw/googlechat-service-account.json`).
5. Erstellen Sie eine Google-Chat-App in der [Google Cloud Console Chat Configuration](https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat):
   - Füllen Sie die **Anwendungsinformationen** aus:
     - **App-Name**: (z. B. `OpenClaw`)
     - **Avatar-URL**: (z. B. `https://openclaw.ai/logo.png`)
     - **Beschreibung**: (z. B. `Personal AI Assistant`)
   - Aktivieren Sie **Interaktive Funktionen**.
   - Aktivieren Sie unter **Funktionalität** die Option **Spaces und Gruppenkonversationen beitreten**.
   - Wählen Sie unter **Verbindungseinstellungen** **HTTP-Endpunkt-URL**.
   - Wählen Sie unter **Trigger** **Eine gemeinsame HTTP-Endpunkt-URL für alle Trigger verwenden** und setzen Sie diese auf die öffentliche URL Ihres Gateways, gefolgt von `/googlechat`.
     - _Tipp: Führen Sie `openclaw status` aus, um die öffentliche URL Ihres Gateways zu ermitteln._
   - Aktivieren Sie unter **Sichtbarkeit** **Diese Chat-App für bestimmte Personen und Gruppen in &lt;Ihre Domain&gt; verfügbar machen**.
   - Geben Sie Ihre E-Mail-Adresse (z. B. `user@example.com`) in das Textfeld ein.
   - Klicken Sie unten auf **Speichern**.
6. **App-Status aktivieren**:
   - **Aktualisieren Sie die Seite**, nachdem Sie gespeichert haben.
   - Suchen Sie den Abschnitt **App-Status** (in der Regel oben oder unten nach dem Speichern).
   - Ändern Sie den Status auf **Live – für Nutzer verfügbar**.
   - Klicken Sie erneut auf **Speichern**.
7. Konfigurieren Sie OpenClaw mit dem Pfad zum Servicekonto + der Webhook-Zielgruppe:
   - Env: `GOOGLE_CHAT_SERVICE_ACCOUNT_FILE=/path/to/service-account.json`
   - Oder Konfiguration: `channels.googlechat.serviceAccountFile: "/path/to/service-account.json"`.
8. Legen Sie den Typ und den Wert der Webhook-Zielgruppe fest (entspricht Ihrer Chat-App-Konfiguration).
9. Starten Sie das Gateway. Google Chat sendet POST-Anfragen an Ihren Webhook-Pfad.

## Zu Google Chat hinzufügen

Sobald das Gateway läuft und Ihre E-Mail-Adresse zur Sichtbarkeitsliste hinzugefügt wurde:

1. Gehen Sie zu [Google Chat](https://chat.google.com/).
2. Klicken Sie auf das **+**-Symbol (Plus) neben **Direktnachrichten**.
3. Geben Sie in der Suchleiste (wo Sie normalerweise Personen hinzufügen) den **App-Namen** ein, den Sie in der Google Cloud Console konfiguriert haben.
   - **Hinweis**: Der Bot erscheint _nicht_ in der „Marketplace“-Übersicht, da es sich um eine private App handelt. Sie müssen ihn über die Namenssuche finden.
4. Wählen Sie Ihren Bot aus den Ergebnissen aus.
5. Klicken Sie auf **Hinzufügen** oder **Chat**, um eine 1:1-Konversation zu starten.
6. Senden Sie „Hello“, um den Assistenten auszulösen!

## Öffentliche URL (nur Webhook)

Google-Chat-Webhooks erfordern einen öffentlichen HTTPS-Endpunkt. Aus Sicherheitsgründen **stellen Sie nur den Pfad `/googlechat` im Internet bereit**. Behalten Sie das OpenClaw-Dashboard und andere sensible Endpunkte in Ihrem privaten Netzwerk.

### Option A: Tailscale Funnel (Empfohlen)

Verwenden Sie Tailscale Serve für das private Dashboard und Funnel für den öffentlichen Webhook-Pfad. Dadurch bleibt `/` privat, während nur `/googlechat` exponiert wird.

1. **Prüfen Sie, an welche Adresse Ihr Gateway gebunden ist:**

   ```bash
   ss -tlnp | grep 18789
   ```

   Notieren Sie die IP-Adresse (z. B. `127.0.0.1`, `0.0.0.0` oder Ihre Tailscale-IP wie `100.x.x.x`).

2. **Stellen Sie das Dashboard nur im Tailnet bereit (Port 8443):**

   ```bash
   # If bound to localhost (127.0.0.1 or 0.0.0.0):
   tailscale serve --bg --https 8443 http://127.0.0.1:18789

   # If bound to Tailscale IP only (e.g., 100.106.161.80):
   tailscale serve --bg --https 8443 http://100.106.161.80:18789
   ```

3. **Stellen Sie ausschließlich den Webhook-Pfad öffentlich bereit:**

   ```bash
   # If bound to localhost (127.0.0.1 or 0.0.0.0):
   tailscale funnel --bg --set-path /googlechat http://127.0.0.1:18789/googlechat

   # If bound to Tailscale IP only (e.g., 100.106.161.80):
   tailscale funnel --bg --set-path /googlechat http://100.106.161.80:18789/googlechat
   ```

4. **Autorisieren Sie den Knoten für Funnel-Zugriff:**
   Falls Sie dazu aufgefordert werden, besuchen Sie die in der Ausgabe angezeigte Autorisierungs-URL, um Funnel für diesen Knoten in Ihrer Tailnet-Richtlinie zu aktivieren.

5. **Überprüfen Sie die Konfiguration:**
   ```bash
   tailscale serve status
   tailscale funnel status
   ```

Ihre öffentliche Webhook-URL lautet:
`https://<node-name>.<tailnet>.ts.net/googlechat`

Ihr privates Dashboard bleibt nur im Tailnet verfügbar:
`https://<node-name>.<tailnet>.ts.net:8443/`

Verwenden Sie die öffentliche URL (ohne `:8443`) in der Google-Chat-App-Konfiguration.

> Hinweis: Diese Konfiguration bleibt über Neustarts hinweg bestehen. Um sie später zu entfernen, führen Sie `tailscale funnel reset` und `tailscale serve reset` aus.

### Option B: Reverse Proxy (Caddy)

Wenn Sie einen Reverse Proxy wie Caddy verwenden, leiten Sie nur den spezifischen Pfad weiter:

```caddy
your-domain.com {
    reverse_proxy /googlechat* localhost:18789
}
```

Mit dieser Konfiguration wird jede Anfrage an `your-domain.com/` ignoriert oder mit 404 beantwortet, während `your-domain.com/googlechat` sicher an OpenClaw weitergeleitet wird.

### Option C: Cloudflare Tunnel

Konfigurieren Sie die Ingress-Regeln Ihres Tunnels so, dass nur der Webhook-Pfad geroutet wird:

- **Pfad**: `/googlechat` -> `http://localhost:18789/googlechat`
- **Standardregel**: HTTP 404 (Nicht gefunden)

## Funktionsweise

1. Google Chat sendet Webhook-POSTs an das Gateway. Jede Anfrage enthält einen Header `Authorization: Bearer <token>`.
2. OpenClaw verifiziert das Token anhand der konfigurierten `audienceType` + `audience`:
   - `audienceType: "app-url"` → Zielgruppe ist Ihre HTTPS-Webhook-URL.
   - `audienceType: "project-number"` → Zielgruppe ist die Cloud-Projektnummer.
3. Nachrichten werden nach Space geroutet:
   - Direktnachrichten verwenden den Sitzungsschlüssel `agent:<agentId>:googlechat:dm:<spaceId>`.
   - Spaces verwenden den Sitzungsschlüssel `agent:<agentId>:googlechat:group:<spaceId>`.
4. Der Zugriff auf Direktnachrichten ist standardmäßig gepaart. Unbekannte Absender erhalten einen Pairing-Code; genehmigen Sie mit:
   - `openclaw pairing approve googlechat <code>`
5. Gruppenspaces erfordern standardmäßig eine @-Erwähnung. Verwenden Sie `botUser`, wenn die Erkennung von Erwähnungen den Benutzernamen der App benötigt.

## Ziele

Verwenden Sie diese Kennungen für Zustellung und Allowlists:

- Direktnachrichten: `users/<userId>` oder `users/<email>` (E-Mail-Adressen werden akzeptiert).
- Spaces: `spaces/<spaceId>`.

## Konfigurations-Highlights

```json5
{
  channels: {
    googlechat: {
      enabled: true,
      serviceAccountFile: "/path/to/service-account.json",
      audienceType: "app-url",
      audience: "https://gateway.example.com/googlechat",
      webhookPath: "/googlechat",
      botUser: "users/1234567890", // optional; helps mention detection
      dm: {
        policy: "pairing",
        allowFrom: ["users/1234567890", "name@example.com"],
      },
      groupPolicy: "allowlist",
      groups: {
        "spaces/AAAA": {
          allow: true,
          requireMention: true,
          users: ["users/1234567890"],
          systemPrompt: "Short answers only.",
        },
      },
      actions: { reactions: true },
      typingIndicator: "message",
      mediaMaxMb: 20,
    },
  },
}
```

Hinweise:

- Servicekonto-Anmeldedaten können auch inline mit `serviceAccount` (JSON-String) übergeben werden.
- Der Standard-Webhook-Pfad ist `/googlechat`, wenn `webhookPath` nicht gesetzt ist.
- Reaktionen sind über das Werkzeug `reactions` und `channels action` verfügbar, wenn `actions.reactions` aktiviert ist.
- `typingIndicator` unterstützt `none`, `message` (Standard) und `reaction` (Reaktion erfordert Benutzer-OAuth).
- Anhänge werden über die Chat API heruntergeladen und in der Medien-Pipeline gespeichert (Größe begrenzt durch `mediaMaxMb`).

## Fehlerbehebung

### 405 Method Not Allowed

Wenn der Google Cloud Logs Explorer Fehler anzeigt wie:

```
status code: 405, reason phrase: HTTP error response: HTTP/1.1 405 Method Not Allowed
```

Dies bedeutet, dass der Webhook-Handler nicht registriert ist. Häufige Ursachen:

1. **Kanal nicht konfiguriert**: Der Abschnitt `channels.googlechat` fehlt in Ihrer Konfiguration. Überprüfen Sie dies mit:

   ```bash
   openclaw config get channels.googlechat
   ```

   Wenn „Config path not found“ zurückgegeben wird, fügen Sie die Konfiguration hinzu (siehe [Konfigurations-Highlights](#konfigurations-highlights)).

2. **Plugin nicht aktiviert**: Prüfen Sie den Plugin-Status:

   ```bash
   openclaw plugins list | grep googlechat
   ```

   Wenn „disabled“ angezeigt wird, fügen Sie `plugins.entries.googlechat.enabled: true` zu Ihrer Konfiguration hinzu.

3. **Gateway nicht neu gestartet**: Starten Sie das Gateway nach dem Hinzufügen der Konfiguration neu:
   ```bash
   openclaw gateway restart
   ```

Verifizieren Sie, dass der Kanal läuft:

```bash
openclaw channels status
# Should show: Google Chat default: enabled, configured, ...
```

### Weitere Probleme

- Prüfen Sie `openclaw channels status --probe` auf Authentifizierungsfehler oder eine fehlende Zielgruppenkonfiguration.
- Wenn keine Nachrichten ankommen, bestätigen Sie die Webhook-URL und die Ereignisabonnements der Chat-App.
- Wenn die Erwähnungsprüfung Antworten blockiert, setzen Sie `botUser` auf den Benutzerressourcennamen der App und überprüfen Sie `requireMention`.
- Verwenden Sie `openclaw logs --follow` beim Senden einer Testnachricht, um zu sehen, ob Anfragen das Gateway erreichen.

Verwandte Dokumente:

- [Gateway-Konfiguration](/gateway/configuration)
- [Sicherheit](/gateway/security)
- [Reaktionen](/tools/reactions)
