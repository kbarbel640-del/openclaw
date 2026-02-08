---
summary: "Interface de configuracao de Skills do macOS e status com suporte do Gateway"
read_when:
  - Atualizando a interface de configuracao de Skills do macOS
  - Alterando o controle de acesso ou o comportamento de instalacao de skills
title: "Skills"
x-i18n:
  source_path: platforms/mac/skills.md
  source_hash: ecd5286bbe49eed8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:53Z
---

# Skills (macOS)

O app macOS expõe as Skills do OpenClaw via o gateway; ele não analisa skills localmente.

## Fonte de dados

- `skills.status` (gateway) retorna todas as skills, além de elegibilidade e requisitos ausentes
  (incluindo bloqueios de allowlist para skills empacotadas).
- Os requisitos são derivados de `metadata.openclaw.requires` em cada `SKILL.md`.

## Ações de instalação

- `metadata.openclaw.install` define opções de instalacao (brew/node/go/uv).
- O app chama `skills.install` para executar instaladores no host do gateway.
- O gateway expõe apenas um instalador preferencial quando vários são fornecidos
  (brew quando disponível; caso contrário, o gerenciador de node de `skills.install`, npm padrão).

## Chaves de ambiente/API

- O app armazena as chaves em `~/.openclaw/openclaw.json` sob `skills.entries.<skillKey>`.
- `skills.update` aplica patches em `enabled`, `apiKey` e `env`.

## Modo remoto

- Instalação e atualizações de configuracao acontecem no host do gateway (não no Mac local).
