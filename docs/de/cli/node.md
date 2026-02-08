---
summary: "CLI-Referenz fuer `openclaw node` (headless Node-Host)"
read_when:
  - Ausfuehren des headless Node-Hosts
  - Koppeln eines Nicht-macOS-Nodes fuer system.run
title: "Node"
x-i18n:
  source_path: cli/node.md
  source_hash: a8b1a57712663e22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:48Z
---

# `openclaw node`

Fuehren Sie einen **headless Node-Host** aus, der sich mit dem Gateway-WebSocket verbindet und
`system.run` / `system.which` auf dieser Maschine bereitstellt.

## Warum einen Node-Host verwenden?

Verwenden Sie einen Node-Host, wenn Sie moechten, dass Agenten **Befehle auf anderen Maschinen**
in Ihrem Netzwerk ausfuehren, ohne dort eine vollstaendige macOS-Begleit-App zu installieren.

Hauefige Anwendungsfaelle:

- Befehle auf entfernten Linux-/Windows-Rechnern ausfuehren (Build-Server, Laborrechner, NAS).
- Exec **in einer Sandbox** auf dem Gateway behalten, aber genehmigte Ausfuehrungen an andere Hosts delegieren.
- Ein leichtgewichtes, headless Ausfuehrungsziel fuer Automatisierung oder CI-Nodes bereitstellen.

Die Ausfuehrung wird weiterhin durch **Exec-Genehmigungen** und agentenspezifische Allowlists auf dem
Node-Host geschuetzt, sodass der Befehlszugriff klar abgegrenzt und explizit bleibt.

## Browser-Proxy (Zero-Config)

Node-Hosts kuendigen automatisch einen Browser-Proxy an, wenn `browser.enabled` auf dem Node nicht
deaktiviert ist. Dadurch kann der Agent Browser-Automatisierung auf diesem Node ohne zusaetzliche
Konfiguration nutzen.

Deaktivieren Sie dies bei Bedarf auf dem Node:

```json5
{
  nodeHost: {
    browserProxy: {
      enabled: false,
    },
  },
}
```

## Ausfuehren (Vordergrund)

```bash
openclaw node run --host <gateway-host> --port 18789
```

Optionen:

- `--host <host>`: Gateway-WebSocket-Host (Standard: `127.0.0.1`)
- `--port <port>`: Gateway-WebSocket-Port (Standard: `18789`)
- `--tls`: TLS fuer die Gateway-Verbindung verwenden
- `--tls-fingerprint <sha256>`: Erwarteter TLS-Zertifikat-Fingerprint (sha256)
- `--node-id <id>`: Node-ID ueberschreiben (setzt Pairing-Token zurueck)
- `--display-name <name>`: Anzeigenamen des Nodes ueberschreiben

## Dienst (Hintergrund)

Installieren Sie einen headless Node-Host als Benutzerdienst.

```bash
openclaw node install --host <gateway-host> --port 18789
```

Optionen:

- `--host <host>`: Gateway-WebSocket-Host (Standard: `127.0.0.1`)
- `--port <port>`: Gateway-WebSocket-Port (Standard: `18789`)
- `--tls`: TLS fuer die Gateway-Verbindung verwenden
- `--tls-fingerprint <sha256>`: Erwarteter TLS-Zertifikat-Fingerprint (sha256)
- `--node-id <id>`: Node-ID ueberschreiben (setzt Pairing-Token zurueck)
- `--display-name <name>`: Anzeigenamen des Nodes ueberschreiben
- `--runtime <runtime>`: Laufzeitumgebung des Dienstes (`node` oder `bun`)
- `--force`: Neu installieren/ueberschreiben, falls bereits installiert

Dienst verwalten:

```bash
openclaw node status
openclaw node stop
openclaw node restart
openclaw node uninstall
```

Verwenden Sie `openclaw node run` fuer einen Node-Host im Vordergrund (kein Dienst).

Dienstbefehle akzeptieren `--json` fuer maschinenlesbare Ausgabe.

## Pairing

Die erste Verbindung erstellt eine ausstehende Node-Pairing-Anfrage auf dem Gateway.
Genehmigen Sie diese ueber:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

Der Node-Host speichert seine Node-ID, sein Token, seinen Anzeigenamen sowie die
Gateway-Verbindungsinformationen in
`~/.openclaw/node.json`.

## Exec-Genehmigungen

`system.run` ist durch lokale Exec-Genehmigungen abgesichert:

- `~/.openclaw/exec-approvals.json`
- [Exec-Genehmigungen](/tools/exec-approvals)
- `openclaw approvals --node <id|name|ip>` (vom Gateway aus bearbeiten)
