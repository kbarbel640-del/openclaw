---
summary: „Forschungsnotizen: Offline-Gedächtnissystem für Clawd-Workspaces (Markdown als Source of Truth + abgeleiteter Index)“
read_when:
  - Entwurf des Workspace-Gedächtnisses (~/.openclaw/workspace) über tägliche Markdown-Logs hinaus
  - Entscheidung: eigenständige CLI vs. tiefe OpenClaw-Integration
  - Hinzufügen von Offline-Abruf + Reflexion (retain/recall/reflect)
title: „Workspace-Gedächtnis – Forschung“
x-i18n:
  source_path: experiments/research/memory.md
  source_hash: 1753c8ee6284999f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:31Z
---

# Workspace Memory v2 (offline): Forschungsnotizen

Ziel: Ein Clawd-ähnlicher Workspace (`agents.defaults.workspace`, Standard `~/.openclaw/workspace`), in dem „Gedächtnis“ als eine Markdown-Datei pro Tag (`memory/YYYY-MM-DD.md`) plus eine kleine Menge stabiler Dateien (z. B. `memory.md`, `SOUL.md`) gespeichert wird.

Dieses Dokument schlägt eine **Offline-First**-Gedächtnisarchitektur vor, die Markdown als kanonische, überprüfbare Source of Truth beibehält, aber **strukturierten Abruf** (Suche, Entitätszusammenfassungen, Konfidenz-Updates) über einen abgeleiteten Index ergänzt.

## Warum ändern?

Das aktuelle Setup (eine Datei pro Tag) ist hervorragend für:

- „append-only“-Journaling
- menschliche Bearbeitung
- git-gestützte Dauerhaftigkeit + Nachvollziehbarkeit
- reibungsarme Erfassung („einfach aufschreiben“)

Es ist schwach bei:

- Abruf mit hoher Wiederauffindbarkeit („Was haben wir über X entschieden?“, „Wann haben wir Y zuletzt ausprobiert?“)
- entitätszentrierten Antworten („Erzähl mir etwas über Alice / The Castle / warelay“) ohne viele Dateien erneut zu lesen
- Stabilität von Meinungen/Präferenzen (und Belege bei Änderungen)
- zeitlichen Einschränkungen („Was war im November 2025 gültig?“) und Konfliktauflösung

## Designziele

- **Offline**: funktioniert ohne Netzwerk; lauffähig auf Laptop/Castle; keine Cloud-Abhängigkeit.
- **Erklärbar**: abgerufene Elemente sollten zuordenbar sein (Datei + Position) und von Inferenz trennbar.
- **Geringe Zeremonie**: tägliches Logging bleibt Markdown, kein schwergewichtiges Schema.
- **Inkrementell**: v1 ist bereits mit FTS nützlich; semantische/Vektor- und Graph-Erweiterungen sind optional.
- **Agentenfreundlich**: erleichtert „Recall innerhalb von Token-Budgets“ (Rückgabe kleiner Faktenbündel).

## Nordstern-Modell (Hindsight × Letta)

Zwei Bausteine zum Kombinieren:

1. **Letta/MemGPT-ähnlicher Kontroll-Loop**

- einen kleinen „Core“ stets im Kontext halten (Persona + zentrale Nutzerfakten)
- alles andere ist außerhalb des Kontexts und wird über Werkzeuge abgerufen
- Gedächtnisschreibvorgänge sind explizite Tool-Aufrufe (append/replace/insert), werden persistiert und im nächsten Turn erneut injiziert

2. **Hindsight-ähnliches Gedächtnissubstrat**

- Trennung von Beobachtetem vs. Geglaubtem vs. Zusammengefasstem
- Unterstützung von retain/recall/reflect
- meinungsbasierte Aussagen mit Konfidenz, die sich mit Evidenz weiterentwickeln können
- entitätsbewusster Abruf + zeitliche Abfragen (auch ohne vollständige Wissensgraphen)

## Vorgeschlagene Architektur (Markdown als Source of Truth + abgeleiteter Index)

### Kanonischer Speicher (git-freundlich)

Behalten Sie `~/.openclaw/workspace` als kanonisches, menschenlesbares Gedächtnis.

Vorgeschlagenes Workspace-Layout:

