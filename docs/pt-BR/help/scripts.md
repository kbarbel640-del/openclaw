---
summary: "Scripts do repositorio: proposito, escopo e notas de seguranca"
read_when:
  - Executando scripts do repositorio
  - Adicionando ou alterando scripts em ./scripts
title: "Scripts"
x-i18n:
  source_path: help/scripts.md
  source_hash: efd220df28f20b33
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:13Z
---

# Scripts

O diretorio `scripts/` contem scripts auxiliares para fluxos de trabalho locais e tarefas de operacoes.
Use-os quando uma tarefa estiver claramente vinculada a um script; caso contrario, prefira a CLI.

## Convencoes

- Scripts sao **opcionais** a menos que sejam referenciados na documentacao ou em checklists de release.
- Prefira superficies da CLI quando existirem (exemplo: o monitoramento de autenticacao usa `openclaw models status --check`).
- Assuma que os scripts sao especificos do host; leia-os antes de executar em uma nova maquina.

## Scripts de monitoramento de autenticacao

Os scripts de monitoramento de autenticacao estao documentados aqui:
[/automation/auth-monitoring](/automation/auth-monitoring)

## Ao adicionar scripts

- Mantenha os scripts focados e documentados.
- Adicione uma breve entrada no documento relevante (ou crie um se estiver faltando).
