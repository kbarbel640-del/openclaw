---
summary: „Clawnet-Refactor: Vereinheitlichung von Netzwerkprotokoll, Rollen, Authentifizierung, Freigaben und Identität“
read_when:
  - Planung eines einheitlichen Netzwerkprotokolls für Nodes + Operator-Clients
  - Überarbeitung von Freigaben, Pairing, TLS und Präsenz über Geräte hinweg
title: „Clawnet-Refactor“
x-i18n:
  source_path: refactor/clawnet.md
  source_hash: 719b219c3b326479
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:41Z
---

# Clawnet-Refactor (Protokoll- + Auth-Vereinheitlichung)

## Hi

Hi Peter — großartige Richtung; das ermöglicht eine einfachere UX + stärkere Sicherheit.

## Zweck

Ein einziges, stringentes Dokument für:

- Aktueller Stand: Protokolle, Abläufe, Vertrauensgrenzen.
- Schmerzpunkte: Freigaben, Multi-Hop-Routing, UI-Duplizierung.
- Vorgeschlagener neuer Stand: ein Protokoll, klar abgegrenzte Rollen, vereinheitlichte Authentifizierung/Pairing, TLS-Pinning.
- Identitätsmodell: stabile IDs + hübsche Slugs.
- Migrationsplan, Risiken, offene Fragen.

## Ziele (aus der Diskussion)

- Ein Protokoll für alle Clients (Mac-App, CLI, iOS, Android, Headless Node).
- Jeder Netzwerkteilnehmer authentifiziert + gepairt.
- Klare Rollen: Nodes vs. Operatoren.
- Zentrale Freigaben, weitergeleitet dorthin, wo der Nutzer ist.
- TLS-Verschlüsselung + optionales Pinning für allen Remote-Traffic.
- Minimale Code-Duplizierung.
- Eine einzelne Maschine erscheint nur einmal (keine UI/Node-Doppeleinträge).

## Nicht-Ziele (explizit)

- Aufhebung der Fähigkeits-Trennung (Least-Privilege bleibt erforderlich).
- Freigabe der vollständigen Gateway-Control-Plane ohne Scope-Prüfungen.
- Authentifizierung von menschlichen Labels abhängig machen (Slugs bleiben nicht sicherheitsrelevant).

---

# Aktueller Stand (Ist-Zustand)

## Zwei Protokolle

### 1) Gateway WebSocket (Control Plane)

- Vollständige API-Oberfläche: Konfiguration, Kanäle, Modelle, Sitzungen, Agent-Läufe, Logs, Nodes usw.
- Standard-Bind: Loopback. Remote-Zugriff via SSH/Tailscale.
- Auth: Token/Passwort über `connect`.
- Kein TLS-Pinning (verlässt sich auf Loopback/Tunnel).
- Code:
  - `src/gateway/server/ws-connection/message-handler.ts`
  - `src/gateway/client.ts`
  - `docs/gateway/protocol.md`

### 2) Bridge (Node-Transport)

- Eng begrenzte Allowlist-Oberfläche, Node-Identität + Pairing.
- JSONL über TCP; optional TLS + Zertifikats-Fingerprint-Pinning.
- TLS bewirbt den Fingerprint in Discovery-TXT.
- Code:
  - `src/infra/bridge/server/connection.ts`
  - `src/gateway/server-bridge.ts`
  - `src/node-host/bridge-client.ts`
  - `docs/gateway/bridge-protocol.md`

## Control-Plane-Clients heute

- CLI → Gateway WS über `callGateway` (`src/gateway/call.ts`).
- macOS-App-UI → Gateway WS (`GatewayConnection`).
- Web-Control-UI → Gateway WS.
- ACP → Gateway WS.
- Browser-Steuerung nutzt ihren eigenen HTTP-Control-Server.

## Nodes heute

- macOS-App im Node-Modus verbindet sich mit der Gateway-Bridge (`MacNodeBridgeSession`).
- iOS/Android-Apps verbinden sich mit der Gateway-Bridge.
- Pairing + per-Node-Token im Gateway gespeichert.

## Aktueller Freigabeablauf (Exec)

- Agent nutzt `system.run` über das Gateway.
- Gateway ruft den Node über die Bridge auf.
- Node-Runtime entscheidet über die Freigabe.
- UI-Prompt wird von der macOS-App angezeigt (wenn Node == macOS-App).
- Node gibt `invoke-res` an das Gateway zurück.
- Multi-Hop, UI an den Node-Host gebunden.

