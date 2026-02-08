---
summary: "Envio de enquetes via gateway + CLI"
read_when:
  - Adicionar ou modificar suporte a enquetes
  - Depurar envios de enquetes a partir da CLI ou do gateway
title: "Enquetes"
x-i18n:
  source_path: automation/poll.md
  source_hash: 760339865d27ec40
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:07Z
---

# Enquetes

## Canais suportados

- WhatsApp (canal web)
- Discord
- MS Teams (Adaptive Cards)

## CLI

```bash
# WhatsApp
openclaw message poll --target +15555550123 \
  --poll-question "Lunch today?" --poll-option "Yes" --poll-option "No" --poll-option "Maybe"
openclaw message poll --target 123456789@g.us \
  --poll-question "Meeting time?" --poll-option "10am" --poll-option "2pm" --poll-option "4pm" --poll-multi

# Discord
openclaw message poll --channel discord --target channel:123456789 \
  --poll-question "Snack?" --poll-option "Pizza" --poll-option "Sushi"
openclaw message poll --channel discord --target channel:123456789 \
  --poll-question "Plan?" --poll-option "A" --poll-option "B" --poll-duration-hours 48

# MS Teams
openclaw message poll --channel msteams --target conversation:19:abc@thread.tacv2 \
  --poll-question "Lunch?" --poll-option "Pizza" --poll-option "Sushi"
```

Opcoes:

- `--channel`: `whatsapp` (padrao), `discord`, ou `msteams`
- `--poll-multi`: permite selecionar multiplas opcoes
- `--poll-duration-hours`: apenas Discord (padrao 24 quando omitido)

## Gateway RPC

Metodo: `poll`

Parametros:

- `to` (string, obrigatorio)
- `question` (string, obrigatorio)
- `options` (string[], obrigatorio)
- `maxSelections` (number, opcional)
- `durationHours` (number, opcional)
- `channel` (string, opcional, padrao: `whatsapp`)
- `idempotencyKey` (string, obrigatorio)

## Diferencas entre canais

- WhatsApp: 2-12 opcoes, `maxSelections` deve estar dentro da contagem de opcoes, ignora `durationHours`.
- Discord: 2-10 opcoes, `durationHours` limitado a 1-768 horas (padrao 24). `maxSelections > 1` habilita selecao multipla; o Discord nao oferece suporte a uma contagem de selecao estrita.
- MS Teams: Enquetes de Adaptive Card (gerenciadas pelo OpenClaw). Nao ha API nativa de enquetes; `durationHours` e ignorado.

## Ferramenta do agente (Mensagem)

Use a ferramenta `message` com a acao `poll` (`to`, `pollQuestion`, `pollOption`, opcional `pollMulti`, `pollDurationHours`, `channel`).

Observacao: O Discord nao tem modo de “escolher exatamente N”; `pollMulti` mapeia para selecao multipla.
As enquetes do Teams sao renderizadas como Adaptive Cards e exigem que o gateway permaneça online
para registrar votos em `~/.openclaw/msteams-polls.json`.
