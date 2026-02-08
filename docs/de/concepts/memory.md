---
summary: „Wie der OpenClaw‑Speicher funktioniert (Workspace‑Dateien + automatischer Memory‑Flush)“
read_when:
  - Sie möchten das Layout und den Workflow der Memory‑Dateien verstehen
  - Sie möchten den automatischen Pre‑Compaction‑Memory‑Flush abstimmen
x-i18n:
  source_path: concepts/memory.md
  source_hash: 5fe705d89fb30998
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:40Z
---

# Memory

Der OpenClaw‑Speicher besteht aus **einfachem Markdown im Agent‑Workspace**. Die Dateien sind die
maßgebliche Quelle der Wahrheit; das Modell „erinnert“ sich nur an das, was auf die Festplatte
geschrieben wird.

Memory‑Suchwerkzeuge werden vom aktiven Memory‑Plugin bereitgestellt (Standard:
`memory-core`). Deaktivieren Sie Memory‑Plugins mit `plugins.slots.memory = "none"`.

## Memory‑Dateien (Markdown)

Das Standard‑Workspace‑Layout verwendet zwei Memory‑Ebenen:

- `memory/YYYY-MM-DD.md`
  - Tägliches Protokoll (nur Anhängen).
  - Lesen von heute + gestern beim Sitzungsstart.
- `MEMORY.md` (optional)
  - Kuratierter Langzeitspeicher.
  - **Nur in der Haupt‑, privaten Sitzung laden** (niemals in Gruppenkontexten).

Diese Dateien liegen unter dem Workspace (`agents.defaults.workspace`, Standard
`~/.openclaw/workspace`). Siehe [Agent‑Workspace](/concepts/agent-workspace) fuer alle Details zum vollständigen Layout.

## Wann Memory geschrieben werden soll

- Entscheidungen, Präferenzen und dauerhafte Fakten gehören in `MEMORY.md`.
- Alltägliche Notizen und laufender Kontext gehören in `memory/YYYY-MM-DD.md`.
- Wenn jemand sagt „merk dir das“, schreiben Sie es auf (nicht im RAM behalten).
- Dieser Bereich entwickelt sich noch weiter. Es hilft, das Modell daran zu erinnern, Erinnerungen zu speichern; es weiß dann, was zu tun ist.
- Wenn etwas haften bleiben soll, **bitten Sie den Bot, es in den Memory zu schreiben**.

## Automatischer Memory‑Flush (Pre‑Compaction‑Ping)

Wenn eine Sitzung **kurz vor der Auto‑Compaction** steht, löst OpenClaw einen **stillen,
agentischen Turn** aus, der das Modell daran erinnert, dauerhafte Erinnerungen **vor** der
Kompaktierung des Kontexts zu schreiben. Die Standard‑Prompts sagen explizit, dass das Modell _antworten darf_,
aber in der Regel ist `NO_REPLY` die korrekte Antwort, sodass der Benutzer diesen Turn nie sieht.

Dies wird über `agents.defaults.compaction.memoryFlush` gesteuert:

```json5
{
  agents: {
    defaults: {
      compaction: {
        reserveTokensFloor: 20000,
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 4000,
          systemPrompt: "Session nearing compaction. Store durable memories now.",
          prompt: "Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store.",
        },
      },
    },
  },
}
```

Details:

- **Soft‑Schwellenwert**: Der Flush wird ausgelöst, wenn die geschätzte Sitzungs‑Tokenzahl
  `contextWindow - reserveTokensFloor - softThresholdTokens` überschreitet.
- **Standardmäßig still**: Prompts enthalten `NO_REPLY`, sodass nichts ausgeliefert wird.
- **Zwei Prompts**: Ein User‑Prompt plus ein System‑Prompt hängen die Erinnerung an.
- **Ein Flush pro Compaction‑Zyklus** (verfolgt in `sessions.json`).
- **Workspace muss beschreibbar sein**: Wenn die Sitzung in einer Sandbox mit
  `workspaceAccess: "ro"` oder `"none"` läuft, wird der Flush übersprungen.

