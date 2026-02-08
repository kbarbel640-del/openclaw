---
summary: „Verhalten und Konfiguration für die Verarbeitung von WhatsApp‑Gruppennachrichten (mentionPatterns werden über alle Oberflächen hinweg geteilt)“
read_when:
  - Ändern von Regeln für Gruppennachrichten oder Erwähnungen
title: „Gruppennachrichten“
x-i18n:
  source_path: concepts/group-messages.md
  source_hash: 181a72f12f5021af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:05Z
---

# Gruppennachrichten (WhatsApp‑Web‑Kanal)

Ziel: Clawd soll in WhatsApp‑Gruppen mitlaufen, nur bei Erwähnung aufwachen und diesen Thread getrennt von der persönlichen Direktnachrichten‑Sitzung halten.

Hinweis: `agents.list[].groupChat.mentionPatterns` wird inzwischen auch von Telegram/Discord/Slack/iMessage verwendet; dieses Dokument konzentriert sich auf WhatsApp‑spezifisches Verhalten. Für Multi‑Agent‑Setups setzen Sie `agents.list[].groupChat.mentionPatterns` pro Agent (oder verwenden Sie `messages.groupChat.mentionPatterns` als globalen Fallback).

## Was implementiert ist (2025‑12‑03)

- Aktivierungsmodi: `mention` (Standard) oder `always`. `mention` erfordert eine Erwähnung (echte WhatsApp‑@‑Erwähnungen über `mentionedJids`, Regex‑Muster oder die E.164‑Nummer des Bots irgendwo im Text). `always` weckt den Agenten bei jeder Nachricht, er sollte jedoch nur antworten, wenn er einen sinnvollen Mehrwert bieten kann; andernfalls gibt er das stille Token `NO_REPLY` zurück. Standardwerte können in der Konfiguration gesetzt (`channels.whatsapp.groups`) und pro Gruppe über `/activation` überschrieben werden. Wenn `channels.whatsapp.groups` gesetzt ist, fungiert es außerdem als Gruppen‑Allowlist (schließen Sie `"*"` ein, um alle zuzulassen).
- Gruppenrichtlinie: `channels.whatsapp.groupPolicy` steuert, ob Gruppennachrichten akzeptiert werden (`open|disabled|allowlist`). `allowlist` verwendet `channels.whatsapp.groupAllowFrom` (Fallback: explizites `channels.whatsapp.allowFrom`). Standard ist `allowlist` (blockiert, bis Sie Absender hinzufügen).
- Sitzungen pro Gruppe: Sitzungsschlüssel sehen aus wie `agent:<agentId>:whatsapp:group:<jid>`, sodass Befehle wie `/verbose on` oder `/think high` (als eigenständige Nachrichten gesendet) auf diese Gruppe begrenzt sind; der persönliche DM‑Zustand bleibt unberührt. Heartbeats werden für Gruppenthreads übersprungen.
- Kontext‑Injection: **nur ausstehende** Gruppennachrichten (Standard: 50), die _keinen_ Lauf ausgelöst haben, werden unter `[Chat messages since your last reply - for context]` vorangestellt; die auslösende Zeile steht unter `[Current message - respond to this]`. Nachrichten, die bereits in der Sitzung sind, werden nicht erneut injiziert.
- Absender‑Einblendung: Jede Gruppen‑Batch endet nun mit `[from: Sender Name (+E164)]`, damit Pi weiß, wer spricht.
- Ephemer/„Einmal ansehen“: Diese werden vor dem Extrahieren von Text/Erwähnungen entpackt, sodass Erwähnungen darin weiterhin auslösen.
- Gruppen‑Systemprompt: Beim ersten Zug einer Gruppensitzung (und immer wenn `/activation` den Modus ändert) fügen wir dem Systemprompt einen kurzen Hinweis wie `You are replying inside the WhatsApp group "<subject>". Group members: Alice (+44...), Bob (+43...), … Activation: trigger-only … Address the specific sender noted in the message context.` hinzu. Wenn Metadaten nicht verfügbar sind, teilen wir dem Agenten dennoch mit, dass es sich um einen Gruppenchat handelt.

