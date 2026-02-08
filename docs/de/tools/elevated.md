---
summary: "Erhöhter Ausführungsmodus und /elevated-Direktiven"
read_when:
  - Anpassen der Standardwerte für den erhöhten Modus, von Allowlists oder des Verhaltens von Slash-Befehlen
title: "Erhöhter Modus"
x-i18n:
  source_path: tools/elevated.md
  source_hash: 83767a0160930402
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:46Z
---

# Erhöhter Modus (/elevated-Direktiven)

## Was er tut

- `/elevated on` läuft auf dem Gateway-Host und behält Exec-Freigaben bei (gleich wie `/elevated ask`).
- `/elevated full` läuft auf dem Gateway-Host **und** genehmigt Exec automatisch (überspringt Exec-Freigaben).
- `/elevated ask` läuft auf dem Gateway-Host, behält jedoch Exec-Freigaben bei (gleich wie `/elevated on`).
- `on`/`ask` erzwingen **nicht** `exec.security=full`; die konfigurierte Sicherheits-/Ask-Policy gilt weiterhin.
- Ändert das Verhalten nur, wenn der Agent **sandboxed** ist (ansonsten läuft Exec bereits auf dem Host).
- Direktivenformen: `/elevated on|off|ask|full`, `/elev on|off|ask|full`.
- Es werden nur `on|off|ask|full` akzeptiert; alles andere gibt einen Hinweis zurück und ändert den Zustand nicht.

## Was er steuert (und was nicht)

- **Verfügbarkeits-Gates**: `tools.elevated` ist die globale Basis. `agents.list[].tools.elevated` kann erhöhten Zugriff pro Agent weiter einschränken (beide müssen erlauben).
- **Sitzungsstatus**: `/elevated on|off|ask|full` setzt die Stufe des erhöhten Modus für den aktuellen Sitzungsschlüssel.
- **Inline-Direktive**: `/elevated on|ask|full` innerhalb einer Nachricht gilt nur für diese Nachricht.
- **Gruppen**: In Gruppenchats werden erhöhte Direktiven nur berücksichtigt, wenn der Agent erwähnt wird. Nur-Befehl-Nachrichten, die die Erwähnungspflicht umgehen, werden als erwähnt behandelt.
- **Host-Ausführung**: Erhöht erzwingt `exec` auf den Gateway-Host; `full` setzt zusätzlich `security=full`.
- **Freigaben**: `full` überspringt Exec-Freigaben; `on`/`ask` beachten sie, wenn Allowlist-/Ask-Regeln dies erfordern.
- **Nicht-sandboxed Agents**: Kein Effekt auf den Ausführungsort; betrifft nur Gating, Logging und Status.
- **Werkzeug-Policy gilt weiterhin**: Wenn `exec` durch die Werkzeug-Policy verweigert ist, kann erhöht nicht verwendet werden.
- **Getrennt von `/exec`**: `/exec` passt sitzungsweise Standardwerte für autorisierte Absender an und erfordert keinen erhöhten Modus.

## Auflösungsreihenfolge

1. Inline-Direktive in der Nachricht (gilt nur für diese Nachricht).
2. Sitzungs-Override (gesetzt durch Senden einer reinen Direktiv-Nachricht).
3. Globaler Standard (`agents.defaults.elevatedDefault` in der Konfiguration).

## Setzen eines Sitzungsstandards

- Senden Sie eine Nachricht, die **nur** aus der Direktive besteht (Whitespace erlaubt), z. B. `/elevated full`.
- Es wird eine Bestätigungsantwort gesendet (`Elevated mode set to full...` / `Elevated mode disabled.`).
- Wenn erhöhter Zugriff deaktiviert ist oder der Absender nicht auf der genehmigten Allowlist steht, antwortet die Direktive mit einem umsetzbaren Fehler und ändert den Sitzungsstatus nicht.
- Senden Sie `/elevated` (oder `/elevated:`) ohne Argument, um die aktuelle Stufe des erhöhten Modus anzuzeigen.

## Verfügbarkeit + Allowlists

- Feature-Gate: `tools.elevated.enabled` (Standard kann per Konfiguration deaktiviert sein, selbst wenn der Code es unterstützt).
- Absender-Allowlist: `tools.elevated.allowFrom` mit anbieterbezogenen Allowlists (z. B. `discord`, `whatsapp`).
- Pro-Agent-Gate: `agents.list[].tools.elevated.enabled` (optional; kann nur weiter einschränken).
- Pro-Agent-Allowlist: `agents.list[].tools.elevated.allowFrom` (optional; wenn gesetzt, muss der Absender **sowohl** die globale als auch die pro-Agent-Allowlist erfüllen).
- Discord-Fallback: Wenn `tools.elevated.allowFrom.discord` weggelassen wird, wird die Liste `channels.discord.dm.allowFrom` als Fallback verwendet. Setzen Sie `tools.elevated.allowFrom.discord` (auch `[]`), um zu überschreiben. Pro-Agent-Allowlists verwenden den Fallback **nicht**.
- Alle Gates müssen bestehen; andernfalls wird erhöhter Modus als nicht verfügbar behandelt.

## Logging + Status

- Erhöhte Exec-Aufrufe werden auf Info-Level protokolliert.
- Der Sitzungsstatus enthält den erhöhten Modus (z. B. `elevated=ask`, `elevated=full`).
