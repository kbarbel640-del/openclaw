---
summary: "Arquitetura do gateway WebSocket, componentes e fluxos de clientes"
read_when:
  - Trabalhando no protocolo do gateway, clientes ou transportes
title: "Arquitetura do Gateway"
x-i18n:
  source_path: concepts/architecture.md
  source_hash: c636d5d8a5e62806
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:53Z
---

# Arquitetura do Gateway

Última atualização: 2026-01-22

## Visão geral

- Um único **Gateway** de longa duração é dono de todas as superfícies de mensagens (WhatsApp via
  Baileys, Telegram via grammY, Slack, Discord, Signal, iMessage, WebChat).
- Clientes do plano de controle (app macOS, CLI, UI web, automações) se conectam ao
  Gateway via **WebSocket** no host de bind configurado (padrão
  `127.0.0.1:18789`).
- **Nodes** (macOS/iOS/Android/headless) também se conectam via **WebSocket**, mas
  declaram `role: node` com caps/comandos explícitos.
- Um Gateway por host; é o único local que abre uma sessão do WhatsApp.
- Um **host de canvas** (padrão `18793`) serve HTML editável por agentes e A2UI.

## Componentes e fluxos

### Gateway (daemon)

- Mantém conexões com provedores.
- Expõe uma API WS tipada (requisições, respostas, eventos de push do servidor).
- Valida frames de entrada contra JSON Schema.
- Emite eventos como `agent`, `chat`, `presence`, `health`, `heartbeat`, `cron`.

### Clientes (app mac / CLI / admin web)

- Uma conexão WS por cliente.
- Enviam requisições (`health`, `status`, `send`, `agent`, `system-presence`).
- Assinam eventos (`tick`, `agent`, `presence`, `shutdown`).

### Nodes (macOS / iOS / Android / headless)

- Conectam ao **mesmo servidor WS** com `role: node`.
- Fornecem uma identidade de dispositivo em `connect`; o pareamento é **baseado em dispositivo** (papel `node`) e
  a aprovação fica na store de pareamento de dispositivos.
- Expõem comandos como `canvas.*`, `camera.*`, `screen.record`, `location.get`.

Detalhes do protocolo:

- [Protocolo do Gateway](/gateway/protocol)

### WebChat

- UI estática que usa a API WS do Gateway para histórico de chat e envios.
- Em configurações remotas, conecta pelo mesmo túnel SSH/Tailscale que outros
  clientes.

## Ciclo de vida da conexão (cliente único)

```
Client                    Gateway
  |                          |
  |---- req:connect -------->|
  |<------ res (ok) ---------|   (or res error + close)
  |   (payload=hello-ok carries snapshot: presence + health)
  |                          |
  |<------ event:presence ---|
  |<------ event:tick -------|
  |                          |
  |------- req:agent ------->|
  |<------ res:agent --------|   (ack: {runId,status:"accepted"})
  |<------ event:agent ------|   (streaming)
  |<------ res:agent --------|   (final: {runId,status,summary})
  |                          |
```

## Protocolo de wire (resumo)

- Transporte: WebSocket, frames de texto com payloads JSON.
- O primeiro frame **deve** ser `connect`.
- Após o handshake:
  - Requisições: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - Eventos: `{type:"event", event, payload, seq?, stateVersion?}`
- Se `OPENCLAW_GATEWAY_TOKEN` (ou `--token`) estiver definido, `connect.params.auth.token`
  deve corresponder ou o socket é fechado.
- Chaves de idempotência são obrigatórias para métodos com efeitos colaterais (`send`, `agent`) para
  permitir retry seguro; o servidor mantém um cache de deduplicação de curta duração.
- Nodes devem incluir `role: "node"` mais caps/comandos/permissões em `connect`.

## Pareamento + confiança local

- Todos os clientes WS (operadores + nodes) incluem uma **identidade de dispositivo** em `connect`.
- Novos IDs de dispositivo exigem aprovação de pareamento; o Gateway emite um **token de dispositivo**
  para conexões subsequentes.
- Conexões **locais** (loopback ou o próprio endereço tailnet do host do gateway) podem ser
  autoaprovadas para manter uma UX fluida no mesmo host.
- Conexões **não locais** devem assinar o nonce `connect.challenge` e exigem
  aprovação explícita.
- A autenticação do Gateway (`gateway.auth.*`) ainda se aplica a **todas** as conexões, locais ou
  remotas.

Detalhes: [Protocolo do Gateway](/gateway/protocol), [Pareamento](/start/pairing),
[Segurança](/gateway/security).

## Tipagem de protocolo e codegen

- Schemas TypeBox definem o protocolo.
- JSON Schema é gerado a partir desses schemas.
- Modelos Swift são gerados a partir do JSON Schema.

## Acesso remoto

- Preferencial: Tailscale ou VPN.
- Alternativa: túnel SSH
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- O mesmo handshake + token de autenticação se aplicam pelo túnel.
- TLS + pinning opcional podem ser habilitados para WS em configurações remotas.

## Snapshot operacional

- Início: `openclaw gateway` (foreground, logs em stdout).
- Saúde: `health` via WS (também incluído em `hello-ok`).
- Supervisão: launchd/systemd para reinício automático.

## Invariantes

- Exatamente um Gateway controla uma única sessão Baileys por host.
- Handshake é obrigatório; qualquer primeiro frame que não seja JSON ou não seja connect resulta em fechamento imediato.
- Eventos não são reproduzidos; clientes devem atualizar ao detectar lacunas.
