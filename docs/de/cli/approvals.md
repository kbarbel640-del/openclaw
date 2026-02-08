---
summary: "CLI-Referenz für `openclaw approvals` (Exec-Genehmigungen für Gateway- oder Node-Hosts)"
read_when:
  - Sie möchten Exec-Genehmigungen über die CLI bearbeiten
  - Sie müssen Allowlists auf Gateway- oder Node-Hosts verwalten
title: "Genehmigungen"
x-i18n:
  source_path: cli/approvals.md
  source_hash: 4329cdaaec2c5f5d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:34Z
---

# `openclaw approvals`

Verwalten Sie Exec-Genehmigungen für den **lokalen Host**, den **Gateway-Host** oder einen **Node-Host**.
Standardmäßig zielen Befehle auf die lokale Genehmigungsdatei auf dem Datenträger. Verwenden Sie `--gateway`, um das Gateway anzusprechen, oder `--node`, um einen bestimmten Node anzusprechen.

Zugehörig:

- Exec-Genehmigungen: [Exec approvals](/tools/exec-approvals)
- Nodes: [Nodes](/nodes)

## Häufige Befehle

```bash
openclaw approvals get
openclaw approvals get --node <id|name|ip>
openclaw approvals get --gateway
```

## Genehmigungen aus einer Datei ersetzen

```bash
openclaw approvals set --file ./exec-approvals.json
openclaw approvals set --node <id|name|ip> --file ./exec-approvals.json
openclaw approvals set --gateway --file ./exec-approvals.json
```

## Allowlist-Hilfsfunktionen

```bash
openclaw approvals allowlist add "~/Projects/**/bin/rg"
openclaw approvals allowlist add --agent main --node <id|name|ip> "/usr/bin/uptime"
openclaw approvals allowlist add --agent "*" "/usr/bin/uname"

openclaw approvals allowlist remove "~/Projects/**/bin/rg"
```

## Hinweise

- `--node` verwendet denselben Resolver wie `openclaw nodes` (ID, Name, IP oder ID-Präfix).
- `--agent` ist standardmäßig `"*"`, was für alle Agenten gilt.
- Der Node-Host muss `system.execApprovals.get/set` bewerben (macOS-App oder headless Node-Host).
- Genehmigungsdateien werden pro Host unter `~/.openclaw/exec-approvals.json` gespeichert.
