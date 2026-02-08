---
summary: "Eine WhatsApp-Nachricht an mehrere Agenten senden"
read_when:
  - Konfiguration von Broadcast-Gruppen
  - Debugging von Multi-Agent-Antworten in WhatsApp
status: experimental
title: "Broadcast-Gruppen"
x-i18n:
  source_path: broadcast-groups.md
  source_hash: eaeb4035912c4941
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:25Z
---

# Broadcast-Gruppen

**Status:** Experimentell  
**Version:** Hinzugefügt in 2026.1.9

## Überblick

Broadcast-Gruppen ermöglichen es mehreren Agenten, dieselbe Nachricht gleichzeitig zu verarbeiten und darauf zu antworten. So können Sie spezialisierte Agententeams erstellen, die gemeinsam in einer einzelnen WhatsApp-Gruppe oder Direktnachricht arbeiten – alles mit einer einzigen Telefonnummer.

Aktueller Umfang: **nur WhatsApp** (Web-Kanal).

Broadcast-Gruppen werden nach Channel-Allowlisten und Gruppenaktivierungsregeln ausgewertet. In WhatsApp-Gruppen bedeutet dies, dass Broadcasts dann stattfinden, wenn OpenClaw normalerweise antworten würde (zum Beispiel bei Erwähnung, abhängig von Ihren Gruppeneinstellungen).

## Anwendungsfälle

### 1. Spezialisierte Agententeams

Setzen Sie mehrere Agenten mit klar abgegrenzten, fokussierten Verantwortlichkeiten ein:

```
Group: "Development Team"
Agents:
  - CodeReviewer (reviews code snippets)
  - DocumentationBot (generates docs)
  - SecurityAuditor (checks for vulnerabilities)
  - TestGenerator (suggests test cases)
```

Jeder Agent verarbeitet dieselbe Nachricht und liefert seine spezialisierte Perspektive.

### 2. Mehrsprachige Unterstützung

```
Group: "International Support"
Agents:
  - Agent_EN (responds in English)
  - Agent_DE (responds in German)
  - Agent_ES (responds in Spanish)
```

### 3. Qualitätssicherungs-Workflows

```
Group: "Customer Support"
Agents:
  - SupportAgent (provides answer)
  - QAAgent (reviews quality, only responds if issues found)
```

### 4. Aufgabenautomatisierung

```
Group: "Project Management"
Agents:
  - TaskTracker (updates task database)
  - TimeLogger (logs time spent)
  - ReportGenerator (creates summaries)
```

## Konfiguration

### Grundkonfiguration

Fügen Sie einen Top-Level-Abschnitt `broadcast` hinzu (neben `bindings`). Schlüssel sind WhatsApp-Peer-IDs:

- Gruppenchats: Gruppen-JID (z. B. `120363403215116621@g.us`)
- Direktnachrichten: E.164-Telefonnummer (z. B. `+15551234567`)

```json
{
  "broadcast": {
    "120363403215116621@g.us": ["alfred", "baerbel", "assistant3"]
  }
}
```

**Ergebnis:** Wenn OpenClaw in diesem Chat antworten würde, werden alle drei Agenten ausgeführt.

### Verarbeitungsstrategie

Steuern Sie, wie Agenten Nachrichten verarbeiten:

#### Parallel (Standard)

Alle Agenten verarbeiten gleichzeitig:

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

#### Sequentiell

Agenten verarbeiten der Reihe nach (einer wartet, bis der vorherige fertig ist):

