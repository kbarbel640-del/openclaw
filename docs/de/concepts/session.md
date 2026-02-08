---
summary: "Regeln, Schluessel und Persistenz der Sitzungsverwaltung fuer Chats"
read_when:
  - Aendern der Sitzungsbehandlung oder -speicherung
title: "Sitzungsverwaltung"
x-i18n:
  source_path: concepts/session.md
  source_hash: 1486759a5c2fdced
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:27Z
---

# Sitzungsverwaltung

OpenClaw behandelt **eine Direktchat-Sitzung pro Agent** als primaer. Direktchats werden zu `agent:<agentId>:<mainKey>` zusammengefasst (Standard `main`), waehrend Gruppen-/Kanalchats eigene Schluessel erhalten. `session.mainKey` wird beachtet.

Verwenden Sie `session.dmScope`, um zu steuern, wie **Direktnachrichten** gruppiert werden:

- `main` (Standard): Alle DMs teilen sich die Hauptsitzung fuer Kontinuitaet.
- `per-peer`: Isolierung nach Absender-ID ueber Kanaele hinweg.
- `per-channel-peer`: Isolierung nach Kanal + Absender (empfohlen fuer Multi-User-Posteingae nge).
- `per-account-channel-peer`: Isolierung nach Konto + Kanal + Absender (empfohlen fuer Multi-Account-Posteingae nge).
  Verwenden Sie `session.identityLinks`, um anbieterpraefixierte Peer-IDs auf eine kanonische Identitaet abzubilden, sodass dieselbe Person bei Verwendung von `per-peer`, `per-channel-peer` oder `per-account-channel-peer` kanaluebergreifend eine DM-Sitzung teilt.

### Sicherer DM-Modus (empfohlen fuer Multi-User-Setups)

> **Sicherheitswarnung:** Wenn Ihr Agent DMs von **mehreren Personen** empfangen kann, sollten Sie dringend den sicheren DM-Modus aktivieren. Ohne ihn teilen sich alle Nutzer denselben Konversationskontext, was private Informationen zwischen Nutzern preisgeben kann.

**Beispiel fuer das Problem mit den Standardeinstellungen:**

- Alice (`<SENDER_A>`) schreibt Ihrem Agenten zu einem privaten Thema (z. B. einem Arzttermin)
- Bob (`<SENDER_B>`) schreibt Ihrem Agenten und fragt „Worueber haben wir gesprochen?“
- Da beide DMs dieselbe Sitzung teilen, kann das Modell Bob unter Verwendung von Alices vorherigem Kontext antworten.