```
~/.openclaw/workspace/
  memory.md                    # small: durable facts + preferences (core-ish)
  memory/
    YYYY-MM-DD.md              # daily log (append; narrative)
  bank/                        # “typed” memory pages (stable, reviewable)
    world.md                   # objective facts about the world
    experience.md              # what the agent did (first-person)
    opinions.md                # subjective prefs/judgments + confidence + evidence pointers
    entities/
      Peter.md
      The-Castle.md
      warelay.md
      ...
```

Hinweise:

- **Das Tageslog bleibt ein Tageslog**. Keine Notwendigkeit, es in JSON umzuwandeln.
- Die `bank/`-Dateien sind **kuratiert**, werden durch Reflexions-Jobs erzeugt und können weiterhin von Hand bearbeitet werden.
- `memory.md` bleibt „klein + core-ähnlich“: die Dinge, die Clawd in jeder Sitzung sehen soll.

### Abgeleiteter Speicher (maschineller Abruf)

Fügen Sie unter dem Workspace einen abgeleiteten Index hinzu (nicht zwingend git-getrackt):

```
~/.openclaw/workspace/.memory/index.sqlite
```

Unterlegt mit:

- SQLite-Schema für Fakten + Entitätsverknüpfungen + Meinungsmetadaten
- SQLite **FTS5** für lexikalischen Abruf (schnell, klein, offline)
- optionale Embedding-Tabelle für semantischen Abruf (ebenfalls offline)

Der Index ist stets **aus Markdown neu aufbaubar**.

## Retain / Recall / Reflect (operativer Loop)

### Retain: Tageslogs in „Fakten“ normalisieren

Hindsights zentrale, hier relevante Erkenntnis: Speichern Sie **narrative, in sich geschlossene Fakten**, keine winzigen Schnipsel.

Praktische Regel für `memory/YYYY-MM-DD.md`:

- am Tagesende (oder währenddessen) einen Abschnitt `## Retain` mit 2–5 Stichpunkten hinzufügen, die:
  - narrativ sind (kontextübergreifender Zusammenhang bleibt erhalten)
  - in sich geschlossen sind (später eigenständig verständlich)
  - mit Typ + Entitätsnennungen getaggt sind

Beispiel:

```
## Retain
- W @Peter: Currently in Marrakech (Nov 27–Dec 1, 2025) for Andy’s birthday.
- B @warelay: I fixed the Baileys WS crash by wrapping connection.update handlers in try/catch (see memory/2025-11-27.md).
- O(c=0.95) @Peter: Prefers concise replies (&lt;1500 chars) on WhatsApp; long content goes into files.
```

Minimales Parsing:

- Typ-Präfix: `W` (Welt), `B` (Erfahrung/biografisch), `O` (Meinung), `S` (Beobachtung/Zusammenfassung; meist generiert)
- Entitäten: `@Peter`, `@warelay` usw. (Slugs mappen auf `bank/entities/*.md`)
- Meinungs-Konfidenz: `O(c=0.0..1.0)` optional

Wenn Autorinnen und Autoren darüber nicht nachdenken sollen: Der Reflexions-Job kann diese Stichpunkte aus dem restlichen Log ableiten, aber ein expliziter Abschnitt `## Retain` ist der einfachste „Qualitätshebel“.

### Recall: Abfragen über den abgeleiteten Index

Recall sollte unterstützen:

- **lexikalisch**: „exakte Begriffe / Namen / Befehle finden“ (FTS5)
- **entitätsbasiert**: „Erzähl mir etwas über X“ (Entitätsseiten + entitätsverknüpfte Fakten)
- **zeitlich**: „Was ist um den 27. Nov passiert?“ / „seit letzter Woche“
- **meinungsbasiert**: „Was bevorzugt Peter?“ (mit Konfidenz + Evidenz)

Das Rückgabeformat sollte agentenfreundlich sein und Quellen zitieren:

- `kind` (`world|experience|opinion|observation`)
- `timestamp` (Quelldatum oder extrahierter Zeitraum, falls vorhanden)
- `entities` (`["Peter","warelay"]`)
- `content` (der narrative Fakt)
- `source` (`memory/2025-11-27.md#L12` usw.)

### Reflect: stabile Seiten erzeugen + Überzeugungen aktualisieren

Reflexion ist ein geplanter Job (täglich oder Heartbeat-`ultrathink`), der:

- `bank/entities/*.md` aus aktuellen Fakten aktualisiert (Entitätszusammenfassungen)
- die Konfidenz von `bank/opinions.md` basierend auf Bestätigung/Widerspruch aktualisiert
- optional Änderungen an `memory.md` vorschlägt („core-ähnliche“ dauerhafte Fakten)

