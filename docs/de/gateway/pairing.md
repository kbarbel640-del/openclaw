---
summary: "Gateway-eigene Knotenpaarung (Option B) für iOS und andere entfernte Knoten"
read_when:
  - Implementierung von Genehmigungen für Knotenpaarungen ohne macOS-UI
  - Hinzufügen von CLI-Abläufen zur Genehmigung entfernter Knoten
  - Erweiterung des Gateway-Protokolls um Knotenverwaltung
title: "Gateway-eigene Paarung"
x-i18n:
  source_path: gateway/pairing.md
  source_hash: 1f5154292a75ea2c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:28Z
---

# Gateway-eigene Paarung (Option B)

Bei der Gateway-eigenen Paarung ist das **Gateway** die maßgebliche Instanz dafür, welche Knoten
beitreten dürfen. UIs (macOS-App, zukünftige Clients) sind lediglich Frontends, die
ausstehende Anfragen genehmigen oder ablehnen.

**Wichtig:** WS-Knoten verwenden **Geräte-Paarung** (Rolle `node`) während `connect`.
`node.pair.*` ist ein separater Pairing-Speicher und steuert den WS-Handshake **nicht**.
Nur Clients, die explizit `node.pair.*` aufrufen, verwenden diesen Ablauf.

## Konzepte

- **Ausstehende Anfrage**: Ein Knoten hat um Beitritt gebeten; Genehmigung erforderlich.
- **Gepaarter Knoten**: Genehmigter Knoten mit einem ausgestellten Auth-Token.
- **Transport**: Der Gateway-WS-Endpunkt leitet Anfragen weiter, entscheidet aber nicht
  über die Mitgliedschaft. (Legacy-TCP-Bridge-Unterstützung ist veraltet/entfernt.)

## Wie die Paarung funktioniert

1. Ein Knoten verbindet sich mit dem Gateway-WS und fordert eine Paarung an.
2. Das Gateway speichert eine **ausstehende Anfrage** und sendet `node.pair.requested`.
3. Sie genehmigen oder lehnen die Anfrage ab (CLI oder UI).
4. Bei Genehmigung stellt das Gateway ein **neues Token** aus (Tokens werden bei erneuter Paarung rotiert).
5. Der Knoten verbindet sich erneut mit dem Token und ist nun „gepaart“.

Ausstehende Anfragen verfallen automatisch nach **5 Minuten**.

## CLI-Workflow (headless-freundlich)

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes reject <requestId>
openclaw nodes status
openclaw nodes rename --node <id|name|ip> --name "Living Room iPad"
```

`nodes status` zeigt gepaarte/verbundene Knoten und deren Fähigkeiten an.

## API-Oberfläche (Gateway-Protokoll)

Events:

- `node.pair.requested` — ausgelöst, wenn eine neue ausstehende Anfrage erstellt wird.
- `node.pair.resolved` — ausgelöst, wenn eine Anfrage genehmigt/abgelehnt/abgelaufen ist.

Methoden:

- `node.pair.request` — eine ausstehende Anfrage erstellen oder wiederverwenden.
- `node.pair.list` — ausstehende + gepaarte Knoten auflisten.
- `node.pair.approve` — eine ausstehende Anfrage genehmigen (stellt ein Token aus).
- `node.pair.reject` — eine ausstehende Anfrage ablehnen.
- `node.pair.verify` — `{ nodeId, token }` verifizieren.

Hinweise:

- `node.pair.request` ist pro Knoten idempotent: Wiederholte Aufrufe geben dieselbe
  ausstehende Anfrage zurück.
- Eine Genehmigung erzeugt **immer** ein frisches Token; aus `node.pair.request` wird niemals
  ein Token zurückgegeben.
- Anfragen können `silent: true` als Hinweis für Auto-Genehmigungsabläufe enthalten.

## Auto-Genehmigung (macOS-App)

Die macOS-App kann optional eine **stille Genehmigung** versuchen, wenn:

- die Anfrage als `silent` markiert ist und
- die App eine SSH-Verbindung zum Gateway-Host mit demselben Benutzer verifizieren kann.

Schlägt die stille Genehmigung fehl, wird auf die normale „Genehmigen/Ablehnen“-Abfrage zurückgegriffen.

## Speicherung (lokal, privat)

Der Paarungszustand wird im Gateway-Zustandsverzeichnis gespeichert (Standard `~/.openclaw`):

- `~/.openclaw/nodes/paired.json`
- `~/.openclaw/nodes/pending.json`

Wenn Sie `OPENCLAW_STATE_DIR` überschreiben, wird der Ordner `nodes/` mit verschoben.

Sicherheitshinweise:

- Tokens sind Geheimnisse; behandeln Sie `paired.json` als sensibel.
- Das Rotieren eines Tokens erfordert eine erneute Genehmigung (oder das Löschen des Knoteneintrags).

## Transportverhalten

- Der Transport ist **zustandslos**; er speichert keine Mitgliedschaften.
- Wenn das Gateway offline ist oder die Paarung deaktiviert ist, können Knoten nicht gepaart werden.
- Befindet sich das Gateway im Remote-Modus, erfolgt die Paarung weiterhin gegen den Speicher des entfernten Gateways.
