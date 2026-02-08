---
summary: "Unterstützung für Zalo-Personalkonten über zca-cli (QR-Login), Funktionen und Konfiguration"
read_when:
  - Zalo Personal für OpenClaw einrichten
  - Debugging von Zalo-Personal-Login oder Nachrichtenfluss
title: "Zalo Personal"
x-i18n:
  source_path: channels/zalouser.md
  source_hash: 2a249728d556e5cc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:35Z
---

# Zalo Personal (inoffiziell)

Status: experimentell. Diese Integration automatisiert ein **persönliches Zalo-Konto** über `zca-cli`.

> **Warnung:** Dies ist eine inoffizielle Integration und kann zu einer Kontosperrung/-suspendierung führen. Nutzung auf eigenes Risiko.

## Erforderliches Plugin

Zalo Personal wird als Plugin ausgeliefert und ist nicht im Core-Install enthalten.

- Installation per CLI: `openclaw plugins install @openclaw/zalouser`
- Oder aus einem Source-Checkout: `openclaw plugins install ./extensions/zalouser`
- Details: [Plugins](/plugin)

## Voraussetzung: zca-cli

Auf der Gateway-Maschine muss das Binary `zca` unter `PATH` verfügbar sein.

- Prüfen: `zca --version`
- Falls nicht vorhanden, zca-cli installieren (siehe `extensions/zalouser/README.md` oder die Upstream-zca-cli-Dokumentation).

## Schnellstart (Einsteiger)

1. Plugin installieren (siehe oben).
2. Anmelden (QR, auf der Gateway-Maschine):
   - `openclaw channels login --channel zalouser`
   - Scannen Sie den QR-Code im Terminal mit der Zalo-Mobil-App.
3. Kanal aktivieren:

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      dmPolicy: "pairing",
    },
  },
}
```

4. Gateway neu starten (oder das Onboarding abschließen).
5. DM-Zugriff ist standardmäßig gekoppelt; genehmigen Sie beim ersten Kontakt den Kopplungscode.

## Was es ist

- Verwendet `zca listen` zum Empfangen eingehender Nachrichten.
- Verwendet `zca msg ...` zum Senden von Antworten (Text/Medien/Links).
- Entwickelt für Anwendungsfälle mit „persönlichen Konten“, bei denen die Zalo Bot API nicht verfügbar ist.

## Benennung

Die Kanal-ID ist `zalouser`, um explizit zu machen, dass hier ein **persönliches Zalo-Benutzerkonto** automatisiert wird (inoffiziell). `zalo` bleibt für eine mögliche zukünftige offizielle Zalo-API-Integration reserviert.

## IDs finden (Verzeichnis)

Verwenden Sie die Directory-CLI, um Peers/Gruppen und deren IDs zu ermitteln:

```bash
openclaw directory self --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory groups list --channel zalouser --query "work"
```

## Limits

- Ausgehender Text wird in ~2000 Zeichen fragmentiert (Limits des Zalo-Clients).
- Streaming ist standardmäßig blockiert.

## Zugriffskontrolle (DMs)

`channels.zalouser.dmPolicy` unterstützt: `pairing | allowlist | open | disabled` (Standard: `pairing`).
`channels.zalouser.allowFrom` akzeptiert Benutzer-IDs oder Namen. Der Assistent löst Namen, sofern verfügbar, über `zca friend find` zu IDs auf.

Freigabe über:

- `openclaw pairing list zalouser`
- `openclaw pairing approve zalouser <code>`

## Gruppenzugriff (optional)

- Standard: `channels.zalouser.groupPolicy = "open"` (Gruppen erlaubt). Verwenden Sie `channels.defaults.groupPolicy`, um den Standard zu überschreiben, wenn er nicht gesetzt ist.
- Einschränkung auf eine Allowlist mit:
  - `channels.zalouser.groupPolicy = "allowlist"`
  - `channels.zalouser.groups` (Schlüssel sind Gruppen-IDs oder -Namen)
- Alle Gruppen blockieren: `channels.zalouser.groupPolicy = "disabled"`.
- Der Konfigurationsassistent kann nach Gruppen-Allowlists fragen.
- Beim Start löst OpenClaw Gruppen-/Benutzernamen in Allowlists zu IDs auf und protokolliert die Zuordnung; nicht auflösbare Einträge bleiben wie eingegeben erhalten.

Beispiel:

```json5
{
  channels: {
    zalouser: {
      groupPolicy: "allowlist",
      groups: {
        "123456789": { allow: true },
        "Work Chat": { allow: true },
      },
    },
  },
}
```

## Multi-Account

Konten werden zca-Profilen zugeordnet. Beispiel:

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      defaultAccount: "default",
      accounts: {
        work: { enabled: true, profile: "work" },
      },
    },
  },
}
```

## Fehlerbehebung

**`zca` nicht gefunden:**

- Installieren Sie zca-cli und stellen Sie sicher, dass es für den Gateway-Prozess auf `PATH` liegt.

**Login bleibt nicht bestehen:**

- `openclaw channels status --probe`
- Erneut anmelden: `openclaw channels logout --channel zalouser && openclaw channels login --channel zalouser`