Meinungsentwicklung (einfach, erklärbar):

- jede Meinung hat:
  - Aussage
  - Konfidenz `c ∈ [0,1]`
  - last_updated
  - Evidenz-Links (unterstützende + widersprechende Fakten-IDs)
- wenn neue Fakten eintreffen:
  - Kandidatenmeinungen anhand von Entitätsüberlappung + Ähnlichkeit finden (zuerst FTS, später Embeddings)
  - Konfidenz in kleinen Deltas aktualisieren; große Sprünge erfordern starken Widerspruch + wiederholte Evidenz

## CLI-Integration: eigenständig vs. tiefe Integration

Empfehlung: **tiefe Integration in OpenClaw**, aber mit einer trennbaren Kernbibliothek.

### Warum in OpenClaw integrieren?

- OpenClaw kennt bereits:
  - den Workspace-Pfad (`agents.defaults.workspace`)
  - das Sitzungsmodell + Heartbeats
  - Logging- und Fehlerbehebungsmuster
- Sie möchten, dass der Agent selbst die Werkzeuge aufruft:
  - `openclaw memory recall "…" --k 25 --since 30d`
  - `openclaw memory reflect --since 7d`

### Warum trotzdem eine Bibliothek abspalten?

- Gedächtnislogik testbar halten ohne Gateway/Runtime
- Wiederverwendung in anderen Kontexten (lokale Skripte, zukünftige Desktop-App usw.)

Form:
Die Gedächtnis-Tools sind als kleine CLI- + Bibliotheks-Schicht gedacht, dies ist jedoch rein explorativ.

## „S-Collide“ / SuCo: wann einsetzen (Forschung)

Wenn „S-Collide“ **SuCo (Subspace Collision)** bezeichnet: Es handelt sich um einen ANN-Abrufansatz, der starke Recall/Latenz-Kompromisse durch gelernte/strukturierte Kollisionen in Subräumen adressiert (Paper: arXiv 2411.14754, 2024).

Pragmatische Einschätzung für `~/.openclaw/workspace`:

- **nicht damit starten**.
- beginnen Sie mit SQLite FTS + (optional) einfachen Embeddings; damit erzielen Sie sofort die meisten UX-Gewinne.
- ziehen Sie SuCo/HNSW/ScaNN-ähnliche Lösungen erst in Betracht, wenn:
  - der Korpus groß ist (zehntausende/hunderttausende Chunks)
  - brute-force Embedding-Suche zu langsam wird
  - die Recall-Qualität spürbar durch lexikalische Suche limitiert ist

Offline-freundliche Alternativen (in steigender Komplexität):

- SQLite FTS5 + Metadatenfilter (kein ML)
- Embeddings + brute force (funktioniert überraschend weit bei geringer Chunk-Anzahl)
- HNSW-Index (verbreitet, robust; benötigt eine Bibliotheksbindung)
- SuCo (forschungsnah; attraktiv, wenn es eine solide einbettbare Implementierung gibt)

Offene Frage:

- welches ist das **beste** Offline-Embedding-Modell für „Personal-Assistant-Gedächtnis“ auf Ihren Maschinen (Laptop + Desktop)?
  - wenn Sie bereits Ollama haben: mit einem lokalen Modell einbetten; andernfalls ein kleines Embedding-Modell in die Toolchain integrieren.

## Kleinster sinnvoller Pilot

Wenn Sie eine minimale, dennoch nützliche Version wollen:

- Fügen Sie `bank/`-Entitätsseiten und einen Abschnitt `## Retain` in Tageslogs hinzu.
- Nutzen Sie SQLite FTS für den Abruf mit Zitaten (Pfad + Zeilennummern).
- Fügen Sie Embeddings nur hinzu, wenn Recall-Qualität oder Skalierung es erfordern.

## Referenzen

- Letta / MemGPT-Konzepte: „core memory blocks“ + „archival memory“ + werkzeuggetriebenes selbsteditierendes Gedächtnis.
- Hindsight Technical Report: „retain / recall / reflect“, Vier-Netzwerk-Gedächtnis, narrative Faktenextraktion, Entwicklung der Meinungs-Konfidenz.
- SuCo: arXiv 2411.14754 (2024): „Subspace Collision“ Approximate-Nearest-Neighbor-Abruf.
