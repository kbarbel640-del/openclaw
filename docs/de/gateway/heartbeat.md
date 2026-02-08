---
summary: "Heartbeat-Abfrage-Nachrichten und Benachrichtigungsregeln"
read_when:
  - Anpassen der Heartbeat-Taktung oder der Nachrichten
  - Entscheidung zwischen Heartbeat und Cron fuer geplante Aufgaben
title: "Heartbeat"
x-i18n:
  source_path: gateway/heartbeat.md
  source_hash: 27db9803263a5f2d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:48Z
---

# Heartbeat (Gateway)

> **Heartbeat vs. Cron?** Siehe [Cron vs Heartbeat](/automation/cron-vs-heartbeat) fuer Hinweise, wann was zu verwenden ist.

Heartbeat fuehrt **periodische Agent-Turns** in der Hauptsitzung aus, damit das Modell
alles Wichtige aufzeigen kann, ohne Sie mit Nachrichten zu ueberschwemmen.

## Schnellstart (Anfaenger)

1. Lassen Sie Heartbeats aktiviert (Standard ist `30m` oder `1h` fuer Anthropic OAuth/setup-token) oder legen Sie Ihre eigene Taktung fest.
2. Erstellen Sie eine kleine `HEARTBEAT.md`-Checkliste im Agent-Workspace (optional, aber empfohlen).
3. Entscheiden Sie, wohin Heartbeat-Nachrichten gesendet werden sollen (`target: "last"` ist der Standard).
4. Optional: Aktivieren Sie die Auslieferung der Heartbeat-Begruendung fuer mehr Transparenz.
5. Optional: Beschraenken Sie Heartbeats auf aktive Stunden (lokale Zeit).

Beispielkonfiguration:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        // activeHours: { start: "08:00", end: "24:00" },
        // includeReasoning: true, // optional: send separate `Reasoning:` message too
      },
    },
  },
}
```

## Standards

- Intervall: `30m` (oder `1h`, wenn Anthropic OAuth/setup-token der erkannte Authentifizierungsmodus ist). Setzen Sie `agents.defaults.heartbeat.every` oder pro Agent `agents.list[].heartbeat.every`; verwenden Sie `0m`, um zu deaktivieren.
- Prompt-Body (konfigurierbar ueber `agents.defaults.heartbeat.prompt`):
  `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
- Der Heartbeat-Prompt wird **wortgetreu** als Nutzernachricht gesendet. Der System-
  Prompt enthaelt einen Abschnitt „Heartbeat“, und der Run wird intern markiert.
- Aktive Stunden (`heartbeat.activeHours`) werden in der konfigurierten Zeitzone geprueft.
  Ausserhalb des Fensters werden Heartbeats uebersprungen, bis der naechste Tick innerhalb des Fensters erreicht ist.

## Wofuer der Heartbeat-Prompt gedacht ist

Der Standard-Prompt ist absichtlich allgemein gehalten:

- **Hintergrundaufgaben**: „Consider outstanding tasks“ veranlasst den Agenten,
  Folgeaufgaben (Posteingang, Kalender, Erinnerungen, Warteschlangenarbeit) zu pruefen
  und Dringendes hervorzuheben.
- **Menschlicher Check-in**: „Checkup sometimes on your human during day time“ regt
  gelegentliche, leichte „Brauchen Sie etwas?“-Nachrichten an, vermeidet aber
  Nacht-Spam durch Nutzung Ihrer konfigurierten lokalen Zeitzone
  (siehe [/concepts/timezone](/concepts/timezone)).

Wenn ein Heartbeat etwas sehr Spezifisches tun soll (z. B. „check Gmail PubSub
stats“ oder „verify gateway health“), setzen Sie `agents.defaults.heartbeat.prompt` (oder
`agents.list[].heartbeat.prompt`) auf einen benutzerdefinierten Body (wortgetreu gesendet).

## Antwortvertrag

- Wenn nichts Aufmerksamkeit erfordert, antworten Sie mit **`HEARTBEAT_OK`**.
- Waerend Heartbeat-Runs behandelt OpenClaw `HEARTBEAT_OK` als Ack, wenn es am
  **Anfang oder Ende** der Antwort erscheint. Das Token wird entfernt und die
  Antwort verworfen, wenn der verbleibende Inhalt **≤ `ackMaxChars`** ist
  (Standard: 300).
- Wenn `HEARTBEAT_OK` **in der Mitte** einer Antwort erscheint, wird es nicht
  speziell behandelt.
