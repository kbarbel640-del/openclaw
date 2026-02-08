---
summary: "Tlon/Urbit-Unterstützungsstatus, Funktionen und Konfiguration"
read_when:
  - Arbeiten an Tlon/Urbit-Kanalfunktionen
title: "Tlon"
x-i18n:
  source_path: channels/tlon.md
  source_hash: 19d7ffe23e82239f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:28Z
---

# Tlon (Plugin)

Tlon ist ein dezentraler Messenger auf Basis von Urbit. OpenClaw verbindet sich mit Ihrem Urbit-Ship und kann
auf Direktnachrichten und Gruppenchat-Nachrichten reagieren. Gruppenantworten erfordern standardmäßig eine @‑Erwähnung und können
über Allowlisten weiter eingeschränkt werden.

Status: über Plugin unterstützt. Direktnachrichten, Gruppen-Erwähnungen, Thread-Antworten und textbasierter Medien‑Fallback
(URL an die Beschriftung angehängt). Reaktionen, Umfragen und native Medien-Uploads werden nicht unterstützt.

## Plugin erforderlich

Tlon wird als Plugin ausgeliefert und ist nicht im Core-Install enthalten.

Installation über CLI (npm-Registry):

```bash
openclaw plugins install @openclaw/tlon
```

Lokaler Checkout (bei Ausführung aus einem Git-Repository):

```bash
openclaw plugins install ./extensions/tlon
```

Details: [Plugins](/plugin)

## Einrichtung

1. Installieren Sie das Tlon-Plugin.
2. Erfassen Sie die URL Ihres Ships und den Login-Code.
3. Konfigurieren Sie `channels.tlon`.
4. Starten Sie das Gateway neu.
5. Senden Sie dem Bot eine Direktnachricht oder erwähnen Sie ihn in einem Gruppenkanal.

Minimale Konfiguration (einzelnes Konto):

```json5
{
  channels: {
    tlon: {
      enabled: true,
      ship: "~sampel-palnet",
      url: "https://your-ship-host",
      code: "lidlut-tabwed-pillex-ridrup",
    },
  },
}
```

## Gruppenkanäle

Automatische Erkennung ist standardmäßig aktiviert. Sie können Kanäle auch manuell anheften:

```json5
{
  channels: {
    tlon: {
      groupChannels: ["chat/~host-ship/general", "chat/~host-ship/support"],
    },
  },
}
```

Automatische Erkennung deaktivieren:

```json5
{
  channels: {
    tlon: {
      autoDiscoverChannels: false,
    },
  },
}
```

## Zugriffskontrolle

Direktnachrichten-Allowlist (leer = alle zulassen):

```json5
{
  channels: {
    tlon: {
      dmAllowlist: ["~zod", "~nec"],
    },
  },
}
```

Gruppenautorisierung (standardmäßig eingeschränkt):

```json5
{
  channels: {
    tlon: {
      defaultAuthorizedShips: ["~zod"],
      authorization: {
        channelRules: {
          "chat/~host-ship/general": {
            mode: "restricted",
            allowedShips: ["~zod", "~nec"],
          },
          "chat/~host-ship/announcements": {
            mode: "open",
          },
        },
      },
    },
  },
}
```

## Zustellziele (CLI/Cron)

Verwenden Sie diese mit `openclaw message send` oder der Cron-Zustellung:

- Direktnachricht: `~sampel-palnet` oder `dm/~sampel-palnet`
- Gruppe: `chat/~host-ship/channel` oder `group:~host-ship/channel`

## Hinweise

- Gruppenantworten erfordern eine Erwähnung (z. B. `~your-bot-ship`), um zu antworten.
- Thread-Antworten: Befindet sich die eingehende Nachricht in einem Thread, antwortet OpenClaw im Thread.
- Medien: `sendMedia` fällt auf Text + URL zurück (kein nativer Upload).
