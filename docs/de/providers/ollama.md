---
summary: "OpenClaw mit Ollama ausführen (lokale LLM-Laufzeitumgebung)"
read_when:
  - Sie möchten OpenClaw mit lokalen Modellen über Ollama ausführen
  - Sie benötigen Anleitungen zur Einrichtung und Konfiguration von Ollama
title: "Ollama"
x-i18n:
  source_path: providers/ollama.md
  source_hash: 2992dd0a456d19c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:19Z
---

# Ollama

Ollama ist eine lokale LLM-Laufzeitumgebung, mit der sich Open-Source-Modelle einfach auf Ihrem Rechner ausführen lassen. OpenClaw integriert sich in die OpenAI-kompatible API von Ollama und kann **werkzeugfähige Modelle automatisch erkennen**, wenn Sie sich mit `OLLAMA_API_KEY` (oder einem Auth-Profil) dafür entscheiden und keinen expliziten `models.providers.ollama`-Eintrag definieren.

## Schnellstart

1. Installieren Sie Ollama: https://ollama.ai

2. Ziehen Sie ein Modell:

```bash
ollama pull gpt-oss:20b
# or
ollama pull llama3.3
# or
ollama pull qwen2.5-coder:32b
# or
ollama pull deepseek-r1:32b
```

3. Aktivieren Sie Ollama für OpenClaw (beliebiger Wert; Ollama benötigt keinen echten Schlüssel):

```bash
# Set environment variable
export OLLAMA_API_KEY="ollama-local"

# Or configure in your config file
openclaw config set models.providers.ollama.apiKey "ollama-local"
```

4. Verwenden Sie Ollama-Modelle:

```json5
{
  agents: {
    defaults: {
      model: { primary: "ollama/gpt-oss:20b" },
    },
  },
}
```

## Modellerkennung (impliziter Anbieter)

Wenn Sie `OLLAMA_API_KEY` (oder ein Auth-Profil) setzen und **keinen** `models.providers.ollama` definieren, erkennt OpenClaw Modelle aus der lokalen Ollama-Instanz unter `http://127.0.0.1:11434`:

- Abfragen von `/api/tags` und `/api/show`
- Beibehaltung nur der Modelle, die die Fähigkeit `tools` melden
- Markiert `reasoning`, wenn das Modell `thinking` meldet
- Liest `contextWindow` aus `model_info["<arch>.context_length"]`, sofern verfügbar
- Setzt `maxTokens` auf das 10‑Fache des Kontextfensters
- Setzt alle Kosten auf `0`

Dies vermeidet manuelle Modelleinträge und hält den Katalog mit den Fähigkeiten von Ollama synchron.

Um zu sehen, welche Modelle verfügbar sind:

```bash
ollama list
openclaw models list
```

Um ein neues Modell hinzuzufügen, ziehen Sie es einfach mit Ollama:

```bash
ollama pull mistral
```

Das neue Modell wird automatisch erkannt und steht zur Nutzung bereit.

Wenn Sie `models.providers.ollama` explizit setzen, wird die automatische Erkennung übersprungen und Sie müssen Modelle manuell definieren (siehe unten).

## Konfiguration

### Grundlegende Einrichtung (implizite Erkennung)

Der einfachste Weg, Ollama zu aktivieren, ist über eine Umgebungsvariable:

```bash
export OLLAMA_API_KEY="ollama-local"
```

### Explizite Einrichtung (manuelle Modelle)

Verwenden Sie eine explizite Konfiguration, wenn:

- Ollama auf einem anderen Host/Port läuft.
- Sie bestimmte Kontextfenster oder Modelllisten erzwingen möchten.
- Sie Modelle einbeziehen möchten, die keine Werkzeugunterstützung melden.

```json5
{
  models: {
    providers: {
      ollama: {
        // Use a host that includes /v1 for OpenAI-compatible APIs
        baseUrl: "http://ollama-host:11434/v1",
        apiKey: "ollama-local",
        api: "openai-completions",
        models: [
          {
            id: "gpt-oss:20b",
            name: "GPT-OSS 20B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192,
            maxTokens: 8192 * 10
          }
        ]
      }
    }
  }
}
```

Wenn `OLLAMA_API_KEY` gesetzt ist, können Sie `apiKey` im Anbieter-Eintrag weglassen, und OpenClaw füllt ihn für Verfügbarkeitsprüfungen aus.

### Benutzerdefinierte Basis-URL (explizite Konfiguration)

Wenn Ollama auf einem anderen Host oder Port läuft (die explizite Konfiguration deaktiviert die automatische Erkennung, daher definieren Sie Modelle manuell):

