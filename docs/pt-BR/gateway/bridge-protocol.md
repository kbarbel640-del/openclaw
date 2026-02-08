---
summary: "Protocolo de bridge (nós legados): TCP JSONL, pareamento, RPC com escopo"
read_when:
  - Construindo ou depurando clientes de nó (modo nó iOS/Android/macOS)
  - Investigando falhas de pareamento ou de autenticação do bridge
  - Auditando a superfície de nó exposta pelo gateway
title: "Protocolo de Bridge"
x-i18n:
  source_path: gateway/bridge-protocol.md
  source_hash: 789bcf3cbc6841fc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:15Z
---

# Protocolo de bridge (transporte de nó legado)

O protocolo de Bridge é um transporte de nó **legado** (TCP JSONL). Novos clientes de nó
devem usar o protocolo WebSocket unificado do Gateway.

Se voce estiver construindo um operador ou cliente de nó, use o
[protocolo do Gateway](/gateway/protocol).

**Nota:** As builds atuais do OpenClaw não incluem mais o listener TCP do bridge; este documento é mantido apenas para referência histórica.
As chaves de configuracao legadas `bridge.*` não fazem mais parte do esquema de configuracao.

## Por que temos ambos

- **Limite de segurança**: o bridge expõe uma pequena allowlist em vez de toda a
  superfície da API do gateway.
- **Pareamento + identidade do nó**: a admissão de nós é controlada pelo gateway e vinculada
  a um token por nó.
- **UX de descoberta**: nós podem descobrir gateways via Bonjour na LAN ou conectar
  diretamente por um tailnet.
- **WS em loopback**: todo o plano de controle WS permanece local, a menos que seja tunelado via SSH.

## Transporte

- TCP, um objeto JSON por linha (JSONL).
- TLS opcional (quando `bridge.tls.enabled` é true).
- A porta padrão legada do listener era `18790` (as builds atuais não iniciam um bridge TCP).

Quando o TLS está habilitado, os registros TXT de descoberta incluem `bridgeTls=1` mais
`bridgeTlsSha256` para que os nós possam fixar o certificado.

## Handshake + pareamento

1. O cliente envia `hello` com metadados do nó + token (se já estiver pareado).
2. Se não estiver pareado, o gateway responde `error` (`NOT_PAIRED`/`UNAUTHORIZED`).
3. O cliente envia `pair-request`.
4. O gateway aguarda aprovação e então envia `pair-ok` e `hello-ok`.

`hello-ok` retorna `serverName` e pode incluir `canvasHostUrl`.

## Frames

Cliente → Gateway:

- `req` / `res`: RPC do gateway com escopo (chat, sessions, config, health, voicewake, skills.bins)
- `event`: sinais do nó (transcrição de voz, solicitação de agente, inscrição em chat, ciclo de vida de exec)

Gateway → Cliente:

- `invoke` / `invoke-res`: comandos do nó (`canvas.*`, `camera.*`, `screen.record`,
  `location.get`, `sms.send`)
- `event`: atualizações de chat para sessoes inscritas
- `ping` / `pong`: keepalive

A aplicacao legada de allowlist vivia em `src/gateway/server-bridge.ts` (removida).

## Eventos do ciclo de vida de Exec

Os nós podem emitir eventos `exec.finished` ou `exec.denied` para expor a atividade de system.run.
Eles são mapeados para eventos de sistema no gateway. (Nós legados ainda podem emitir `exec.started`.)

Campos do payload (todos opcionais, a menos que indicado):

- `sessionKey` (obrigatorio): sessao do agente para receber o evento do sistema.
- `runId`: id de exec unico para agrupamento.
- `command`: string de comando bruta ou formatada.
- `exitCode`, `timedOut`, `success`, `output`: detalhes de conclusao (apenas quando finalizado).
- `reason`: motivo da negacao (apenas quando negado).

## Uso de tailnet

- Vincule o bridge a um IP do tailnet: `bridge.bind: "tailnet"` em
  `~/.openclaw/openclaw.json`.
- Os clientes se conectam via nome MagicDNS ou IP do tailnet.
- O Bonjour **não** atravessa redes; use host/porta manual ou DNS‑SD de area ampla
  quando necessario.

## Versionamento

O bridge atualmente é **v1 implicito** (sem negociacao de min/max). A compatibilidade retroativa
é esperada; adicione um campo de versao do protocolo de bridge antes de quaisquer mudancas incompatíveis.
