---
summary: "CLI-Referenz für `openclaw devices` (Geräte-Kopplung + Token-Rotation/-Widerruf)"
read_when:
  - Sie genehmigen Anfragen zur Geräte-Kopplung
  - Sie müssen Geräte-Tokens rotieren oder widerrufen
title: "Geräte"
x-i18n:
  source_path: cli/devices.md
  source_hash: ac7d130ecdc5d429
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:41Z
---

# `openclaw devices`

Verwalten Sie Anfragen zur Geräte-Kopplung und gerätebezogene Tokens.

## Commands

### `openclaw devices list`

Listet ausstehende Kopplungsanfragen und gekoppelte Geräte auf.

```
openclaw devices list
openclaw devices list --json
```

### `openclaw devices approve <requestId>`

Genehmigt eine ausstehende Anfrage zur Geräte-Kopplung.

```
openclaw devices approve <requestId>
```

### `openclaw devices reject <requestId>`

Lehnt eine ausstehende Anfrage zur Geräte-Kopplung ab.

```
openclaw devices reject <requestId>
```

### `openclaw devices rotate --device <id> --role <role> [--scope <scope...>]`

Rotiert ein Geräte-Token für eine bestimmte Rolle (optional mit Aktualisierung der Scopes).

```
openclaw devices rotate --device <deviceId> --role operator --scope operator.read --scope operator.write
```

### `openclaw devices revoke --device <id> --role <role>`

Widerruft ein Geräte-Token für eine bestimmte Rolle.

```
openclaw devices revoke --device <deviceId> --role node
```

## Common options

- `--url <url>`: Gateway-WebSocket-URL (standardmäßig `gateway.remote.url`, wenn konfiguriert).
- `--token <token>`: Gateway-Token (falls erforderlich).
- `--password <password>`: Gateway-Passwort (Passwortauthentifizierung).
- `--timeout <ms>`: RPC-Timeout.
- `--json`: JSON-Ausgabe (empfohlen für Skripting).

Hinweis: Wenn Sie `--url` setzen, greift die CLI nicht auf Konfigurations- oder Umgebungs-Anmeldeinformationen zurück.
Übergeben Sie `--token` oder `--password` explizit. Fehlende explizite Anmeldeinformationen sind ein Fehler.

## Notes

- Die Token-Rotation gibt ein neues Token zurück (sensibel). Behandeln Sie es wie ein Geheimnis.
- Diese Befehle erfordern den Scope `operator.pairing` (oder `operator.admin`).