## Präsenz + Identität heute

- Gateway-Präsenz-Einträge von WS-Clients.
- Node-Präsenz-Einträge von der Bridge.
- macOS-App kann zwei Einträge für dieselbe Maschine anzeigen (UI + Node).
- Node-Identität im Pairing-Store; UI-Identität separat.

---

# Probleme / Schmerzpunkte

- Zwei Protokoll-Stacks zu warten (WS + Bridge).
- Freigaben auf Remote-Nodes: Prompt erscheint auf dem Node-Host, nicht dort, wo der Nutzer ist.
- TLS-Pinning existiert nur für die Bridge; WS verlässt sich auf SSH/Tailscale.
- Identitäts-Duplizierung: dieselbe Maschine erscheint als mehrere Instanzen.
- Unklare Rollen: UI + Node + CLI-Fähigkeiten nicht sauber getrennt.

---

# Vorgeschlagener neuer Stand (Clawnet)

## Ein Protokoll, zwei Rollen

Ein einziges WS-Protokoll mit Rolle + Scope.

- **Rolle: node** (Fähigkeits-Host)
- **Rolle: operator** (Control Plane)
- Optionaler **Scope** für Operator:
  - `operator.read` (Status + Ansicht)
  - `operator.write` (Agent-Lauf, Sends)
  - `operator.admin` (Konfiguration, Kanäle, Modelle)

### Rollenverhalten

**Node**

- Kann Fähigkeiten registrieren (`caps`, `commands`, Berechtigungen).
- Kann `invoke`-Kommandos empfangen (`system.run`, `camera.*`, `canvas.*`, `screen.record` usw.).
- Kann Events senden: `voice.transcript`, `agent.request`, `chat.subscribe`.
- Kann keine Control-Plane-APIs für config/models/channels/sessions/agent aufrufen.

**Operator**

- Vollständige Control-Plane-API, durch Scopes begrenzt.
- Empfängt alle Freigaben.
- Führt keine OS-Aktionen direkt aus; routet zu Nodes.

### Zentrale Regel

Die Rolle ist pro Verbindung, nicht pro Gerät. Ein Gerät kann beide Rollen separat öffnen.

---

# Vereinheitlichte Authentifizierung + Pairing

## Client-Identität

Jeder Client liefert:

- `deviceId` (stabil, aus dem Geräteschlüssel abgeleitet).
- `displayName` (menschlicher Name).
- `role` + `scope` + `caps` + `commands`.

## Pairing-Ablauf (vereinheitlicht)

- Client verbindet sich unauthentifiziert.
- Gateway erstellt eine **Pairing-Anfrage** für diese `deviceId`.
- Operator erhält einen Prompt; genehmigt/ablehnt.
- Gateway stellt Anmeldeinformationen aus, gebunden an:
  - Geräteschlüssel (Public Key)
  - Rolle(n)
  - Scope(s)
  - Fähigkeiten/Kommandos
- Client persistiert das Token und verbindet sich authentifiziert erneut.

## Gerätegebundene Auth (Vermeidung von Bearer-Token-Replay)

Bevorzugt: Geräteschlüsselpaare.

- Gerät erzeugt einmalig ein Schlüsselpaar.
- `deviceId = fingerprint(publicKey)`.
- Gateway sendet Nonce; Gerät signiert; Gateway verifiziert.
- Tokens werden an einen Public Key ausgegeben (Proof-of-Possession), nicht an eine Zeichenkette.

Alternativen:

- mTLS (Client-Zertifikate): am stärksten, mehr operativer Aufwand.
- Kurzlebige Bearer-Tokens nur als Übergangsphase (früh rotieren + widerrufen).

## Stille Freigabe (SSH-Heuristik)

Präzise definieren, um eine Schwachstelle zu vermeiden. Bevorzugen Sie eine Option:

- **Nur lokal**: Auto-Pairing, wenn der Client über Loopback/Unix-Socket verbindet.
- **Challenge via SSH**: Gateway stellt Nonce aus; Client weist SSH nach, indem er sie abruft.
- **Zeitfenster physischer Präsenz**: Nach einer lokalen Freigabe auf der Gateway-Host-UI Auto-Pairing für ein kurzes Fenster (z. B. 10 Minuten).

Auto-Freigaben stets protokollieren und erfassen.

---

# TLS überall (Dev + Prod)

