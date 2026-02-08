---
summary: „Wie OpenClaw Prompt-Kontext aufbaut und Token-Nutzung sowie Kosten meldet“
read_when:
  - Beim Erklären von Token-Nutzung, Kosten oder Kontextfenstern
  - Beim Debuggen von Kontextwachstum oder Kompaktierungsverhalten
title: „Token-Nutzung und Kosten“
x-i18n:
  source_path: token-use.md
  source_hash: cc914080a809ada2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:43Z
---

# Token-Nutzung & Kosten

OpenClaw verfolgt **Tokens**, nicht Zeichen. Tokens sind modellspezifisch, aber die meisten
OpenAI‑ähnlichen Modelle liegen im Durchschnitt bei ~4 Zeichen pro Token für englischen Text.

## Wie der System-Prompt aufgebaut wird

OpenClaw setzt bei jedem Lauf seinen eigenen System-Prompt zusammen. Er enthält:

- Werkzeugliste + kurze Beschreibungen
- Skills-Liste (nur Metadaten; Anweisungen werden bei Bedarf mit `read` geladen)
- Selbstaktualisierungsanweisungen
- Workspace‑ + Bootstrap‑Dateien (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md` bei Neuerstellung). Große Dateien werden durch `agents.defaults.bootstrapMaxChars` gekürzt (Standard: 20000).
- Zeit (UTC + Benutzerzeitzone)
- Antwort‑Tags + Heartbeat‑Verhalten
- Laufzeit‑Metadaten (Host/OS/Modell/Thinking)

Die vollständige Aufschlüsselung finden Sie unter [System Prompt](/concepts/system-prompt).

## Was im Kontextfenster zählt

Alles, was das Modell erhält, zählt zum Kontextlimit:

- System-Prompt (alle oben aufgeführten Abschnitte)
- Gesprächsverlauf (Benutzer‑ + Assistent‑Nachrichten)
- Werkzeugaufrufe und Werkzeugergebnisse
- Anhänge/Transkripte (Bilder, Audio, Dateien)
- Kompaktierungszusammenfassungen und Pruning‑Artefakte
- Anbieter‑Wrapper oder Sicherheits‑Header (nicht sichtbar, werden aber mitgezählt)

Für eine praktische Aufschlüsselung (pro injizierter Datei, Werkzeuge, Skills und Größe des System-Prompts) verwenden Sie `/context list` oder `/context detail`. Siehe [Context](/concepts/context).

## Aktuelle Token-Nutzung anzeigen

Verwenden Sie im Chat:

- `/status` → **emoji‑reiche Statuskarte** mit Sitzungsmodell, Kontextnutzung,
  Eingabe-/Ausgabe‑Tokens der letzten Antwort und **geschätzten Kosten** (nur API‑Key).
- `/usage off|tokens|full` → hängt jeder Antwort eine **pro‑Antwort‑Nutzungsfußzeile** an.
  - Persistiert pro Sitzung (gespeichert als `responseUsage`).
  - OAuth‑Authentifizierung **blendet Kosten aus** (nur Tokens).
- `/usage cost` → zeigt eine lokale Kostenübersicht aus den OpenClaw‑Sitzungslogs.

Weitere Oberflächen:

- **TUI/Web TUI:** `/status` + `/usage` werden unterstützt.
- **CLI:** `openclaw status --usage` und `openclaw channels list` zeigen
  Anbieter‑Kontingentfenster (keine Kosten pro Antwort).

## Kostenschätzung (falls angezeigt)

Kosten werden aus Ihrer Modell‑Preis­konfiguration geschätzt:

```
models.providers.<provider>.models[].cost
```

Dies sind **USD pro 1 Mio. Tokens** für `input`, `output`, `cacheRead` und
`cacheWrite`. Fehlen Preise, zeigt OpenClaw nur Tokens an. OAuth‑Tokens
zeigen niemals Dollar‑Kosten.

## Cache‑TTL und Auswirkungen von Pruning

Prompt‑Caching des Anbieters gilt nur innerhalb des Cache‑TTL‑Fensters. OpenClaw kann
optional **Cache‑TTL‑Pruning** ausführen: Die Sitzung wird bereinigt, sobald das Cache‑TTL
abgelaufen ist, und anschließend wird das Cache‑Fenster zurückgesetzt, sodass nachfolgende
Anfragen den frisch gecachten Kontext wiederverwenden können, statt den vollständigen
Verlauf erneut zu cachen. Das hält Cache‑Schreibkosten niedrig, wenn eine Sitzung über das
TTL hinaus inaktiv ist.

Konfigurieren Sie dies in der [Gateway configuration](/gateway/configuration) und sehen Sie
Details zum Verhalten unter [Session pruning](/concepts/session-pruning).

Der Heartbeat kann den Cache über Leerlaufphasen hinweg **warm** halten. Wenn das Cache‑TTL
Ihres Modells `1h` beträgt, kann das Setzen des Heartbeat‑Intervalls knapp darunter
(z. B. `55m`) vermeiden, den vollständigen Prompt erneut zu cachen, und so die
Cache‑Schreibkosten reduzieren.

Bei der Anthropic‑API‑Bepreisung sind Cache‑Lesevorgänge deutlich günstiger als Eingabe‑Tokens,
während Cache‑Schreibvorgänge mit einem höheren Multiplikator berechnet werden. Aktuelle
Sätze und TTL‑Multiplikatoren finden Sie in der Anthropic‑Dokumentation zur Prompt‑Caching‑Bepreisung:
https://docs.anthropic.com/docs/build-with-claude/prompt-caching

### Beispiel: 1‑h‑Cache mit Heartbeat warm halten

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

## Tipps zur Reduzierung des Token‑Drucks

- Verwenden Sie `/compact`, um lange Sitzungen zusammenzufassen.
- Kürzen Sie große Werkzeugausgaben in Ihren Workflows.
- Halten Sie Skill‑Beschreibungen kurz (die Skills‑Liste wird in den Prompt injiziert).
- Bevorzugen Sie kleinere Modelle für ausführliche, explorative Arbeit.

Siehe [Skills](/tools/skills) für die genaue Formel des Overheads der Skills‑Liste.