```json5
{
  models: {
    providers: {
      ollama: {
        apiKey: "ollama-local",
        baseUrl: "http://ollama-host:11434/v1",
      },
    },
  },
}
```

### Modellauswahl

Nach der Konfiguration stehen alle Ihre Ollama-Modelle zur Verfügung:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/gpt-oss:20b",
        fallbacks: ["ollama/llama3.3", "ollama/qwen2.5-coder:32b"],
      },
    },
  },
}
```

## Erweitert

### Reasoning-Modelle

OpenClaw markiert Modelle als reasoning-fähig, wenn Ollama `thinking` in `/api/show` meldet:

```bash
ollama pull deepseek-r1:32b
```

### Modellkosten

Ollama ist kostenlos und läuft lokal, daher sind alle Modellkosten auf $0 gesetzt.

### Streaming-Konfiguration

Aufgrund eines [bekannten Problems](https://github.com/badlogic/pi-mono/issues/1205) im zugrunde liegenden SDK mit dem Antwortformat von Ollama ist **Streaming standardmäßig deaktiviert** für Ollama-Modelle. Dies verhindert beschädigte Antworten bei der Verwendung werkzeugfähiger Modelle.

Wenn Streaming deaktiviert ist, werden Antworten auf einmal (Nicht-Streaming-Modus) geliefert, wodurch das Problem vermieden wird, dass verschachtelte Content-/Reasoning-Deltas zu verstümmelter Ausgabe führen.

#### Streaming wieder aktivieren (Erweitert)

Wenn Sie Streaming für Ollama wieder aktivieren möchten (kann bei werkzeugfähigen Modellen Probleme verursachen):

```json5
{
  agents: {
    defaults: {
      models: {
        "ollama/gpt-oss:20b": {
          streaming: true,
        },
      },
    },
  },
}
```

#### Streaming für andere Anbieter deaktivieren

Sie können Streaming bei Bedarf auch für jeden anderen Anbieter deaktivieren:

```json5
{
  agents: {
    defaults: {
      models: {
        "openai/gpt-4": {
          streaming: false,
        },
      },
    },
  },
}
```

### Kontextfenster

Für automatisch erkannte Modelle verwendet OpenClaw das von Ollama gemeldete Kontextfenster, sofern verfügbar; andernfalls wird standardmäßig `8192` verwendet. Sie können `contextWindow` und `maxTokens` in der expliziten Anbieter-Konfiguration überschreiben.

## Fehlerbehebung

### Ollama nicht erkannt

Stellen Sie sicher, dass Ollama läuft und dass Sie `OLLAMA_API_KEY` (oder ein Auth-Profil) gesetzt haben und **keinen** expliziten `models.providers.ollama`-Eintrag definiert haben:

```bash
ollama serve
```

Und dass die API erreichbar ist:

```bash
curl http://localhost:11434/api/tags
```

### Keine Modelle verfügbar

OpenClaw erkennt automatisch nur Modelle, die Werkzeugunterstützung melden. Wenn Ihr Modell nicht aufgeführt ist, können Sie entweder:

- Ein werkzeugfähiges Modell ziehen, oder
- Das Modell explizit in `models.providers.ollama` definieren.

Um Modelle hinzuzufügen:

```bash
ollama list  # See what's installed
ollama pull gpt-oss:20b  # Pull a tool-capable model
ollama pull llama3.3     # Or another model
```

### Verbindung abgelehnt

Prüfen Sie, dass Ollama auf dem richtigen Port läuft:

```bash
# Check if Ollama is running
ps aux | grep ollama

# Or restart Ollama
ollama serve
```

### Beschädigte Antworten oder Werkzeugnamen in der Ausgabe

Wenn Sie verstümmelte Antworten mit Werkzeugnamen (wie `sessions_send`, `memory_get`) oder fragmentiertem Text bei der Verwendung von Ollama-Modellen sehen, liegt dies an einem Upstream-SDK-Problem mit Streaming-Antworten. **Dies ist in der neuesten OpenClaw-Version standardmäßig behoben**, indem Streaming für Ollama-Modelle deaktiviert wird.

Wenn Sie Streaming manuell aktiviert haben und dieses Problem auftritt:

1. Entfernen Sie die Konfiguration `streaming: true` aus Ihren Ollama-Modell-Einträgen, oder
2. Setzen Sie `streaming: false` explizit für Ollama-Modelle (siehe [Streaming-Konfiguration](#streaming-configuration))

## Siehe auch

- [Model Providers](/concepts/model-providers) – Überblick über alle Anbieter
- [Model Selection](/concepts/models) – So wählen Sie Modelle aus
- [Configuration](/gateway/configuration) – Vollständige Konfigurationsreferenz
