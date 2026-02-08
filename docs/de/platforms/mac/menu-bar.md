---
summary: „Statuslogik der Menüleiste und was den Benutzern angezeigt wird“
read_when:
  - Optimieren der mac-Menü-UI oder der Statuslogik
title: „Menüleiste“
x-i18n:
  source_path: platforms/mac/menu-bar.md
  source_hash: 8eb73c0e671a76aa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:05Z
---

# Statuslogik der Menüleiste

## Was angezeigt wird

- Wir zeigen den aktuellen Arbeitsstatus des Agenten im Symbol der Menüleiste und in der ersten Statuszeile des Menüs an.
- Der Gesundheitsstatus ist ausgeblendet, während Arbeit aktiv ist; er erscheint wieder, wenn alle Sitzungen im Leerlauf sind.
- Der Block „Nodes“ im Menü listet nur **Geräte** (gekoppelte Nodes über `node.list`), keine Client-/Presence-Einträge.
- Ein Abschnitt „Usage“ erscheint unter „Context“, wenn Nutzungs-Snapshots des Anbieters verfügbar sind.

## Zustandsmodell

- Sitzungen: Ereignisse treffen mit `runId` (pro Lauf) sowie `sessionKey` im Payload ein. Die „Haupt“-Sitzung ist der Schlüssel `main`; falls er fehlt, greifen wir auf die zuletzt aktualisierte Sitzung zurück.
- Priorität: Die Hauptsitzung gewinnt immer. Ist die Hauptsitzung aktiv, wird ihr Zustand sofort angezeigt. Ist die Hauptsitzung im Leerlauf, wird die zuletzt aktive Nicht‑Hauptsitzung angezeigt. Wir wechseln nicht während einer Aktivität hin und her; wir schalten nur um, wenn die aktuelle Sitzung in den Leerlauf geht oder die Hauptsitzung aktiv wird.
- Aktivitätsarten:
  - `job`: Ausführung von High‑Level‑Befehlen (`state: started|streaming|done|error`).
  - `tool`: `phase: start|result` mit `toolName` und `meta/args`.

## IconState enum (Swift)

- `idle`
- `workingMain(ActivityKind)`
- `workingOther(ActivityKind)`
- `overridden(ActivityKind)` (Debug‑Override)

### ActivityKind → Glyph

- `exec` → 💻
- `read` → 📄
- `write` → ✍️
- `edit` → 📝
- `attach` → 📎
- default → 🛠️

### Visuelle Zuordnung

- `idle`: normales Tierchen.
- `workingMain`: Badge mit Glyph, volle Tönung, „arbeitende“ Bein‑Animation.
- `workingOther`: Badge mit Glyph, gedämpfte Tönung, kein Herumwuseln.
- `overridden`: verwendet das gewählte Glyph/die Tönung unabhängig von der Aktivität.

## Statuszeilentext (Menü)

- Während Arbeit aktiv ist: `<Session role> · <activity label>`
  - Beispiele: `Main · exec: pnpm test`, `Other · read: apps/macos/Sources/OpenClaw/AppState.swift`.
- Im Leerlauf: Fällt auf die Gesundheitszusammenfassung zurück.

## Ereignisaufnahme

- Quelle: Control‑Kanal `agent`‑Ereignisse (`ControlChannel.handleAgentEvent`).
- Geparste Felder:
  - `stream: "job"` mit `data.state` für Start/Stopp.
  - `stream: "tool"` mit `data.phase`, `name`, optional `meta`/`args`.
- Beschriftungen:
  - `exec`: erste Zeile von `args.command`.
  - `read`/`write`: verkürzter Pfad.
  - `edit`: Pfad plus abgeleitete Änderungsart aus `meta`/Diff‑Zählungen.
  - Fallback: Werkzeugname.

## Debug‑Override

- Einstellungen ▸ Debug ▸ Auswahlliste „Icon override“:
  - `System (auto)` (Standard)
  - `Working: main` (pro Werkzeugart)
  - `Working: other` (pro Werkzeugart)
  - `Idle`
- Gespeichert über `@AppStorage("iconOverride")`; zugeordnet zu `IconState.overridden`.

## Test‑Checkliste

- Job der Hauptsitzung auslösen: Prüfen, dass das Icon sofort umschaltet und die Statuszeile die Beschriftung der Hauptsitzung zeigt.
- Job einer Nicht‑Hauptsitzung auslösen, während die Hauptsitzung im Leerlauf ist: Icon/Status zeigt die Nicht‑Hauptsitzung; bleibt stabil, bis sie endet.
- Hauptsitzung starten, während eine andere aktiv ist: Icon wechselt sofort zur Hauptsitzung.
- Schnelle Werkzeug‑Bursts: Sicherstellen, dass das Badge nicht flackert (TTL‑Schonfrist für Werkzeugergebnisse).
- Die Gesundheitszeile erscheint wieder, sobald alle Sitzungen im Leerlauf sind.
