---
summary: "Ingress de webhook para despertar e execucoes isoladas de agentes"
read_when:
  - Adicionando ou alterando endpoints de webhook
  - Conectando sistemas externos ao OpenClaw
title: "Webhooks"
x-i18n:
  source_path: automation/webhook.md
  source_hash: f26b88864567be82
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:16Z
---

# Webhooks

O Gateway pode expor um pequeno endpoint de webhook HTTP para gatilhos externos.

## Ativar

```json5
{
  hooks: {
    enabled: true,
    token: "shared-secret",
    path: "/hooks",
  },
}
```

Notas:

- `hooks.token` e necessario quando `hooks.enabled=true`.
- `hooks.path` tem como padrao `/hooks`.

## Autenticacao

Toda requisicao deve incluir o token do hook. Prefira cabecalhos:

- `Authorization: Bearer <token>` (recomendado)
- `x-openclaw-token: <token>`
- `?token=<token>` (obsoleto; registra um aviso e sera removido em uma futura versao principal)

## Endpoints

### `POST /hooks/wake`

Payload:

```json
{ "text": "System line", "mode": "now" }
```

- `text` **obrigatorio** (string): A descricao do evento (por exemplo, "Novo email recebido").
- `mode` opcional (`now` | `next-heartbeat`): Se deve acionar um heartbeat imediato (padrao `now`) ou aguardar a proxima verificacao periodica.

Efeito:

- Enfileira um evento de sistema para a sessao **principal**
- Se `mode=now`, aciona um heartbeat imediato

### `POST /hooks/agent`

Payload:

```json
{
  "message": "Run this",
  "name": "Email",
  "sessionKey": "hook:email:msg-123",
  "wakeMode": "now",
  "deliver": true,
  "channel": "last",
  "to": "+15551234567",
  "model": "openai/gpt-5.2-mini",
  "thinking": "low",
  "timeoutSeconds": 120
}
```

- `message` **obrigatorio** (string): O prompt ou mensagem para o agente processar.
- `name` opcional (string): Nome legivel para humanos do hook (por exemplo, "GitHub"), usado como prefixo nos resumos da sessao.
- `sessionKey` opcional (string): A chave usada para identificar a sessao do agente. O padrao e um `hook:<uuid>` aleatorio. Usar uma chave consistente permite uma conversa de varios turnos dentro do contexto do hook.
- `wakeMode` opcional (`now` | `next-heartbeat`): Se deve acionar um heartbeat imediato (padrao `now`) ou aguardar a proxima verificacao periodica.
- `deliver` opcional (boolean): Se `true`, a resposta do agente sera enviada para o canal de mensagens. O padrao e `true`. Respostas que sao apenas confirmacoes de heartbeat sao automaticamente ignoradas.
- `channel` opcional (string): O canal de mensagens para entrega. Um de: `last`, `whatsapp`, `telegram`, `discord`, `slack`, `mattermost` (plugin), `signal`, `imessage`, `msteams`. O padrao e `last`.
- `to` opcional (string): O identificador do destinatario para o canal (por exemplo, numero de telefone para WhatsApp/Signal, ID de chat para Telegram, ID de canal para Discord/Slack/Mattermost (plugin), ID de conversa para MS Teams). O padrao e o ultimo destinatario na sessao principal.
- `model` opcional (string): Sobrescrita de modelo (por exemplo, `anthropic/claude-3-5-sonnet` ou um alias). Deve estar na lista de modelos permitidos se houver restricao.
- `thinking` opcional (string): Sobrescrita do nivel de raciocinio (por exemplo, `low`, `medium`, `high`).
- `timeoutSeconds` opcional (number): Duracao maxima da execucao do agente em segundos.

Efeito:

- Executa um turno de agente **isolado** (chave de sessao propria)
- Sempre publica um resumo na sessao **principal**
- Se `wakeMode=now`, aciona um heartbeat imediato

### `POST /hooks/<name>` (mapeado)

Nomes de hooks personalizados sao resolvidos via `hooks.mappings` (veja a configuracao). Um mapeamento pode
transformar payloads arbitrarios em acoes `wake` ou `agent`, com templates opcionais ou
transformacoes de codigo.

Opcoes de mapeamento (resumo):

- `hooks.presets: ["gmail"]` habilita o mapeamento integrado do Gmail.
- `hooks.mappings` permite definir `match`, `action` e templates na configuracao.
- `hooks.transformsDir` + `transform.module` carrega um modulo JS/TS para logica personalizada.
- Use `match.source` para manter um endpoint de ingestao generico (roteamento orientado por payload).
- Transformacoes TS exigem um carregador TS (por exemplo, `bun` ou `tsx`) ou `.js` precompilado em tempo de execucao.
- Defina `deliver: true` + `channel`/`to` nos mapeamentos para rotear respostas para uma superficie de chat
  (`channel` tem como padrao `last` e faz fallback para WhatsApp).
- `allowUnsafeExternalContent: true` desativa o wrapper externo de seguranca de conteudo para aquele hook
  (perigoso; apenas para fontes internas confiaveis).
- `openclaw webhooks gmail setup` grava configuracao `hooks.gmail` para `openclaw webhooks gmail run`.
  Veja [Gmail Pub/Sub](/automation/gmail-pubsub) para o fluxo completo de watch do Gmail.

## Respostas

- `200` para `/hooks/wake`
- `202` para `/hooks/agent` (execucao assincrona iniciada)
- `401` em falha de autenticacao
- `400` em payload invalido
- `413` em payloads grandes demais

## Exemplos

```bash
curl -X POST http://127.0.0.1:18789/hooks/wake \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"text":"New email received","mode":"now"}'
```

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","wakeMode":"next-heartbeat"}'
```

### Usar um modelo diferente

Adicione `model` ao payload do agente (ou ao mapeamento) para sobrescrever o modelo para aquela execucao:

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","model":"openai/gpt-5.2-mini"}'
```

Se voce impuser `agents.defaults.models`, certifique-se de que o modelo de sobrescrita esteja incluido la.

```bash
curl -X POST http://127.0.0.1:18789/hooks/gmail \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"source":"gmail","messages":[{"from":"Ada","subject":"Hello","snippet":"Hi"}]}'
```

## Seguranca

- Mantenha endpoints de hook atras de loopback, tailnet ou proxy reverso confiavel.
- Use um token de hook dedicado; nao reutilize tokens de autenticacao do gateway.
- Evite incluir payloads brutos sensiveis nos logs de webhook.
- Payloads de hook sao tratados como nao confiaveis e encapsulados com limites de seguranca por padrao.
  Se voce precisar desativar isso para um hook especifico, defina `allowUnsafeExternalContent: true`
  no mapeamento desse hook (perigoso).