Den vollständigen Compaction‑Lebenszyklus finden Sie unter
[Session‑Management + Compaction](/reference/session-management-compaction).

## Vektorbasierte Memory‑Suche

OpenClaw kann einen kleinen Vektorindex über `MEMORY.md` und `memory/*.md` aufbauen, sodass
semantische Abfragen verwandte Notizen finden können, selbst wenn sich die Wortwahl unterscheidet.

Standards:

- Standardmäßig aktiviert.
- Beobachtet Memory‑Dateien auf Änderungen (entprellt).
- Verwendet standardmäßig Remote‑Embeddings. Wenn `memorySearch.provider` nicht gesetzt ist, wählt OpenClaw automatisch:
  1. `local`, wenn ein `memorySearch.local.modelPath` konfiguriert ist und die Datei existiert.
  2. `openai`, wenn ein OpenAI‑Schlüssel aufgelöst werden kann.
  3. `gemini`, wenn ein Gemini‑Schlüssel aufgelöst werden kann.
  4. Andernfalls bleibt die Memory‑Suche deaktiviert, bis sie konfiguriert wird.
- Der lokale Modus verwendet node‑llama‑cpp und kann `pnpm approve-builds` erfordern.
- Verwendet sqlite‑vec (falls verfügbar), um die Vektorsuche innerhalb von SQLite zu beschleunigen.

Remote‑Embeddings **erfordern** einen API‑Schlüssel für den Embedding‑Anbieter. OpenClaw
löst Schlüssel aus Auth‑Profilen, `models.providers.*.apiKey` oder Umgebungsvariablen auf.
Codex‑OAuth deckt nur Chat/Completions ab und erfüllt **nicht** die Anforderungen
für Embeddings zur Memory‑Suche. Für Gemini verwenden Sie `GEMINI_API_KEY` oder
`models.providers.google.apiKey`. Bei Verwendung eines benutzerdefinierten OpenAI‑kompatiblen Endpunkts
setzen Sie `memorySearch.remote.apiKey` (und optional `memorySearch.remote.headers`).

### QMD‑Backend (experimentell)