```json
{
  "broadcast": {
    "strategy": "sequential",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

### Vollständiges Beispiel

```json
{
  "agents": {
    "list": [
      {
        "id": "code-reviewer",
        "name": "Code Reviewer",
        "workspace": "/path/to/code-reviewer",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "security-auditor",
        "name": "Security Auditor",
        "workspace": "/path/to/security-auditor",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "docs-generator",
        "name": "Documentation Generator",
        "workspace": "/path/to/docs-generator",
        "sandbox": { "mode": "all" }
      }
    ]
  },
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["code-reviewer", "security-auditor", "docs-generator"],
    "120363424282127706@g.us": ["support-en", "support-de"],
    "+15555550123": ["assistant", "logger"]
  }
}
```

## Funktionsweise

### Nachrichtenfluss

1. **Eingehende Nachricht** trifft in einer WhatsApp-Gruppe ein
2. **Broadcast-Prüfung**: Das System prüft, ob die Peer-ID in `broadcast` enthalten ist
3. **Wenn in der Broadcast-Liste**:
   - Alle aufgeführten Agenten verarbeiten die Nachricht
   - Jeder Agent hat seinen eigenen Sitzungsschlüssel und isolierten Kontext
   - Agenten verarbeiten parallel (Standard) oder sequentiell
4. **Wenn nicht in der Broadcast-Liste**:
   - Normales Routing greift (erste passende Zuordnung)

Hinweis: Broadcast-Gruppen umgehen keine Channel-Allowlisten oder Gruppenaktivierungsregeln (Erwähnungen/Befehle/etc.). Sie ändern nur _welche Agenten ausgeführt werden_, wenn eine Nachricht zur Verarbeitung berechtigt ist.

### Sitzungsisolierung

Jeder Agent in einer Broadcast-Gruppe verwaltet vollständig getrennte:

- **Sitzungsschlüssel** (`agent:alfred:whatsapp:group:120363...` vs. `agent:baerbel:whatsapp:group:120363...`)
- **Gesprächsverlauf** (Agenten sehen die Nachrichten anderer Agenten nicht)
- **Workspace** (separate Sandboxes, falls konfiguriert)
- **Werkzeugzugriff** (unterschiedliche Allow-/Deny-Listen)
- **Gedächtnis/Kontext** (separate IDENTITY.md, SOUL.md usw.)
- **Gruppenkontext-Puffer** (aktuelle Gruppennachrichten für den Kontext) wird pro Peer geteilt, sodass alle Broadcast-Agenten beim Triggern denselben Kontext sehen

Dies ermöglicht es jedem Agenten, zu haben:

- Unterschiedliche Persönlichkeiten
- Unterschiedlichen Werkzeugzugriff (z. B. nur Lesen vs. Lesen/Schreiben)
- Unterschiedliche Modelle (z. B. opus vs. sonnet)
- Unterschiedliche installierte Skills

### Beispiel: Isolierte Sitzungen

In der Gruppe `120363403215116621@g.us` mit den Agenten `["alfred", "baerbel"]`:

**Alfreds Kontext:**

```
Session: agent:alfred:whatsapp:group:120363403215116621@g.us
History: [user message, alfred's previous responses]
Workspace: /Users/pascal/openclaw-alfred/
Tools: read, write, exec
```

**Bärbels Kontext:**

```
Session: agent:baerbel:whatsapp:group:120363403215116621@g.us
History: [user message, baerbel's previous responses]
Workspace: /Users/pascal/openclaw-baerbel/
Tools: read only
```

## Best Practices

### 1. Agenten fokussiert halten

Gestalten Sie jeden Agenten mit einer einzigen, klaren Verantwortung:

```json
{
  "broadcast": {
    "DEV_GROUP": ["formatter", "linter", "tester"]
  }
}
```

✅ **Gut:** Jeder Agent hat genau eine Aufgabe  
❌ **Schlecht:** Ein generischer „dev-helper“-Agent

### 2. Aussagekräftige Namen verwenden

Machen Sie klar, was jeder Agent tut:

```json
{
  "agents": {
    "security-scanner": { "name": "Security Scanner" },
    "code-formatter": { "name": "Code Formatter" },
    "test-generator": { "name": "Test Generator" }
  }
}
```

### 3. Unterschiedlichen Werkzeugzugriff konfigurieren

Geben Sie Agenten nur die Werkzeuge, die sie benötigen:

```json
{
  "agents": {
    "reviewer": {
      "tools": { "allow": ["read", "exec"] } // Read-only
    },
    "fixer": {
      "tools": { "allow": ["read", "write", "edit", "exec"] } // Read-write
    }
  }
}
```

### 4. Leistung überwachen

Bei vielen Agenten berücksichtigen Sie:

- Verwendung von `"strategy": "parallel"` (Standard) für Geschwindigkeit
- Begrenzung von Broadcast-Gruppen auf 5–10 Agenten
- Schnellere Modelle für einfachere Agenten

### 5. Fehler robust behandeln

Agenten schlagen unabhängig voneinander fehl. Der Fehler eines Agenten blockiert die anderen nicht:

```
Message → [Agent A ✓, Agent B ✗ error, Agent C ✓]
Result: Agent A and C respond, Agent B logs error
```

## Kompatibilität

### Anbieter

Broadcast-Gruppen funktionieren derzeit mit:

- ✅ WhatsApp (implementiert)
- 🚧 Telegram (geplant)
- 🚧 Discord (geplant)
- 🚧 Slack (geplant)

### Routing

Broadcast-Gruppen arbeiten zusammen mit bestehendem Routing:

```json
{
  "bindings": [
    {
      "match": { "channel": "whatsapp", "peer": { "kind": "group", "id": "GROUP_A" } },
      "agentId": "alfred"
    }
  ],
  "broadcast": {
    "GROUP_B": ["agent1", "agent2"]
  }
}
```

- `GROUP_A`: Nur alfred antwortet (normales Routing)
- `GROUP_B`: agent1 UND agent2 antworten (Broadcast)

**Priorität:** `broadcast` hat Vorrang vor `bindings`.

## Fehlerbehebung

### Agenten antworten nicht

**Prüfen Sie:**

1. Agenten-IDs existieren in `agents.list`
2. Peer-ID-Format ist korrekt (z. B. `120363403215116621@g.us`)
3. Agenten befinden sich nicht in Deny-Listen

**Debug:**

```bash
tail -f ~/.openclaw/logs/gateway.log | grep broadcast
```

### Nur ein Agent antwortet

**Ursache:** Die Peer-ID könnte in `bindings`, aber nicht in `broadcast` enthalten sein.

**Behebung:** Zur Broadcast-Konfiguration hinzufügen oder aus den Bindings entfernen.

### Leistungsprobleme

**Bei Langsamkeit mit vielen Agenten:**

- Anzahl der Agenten pro Gruppe reduzieren
- Leichtere Modelle verwenden (sonnet statt opus)
- Startzeit der Sandbox prüfen

## Beispiele

### Beispiel 1: Code-Review-Team

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": [
      "code-formatter",
      "security-scanner",
      "test-coverage",
      "docs-checker"
    ]
  },
  "agents": {
    "list": [
      {
        "id": "code-formatter",
        "workspace": "~/agents/formatter",
        "tools": { "allow": ["read", "write"] }
      },
      {
        "id": "security-scanner",
        "workspace": "~/agents/security",
        "tools": { "allow": ["read", "exec"] }
      },
      {
        "id": "test-coverage",
        "workspace": "~/agents/testing",
        "tools": { "allow": ["read", "exec"] }
      },
      { "id": "docs-checker", "workspace": "~/agents/docs", "tools": { "allow": ["read"] } }
    ]
  }
}
```

**Benutzer sendet:** Code-Snippet  
**Antworten:**

- code-formatter: „Einrückung korrigiert und Typ-Hinweise hinzugefügt“
- security-scanner: „⚠️ SQL-Injection-Sicherheitslücke in Zeile 12“
- test-coverage: „Abdeckung liegt bei 45 %, fehlende Tests für Fehlerfälle“
- docs-checker: „Fehlender Docstring für Funktion `process_data`“

### Beispiel 2: Mehrsprachige Unterstützung

```json
{
  "broadcast": {
    "strategy": "sequential",
    "+15555550123": ["detect-language", "translator-en", "translator-de"]
  },
  "agents": {
    "list": [
      { "id": "detect-language", "workspace": "~/agents/lang-detect" },
      { "id": "translator-en", "workspace": "~/agents/translate-en" },
      { "id": "translator-de", "workspace": "~/agents/translate-de" }
    ]
  }
}
```

## API-Referenz

### Konfigurationsschema

```typescript
interface OpenClawConfig {
  broadcast?: {
    strategy?: "parallel" | "sequential";
    [peerId: string]: string[];
  };
}
```

### Felder

- `strategy` (optional): Wie Agenten verarbeitet werden
  - `"parallel"` (Standard): Alle Agenten verarbeiten gleichzeitig
  - `"sequential"`: Agenten verarbeiten in Array-Reihenfolge
- `[peerId]`: WhatsApp-Gruppen-JID, E.164-Nummer oder andere Peer-ID
  - Wert: Array von Agenten-IDs, die Nachrichten verarbeiten sollen

## Einschränkungen

1. **Max. Agenten:** Keine feste Obergrenze, aber 10+ Agenten können langsam sein
2. **Geteilter Kontext:** Agenten sehen die Antworten anderer Agenten nicht (absichtlich)
3. **Nachrichtenreihenfolge:** Parallele Antworten können in beliebiger Reihenfolge eintreffen
4. **Rate-Limits:** Alle Agenten zählen zu den WhatsApp-Rate-Limits

## Zukünftige Erweiterungen

Geplante Funktionen:

- [ ] Geteilter Kontextmodus (Agenten sehen die Antworten der anderen)
- [ ] Agentenkoordination (Agenten können sich gegenseitig signalisieren)
- [ ] Dynamische Agentenauswahl (Auswahl basierend auf Nachrichteninhalt)
- [ ] Agentenprioritäten (einige Agenten antworten vor anderen)

## Siehe auch

- [Multi-Agent Configuration](/multi-agent-sandbox-tools)
- [Routing Configuration](/concepts/channel-routing)
- [Session Management](/concepts/sessions)