- Fuer Warnungen **nicht** `HEARTBEAT_OK` einschliessen; geben Sie nur den
  Warnungstext zurueck.

Ausserhalb von Heartbeats wird ein verirrtes `HEARTBEAT_OK` am Anfang/Ende einer
Nachricht entfernt und protokolliert; eine Nachricht, die nur aus
`HEARTBEAT_OK` besteht, wird verworfen.

## Konfiguration

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m", // default: 30m (0m disables)
        model: "anthropic/claude-opus-4-6",
        includeReasoning: false, // default: false (deliver separate Reasoning: message when available)
        target: "last", // last | none | <channel id> (core or plugin, e.g. "bluebubbles")
        to: "+15551234567", // optional channel-specific override
        accountId: "ops-bot", // optional multi-account channel id
        prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        ackMaxChars: 300, // max chars allowed after HEARTBEAT_OK
      },
    },
  },
}
```

### Geltungsbereich und Prioritaet

- `agents.defaults.heartbeat` setzt das globale Heartbeat-Verhalten.
- `agents.list[].heartbeat` wird daruebergelegt; wenn ein Agent einen `heartbeat`-Block
  hat, laufen Heartbeats **nur fuer diese Agenten**.
- `channels.defaults.heartbeat` setzt Sichtbarkeits-Standards fuer alle Kanaele.
- `channels.<channel>.heartbeat` ueberschreibt Kanal-Standards.
- `channels.<channel>.accounts.<id>.heartbeat` (Mehrkonto-Kanaele) ueberschreibt kanalweise Einstellungen.

### Pro-Agent-Heartbeats

Wenn ein `agents.list[]`-Eintrag einen `heartbeat`-Block enthaelt, laufen
Heartbeats **nur fuer diese Agenten**. Der Pro-Agent-Block wird ueber
`agents.defaults.heartbeat` gelegt (so koennen Sie gemeinsame Standards einmal setzen und pro
Agent ueberschreiben).

Beispiel: zwei Agenten, nur der zweite Agent fuehrt Heartbeats aus.

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
      },
    },
    list: [
      { id: "main", default: true },
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "whatsapp",
          to: "+15551234567",
          prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        },
      },
    ],
  },
}
```

### Beispiel fuer aktive Stunden