Setzen Sie `memory.backend = "qmd"`, um den eingebauten SQLite‑Indexer gegen
[QMD](https://github.com/tobi/qmd) auszutauschen: ein Local‑First‑Search‑Sidecar, das
BM25 + Vektoren + Reranking kombiniert. Markdown bleibt die Quelle der Wahrheit;
OpenClaw ruft QMD fuer das Retrieval auf. Wichtige Punkte:

**Voraussetzungen**

- Standardmäßig deaktiviert. Opt‑in pro Konfiguration (`memory.backend = "qmd"`).
- Installieren Sie die QMD‑CLI separat (`bun install -g github.com/tobi/qmd` oder laden Sie
  ein Release) und stellen Sie sicher, dass das `qmd`‑Binary im `PATH` des Gateways liegt.
- QMD benötigt einen SQLite‑Build, der Erweiterungen erlaubt (`brew install sqlite` unter
  macOS).
- QMD läuft vollständig lokal über Bun + `node-llama-cpp` und lädt GGUF‑Modelle
  beim ersten Einsatz automatisch von HuggingFace herunter (kein separater Ollama‑Daemon erforderlich).
- Das Gateway führt QMD in einem eigenständigen XDG‑Home unter
  `~/.openclaw/agents/<agentId>/qmd/` aus, indem es `XDG_CONFIG_HOME` und
  `XDG_CACHE_HOME` setzt.
- OS‑Support: macOS und Linux funktionieren sofort, sobald Bun + SQLite
  installiert sind. Windows wird am besten über WSL2 unterstützt.

**Wie das Sidecar läuft**

- Das Gateway schreibt ein eigenständiges QMD‑Home unter
  `~/.openclaw/agents/<agentId>/qmd/` (Konfiguration + Cache + SQLite‑DB).
- Collections werden aus `memory.qmd.paths` (plus den Standard‑Workspace‑Memory‑Dateien)
  nach `index.yml` umgeschrieben, dann laufen `qmd update` + `qmd embed` beim Boot
  und in einem konfigurierbaren Intervall (`memory.qmd.update.interval`, Standard 5 Min.).
- Suchen laufen über `qmd query --json`. Wenn QMD fehlschlägt oder das Binary fehlt,
  fällt OpenClaw automatisch auf den eingebauten SQLite‑Manager zurück, sodass die
  Memory‑Werkzeuge weiter funktionieren.
- **Die erste Suche kann langsam sein**: QMD kann beim ersten `qmd query`‑Lauf
  lokale GGUF‑Modelle (Reranker/Query‑Expansion) herunterladen.
  - OpenClaw setzt `XDG_CONFIG_HOME`/`XDG_CACHE_HOME` automatisch, wenn es QMD ausführt.
  - Wenn Sie Modelle manuell vorab herunterladen möchten (und denselben Index aufwärmen wollen,
    den OpenClaw verwendet), führen Sie eine einmalige Abfrage mit den XDG‑Verzeichnissen des Agents aus.

    Der QMD‑Status von OpenClaw liegt unter Ihrem **State‑Verzeichnis** (Standard: `~/.openclaw`).
    Sie können `qmd` auf exakt denselben Index zeigen lassen, indem Sie dieselben
    XDG‑Variablen exportieren, die OpenClaw verwendet:

    ```bash
    # Pick the same state dir OpenClaw uses
    STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
    if [ -d "$HOME/.moltbot" ] && [ ! -d "$HOME/.openclaw" ] \
      && [ -z "${OPENCLAW_STATE_DIR:-}" ]; then
      STATE_DIR="$HOME/.moltbot"
    fi

    export XDG_CONFIG_HOME="$STATE_DIR/agents/main/qmd/xdg-config"
    export XDG_CACHE_HOME="$STATE_DIR/agents/main/qmd/xdg-cache"

    # (Optional) force an index refresh + embeddings
    qmd update
    qmd embed

    # Warm up / trigger first-time model downloads
    qmd query "test" -c memory-root --json >/dev/null 2>&1
    ```

**Konfigurationsoberfläche (`memory.qmd.*`)**

- `command` (Standard `qmd`): überschreibt den Pfad zur ausführbaren Datei.
- `includeDefaultMemory` (Standard `true`): automatisches Indexieren von `MEMORY.md` + `memory/**/*.md`.
- `paths[]`: zusätzliche Verzeichnisse/Dateien hinzufügen (`path`, optional `pattern`, optional
  stabil `name`).
- `sessions`: Opt‑in für das Indexieren von Session‑JSONL (`enabled`, `retentionDays`,
  `exportDir`).
- `update`: steuert die Aktualisierungsfrequenz (`interval`, `debounceMs`, `onBoot`, `embedInterval`).
- `limits`: begrenzt die Recall‑Nutzlast (`maxResults`, `maxSnippetChars`,
  `maxInjectedChars`, `timeoutMs`).
- `scope`: gleiches Schema wie [`session.sendPolicy`](/gateway/configuration#session).
  Standard ist nur Direktnachrichten (`deny` alle, `allow` Direktchats); lockern Sie dies,
  um QMD‑Treffer in Gruppen/Kanälen anzuzeigen.
- Snippets aus Quellen außerhalb des Workspace erscheinen als
  `qmd/<collection>/<relative-path>` in den Ergebnissen von `memory_search`; `memory_get`
  versteht dieses Präfix und liest aus der konfigurierten QMD‑Collection‑Root.
- Wenn `memory.qmd.sessions.enabled = true`, exportiert OpenClaw bereinigte Sitzungs‑Transkripte
  (User/Assistant‑Turns) in eine dedizierte QMD‑Collection unter
  `~/.openclaw/agents/<id>/qmd/sessions/`, sodass `memory_search` kürzliche
  Unterhaltungen abrufen kann, ohne den eingebauten SQLite‑Index zu berühren.
- `memory_search`‑Snippets enthalten jetzt eine `Source: <path#line>`‑Fußzeile, wenn
  `memory.citations` `auto`/`on` ist; setzen Sie `memory.citations = "off"`, um
  die Pfad‑Metadaten intern zu halten (der Agent erhält den Pfad weiterhin fuer
  `memory_get`, aber der Snippet‑Text lässt die Fußzeile weg und der System‑Prompt
  warnt den Agenten, sie nicht zu zitieren).

**Beispiel**

```json5
memory: {
  backend: "qmd",
  citations: "auto",
  qmd: {
    includeDefaultMemory: true,
    update: { interval: "5m", debounceMs: 15000 },
    limits: { maxResults: 6, timeoutMs: 4000 },
    scope: {
      default: "deny",
      rules: [{ action: "allow", match: { chatType: "direct" } }]
    },
    paths: [
      { name: "docs", path: "~/notes", pattern: "**/*.md" }
    ]
  }
}
```

**Zitate & Fallback**

- `memory.citations` gilt unabhängig vom Backend (`auto`/`on`/`off`).
- Wenn `qmd` läuft, markieren wir `status().backend = "qmd"`, sodass Diagnosen zeigen,
  welche Engine die Ergebnisse geliefert hat. Wenn der QMD‑Subprozess beendet wird oder
  die JSON‑Ausgabe nicht geparst werden kann, protokolliert der Suchmanager eine Warnung
  und gibt den eingebauten Anbieter (bestehende Markdown‑Embeddings) zurück, bis QMD sich erholt.

### Zusätzliche Memory‑Pfade

Wenn Sie Markdown‑Dateien außerhalb des Standard‑Workspace‑Layouts indexieren möchten,
fügen Sie explizite Pfade hinzu:

```json5
agents: {
  defaults: {
    memorySearch: {
      extraPaths: ["../team-docs", "/srv/shared-notes/overview.md"]
    }
  }
}
```

Hinweise:

- Pfade können absolut oder relativ zum Workspace sein.
- Verzeichnisse werden rekursiv nach `.md`‑Dateien durchsucht.
- Es werden nur Markdown‑Dateien indexiert.
- Symlinks werden ignoriert (Dateien oder Verzeichnisse).

### Gemini‑Embeddings (nativ)

Setzen Sie den Anbieter auf `gemini`, um die Gemini‑Embeddings‑API direkt zu verwenden:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "gemini",
      model: "gemini-embedding-001",
      remote: {
        apiKey: "YOUR_GEMINI_API_KEY"
      }
    }
  }
}
```

Hinweise:

- `remote.baseUrl` ist optional (Standard ist die Gemini‑API‑Basis‑URL).
- `remote.headers` ermöglicht das Hinzufügen zusätzlicher Header bei Bedarf.
- Standard‑Modell: `gemini-embedding-001`.

Wenn Sie einen **benutzerdefinierten OpenAI‑kompatiblen Endpunkt** (OpenRouter, vLLM oder einen Proxy)
verwenden möchten, können Sie die `remote`‑Konfiguration mit dem OpenAI‑Anbieter nutzen:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_OPENAI_COMPAT_API_KEY",
        headers: { "X-Custom-Header": "value" }
      }
    }
  }
}
```