## Bestehendes Bridge-TLS wiederverwenden

Aktuelle TLS-Runtime + Fingerprint-Pinning nutzen:

- `src/infra/bridge/server/tls.ts`
- Fingerprint-Verifikationslogik in `src/node-host/bridge-client.ts`

## Auf WS anwenden

- WS-Server unterstützt TLS mit demselben Zertifikat/Schlüssel + Fingerprint.
- WS-Clients können den Fingerprint anpinnen (optional).
- Discovery bewirbt TLS + Fingerprint für alle Endpunkte.
  - Discovery ist nur Locator-Hinweise; niemals ein Vertrauensanker.

## Warum

- Geringere Abhängigkeit von SSH/Tailscale für Vertraulichkeit.
- Sichere Remote-Mobilverbindungen standardmäßig.

---

# Freigaben-Redesign (zentralisiert)

## Aktuell

Freigabe erfolgt auf dem Node-Host (macOS-App-Node-Runtime). Prompt erscheint dort, wo der Node läuft.

## Vorgeschlagen

Freigabe ist **Gateway-gehostet**, UI wird an Operator-Clients ausgeliefert.

### Neuer Ablauf

1. Gateway erhält `system.run`-Intent (Agent).
2. Gateway erstellt einen Freigabe-Datensatz: `approval.requested`.
3. Operator-UIs zeigen einen Prompt.
4. Freigabeentscheidung wird an das Gateway gesendet: `approval.resolve`.
5. Gateway ruft bei Genehmigung das Node-Kommando auf.
6. Node führt aus und gibt `invoke-res` zurück.

### Freigabesemantik (Härtung)

- Broadcast an alle Operatoren; nur die aktive UI zeigt ein Modal (andere erhalten einen Toast).
- Die erste Entscheidung gewinnt; Gateway lehnt weitere Entscheidungen als bereits erledigt ab.
- Standard-Timeout: Ablehnung nach N Sekunden (z. B. 60 s), Grund protokollieren.
- Entscheidung erfordert den Scope `operator.approvals`.

## Vorteile

- Prompt erscheint dort, wo der Nutzer ist (Mac/Telefon).
- Konsistente Freigaben für Remote-Nodes.
- Node-Runtime bleibt headless; keine UI-Abhängigkeit.

---

# Beispiele für klare Rollen

## iPhone-App

- **Node-Rolle** für: Mikrofon, Kamera, Sprachchat, Standort, Push-to-Talk.
- Optional **operator.read** für Status und Chat-Ansicht.
- Optional **operator.write/admin** nur bei expliziter Aktivierung.

## macOS-App

- Operator-Rolle standardmäßig (Control-UI).
- Node-Rolle, wenn „Mac-Node“ aktiviert ist (system.run, Bildschirm, Kamera).
- Gleiche deviceId für beide Verbindungen → zusammengeführter UI-Eintrag.

## CLI

- Immer Operator-Rolle.
- Scope abgeleitet vom Subcommand:
  - `status`, `logs` → read
  - `agent`, `message` → write
  - `config`, `channels` → admin
  - Freigaben + Pairing → `operator.approvals` / `operator.pairing`

---

# Identität + Slugs

## Stabile ID

Für Auth erforderlich; ändert sich nie.
Bevorzugt:

- Schlüsselpaar-Fingerprint (Public-Key-Hash).

## Hübscher Slug (hummer‑thematisch)

Nur menschliches Label.

- Beispiel: `scarlet-claw`, `saltwave`, `mantis-pinch`.
- Im Gateway-Register gespeichert, editierbar.
- Kollisionsbehandlung: `-2`, `-3`.

## UI-Gruppierung

Gleiche `deviceId` über Rollen hinweg → eine einzelne „Instanz“-Zeile:

- Badge: `operator`, `node`.
- Zeigt Fähigkeiten + zuletzt gesehen.

---

# Migrationsstrategie

## Phase 0: Dokumentieren + abstimmen

- Dieses Dokument veröffentlichen.
- Alle Protokollaufrufe + Freigabeabläufe inventarisieren.

## Phase 1: Rollen/Scopes zu WS hinzufügen

- `connect`-Parameter um `role`, `scope`, `deviceId` erweitern.
- Allowlist-Gating für die Node-Rolle hinzufügen.

## Phase 2: Bridge-Kompatibilität

- Bridge weiter betreiben.
- WS-Node-Support parallel hinzufügen.
- Funktionen hinter Konfigurations-Flag absichern.

