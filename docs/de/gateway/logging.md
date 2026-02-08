---
summary: "Logging-Oberflächen, Dateilogs, WS-Log-Stile und Konsolenformatierung"
read_when:
  - Beim Ändern der Logging-Ausgabe oder -Formate
  - Beim Debuggen der CLI- oder Gateway-Ausgabe
title: "Logging"
x-i18n:
  source_path: gateway/logging.md
  source_hash: efb8eda5e77e3809
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:28Z
---

# Logging

Für eine benutzerorientierte Übersicht (CLI + Control UI + Konfiguration) siehe [/logging](/logging).

OpenClaw hat zwei Log-„Oberflächen“:

- **Konsolenausgabe** (was Sie im Terminal / in der Debug-UI sehen).
- **Dateilogs** (JSON-Zeilen), geschrieben vom Gateway-Logger.

## Dateibasierter Logger

- Standardmäßige rotierende Logdatei befindet sich unter `/tmp/openclaw/` (eine Datei pro Tag): `openclaw-YYYY-MM-DD.log`
  - Das Datum verwendet die lokale Zeitzone des Gateway-Hosts.
- Der Pfad der Logdatei und der Level können über `~/.openclaw/openclaw.json` konfiguriert werden:
  - `logging.file`
  - `logging.level`

Das Dateiformat ist ein JSON-Objekt pro Zeile.

Der Tab „Logs“ der Control UI verfolgt diese Datei über das Gateway (`logs.tail`).
Die CLI kann dasselbe tun:

```bash
openclaw logs --follow
```

**Verbose vs. Log-Level**

- **Dateilogs** werden ausschließlich durch `logging.level` gesteuert.
- `--verbose` beeinflusst nur die **Konsolen-Verbosity** (und den WS-Log-Stil); es erhöht **nicht**
  den Dateilog-Level.
- Um ausschließlich bei Verbose verfügbare Details in Dateilogs zu erfassen, setzen Sie `logging.level` auf `debug` oder
  `trace`.

## Konsolen-Erfassung

Die CLI erfasst `console.log/info/warn/error/debug/trace` und schreibt sie in die Dateilogs,
während weiterhin auf stdout/stderr ausgegeben wird.

Sie können die Konsolen-Verbosity unabhängig einstellen über:

- `logging.consoleLevel` (Standard `info`)
- `logging.consoleStyle` (`pretty` | `compact` | `json`)

## Redigieren von Tool-Zusammenfassungen

Ausführliche Tool-Zusammenfassungen (z. B. `🛠️ Exec: ...`) können sensible Tokens maskieren, bevor sie den
Konsolen-Stream erreichen. Dies gilt **nur für Tools** und verändert keine Dateilogs.

- `logging.redactSensitive`: `off` | `tools` (Standard: `tools`)
- `logging.redactPatterns`: Array von Regex-Strings (überschreibt Standardwerte)
  - Verwenden Sie rohe Regex-Strings (auto `gi`), oder `/pattern/flags`, wenn Sie benutzerdefinierte Flags benötigen.
  - Treffer werden maskiert, indem die ersten 6 + letzten 4 Zeichen beibehalten werden (Länge >= 18), andernfalls `***`.
  - Standardwerte decken gängige Schlüsselzuweisungen, CLI-Flags, JSON-Felder, Bearer-Header, PEM-Blöcke und verbreitete Token-Präfixe ab.

## Gateway-WebSocket-Logs

Das Gateway gibt WebSocket-Protokolllogs in zwei Modi aus:

- **Normalmodus (kein `--verbose`)**: Es werden nur „interessante“ RPC-Ergebnisse ausgegeben:
  - Fehler (`ok=false`)
  - langsame Aufrufe (Standard-Schwellenwert: `>= 50ms`)
  - Parse-Fehler
- **Verbose-Modus (`--verbose`)**: Gibt den gesamten WS-Request/Response-Traffic aus.

### WS-Log-Stil

`openclaw gateway` unterstützt einen Stilwechsel pro Gateway:

- `--ws-log auto` (Standard): Normalmodus ist optimiert; der Verbose-Modus verwendet kompakte Ausgabe
- `--ws-log compact`: kompakte Ausgabe (gepaarte Request/Response) bei Verbose
- `--ws-log full`: vollständige Ausgabe pro Frame bei Verbose
- `--compact`: Alias für `--ws-log compact`

Beispiele:

```bash
# optimized (only errors/slow)
openclaw gateway

# show all WS traffic (paired)
openclaw gateway --verbose --ws-log compact

# show all WS traffic (full meta)
openclaw gateway --verbose --ws-log full
```

## Konsolenformatierung (Subsystem-Logging)

Der Konsolen-Formatter ist **TTY-bewusst** und gibt konsistente, vorangestellte Zeilen aus.
Subsystem-Logger halten die Ausgabe gruppiert und gut scannbar.

Verhalten:

- **Subsystem-Präfixe** in jeder Zeile (z. B. `[gateway]`, `[canvas]`, `[tailscale]`)
- **Subsystem-Farben** (stabil pro Subsystem) plus Level-Färbung
- **Farbe**, wenn die Ausgabe ein TTY ist oder die Umgebung wie ein reichhaltiges Terminal aussieht (`TERM`/`COLORTERM`/`TERM_PROGRAM`), berücksichtigt `NO_COLOR`
- **Verkürzte Subsystem-Präfixe**: entfernt führende `gateway/` + `channels/`, behält die letzten 2 Segmente (z. B. `whatsapp/outbound`)
- **Sub-Logger nach Subsystem** (automatisches Präfix + strukturiertes Feld `{ subsystem }`)
- **`logRaw()`** für QR/UX-Ausgabe (kein Präfix, keine Formatierung)
- **Konsolenstile** (z. B. `pretty | compact | json`)
- **Konsolen-Log-Level** getrennt vom Dateilog-Level (Datei behält volle Details, wenn `logging.level` auf `debug`/`trace` gesetzt ist)
- **WhatsApp-Nachrichteninhalte** werden auf `debug` geloggt (verwenden Sie `--verbose`, um sie zu sehen)

Dies hält bestehende Dateilogs stabil und macht die interaktive Ausgabe gut scannbar.