Wenn Sie keinen API‑Schlüssel setzen möchten, verwenden Sie `memorySearch.provider = "local"` oder setzen Sie
`memorySearch.fallback = "none"`.

Fallbacks:

- `memorySearch.fallback` kann `openai`, `gemini`, `local` oder `none` sein.
- Der Fallback‑Anbieter wird nur verwendet, wenn der primäre Embedding‑Anbieter fehlschlägt.

Batch‑Indexierung (OpenAI + Gemini):

- Standardmäßig aktiviert für OpenAI‑ und Gemini‑Embeddings. Setzen Sie `agents.defaults.memorySearch.remote.batch.enabled = false`, um sie zu deaktivieren.
- Das Standardverhalten wartet auf den Abschluss des Batches; stimmen Sie `remote.batch.wait`, `remote.batch.pollIntervalMs` und `remote.batch.timeoutMinutes` bei Bedarf ab.
- Setzen Sie `remote.batch.concurrency`, um zu steuern, wie viele Batch‑Jobs parallel eingereicht werden (Standard: 2).
- Der Batch‑Modus greift, wenn `memorySearch.provider = "openai"` oder `"gemini"` gesetzt ist, und verwendet den entsprechenden API‑Schlüssel.
- Gemini‑Batch‑Jobs verwenden den asynchronen Embeddings‑Batch‑Endpunkt und erfordern die Verfügbarkeit der Gemini‑Batch‑API.

