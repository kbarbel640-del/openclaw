---
summary: "Invoque uma unica ferramenta diretamente pelo endpoint HTTP do Gateway"
read_when:
  - Chamar ferramentas sem executar um turno completo do agente
  - Construir automacoes que precisam de aplicacao de politicas de ferramentas
title: "API de Invocacao de Ferramentas"
x-i18n:
  source_path: gateway/tools-invoke-http-api.md
  source_hash: 17ccfbe0b0d9bb61
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:25Z
---

# Tools Invoke (HTTP)

O Gateway do OpenClaw expõe um endpoint HTTP simples para invocar uma unica ferramenta diretamente. Ele esta sempre habilitado, mas protegido pela autenticacao do Gateway e pela politica de ferramentas.

- `POST /tools/invoke`
- Mesma porta do Gateway (multiplexacao WS + HTTP): `http://<gateway-host>:<port>/tools/invoke`

O tamanho maximo padrao do payload e de 2 MB.

## Authentication

Usa a configuracao de autenticacao do Gateway. Envie um token bearer:

- `Authorization: Bearer <token>`

Notas:

- Quando `gateway.auth.mode="token"`, use `gateway.auth.token` (ou `OPENCLAW_GATEWAY_TOKEN`).
- Quando `gateway.auth.mode="password"`, use `gateway.auth.password` (ou `OPENCLAW_GATEWAY_PASSWORD`).

## Request body

```json
{
  "tool": "sessions_list",
  "action": "json",
  "args": {},
  "sessionKey": "main",
  "dryRun": false
}
```

Campos:

- `tool` (string, obrigatorio): nome da ferramenta a ser invocada.
- `action` (string, opcional): mapeado para args se o esquema da ferramenta suportar `action` e o payload de args o omitir.
- `args` (object, opcional): argumentos especificos da ferramenta.
- `sessionKey` (string, opcional): chave de sessao de destino. Se omitida ou `"main"`, o Gateway usa a chave de sessao principal configurada (respeita `session.mainKey` e o agente padrao, ou `global` no escopo global).
- `dryRun` (boolean, opcional): reservado para uso futuro; atualmente ignorado.

## Policy + routing behavior

A disponibilidade da ferramenta e filtrada pela mesma cadeia de politicas usada pelos agentes do Gateway:

- `tools.profile` / `tools.byProvider.profile`
- `tools.allow` / `tools.byProvider.allow`
- `agents.<id>.tools.allow` / `agents.<id>.tools.byProvider.allow`
- politicas de grupo (se a chave de sessao mapear para um grupo ou canal)
- politica de subagente (ao invocar com uma chave de sessao de subagente)

Se uma ferramenta nao for permitida pela politica, o endpoint retorna **404**.

Para ajudar as politicas de grupo a resolver o contexto, voce pode opcionalmente definir:

- `x-openclaw-message-channel: <channel>` (exemplo: `slack`, `telegram`)
- `x-openclaw-account-id: <accountId>` (quando existem varias contas)

## Responses

- `200` → `{ ok: true, result }`
- `400` → `{ ok: false, error: { type, message } }` (requisicao invalida ou erro da ferramenta)
- `401` → nao autorizado
- `404` → ferramenta nao disponivel (nao encontrada ou nao permitida)
- `405` → metodo nao permitido

## Example

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "sessions_list",
    "action": "json",
    "args": {}
  }'
```