Beschraenken Sie Heartbeats auf Geschaeftszeiten in einer bestimmten Zeitzone:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        activeHours: {
          start: "09:00",
          end: "22:00",
          timezone: "America/New_York", // optional; uses your userTimezone if set, otherwise host tz
        },
      },
    },
  },
}
```

Ausserhalb dieses Fensters (vor 9 Uhr oder nach 22 Uhr Eastern) werden Heartbeats
uebersprungen. Der naechste geplante Tick innerhalb des Fensters laeuft normal.

### Mehrkonto-Beispiel

Verwenden Sie `accountId`, um auf Mehrkonto-Kanaelen wie Telegram ein bestimmtes
Konto anzusprechen:

```json5
{
  agents: {
    list: [
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "telegram",
          to: "12345678",
          accountId: "ops-bot",
        },
      },
    ],
  },
  channels: {
    telegram: {
      accounts: {
        "ops-bot": { botToken: "YOUR_TELEGRAM_BOT_TOKEN" },
      },
    },
  },
}
```

### Feldnotizen

- `every`: Heartbeat-Intervall (Dauerstring; Standardeinheit = Minuten).
- `model`: optionale Modellueberschreibung fuer Heartbeat-Runs
  (`provider/model`).
- `includeReasoning`: wenn aktiviert, wird zusaetzlich die separate
  `Reasoning:`-Nachricht ausgeliefert, sobald verfuegbar (gleiche Form wie
  `/reasoning on`).
- `session`: optionaler Sitzungs-Schluessel fuer Heartbeat-Runs.
  - `main` (Standard): Hauptsitzung des Agenten.
  - Expliziter Sitzungs-Schluessel (kopieren Sie ihn aus `openclaw sessions --json` oder der
    [sessions CLI](/cli/sessions)).
  - Sitzungs-Schluessel-Formate: siehe [Sessions](/concepts/session) und
    [Groups](/concepts/groups).
- `target`:
  - `last` (Standard): Zustellung an den zuletzt verwendeten externen Kanal.
  - Expliziter Kanal: `whatsapp` / `telegram` / `discord` /
    `googlechat` / `slack` / `msteams` / `signal` /
    `imessage`.
  - `none`: Heartbeat ausfuehren, aber **nicht extern zustellen**.
- `to`: optionale Empfaengerueberschreibung (kanalspezifische ID, z. B.
  E.164 fuer WhatsApp oder eine Telegram-Chat-ID).
- `accountId`: optionale Konto-ID fuer Mehrkonto-Kanaele. Wenn
  `target: "last"`, gilt die Konto-ID fuer den aufgeloesten letzten Kanal, sofern er
  Konten unterstuetzt; andernfalls wird sie ignoriert. Wenn die Konto-ID keinem
  konfigurierten Konto fuer den aufgeloesten Kanal entspricht, wird die Zustellung
  uebersprungen.
- `prompt`: ueberschreibt den Standard-Prompt-Body (wird nicht gemergt).
- `ackMaxChars`: maximale Zeichen nach `HEARTBEAT_OK` vor der Zustellung.
- `activeHours`: beschraenkt Heartbeat-Runs auf ein Zeitfenster. Objekt mit
  `start` (HH:MM, inklusiv), `end` (HH:MM exklusiv;
  `24:00` fuer Tagesende zulaessig) und optional `timezone`.
  - Weggelassen oder `"user"`: verwendet Ihre `agents.defaults.userTimezone`, falls gesetzt,
    sonst Rueckfall auf die Host-System-Zeitzone.
  - `"local"`: verwendet immer die Host-System-Zeitzone.
  - Jede IANA-Kennung (z. B. `America/New_York`): wird direkt verwendet; bei Ungueltigkeit
    Rueckfall auf das `"user"`-Verhalten oben.
  - Ausserhalb des aktiven Fensters werden Heartbeats uebersprungen, bis der naechste
    Tick innerhalb des Fensters erreicht ist.

## Zustellverhalten

- Heartbeats laufen standardmaessig in der Hauptsitzung des Agenten
  (`agent:<id>:<mainKey>`), oder `global`, wenn `session.scope = "global"`. Setzen Sie
  `session`, um auf eine bestimmte Kanalsitzung (Discord/WhatsApp/etc.)
  umzuschalten.
- `session` betrifft nur den Run-Kontext; die Zustellung wird durch
  `target` und `to` gesteuert.
- Um an einen bestimmten Kanal/Empfaenger zuzustellen, setzen Sie
  `target` + `to`. Mit `target: "last"` erfolgt die Zustellung
  ueber den letzten externen Kanal dieser Sitzung.
- Wenn die Hauptwarteschlange beschaeftigt ist, wird der Heartbeat uebersprungen und
  spaeter erneut versucht.
- Wenn `target` zu keinem externen Ziel aufloest, findet der Run dennoch
  statt, es wird aber keine ausgehende Nachricht gesendet.
- Reine Heartbeat-Antworten halten die Sitzung **nicht** aktiv; der letzte
  `updatedAt` wird wiederhergestellt, sodass der Idle-Ablauf normal greift.

## Sichtbarkeitssteuerungen

Standardmaessig werden `HEARTBEAT_OK`-Bestaetigungen unterdrueckt, waehrend
Warninhalte zugestellt werden. Sie koennen dies pro Kanal oder pro Konto anpassen:

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false # Hide HEARTBEAT_OK (default)
      showAlerts: true # Show alert messages (default)
      useIndicator: true # Emit indicator events (default)
  telegram:
    heartbeat:
      showOk: true # Show OK acknowledgments on Telegram
  whatsapp:
    accounts:
      work:
        heartbeat:
          showAlerts: false # Suppress alert delivery for this account
```

Prioritaet: Pro-Konto → Pro-Kanal → Kanal-Standards → Eingebaute Standards.

### Was jede Markierung bewirkt

- `showOk`: sendet eine `HEARTBEAT_OK`-Bestaetigung, wenn das Modell nur eine
  OK-Antwort zurueckgibt.
- `showAlerts`: sendet den Warninhalt, wenn das Modell eine Nicht-OK-Antwort
  zurueckgibt.
- `useIndicator`: erzeugt Indikator-Events fuer UI-Statusflaechen.

Wenn **alle drei** false sind, ueberspringt OpenClaw den Heartbeat-Run vollstaendig
(kein Modellaufruf).

