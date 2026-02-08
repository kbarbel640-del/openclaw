---
summary: "Execucoes diretas do CLI `openclaw agent` (com entrega opcional)"
read_when:
  - Adicionar ou modificar o entrypoint do CLI do agente
title: "Envio do Agente"
x-i18n:
  source_path: tools/agent-send.md
  source_hash: a84d6a304333eebe
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:30Z
---

# `openclaw agent` (execucoes diretas do agente)

`openclaw agent` executa um unico turno do agente sem precisar de uma mensagem de chat de entrada.
Por padrao, passa **pelo Gateway**; adicione `--local` para forcar o
runtime incorporado na maquina atual.

## Comportamento

- Obrigatorio: `--message <text>`
- Selecao de sessao:
  - `--to <dest>` deriva a chave da sessao (alvos de grupo/canal preservam isolamento; chats diretos colapsam para `main`), **ou**
  - `--session-id <id>` reutiliza uma sessao existente por id, **ou**
  - `--agent <id>` direciona diretamente um agente configurado (usa a chave de sessao `main` desse agente)
- Executa o mesmo runtime de agente incorporado das respostas de entrada normais.
- Flags de pensamento/verboso persistem no armazenamento da sessao.
- Saida:
  - padrao: imprime o texto da resposta (alem de linhas `MEDIA:<url>`)
  - `--json`: imprime payload estruturado + metadados
- Entrega opcional de volta a um canal com `--deliver` + `--channel` (formatos de alvo correspondem a `openclaw message --target`).
- Use `--reply-channel`/`--reply-to`/`--reply-account` para substituir a entrega sem alterar a sessao.

Se o Gateway estiver inacessivel, o CLI **faz fallback** para a execucao local incorporada.

## Exemplos

```bash
openclaw agent --to +15555550123 --message "status update"
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --to +15555550123 --message "Trace logs" --verbose on --json
openclaw agent --to +15555550123 --message "Summon reply" --deliver
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```

## Flags

- `--local`: executar localmente (requer chaves de API do provedor de modelo no seu shell)
- `--deliver`: enviar a resposta para o canal escolhido
- `--channel`: canal de entrega (`whatsapp|telegram|discord|googlechat|slack|signal|imessage`, padrao: `whatsapp`)
- `--reply-to`: substituicao do alvo de entrega
- `--reply-channel`: substituicao do canal de entrega
- `--reply-account`: substituicao do id da conta de entrega
- `--thinking <off|minimal|low|medium|high|xhigh>`: persistir nivel de pensamento (somente modelos GPT-5.2 + Codex)
- `--verbose <on|full|off>`: persistir nivel verboso
- `--timeout <seconds>`: substituir timeout do agente
- `--json`: saida JSON estruturada
