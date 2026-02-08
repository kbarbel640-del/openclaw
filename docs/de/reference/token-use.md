---
summary: „Wie OpenClaw Prompt-Kontext erstellt und Token-Nutzung sowie Kosten meldet“
read_when:
  - Erklaerung von Token-Nutzung, Kosten oder Kontextfenstern
  - Debugging von Kontextwachstum oder Kompaktierungsverhalten
title: „Token-Nutzung und Kosten“
x-i18n:
  source_path: reference/token-use.md
  source_hash: f8bfadb36b51830c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:58Z
---

# Token-Nutzung & Kosten

OpenClaw verfolgt **Token**, nicht Zeichen. Token sind modellspezifisch, aber die meisten
OpenAI-ähnlichen Modelle kommen bei englischem Text im Mittel auf ~4 Zeichen pro Token.

## Wie der System-Prompt aufgebaut wird

OpenClaw setzt bei jedem Lauf seinen eigenen System-Prompt zusammen. Er umfasst:

- Werkzeugliste + kurze Beschreibungen
- Skills-Liste (nur Metadaten; Anweisungen werden bei Bedarf mit `read` geladen)
- Selbstaktualisierungs-Anweisungen
- Workspace- + Bootstrap-Dateien (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md` bei Neuheit). Große Dateien werden durch `agents.defaults.bootstrapMaxChars` gekuerzt (Standard: 20000).
- Zeit (UTC + Benutzerzeitzone)
- Antwort-Tags + Heartbeat-Verhalten
- Laufzeit-Metadaten (Host/OS/Modell/Thinking)

Siehe die vollstaendige Aufschluesselung unter [System Prompt](/concepts/system-prompt).

## Was im Kontextfenster zaehlt

Alles, was das Modell erhaelt, zaehlt zum Kontextlimit:

- System-Prompt (alle oben aufgefuehrten Abschnitte)
- Gespraechsverlauf (Benutzer- + Assistenten-Nachrichten)
- Werkzeugaufrufe und -ergebnisse
- Anhaenge/Transkripte (Bilder, Audio, Dateien)
- Kompaktierungszusammenfassungen und Pruning-Artefakte
- Anbieter-Wrapper oder Sicherheits-Header (nicht sichtbar, werden aber mitgezaehlt)

Fuer eine praktische Aufschluesselung (pro injizierter Datei, Werkzeuge, Skills und Groesse des System-Prompts) verwenden Sie `/context list` oder `/context detail`. Siehe [Context](/concepts/context).

## So sehen Sie die aktuelle Token-Nutzung

Verwenden Sie dies im Chat:

- `/status` → **emoji-reiche Statuskarte** mit Sitzungsmodell, Kontextnutzung,
  Token fuer Eingabe/Ausgabe der letzten Antwort und **geschaetzten Kosten** (nur API-Schluessel).
- `/usage off|tokens|full` → fuegt jeder Antwort eine **Nutzungs-Fusszeile pro Antwort** hinzu.
  - Bleibt pro Sitzung bestehen (gespeichert als `responseUsage`).
  - OAuth-Authentifizierung **verbirgt Kosten** (nur Token).
- `/usage cost` → zeigt eine lokale Kostenuebersicht aus OpenClaw-Sitzungslogs.

Weitere Oberflaechen:

- **TUI/Web TUI:** `/status` + `/usage` werden unterstuetzt.
- **CLI:** `openclaw status --usage` und `openclaw channels list` zeigen
  Anbieter-Kontingentfenster (keine Kosten pro Antwort).

## Kostenschaetzung (falls angezeigt)

Kosten werden aus Ihrer Modell-Preis-Konfiguration geschaetzt:

```
models.providers.<provider>.models[].cost
```

Dies sind **USD pro 1 Mio. Token** fuer `input`, `output`, `cacheRead` und
`cacheWrite`. Fehlen Preisangaben, zeigt OpenClaw nur Token an. OAuth-Token
zeigen niemals Dollar-Kosten.

## Cache-TTL und Auswirkungen von Pruning

Anbieter-Prompt-Caching gilt nur innerhalb des Cache-TTL-Fensters. OpenClaw kann
optional **Cache-TTL-Pruning** ausfuehren: Es kuerzt die Sitzung, sobald das Cache-TTL
abgelaufen ist, und setzt anschliessend das Cache-Fenster zurueck, sodass nachfolgende
Anfragen den frisch gecachten Kontext wiederverwenden koennen, statt den gesamten
Verlauf erneut zu cachen. Das haelt die Cache-Schreibkosten niedrig, wenn eine Sitzung
ueber das TTL hinaus inaktiv wird.

Konfigurieren Sie dies in der [Gateway configuration](/gateway/configuration) und
sehen Sie die Verhaltensdetails unter [Session pruning](/concepts/session-pruning).

Der Heartbeat kann den Cache ueber Leerlaufphasen hinweg **warm** halten. Wenn das
Cache-TTL Ihres Modells `1h` betraegt, kann das Setzen des Heartbeat-Intervalls
knapp darunter (z. B. `55m`) vermeiden, dass der gesamte Prompt erneut gecacht
wird, und so Cache-Schreibkosten reduzieren.

Bei der Anthropic-API-Bepreisung sind Cache-Lesezugriffe deutlich guenstiger als
Eingabe-Token, waehrend Cache-Schreibzugriffe mit einem hoeheren Multiplikator
abgerechnet werden. Siehe die Prompt-Caching-Preise von Anthropic fuer aktuelle Saetze
und TTL-Multiplikatoren:
[https://docs.anthropic.com/docs/build-with-claude/prompt-caching](https://docs.anthropic.com/docs/build-with-claude/prompt-caching)

### Beispiel: 1 h Cache mit Heartbeat warm halten

```yaml
agents:
  defaults:
    model:
      primary: "anthropic/claude-opus-4-6"
    models:
      "anthropic/claude-opus-4-6":
        params:
          cacheRetention: "long"
    heartbeat:
      every: "55m"
```

## Tipps zur Reduzierung des Token-Drucks

- Verwenden Sie `/compact`, um lange Sitzungen zusammenzufassen.
- Kuerzen Sie grosse Werkzeugausgaben in Ihren Workflows.
- Halten Sie Skill-Beschreibungen kurz (die Skill-Liste wird in den Prompt injiziert).
- Bevorzugen Sie kleinere Modelle fuer ausfuehrliche, explorative Arbeit.

Siehe [Skills](/tools/skills) fuer die exakte Overhead-Formel der Skill-Liste.
