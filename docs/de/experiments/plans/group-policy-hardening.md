---
summary: "Telegram-Allowlist-Härtung: Präfix + Normalisierung von Leerzeichen"
read_when:
  - Bei der Überprüfung historischer Änderungen an der Telegram-Allowlist
title: "Telegram-Allowlist-Härtung"
x-i18n:
  source_path: experiments/plans/group-policy-hardening.md
  source_hash: a2eca5fcc8537694
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:14Z
---

# Telegram-Allowlist-Härtung

**Datum**: 2026-01-05  
**Status**: Abgeschlossen  
**PR**: #216

## Zusammenfassung

Telegram-Allowlists akzeptieren jetzt die Präfixe `telegram:` und `tg:` unabhängig von der Groß-/Kleinschreibung und tolerieren
versehentliche Leerzeichen. Dadurch werden eingehende Allowlist-Prüfungen an die ausgehende Sendenormalisierung angepasst.

## Was sich geändert hat

- Die Präfixe `telegram:` und `tg:` werden gleich behandelt (unabhängig von der Groß-/Kleinschreibung).
- Allowlist-Einträge werden getrimmt; leere Einträge werden ignoriert.

## Beispiele

Alle folgenden Varianten werden für dieselbe ID akzeptiert:

- `telegram:123456`
- `TG:123456`
- `tg:123456`

## Warum das wichtig ist

Kopieren/Einfügen aus Logs oder Chat-IDs enthält häufig Präfixe und Leerzeichen. Die Normalisierung vermeidet
falsche Negative bei der Entscheidung, ob in Direktnachrichten oder Gruppen geantwortet werden soll.

## Verwandte Dokumente

- [Gruppenchats](/concepts/groups)
- [Telegram-Anbieter](/channels/telegram)
