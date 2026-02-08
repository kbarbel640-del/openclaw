---
summary: "Markdown-Formatierungs-Pipeline fuer ausgehende Kanaele"
read_when:
  - Sie aendern die Markdown-Formatierung oder das Chunking fuer ausgehende Kanaele
  - Sie fuegen einen neuen Kanal-Formatter oder ein Style-Mapping hinzu
  - Sie debuggen Formatierungs-Regressionen ueber Kanaele hinweg
title: "Markdown-Formatierung"
x-i18n:
  source_path: concepts/markdown-formatting.md
  source_hash: f9cbf9b744f9a218
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:03Z
---

# Markdown-Formatierung

OpenClaw formatiert ausgehendes Markdown, indem es zunaechst in eine gemeinsame
intermediaere Repraesentation (IR) konvertiert wird, bevor kanalspezifische Ausgaben
gerendert werden. Die IR behaelt den Quelltext unveraendert bei, traegt jedoch
Style- und Link-Spans, sodass Chunking und Rendering ueber Kanaele hinweg konsistent
bleiben.

## Ziele

- **Konsistenz:** ein Parse-Schritt, mehrere Renderer.
- **Sicheres Chunking:** Text vor dem Rendering aufteilen, sodass Inline-Formatierung
  niemals ueber Chunk-Grenzen hinweg bricht.
- **Kanaltauglichkeit:** dieselbe IR auf Slack mrkdwn, Telegram HTML und Signal
  Style-Ranges abbilden, ohne Markdown erneut zu parsen.

## Pipeline

1. **Markdown parsen -> IR**
   - Die IR besteht aus Plaintext plus Style-Spans (fett/kursiv/durchgestrichen/Code/Spoiler) sowie Link-Spans.
   - Offsets sind UTF-16-Codeeinheiten, damit Signal-Style-Ranges mit seiner API uebereinstimmen.
   - Tabellen werden nur dann geparst, wenn ein Kanal explizit in die Tabellenkonvertierung optiert.
2. **IR chunken (format-first)**
   - Das Chunking erfolgt auf dem IR-Text vor dem Rendering.
   - Inline-Formatierung wird nicht ueber Chunks hinweg aufgeteilt; Spans werden pro Chunk zugeschnitten.
3. **Pro Kanal rendern**
   - **Slack:** mrkdwn-Tokens (fett/kursiv/durchgestrichen/Code), Links als `<url|label>`.
   - **Telegram:** HTML-Tags (`<b>`, `<i>`, `<s>`, `<code>`, `<pre><code>`, `<a href>`).
   - **Signal:** Plaintext + `text-style`-Ranges; Links werden zu `label (url)`, wenn sich das Label unterscheidet.

## IR-Beispiel

Eingabe-Markdown:

```markdown
Hello **world** — see [docs](https://docs.openclaw.ai).
```

IR (schematisch):

```json
{
  "text": "Hello world — see docs.",
  "styles": [{ "start": 6, "end": 11, "style": "bold" }],
  "links": [{ "start": 19, "end": 23, "href": "https://docs.openclaw.ai" }]
}
```

## Wo es verwendet wird

- Die ausgehenden Adapter fuer Slack, Telegram und Signal rendern aus der IR.
- Andere Kanaele (WhatsApp, iMessage, MS Teams, Discord) verwenden weiterhin Plaintext
  oder eigene Formatierungsregeln, wobei die Markdown-Tabellenkonvertierung – wenn
  aktiviert – vor dem Chunking angewendet wird.

## Tabellenbehandlung

Markdown-Tabellen werden von Chat-Clients nicht einheitlich unterstuetzt. Verwenden Sie
`markdown.tables`, um die Konvertierung pro Kanal (und pro Account) zu steuern.

- `code`: Tabellen als Code-Bloecke rendern (Standard fuer die meisten Kanaele).
- `bullets`: Jede Zeile in Aufzaehlungspunkte umwandeln (Standard fuer Signal + WhatsApp).
- `off`: Tabellenparsing und -konvertierung deaktivieren; roher Tabellen-Text wird durchgereicht.

Config-Keys:

```yaml
channels:
  discord:
    markdown:
      tables: code
    accounts:
      work:
        markdown:
          tables: off
```

## Chunking-Regeln

- Chunk-Limits stammen aus Kanaladaptern bzw. der Konfiguration und werden auf den IR-Text angewendet.
- Code-Fences werden als einzelner Block mit nachfolgendem Zeilenumbruch beibehalten,
  damit Kanaele sie korrekt rendern.
- Listenpraefixe und Blockquote-Praefixe sind Teil des IR-Texts, sodass Chunking nicht
  mitten im Praefix trennt.
- Inline-Styles (fett/kursiv/durchgestrichen/Inline-Code/Spoiler) werden niemals ueber
  Chunks hinweg aufgeteilt; der Renderer oeffnet Styles innerhalb jedes Chunks erneut.

Wenn Sie mehr zum Chunking-Verhalten ueber Kanaele hinweg benoetigen, siehe
[Streaming + chunking](/concepts/streaming).

## Link-Richtlinie

- **Slack:** `[label](url)` -> `<url|label>`; nackte URLs bleiben unveraendert. Autolink
  ist waehrend des Parsens deaktiviert, um doppeltes Verlinken zu vermeiden.
- **Telegram:** `[label](url)` -> `<a href="url">label</a>` (HTML-Parse-Modus).
- **Signal:** `[label](url)` -> `label (url)`, sofern das Label nicht der URL entspricht.

## Spoiler

Spoiler-Markierungen (`||spoiler||`) werden nur fuer Signal geparst, wo sie auf
SPOILER-Style-Ranges abgebildet werden. Andere Kanaele behandeln sie als Plaintext.

## Wie man einen Kanal-Formatter hinzufuegt oder aktualisiert

1. **Einmal parsen:** Verwenden Sie den gemeinsamen `markdownToIR(...)`-Helper mit
   kanalgerechten Optionen (Autolink, Ueberschriftenstil, Blockquote-Praefix).
2. **Rendern:** Implementieren Sie einen Renderer mit `renderMarkdownWithMarkers(...)` und einer
   Style-Marker-Map (oder Signal-Style-Ranges).
3. **Chunken:** Rufen Sie `chunkMarkdownIR(...)` vor dem Rendering auf; rendern Sie jeden Chunk.
4. **Adapter verdrahten:** Aktualisieren Sie den ausgehenden Kanaladapter, um den neuen
   Chunker und Renderer zu verwenden.
5. **Testen:** Fuegen Sie Format-Tests sowie einen Outbound-Delivery-Test hinzu oder
   aktualisieren Sie diese, falls der Kanal Chunking verwendet.

## Haeufige Stolpersteine

- Slack-Winkelklammer-Tokens (`<@U123>`, `<#C123>`, `<https://...>`) muessen
  beibehalten werden; escapen Sie rohes HTML sicher.
- Telegram-HTML erfordert das Escapen von Text ausserhalb von Tags, um fehlerhaftes Markup zu vermeiden.
- Signal-Style-Ranges haengen von UTF-16-Offsets ab; verwenden Sie keine Codepoint-Offsets.
- Behalten Sie abschliessende Zeilenumbrueche fuer umschlossene Code-Bloecke bei, damit
  schliessende Marker in einer eigenen Zeile landen.