**Die Loesung:** Setzen Sie `dmScope`, um Sitzungen pro Nutzer zu isolieren:

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    // Secure DM mode: isolate DM context per channel + sender.
    dmScope: "per-channel-peer",
  },
}
```

**Wann dies aktiviert werden sollte:**

- Sie haben Kopplungsfreigaben fuer mehr als einen Absender
- Sie verwenden eine DM-Allowlist mit mehreren Eintraegen
- Sie setzen `dmPolicy: "open"`
- Mehrere Telefonnummern oder Konten koennen Ihrem Agenten schreiben

Hinweise:

- Standard ist `dmScope: "main"` fuer Kontinuitaet (alle DMs teilen die Hauptsitzung). Das ist fuer Single-User-Setups in Ordnung.
- Fuer Multi-Account-Posteingae nge im selben Kanal bevorzugen Sie `per-account-channel-peer`.
- Wenn dieselbe Person Sie ueber mehrere Kanaele kontaktiert, verwenden Sie `session.identityLinks`, um deren DM-Sitzungen zu einer kanonischen Identitaet zusammenzufuehren.
- Sie koennen Ihre DM-Einstellungen mit `openclaw security audit` ueberpruefen (siehe [security](/cli/security)).

## Gateway ist die Quelle der Wahrheit

Der gesamte Sitzungszustand wird **vom Gateway besessen** (dem „Master“-OpenClaw). UI-Clients (macOS-App, WebChat usw.) muessen das Gateway nach Sitzungslisten und Token-Zaehlern abfragen, anstatt lokale Dateien zu lesen.

- Im **Remote-Modus** befindet sich der relevante Sitzungsspeicher auf dem entfernten Gateway-Host, nicht auf Ihrem Mac.
- In UIs angezeigte Token-Zaehler stammen aus den Speicherfeldern des Gateways (`inputTokens`, `outputTokens`, `totalTokens`, `contextTokens`). Clients parsen keine JSONL-Transkripte, um Summen „nachzubessern“.

## Wo der Zustand liegt

- Auf dem **Gateway-Host**:
  - Speicherdatei: `~/.openclaw/agents/<agentId>/sessions/sessions.json` (pro Agent).
- Transkripte: `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl` (Telegram-Topic-Sitzungen verwenden `.../<SessionId>-topic-<threadId>.jsonl`).
- Der Speicher ist eine Map `sessionKey -> { sessionId, updatedAt, ... }`. Das Loeschen von Eintraegen ist sicher; sie werden bei Bedarf neu erstellt.
- Gruppeneintraege koennen `displayName`, `channel`, `subject`, `room` und `space` enthalten, um Sitzungen in UIs zu beschriften.
- Sitzungseintraege enthalten `origin`-Metadaten (Label + Routing-Hinweise), damit UIs erklaeren koennen, woher eine Sitzung stammt.
- OpenClaw liest **keine** veralteten Pi/Tau-Sitzungsordner.

## Sitzungsbereinigung

OpenClaw kuerzt **alte Werkzeugergebnisse** im In-Memory-Kontext standardmaessig direkt vor LLM-Aufrufen.
Dies schreibt die JSONL-Historie **nicht** um. Siehe [/concepts/session-pruning](/concepts/session-pruning).

## Vorab-Kompaktion: Memory-Flush

Wenn sich eine Sitzung der automatischen Kompaktierung naehert, kann OpenClaw einen **stillen Memory-Flush**
ausfuehren, der das Modell daran erinnert, dauerhafte Notizen auf die Festplatte zu schreiben. Dies laeuft nur, wenn
der Workspace beschreibbar ist. Siehe [Memory](/concepts/memory) und
[Compaction](/concepts/compaction).

## Abbildung von Transporten → Sitzungsschluessel

- Direktchats folgen `session.dmScope` (Standard `main`).
  - `main`: `agent:<agentId>:<mainKey>` (Kontinuitaet ueber Geraete/Kanaele hinweg).
    - Mehrere Telefonnummern und Kanaele koennen auf denselben Agenten-Hauptschluessel abgebildet werden; sie fungieren als Transporte in eine Konversation.
  - `per-peer`: `agent:<agentId>:dm:<peerId>`.
  - `per-channel-peer`: `agent:<agentId>:<channel>:dm:<peerId>`.
  - `per-account-channel-peer`: `agent:<agentId>:<channel>:<accountId>:dm:<peerId>` (accountId standardmaessig `default`).
  - Wenn `session.identityLinks` einer anbieterpraefixierten Peer-ID entspricht (z. B. `telegram:123`), ersetzt der kanonische Schluessel `<peerId>`, sodass dieselbe Person kanaluebergreifend eine Sitzung teilt.
- Gruppenchats isolieren den Zustand: `agent:<agentId>:<channel>:group:<id>` (Raeume/Kanaele verwenden `agent:<agentId>:<channel>:channel:<id>`).
  - Telegram-Forum-Themen haengen `:topic:<threadId>` an die Gruppen-ID an, um Isolation zu erreichen.
  - Legacy-`group:<id>`-Schluessel werden weiterhin fuer die Migration erkannt.
- Eingehende Kontexte koennen weiterhin `group:<id>` verwenden; der Kanal wird aus `Provider` abgeleitet und in die kanonische `agent:<agentId>:<channel>:group:<id>`-Form normalisiert.
- Weitere Quellen:
  - Cron-Jobs: `cron:<job.id>`
  - Webhooks: `hook:<uuid>` (sofern nicht explizit vom Hook gesetzt)
  - Node-Runs: `node-<nodeId>`

## Lebenszyklus

- Zuruecksetzrichtlinie: Sitzungen werden wiederverwendet, bis sie ablaufen; der Ablauf wird bei der naechsten eingehenden Nachricht bewertet.
- Taeglicher Reset: Standard ist **4:00 Uhr Ortszeit auf dem Gateway-Host**. Eine Sitzung ist veraltet, wenn ihre letzte Aktualisierung vor der juengsten taeglichen Reset-Zeit liegt.
- Leerlauf-Reset (optional): `idleMinutes` fuegt ein gleitendes Leerlauffenster hinzu. Wenn sowohl taegliche als auch Leerlauf-Resets konfiguriert sind, erzwingt **der frueher ablaufende** eine neue Sitzung.
- Legacy nur-Leerlauf: Wenn Sie `session.idleMinutes` ohne irgendeine `session.reset`/`resetByType`-Konfiguration setzen, bleibt OpenClaw aus Gruenden der Rueckwaertskompatibilitaet im Nur-Leerlauf-Modus.
- Ueberschreibungen pro Typ (optional): `resetByType` ermoeglicht das Ueberschreiben der Richtlinie fuer `dm`, `group` und `thread`-Sitzungen (Thread = Slack/Discord-Threads, Telegram-Themen, Matrix-Threads, wenn vom Connector bereitgestellt).
- Ueberschreibungen pro Kanal (optional): `resetByChannel` ueberschreibt die Reset-Richtlinie fuer einen Kanal (gilt fuer alle Sitzungstypen dieses Kanals und hat Vorrang vor `reset`/`resetByType`).
- Reset-Trigger: Exakte `/new` oder `/reset` (zuzueglich eventueller Extras in `resetTriggers`) starten eine frische Sitzungs-ID und leiten den Rest der Nachricht weiter. `/new <model>` akzeptiert einen Modell-Alias, `provider/model` oder einen Anbieternamen (unscharfer Abgleich), um das neue Sitzungsmodell zu setzen. Wenn `/new` oder `/reset` allein gesendet wird, fuehrt OpenClaw einen kurzen „Hallo“-Begruessungszug aus, um den Reset zu bestaetigen.
- Manueller Reset: Loeschen Sie spezifische Schluessel aus dem Speicher oder entfernen Sie das JSONL-Transkript; die naechste Nachricht erstellt sie neu.
- Isolierte Cron-Jobs erzeugen pro Lauf stets eine frische `sessionId` (keine Leerlauf-Wiederverwendung).

## Sende-Richtlinie (optional)

Blockieren Sie die Zustellung fuer bestimmte Sitzungstypen, ohne einzelne IDs aufzulisten.

```json5
{
  session: {
    sendPolicy: {
      rules: [
        { action: "deny", match: { channel: "discord", chatType: "group" } },
        { action: "deny", match: { keyPrefix: "cron:" } },
      ],
      default: "allow",
    },
  },
}
```

Laufzeit-Ueberschreibung (nur Owner):

- `/send on` → fuer diese Sitzung erlauben
- `/send off` → fuer diese Sitzung verweigern
- `/send inherit` → Ueberschreibung loeschen und Konfigurationsregeln verwenden
  Senden Sie diese als eigenstaendige Nachrichten, damit sie registriert werden.

## Konfiguration (optional: Beispiel fuer Umbenennung)

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    scope: "per-sender", // keep group keys separate
    dmScope: "main", // DM continuity (set per-channel-peer/per-account-channel-peer for shared inboxes)
    identityLinks: {
      alice: ["telegram:123456789", "discord:987654321012345678"],
    },
    reset: {
      // Defaults: mode=daily, atHour=4 (gateway host local time).
      // If you also set idleMinutes, whichever expires first wins.
      mode: "daily",
      atHour: 4,
      idleMinutes: 120,
    },
    resetByType: {
      thread: { mode: "daily", atHour: 4 },
      dm: { mode: "idle", idleMinutes: 240 },
      group: { mode: "idle", idleMinutes: 120 },
    },
    resetByChannel: {
      discord: { mode: "idle", idleMinutes: 10080 },
    },
    resetTriggers: ["/new", "/reset"],
    store: "~/.openclaw/agents/{agentId}/sessions/sessions.json",
    mainKey: "main",
  },
}
```

