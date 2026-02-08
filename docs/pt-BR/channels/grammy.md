---
summary: "Integração com a API de Bots do Telegram via grammY, com notas de configuração"
read_when:
  - Trabalhando em fluxos do Telegram ou grammY
title: grammY
x-i18n:
  source_path: channels/grammy.md
  source_hash: ea7ef23e6d77801f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:15Z
---

# Integração com grammY (API de Bots do Telegram)

# Por que grammY

- Cliente da Bot API com foco em TS, com helpers integrados para long-poll e webhook, middleware, tratamento de erros e limitador de taxa.
- Helpers de mídia mais limpos do que implementar fetch + FormData manualmente; suporta todos os métodos da Bot API.
- Extensível: suporte a proxy via fetch customizado, middleware de sessao (opcional), contexto com tipagem segura.

# O que entregamos

- **Caminho único de cliente:** a implementação baseada em fetch foi removida; grammY agora é o único cliente do Telegram (envio + gateway), com o limitador do grammY habilitado por padrao.
- **Gateway:** `monitorTelegramProvider` constrói um `Bot` do grammY, conecta o gating por menção/lista de permissões, download de mídia via `getFile`/`download`, e entrega respostas com `sendMessage/sendPhoto/sendVideo/sendAudio/sendDocument`. Suporta long-poll ou webhook via `webhookCallback`.
- **Proxy:** o `channels.telegram.proxy` opcional usa `undici.ProxyAgent` por meio do `client.baseFetch` do grammY.
- **Suporte a webhook:** `webhook-set.ts` envolve `setWebhook/deleteWebhook`; `webhook.ts` hospeda o callback com health + desligamento gracioso. O Gateway habilita o modo webhook quando `channels.telegram.webhookUrl` + `channels.telegram.webhookSecret` estao definidos (caso contrario, usa long-poll).
- **Sessoes:** chats diretos colapsam na sessao principal do agente (`agent:<agentId>:<mainKey>`); grupos usam `agent:<agentId>:telegram:group:<chatId>`; as respostas retornam para o mesmo canal.
- **Controles de configuracao:** `channels.telegram.botToken`, `channels.telegram.dmPolicy`, `channels.telegram.groups` (padroes de lista de permissoes + mencao), `channels.telegram.allowFrom`, `channels.telegram.groupAllowFrom`, `channels.telegram.groupPolicy`, `channels.telegram.mediaMaxMb`, `channels.telegram.linkPreview`, `channels.telegram.proxy`, `channels.telegram.webhookSecret`, `channels.telegram.webhookUrl`.
- **Streaming de rascunho:** o `channels.telegram.streamMode` opcional usa `sendMessageDraft` em chats de topico privado (Bot API 9.3+). Isso e separado do streaming de blocos de canal.
- **Testes:** mocks do grammY cobrem gating por mencao em DM + grupo e envio de saida; mais fixtures de midia/webhook ainda sao bem-vindos.

Perguntas em aberto

- Plugins opcionais do grammY (limitador) se atingirmos 429 da Bot API.
- Adicionar mais testes estruturados de midia (figurinhas, notas de voz).
- Tornar a porta de escuta do webhook configuravel (atualmente fixa em 8787, a menos que seja conectada via gateway).