Warum OpenAI‑Batch schnell + günstig ist:

- Für große Backfills ist OpenAI in der Regel die schnellste Option, die wir unterstützen, da wir viele Embedding‑Anfragen in einem einzigen Batch‑Job einreichen und OpenAI sie asynchron verarbeiten lassen können.
- OpenAI bietet rabattierte Preise für Batch‑API‑Workloads, sodass große Indexierungsläufe meist günstiger sind als das synchrone Senden derselben Anfragen.
- Siehe die OpenAI‑Batch‑API‑Dokumentation und Preise:
  - https://platform.openai.com/docs/api-reference/batch
  - https://platform.openai.com/pricing

Konfigurationsbeispiel:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      fallback: "openai",
      remote: {
        batch: { enabled: true, concurrency: 2 }
      },
      sync: { watch: true }
    }
  }
}
```

Werkzeuge:

- `memory_search` — gibt Snippets mit Datei‑ und Zeilenbereichen zurück.
- `memory_get` — liest den Inhalt einer Memory‑Datei nach Pfad.

Lokaler Modus:

- Setzen Sie `agents.defaults.memorySearch.provider = "local"`.
- Geben Sie `agents.defaults.memorySearch.local.modelPath` an (GGUF oder `hf:`‑URI).
- Optional: Setzen Sie `agents.defaults.memorySearch.fallback = "none"`, um Remote‑Fallbacks zu vermeiden.

### Wie die Memory‑Werkzeuge funktionieren

- `memory_search` durchsucht semantisch Markdown‑Chunks (~400‑Token‑Ziel, 80‑Token‑Überlappung) aus `MEMORY.md` + `memory/**/*.md`. Es gibt Snippet‑Text (auf ~700 Zeichen begrenzt), Dateipfad, Zeilenbereich, Score, Anbieter/Modell und ob von lokalen → Remote‑Embeddings zurückgefallen wurde, zurück. Es wird kein vollständiger Dateiinhalt geliefert.
- `memory_get` liest eine bestimmte Memory‑Markdown‑Datei (relativ zum Workspace), optional ab einer Startzeile und für N Zeilen. Pfade außerhalb von `MEMORY.md` / `memory/` werden abgelehnt.
- Beide Werkzeuge sind nur aktiviert, wenn `memorySearch.enabled` für den Agenten true ergibt.

### Was indexiert wird (und wann)

- Dateityp: nur Markdown (`MEMORY.md`, `memory/**/*.md`).
- Index‑Speicher: pro Agent SQLite unter `~/.openclaw/memory/<agentId>.sqlite` (konfigurierbar über `agents.defaults.memorySearch.store.path`, unterstützt das `{agentId}`‑Token).
- Aktualität: Watcher auf `MEMORY.md` + `memory/` markieren den Index als „dirty“ (Entprellung 1,5 s). Die Synchronisierung wird beim Sitzungsstart, bei der Suche oder in einem Intervall geplant und läuft asynchron. Sitzungs‑Transkripte verwenden Delta‑Schwellen, um eine Hintergrund‑Synchronisierung auszulösen.
- Reindex‑Trigger: Der Index speichert **Anbieter/Modell + Endpunkt‑Fingerprint + Chunking‑Parameter** der Embeddings. Wenn sich eines davon ändert, setzt OpenClaw den gesamten Store automatisch zurück und indexiert neu.

### Hybride Suche (BM25 + Vektor)

Wenn aktiviert, kombiniert OpenClaw:

- **Vektorähnlichkeit** (semantischer Treffer, Wortlaut kann variieren)
- **BM25‑Keyword‑Relevanz** (exakte Tokens wie IDs, Umgebungsvariablen, Code‑Symbole)

Wenn die Volltextsuche auf Ihrer Plattform nicht verfügbar ist, fällt OpenClaw auf reine Vektorsuche zurück.

#### Warum hybrid?

Die Vektorsuche ist hervorragend bei „das bedeutet dasselbe“:

- „Mac Studio gateway host“ vs. „die Maschine, auf der das Gateway läuft“
- „Datei‑Updates entprellen“ vs. „Indexierung bei jedem Schreiben vermeiden“

Sie kann aber bei exakten, hochsignaligen Tokens schwach sein:

- IDs (`a828e60`, `b3b9895a…`)
- Code‑Symbole (`memorySearch.query.hybrid`)
- Fehlermeldungen („sqlite‑vec unavailable“)

BM25 (Volltext) ist das Gegenteil: stark bei exakten Tokens, schwächer bei Paraphrasen.
Hybride Suche ist der pragmatische Mittelweg: **beide Retrieval‑Signale verwenden**, sodass Sie
gute Ergebnisse sowohl fuer „natürliche Sprache“‑Abfragen als auch fuer „Nadel‑im‑Heuhaufen“‑Abfragen erhalten.

#### Wie wir Ergebnisse zusammenführen (aktuelles Design)

Implementierungsskizze:

1. Kandidatenpool von beiden Seiten abrufen:

- **Vektor**: Top `maxResults * candidateMultiplier` nach Kosinus‑Ähnlichkeit.
- **BM25**: Top `maxResults * candidateMultiplier` nach FTS5‑BM25‑Rang (niedriger ist besser).

2. BM25‑Rang in einen 0..1‑ähnlichen Score umwandeln:

- `textScore = 1 / (1 + max(0, bm25Rank))`

3. Kandidaten nach Chunk‑ID vereinigen und einen gewichteten Score berechnen:

- `finalScore = vectorWeight * vectorScore + textWeight * textScore`

Hinweise:

- `vectorWeight` + `textWeight` wird bei der Konfigurationsauflösung auf 1,0 normalisiert, sodass die Gewichte wie Prozentsätze wirken.
- Wenn Embeddings nicht verfügbar sind (oder der Anbieter einen Null‑Vektor zurückgibt), führen wir dennoch BM25 aus und geben Keyword‑Treffer zurück.
- Wenn FTS5 nicht erstellt werden kann, behalten wir die reine Vektorsuche bei (kein harter Fehler).

Dies ist nicht „IR‑theoretisch perfekt“, aber es ist einfach, schnell und verbessert in der Praxis
Recall/Precision bei echten Notizen. Wenn wir es später verfeinern möchten, sind gängige nächste Schritte
Reciprocal Rank Fusion (RRF) oder Score‑Normalisierung (Min/Max oder Z‑Score) vor dem Mischen.

Konfiguration:

```json5
agents: {
  defaults: {
    memorySearch: {
      query: {
        hybrid: {
          enabled: true,
          vectorWeight: 0.7,
          textWeight: 0.3,
          candidateMultiplier: 4
        }
      }
    }
  }
}
```

### Embedding‑Cache

OpenClaw kann **Chunk‑Embeddings** in SQLite cachen, sodass Reindexierung und häufige Updates
(insbesondere Sitzungs‑Transkripte) unveränderten Text nicht erneut einbetten.

Konfiguration:

```json5
agents: {
  defaults: {
    memorySearch: {
      cache: {
        enabled: true,
        maxEntries: 50000
      }
    }
  }
}
```

### Session‑Memory‑Suche (experimentell)

Optional können Sie **Sitzungs‑Transkripte** indexieren und über `memory_search` verfügbar machen.
Dies ist hinter einem experimentellen Flag abgesichert.

```json5
agents: {
  defaults: {
    memorySearch: {
      experimental: { sessionMemory: true },
      sources: ["memory", "sessions"]
    }
  }
}
```

Hinweise:

- Session‑Indexierung ist **Opt‑in** (standardmäßig aus).
- Session‑Updates werden entprellt und **asynchron indexiert**, sobald sie Delta‑Schwellen überschreiten (Best‑Effort).
- `memory_search` blockiert nie auf die Indexierung; Ergebnisse können leicht veraltet sein, bis die Hintergrund‑Synchronisierung abgeschlossen ist.
- Ergebnisse enthalten weiterhin nur Snippets; `memory_get` bleibt auf Memory‑Dateien beschränkt.
- Session‑Indexierung ist pro Agent isoliert (nur die Sitzungsprotokolle dieses Agents werden indexiert).
- Sitzungsprotokolle liegen auf der Festplatte (`~/.openclaw/agents/<agentId>/sessions/*.jsonl`). Jeder Prozess/Benutzer mit Dateisystemzugriff kann sie lesen; betrachten Sie daher den Festplattenzugriff als Vertrauensgrenze. Fuer strengere Isolation führen Sie Agents unter getrennten OS‑Benutzern oder Hosts aus.

Delta‑Schwellen (Standardwerte gezeigt):

```json5
agents: {
  defaults: {
    memorySearch: {
      sync: {
        sessions: {
          deltaBytes: 100000,   // ~100 KB
          deltaMessages: 50     // JSONL lines
        }
      }
    }
  }
}
```

### SQLite‑Vektor‑Beschleunigung (sqlite‑vec)

Wenn die sqlite‑vec‑Erweiterung verfügbar ist, speichert OpenClaw Embeddings in einer
SQLite‑Virtual‑Table (`vec0`) und führt Vektor‑Distanzabfragen in der
Datenbank aus. Das hält die Suche schnell, ohne jedes Embedding in JS zu laden.

Konfiguration (optional):

```json5
agents: {
  defaults: {
    memorySearch: {
      store: {
        vector: {
          enabled: true,
          extensionPath: "/path/to/sqlite-vec"
        }
      }
    }
  }
}
```

Hinweise:

- `enabled` ist standardmäßig true; wenn deaktiviert, fällt die Suche auf eine
  In‑Process‑Kosinus‑Ähnlichkeit über gespeicherte Embeddings zurück.
- Wenn die sqlite‑vec‑Erweiterung fehlt oder nicht geladen werden kann, protokolliert OpenClaw den
  Fehler und fährt mit dem JS‑Fallback fort (keine Vektor‑Tabelle).
- `extensionPath` überschreibt den gebündelten sqlite‑vec‑Pfad (nützlich für benutzerdefinierte Builds
  oder nicht standardmäßige Installationsorte).

### Automatischer Download lokaler Embeddings

- Standard‑Modell für lokale Embeddings: `hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf` (~0,6 GB).
- Wenn `memorySearch.provider = "local"`, löst `node-llama-cpp` `modelPath` auf; fehlt das GGUF, wird es **automatisch** in den Cache (oder `local.modelCacheDir`, falls gesetzt) heruntergeladen und anschließend geladen. Downloads werden bei erneutem Versuch fortgesetzt.
- Native‑Build‑Anforderung: Führen Sie `pnpm approve-builds` aus, wählen Sie `node-llama-cpp`, dann `pnpm rebuild node-llama-cpp`.
- Fallback: Wenn das lokale Setup fehlschlägt und `memorySearch.fallback = "openai"`, wechseln wir automatisch zu Remote‑Embeddings (`openai/text-embedding-3-small`, sofern nicht überschrieben) und protokollieren den Grund.

### Beispiel für einen benutzerdefinierten OpenAI‑kompatiblen Endpunkt

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_REMOTE_API_KEY",
        headers: {
          "X-Organization": "org-id",
          "X-Project": "project-id"
        }
      }
    }
  }
}
```

Hinweise:

- `remote.*` hat Vorrang vor `models.providers.openai.*`.
- `remote.headers` wird mit OpenAI‑Headern zusammengeführt; bei Schlüsselkonflikten gewinnt Remote. Lassen Sie `remote.headers` weg, um die OpenAI‑Standardwerte zu verwenden.