## Inspektion

- `openclaw status` — zeigt Speicherpfad und aktuelle Sitzungen.
- `openclaw sessions --json` — gibt jeden Eintrag aus (filtern mit `--active <minutes>`).
- `openclaw gateway call sessions.list --params '{}'` — ruft Sitzungen vom laufenden Gateway ab (verwenden Sie `--url`/`--token` fuer Remote-Gateway-Zugriff).
- Senden Sie `/status` als eigenstaendige Nachricht im Chat, um zu sehen, ob der Agent erreichbar ist, wie viel des Sitzungskontexts genutzt wird, aktuelle Thinking-/Verbose-Toggles sowie wann Ihre WhatsApp-Web-Zugangsdaten zuletzt aktualisiert wurden (hilft, Relink-Bedarf zu erkennen).
- Senden Sie `/context list` oder `/context detail`, um zu sehen, was sich im System-Prompt und in injizierten Workspace-Dateien befindet (und die groessten Kontextbeitraege).
- Senden Sie `/stop` als eigenstaendige Nachricht, um den aktuellen Lauf abzubrechen, wartende Folgeaktionen fuer diese Sitzung zu loeschen und alle daraus gestarteten Sub-Agent-Laeufe zu stoppen (die Antwort enthaelt die Anzahl der gestoppten Laeufe).
- Senden Sie `/compact` (optionale Anweisungen) als eigenstaendige Nachricht, um aelteren Kontext zusammenzufassen und Fensterspeicher freizugeben. Siehe [/concepts/compaction](/concepts/compaction).
- JSONL-Transkripte koennen direkt geoeffnet werden, um vollstaendige Zuege zu pruefen.