## Phase 3: Zentrale Freigaben

- Freigabe-Anfrage- + Resolve-Events in WS hinzufügen.
- macOS-App-UI aktualisieren, um Prompts anzuzeigen + zu beantworten.
- Node-Runtime hört auf, UI-Prompts anzuzeigen.

## Phase 4: TLS-Vereinheitlichung

- TLS-Konfiguration für WS mit Bridge-TLS-Runtime hinzufügen.
- Pinning zu Clients hinzufügen.

## Phase 5: Bridge ablösen

- iOS/Android/macOS-Node auf WS migrieren.
- Bridge als Fallback behalten; nach Stabilisierung entfernen.

## Phase 6: Gerätegebundene Auth

- Schlüsselbasierte Identität für alle nicht-lokalen Verbindungen verlangen.
- Widerrufs- + Rotations-UI hinzufügen.

---

# Sicherheitshinweise

- Rollen/Allowlists am Gateway-Rand durchgesetzt.
- Kein Client erhält die „volle“ API ohne Operator-Scope.
- Pairing für _alle_ Verbindungen erforderlich.
- TLS + Pinning reduzieren MITM-Risiken für Mobilgeräte.
- SSH-stille Freigabe ist Komfort; weiterhin protokolliert + widerrufbar.
- Discovery ist niemals ein Vertrauensanker.
- Fähigkeits-Claims werden plattform-/typabhängig gegen Server-Allowlists verifiziert.

# Streaming + große Payloads (Node-Medien)

WS-Control-Plane ist für kleine Nachrichten geeignet, aber Nodes machen auch:

- Kameraclips
- Bildschirmaufzeichnungen
- Audiostreams

Optionen:

1. WS-Binary-Frames + Chunking + Backpressure-Regeln.
2. Separater Streaming-Endpunkt (weiterhin TLS + Auth).
3. Bridge länger beibehalten für medienlastige Kommandos, zuletzt migrieren.

Wählen Sie vor der Implementierung eine Option, um Drift zu vermeiden.

# Fähigkeits- + Kommando-Policy

- Von Nodes gemeldete Caps/Kommandos werden als **Claims** behandelt.
- Gateway erzwingt plattformspezifische Allowlists.
- Jedes neue Kommando erfordert Operator-Freigabe oder eine explizite Allowlist-Änderung.
- Änderungen mit Zeitstempeln auditieren.

# Audit + Rate-Limiting

- Protokollieren: Pairing-Anfragen, Genehmigungen/Ablehnungen, Token-Ausgabe/Rotation/Widerruf.
- Pairing-Spam und Freigabe-Prompts rate-limitieren.

# Protokoll-Hygiene

- Explizite Protokollversion + Fehlercodes.
- Reconnect-Regeln + Heartbeat-Policy.
- Präsenz-TTL und Last-Seen-Semantik.

---

# Offene Fragen

1. Ein einzelnes Gerät mit beiden Rollen: Token-Modell
   - Empfehlung: getrennte Tokens pro Rolle (Node vs. Operator).
   - Gleiche deviceId; unterschiedliche Scopes; klarerer Widerruf.

2. Granularität der Operator-Scopes
   - read/write/admin + Freigaben + Pairing (Minimum Viable).
   - Später per-Feature-Scopes erwägen.

3. UX für Token-Rotation + Widerruf
   - Auto-Rotation bei Rollenänderung.
   - UI zum Widerrufen nach deviceId + Rolle.

4. Discovery
   - Aktuelle Bonjour-TXT erweitern um WS-TLS-Fingerprint + Rollen-Hinweise.
   - Nur als Locator-Hinweise behandeln.

5. Netzwerkübergreifende Freigaben
   - Broadcast an alle Operator-Clients; aktive UI zeigt Modal.
   - Erste Antwort gewinnt; Gateway erzwingt Atomizität.

---

# Zusammenfassung (TL;DR)

- Heute: WS-Control-Plane + Bridge-Node-Transport.
- Schmerz: Freigaben + Duplizierung + zwei Stacks.
- Vorschlag: ein WS-Protokoll mit expliziten Rollen + Scopes, vereinheitlichtes Pairing + TLS-Pinning, Gateway-gehostete Freigaben, stabile Geräte-IDs + hübsche Slugs.
- Ergebnis: einfachere UX, stärkere Sicherheit, weniger Duplizierung, bessere Mobile-Routing.
