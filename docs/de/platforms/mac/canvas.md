---
summary: „Agentengesteuertes Canvas-Panel, eingebettet über WKWebView + benutzerdefiniertes URL-Schema“
read_when:
  - Implementierung des macOS-Canvas-Panels
  - Hinzufuegen von Agentensteuerungen fuer den visuellen Arbeitsbereich
  - Debugging von WKWebView-Canvas-Ladevorgaengen
title: „Canvas“
x-i18n:
  source_path: platforms/mac/canvas.md
  source_hash: e39caa21542e839d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:59Z
---

# Canvas (macOS-App)

Die macOS-App bettet ein agentengesteuertes **Canvas-Panel** ueber `WKWebView` ein. Es
ist ein leichtgewichtiger visueller Arbeitsbereich fuer HTML/CSS/JS, A2UI und kleine interaktive
UI-Oberflaechen.

## Wo Canvas liegt

Der Canvas-Zustand wird unter „Application Support“ gespeichert:

- `~/Library/Application Support/OpenClaw/canvas/<session>/...`

Das Canvas-Panel stellt diese Dateien ueber ein **benutzerdefiniertes URL-Schema** bereit:

- `openclaw-canvas://<session>/<path>`

Beispiele:

- `openclaw-canvas://main/` → `<canvasRoot>/main/index.html`
- `openclaw-canvas://main/assets/app.css` → `<canvasRoot>/main/assets/app.css`
- `openclaw-canvas://main/widgets/todo/` → `<canvasRoot>/main/widgets/todo/index.html`

Wenn kein `index.html` im Root vorhanden ist, zeigt die App eine **integrierte Geruestseite** an.

## Panel-Verhalten

- Rahmenloses, in der Groesse anpassbares Panel, nahe der Menueleiste (oder des Mauszeigers) verankert.
- Merkt sich Groesse und Position pro Sitzung.
- Laedt automatisch neu, wenn sich lokale Canvas-Dateien aendern.
- Es ist immer nur ein Canvas-Panel sichtbar (die Sitzung wird bei Bedarf gewechselt).

Canvas kann in den Einstellungen → **Allow Canvas** deaktiviert werden. Wenn deaktiviert, geben Canvas-
Node-Befehle `CANVAS_DISABLED` zurueck.

## Agent-API-Oberflaeche

Canvas wird ueber den **Gateway WebSocket** bereitgestellt, sodass der Agent Folgendes kann:

- das Panel ein- oder ausblenden
- zu einem Pfad oder einer URL navigieren
- JavaScript auswerten
- ein Snapshot-Bild erfassen

CLI-Beispiele:

```bash
openclaw nodes canvas present --node <id>
openclaw nodes canvas navigate --node <id> --url "/"
openclaw nodes canvas eval --node <id> --js "document.title"
openclaw nodes canvas snapshot --node <id>
```

Hinweise:

- `canvas.navigate` akzeptiert **lokale Canvas-Pfade**, `http(s)`-URLs und `file://`-URLs.
- Wenn Sie `"/"` uebergeben, zeigt Canvas das lokale Geruest oder `index.html` an.

## A2UI in Canvas

A2UI wird vom Gateway-Canvas-Host bereitgestellt und innerhalb des Canvas-Panels gerendert.
Wenn das Gateway einen Canvas-Host bewirbt, navigiert die macOS-App beim ersten Oeffnen automatisch zur
A2UI-Host-Seite.

Standard-A2UI-Host-URL:

```
http://<gateway-host>:18793/__openclaw__/a2ui/
```

### A2UI-Befehle (v0.8)

Canvas akzeptiert derzeit **A2UI v0.8** Server→Client-Nachrichten:

- `beginRendering`
- `surfaceUpdate`
- `dataModelUpdate`
- `deleteSurface`

`createSurface` (v0.9) wird nicht unterstuetzt.

CLI-Beispiel:

```bash
cat > /tmp/a2ui-v0.8.jsonl <<'EOFA2'
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["title","content"]}}}},{"id":"title","component":{"Text":{"text":{"literalString":"Canvas (A2UI v0.8)"},"usageHint":"h1"}}},{"id":"content","component":{"Text":{"text":{"literalString":"If you can read this, A2UI push works."},"usageHint":"body"}}}]}}
{"beginRendering":{"surfaceId":"main","root":"root"}}
EOFA2

openclaw nodes canvas a2ui push --jsonl /tmp/a2ui-v0.8.jsonl --node <id>
```

Schneller Smoke-Test:

```bash
openclaw nodes canvas a2ui push --node <id> --text "Hello from A2UI"
```

## Ausloesen von Agentenlaeufen aus Canvas

Canvas kann neue Agentenlaeufe ueber Deep Links ausloesen:

- `openclaw://agent?...`

Beispiel (in JS):

```js
window.location.href = "openclaw://agent?message=Review%20this%20design";
```

Die App fordert zur Bestaetigung auf, sofern kein gueltiger Schluessel angegeben ist.

## Sicherheitshinweise

- Das Canvas-Schema blockiert Directory Traversal; Dateien muessen unterhalb des Sitzungs-Root liegen.
- Lokale Canvas-Inhalte verwenden ein benutzerdefiniertes Schema (kein Loopback-Server erforderlich).
- Externe `http(s)`-URLs sind nur erlaubt, wenn explizit zu ihnen navigiert wird.