### Pro-Kanal- vs. Pro-Konto-Beispiele

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false
      showAlerts: true
      useIndicator: true
  slack:
    heartbeat:
      showOk: true # all Slack accounts
    accounts:
      ops:
        heartbeat:
          showAlerts: false # suppress alerts for the ops account only
  telegram:
    heartbeat:
      showOk: true
```

### Hauefige Muster

| Ziel                                                   | Konfiguration                                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Standardverhalten (stille OKs, Warnungen)              | _(keine Konfiguration erforderlich)_                                                     |
| Vollstaendig still (keine Nachrichten, kein Indikator) | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: false }` |
| Nur Indikator (keine Nachrichten)                      | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: true }`  |
| OKs nur in einem Kanal                                 | `channels.telegram.heartbeat: { showOk: true }`                                          |

## HEARTBEAT.md (optional)

Wenn eine `HEARTBEAT.md`-Datei im Workspace existiert, weist der Standard-Prompt den
Agenten an, sie zu lesen. Betrachten Sie sie als Ihre „Heartbeat-Checkliste“:
klein, stabil und sicher, um sie alle 30 Minuten einzubinden.

Wenn `HEARTBEAT.md` existiert, aber faktisch leer ist (nur Leerzeilen und
Markdown-Ueberschriften wie `# Heading`), ueberspringt OpenClaw den Heartbeat-Run,
um API-Aufrufe zu sparen. Fehlt die Datei, laeuft der Heartbeat dennoch, und das
Modell entscheidet, was zu tun ist.

Halten Sie sie klein (kurze Checkliste oder Erinnerungen), um Prompt-Aufblaehung zu
vermeiden.

Beispiel `HEARTBEAT.md`:

```md
# Heartbeat checklist

- Quick scan: anything urgent in inboxes?
- If it’s daytime, do a lightweight check-in if nothing else is pending.
- If a task is blocked, write down _what is missing_ and ask Peter next time.
```

### Kann der Agent HEARTBEAT.md aktualisieren?

Ja — wenn Sie ihn darum bitten.

`HEARTBEAT.md` ist nur eine normale Datei im Agent-Workspace, daher koennen Sie
dem Agenten (in einem normalen Chat) z. B. sagen:

- „Aktualisiere `HEARTBEAT.md`, um eine taegliche Kalenderpruefung hinzuzufuegen.“
- „Schreibe `HEARTBEAT.md` um, damit es kuerzer ist und sich auf Inbox-Follow-ups
  konzentriert.“

Wenn dies proaktiv geschehen soll, koennen Sie auch eine explizite Zeile in Ihren
Heartbeat-Prompt aufnehmen, etwa: „If the checklist becomes stale, update
HEARTBEAT.md with a better one.“

Sicherheitshinweis: Platzieren Sie keine Geheimnisse (API-Schluessel,
Telefonnummern, private Tokens) in `HEARTBEAT.md` — es wird Teil des Prompt-
Kontexts.

## Manueller Wake (on-demand)

Sie koennen ein Systemereignis in die Warteschlange stellen und einen sofortigen
Heartbeat ausloesen mit:

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
```

Wenn mehrere Agenten `heartbeat` konfiguriert haben, fuehrt ein manueller Wake
alle diese Agent-Heartbeats sofort aus.

Verwenden Sie `--mode next-heartbeat`, um auf den naechsten geplanten Tick zu warten.

## Auslieferung der Begruendung (optional)

Standardmaessig liefern Heartbeats nur die finale „Antwort“-Nutzlast.

Wenn Sie Transparenz wuenschen, aktivieren Sie:

- `agents.defaults.heartbeat.includeReasoning: true`

Wenn aktiviert, liefern Heartbeats zusaetzlich eine separate Nachricht mit dem
Praefix `Reasoning:` (gleiche Form wie `/reasoning on`). Dies kann nuetzlich sein,
wenn der Agent mehrere Sitzungen/Kodizes verwaltet und Sie sehen moechten, warum er
sich entschieden hat, Sie anzupingen — kann aber auch mehr interne Details preisgeben,
als gewuenscht. Bevorzugen Sie es, dies in Gruppenchats deaktiviert zu lassen.

## Kostenbewusstsein

Heartbeats fuehren vollstaendige Agent-Turns aus. Kuerzere Intervalle verbrauchen
mehr Tokens. Halten Sie `HEARTBEAT.md` klein und ziehen Sie ein guenstigeres
`model` oder `target: "none"` in Betracht, wenn Sie nur interne
Statusaktualisierungen wuenschen.