## Konfigurationsbeispiel (WhatsApp)

Fügen Sie einen `groupChat`‑Block zu `~/.openclaw/openclaw.json` hinzu, damit Anzeigenamen‑Erwähnungen funktionieren, selbst wenn WhatsApp die visuelle `@` im Textkörper entfernt:

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          historyLimit: 50,
          mentionPatterns: ["@?openclaw", "\\+?15555550123"],
        },
      },
    ],
  },
}
```

Hinweise:

- Die Regexe sind nicht groß/klein‑schreibungssensitiv; sie decken eine Anzeigenamen‑Erwähnung wie `@openclaw` sowie die Rohnummer mit oder ohne `+`/Leerzeichen ab.
- WhatsApp sendet weiterhin kanonische Erwähnungen über `mentionedJids`, wenn jemand den Kontakt antippt; daher ist der Nummern‑Fallback selten nötig, aber ein nützliches Sicherheitsnetz.

### Aktivierungsbefehl (nur Eigentümer)

Verwenden Sie den Gruppenchat‑Befehl:

- `/activation mention`
- `/activation always`

Nur die Eigentümernummer (aus `channels.whatsapp.allowFrom` oder die eigene E.164 des Bots, wenn nicht gesetzt) kann dies ändern. Senden Sie `/status` als eigenständige Nachricht in der Gruppe, um den aktuellen Aktivierungsmodus anzuzeigen.

## Verwendung

1. Fügen Sie Ihr WhatsApp‑Konto (das OpenClaw ausführt) zur Gruppe hinzu.
2. Sagen Sie `@openclaw …` (oder fügen Sie die Nummer ein). Nur zugelassene Absender können es auslösen, es sei denn, Sie setzen `groupPolicy: "open"`.
3. Der Agenten‑Prompt enthält den aktuellen Gruppenkontext plus den nachgestellten Marker `[from: …]`, damit er die richtige Person adressiert.
4. Sitzungsweite Direktiven (`/verbose on`, `/think high`, `/new` oder `/reset`, `/compact`) gelten nur für die Sitzung dieser Gruppe; senden Sie sie als eigenständige Nachrichten, damit sie registriert werden. Ihre persönliche DM‑Sitzung bleibt unabhängig.

## Testen / Verifizierung

- Manueller Smoke‑Test:
  - Senden Sie eine `@openclaw`‑Erwähnung in der Gruppe und bestätigen Sie eine Antwort, die auf den Absendernamen Bezug nimmt.
  - Senden Sie eine zweite Erwähnung und prüfen Sie, dass der Verlaufsblock enthalten ist und im nächsten Zug wieder geleert wird.
- Prüfen Sie die Gateway‑Logs (ausführen mit `--verbose`), um `inbound web message`‑Einträge zu sehen, die `from: <groupJid>` und das Suffix `[from: …]` anzeigen.

## Bekannte Hinweise

- Heartbeats werden für Gruppen absichtlich übersprungen, um laute Broadcasts zu vermeiden.
- Die Echo‑Unterdrückung verwendet die kombinierte Batch‑Zeichenfolge; wenn Sie identischen Text zweimal ohne Erwähnungen senden, erhält nur der erste eine Antwort.
- Einträge im Sitzungsspeicher erscheinen als `agent:<agentId>:whatsapp:group:<jid>` im Sitzungsspeicher (`~/.openclaw/agents/<agentId>/sessions/sessions.json` standardmäßig); ein fehlender Eintrag bedeutet lediglich, dass die Gruppe noch keinen Lauf ausgelöst hat.
- Tippindikatoren in Gruppen folgen `agents.defaults.typingMode` (Standard: `message` ohne Erwähnung).