## Tipps

- Halten Sie den primaeren Schluessel fuer 1:1-Verkehr reserviert; lassen Sie Gruppen ihre eigenen Schluessel behalten.
- Beim automatisierten Aufraeumen loeschen Sie einzelne Schluessel statt den gesamten Speicher, um Kontext an anderer Stelle zu bewahren.

## Metadaten zum Sitzungsursprung

Jeder Sitzungseintrag zeichnet bestmoeglich auf, woher er stammt, in `origin`:

- `label`: menschenlesbares Label (aufgeloest aus Konversationslabel + Gruppenthema/Kanal)
- `provider`: normalisierte Kanal-ID (einschliesslich Erweiterungen)
- `from`/`to`: rohe Routing-IDs aus dem eingehenden Umschlag
- `accountId`: Anbieter-Konto-ID (bei Multi-Account)
- `threadId`: Thread-/Topic-ID, wenn der Kanal dies unterstuetzt
  Die Ursprungsfelder werden fuer Direktnachrichten, Kanaele und Gruppen befuellt. Wenn ein
  Connector nur die Zustellungsweiterleitung aktualisiert (z. B. um eine DM-Hauptsitzung
  frisch zu halten), sollte er dennoch eingehenden Kontext bereitstellen, damit die Sitzung ihre
  Erklaerungsmetadaten behaelt. Erweiterungen koennen dies tun, indem sie `ConversationLabel`,
  `GroupSubject`, `GroupChannel`, `GroupSpace` und `SenderName` im eingehenden
  Kontext senden und `recordSessionMetaFromInbound` aufrufen (oder denselben Kontext an `updateLastRoute`
  uebergeben).
