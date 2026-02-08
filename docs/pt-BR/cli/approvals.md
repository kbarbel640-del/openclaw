---
summary: "Referencia de CLI para `openclaw approvals` (aprovações de exec para hosts de gateway ou de node)"
read_when:
  - Voce quer editar aprovações de exec pela CLI
  - Voce precisa gerenciar allowlists em hosts de gateway ou de node
title: "aprovações"
x-i18n:
  source_path: cli/approvals.md
  source_hash: 4329cdaaec2c5f5d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:29Z
---

# `openclaw approvals`

Gerencie aprovações de exec para o **host local**, **host de gateway** ou um **host de node**.
Por padrao, os comandos miram o arquivo de aprovações local em disco. Use `--gateway` para mirar o gateway ou `--node` para mirar um node especifico.

Relacionado:

- Aprovações de exec: [Exec approvals](/tools/exec-approvals)
- Nodes: [Nodes](/nodes)

## Comandos comuns

```bash
openclaw approvals get
openclaw approvals get --node <id|name|ip>
openclaw approvals get --gateway
```

## Substituir aprovações a partir de um arquivo

```bash
openclaw approvals set --file ./exec-approvals.json
openclaw approvals set --node <id|name|ip> --file ./exec-approvals.json
openclaw approvals set --gateway --file ./exec-approvals.json
```

## Ajudantes de allowlist

```bash
openclaw approvals allowlist add "~/Projects/**/bin/rg"
openclaw approvals allowlist add --agent main --node <id|name|ip> "/usr/bin/uptime"
openclaw approvals allowlist add --agent "*" "/usr/bin/uname"

openclaw approvals allowlist remove "~/Projects/**/bin/rg"
```

## Notas

- `--node` usa o mesmo resolvedor que `openclaw nodes` (id, nome, ip ou prefixo de id).
- `--agent` tem como padrao `"*"`, que se aplica a todos os agentes.
- O host de node deve anunciar `system.execApprovals.get/set` (aplicativo macOS ou host de node headless).
- Os arquivos de aprovações sao armazenados por host em `~/.openclaw/exec-approvals.json`.
