---
summary: „Wie OpenClaw-Presence-Einträge erzeugt, zusammengeführt und angezeigt werden“
read_when:
  - Debugging des Instanzen-Tabs
  - Untersuchung doppelter oder veralteter Instanzen-Zeilen
  - Aendern von Gateway-WS-Verbindungen oder System-Event-Beacons
title: „Presence“
x-i18n:
  source_path: concepts/presence.md
  source_hash: c752c76a880878fe
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:05Z
---

# Presence

OpenClaw „Presence“ ist eine leichtgewichtige Best‑Effort-Ansicht von:

- dem **Gateway** selbst und
- **Clients, die mit dem Gateway verbunden sind** (Mac-App, WebChat, CLI usw.)

Presence wird in erster Linie verwendet, um den **Instanzen**-Tab der macOS-App darzustellen und
schnelle Sichtbarkeit fuer Operatoren bereitzustellen.

## Presence-Felder (was angezeigt wird)

Presence-Eintraege sind strukturierte Objekte mit Feldern wie:

- `instanceId` (optional, aber dringend empfohlen): stabile Client-Identitaet (meist `connect.client.instanceId`)
- `host`: menschenlesbarer Hostname
- `ip`: Best‑Effort-IP-Adresse
- `version`: Client-Versionsstring
- `deviceFamily` / `modelIdentifier`: Hardware-Hinweise
- `mode`: `ui`, `webchat`, `cli`, `backend`, `probe`, `test`, `node`, ...
- `lastInputSeconds`: „Sekunden seit letzter Benutzereingabe“ (falls bekannt)
- `reason`: `self`, `connect`, `node-connected`, `periodic`, ...
- `ts`: Zeitstempel des letzten Updates (ms seit Epoche)

## Erzeuger (woher Presence kommt)

Presence-Eintraege werden aus mehreren Quellen erzeugt und **zusammengefuehrt**.

### 1) Gateway-Selbsteintrag

Das Gateway initialisiert beim Start immer einen „Self“-Eintrag, sodass UIs den Gateway-Host
anzeigen, noch bevor Clients verbunden sind.

### 2) WebSocket-Verbindung

Jeder WS-Client beginnt mit einer `connect`-Anfrage. Nach erfolgreichem Handshake
fuegt das Gateway einen Presence-Eintrag fuer diese Verbindung ein oder aktualisiert ihn.

#### Warum einmalige CLI-Befehle nicht angezeigt werden

Die CLI verbindet sich haeufig nur kurz fuer einmalige Befehle. Um die
Instanzen-Liste nicht zu ueberfluten, wird `client.mode === "cli"` **nicht** in einen Presence-Eintrag umgewandelt.

### 3) `system-event`-Beacons

Clients koennen ueber die Methode `system-event` reichhaltigere periodische Beacons senden. Die Mac-App
verwendet dies, um Hostname, IP und `lastInputSeconds` zu melden.

### 4) Node-Verbindungen (Rolle: node)

Wenn sich ein Node ueber den Gateway-WebSocket mit `role: node` verbindet, fuegt das Gateway
einen Presence-Eintrag fuer diesen Node ein oder aktualisiert ihn (gleicher Ablauf wie bei anderen WS-Clients).

## Merge- und Deduplizierungsregeln (warum `instanceId` wichtig ist)

Presence-Eintraege werden in einer einzelnen In‑Memory-Map gespeichert:

- Eintraege werden ueber einen **Presence-Schluessel** identifiziert.
- Der beste Schluessel ist eine stabile `instanceId` (aus `connect.client.instanceId`), die Neustarts uebersteht.
- Schluessel sind nicht zwischen Gross- und Kleinschreibung unterscheidend.

Wenn sich ein Client ohne stabile `instanceId` erneut verbindet, kann er als
**doppelte** Zeile erscheinen.

## TTL und begrenzte Groesse

Presence ist bewusst ephemer:

- **TTL:** Eintraege, die aelter als 5 Minuten sind, werden entfernt
- **Max. Eintraege:** 200 (die aeltesten werden zuerst entfernt)

Dies haelt die Liste aktuell und verhindert unbeschraenktes Speicherwachstum.

## Remote-/Tunnel-Hinweis (Loopback-IP-Adressen)

Wenn sich ein Client ueber einen SSH-Tunnel / lokales Port-Forwarding verbindet, kann das Gateway
die Remote-Adresse als `127.0.0.1` sehen. Um eine gueltige, vom Client gemeldete IP nicht zu
ueberschreiben, werden Loopback-Remote-Adressen ignoriert.

## Konsumenten

### macOS-Instanzen-Tab

Die macOS-App rendert die Ausgabe von `system-presence` und wendet einen kleinen Statusindikator
(Aktiv/Idle/Veraltet) basierend auf dem Alter des letzten Updates an.

## Debugging-Tipps

- Um die Rohdatenliste zu sehen, rufen Sie `system-presence` gegen das Gateway auf.
- Wenn Sie Duplikate sehen:
  - bestaetigen Sie, dass Clients beim Handshake eine stabile `client.instanceId` senden
  - bestaetigen Sie, dass periodische Beacons dieselbe `instanceId` verwenden
  - pruefen Sie, ob dem verbindungsabgeleiteten Eintrag `instanceId` fehlt (Duplikate sind in diesem Fall zu erwarten)
