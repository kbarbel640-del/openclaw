---
summary: "Protocolo WebSocket do Gateway: handshake, frames, versionamento"
read_when:
  - Implementando ou atualizando clientes WS do gateway
  - Depurando incompatibilidades de protocolo ou falhas de conexao
  - Regenerando esquemas/modelos de protocolo
title: "Protocolo do Gateway"
x-i18n:
  source_path: gateway/protocol.md
  source_hash: bdafac40d5356590
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:30Z
---

# Protocolo do Gateway (WebSocket)

O protocolo WS do Gateway e o **plano de controle unico + transporte de nos** do
OpenClaw. Todos os clientes (CLI, UI web, app macOS, nos iOS/Android, nos
headless) se conectam via WebSocket e declaram seu **papel** + **escopo** no
momento do handshake.

## Transporte

- WebSocket, frames de texto com payloads JSON.
- O primeiro frame **deve** ser uma requisicao `connect`.

## Handshake (conexao)

Gateway → Cliente (desafio pre-conexao):

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": { "nonce": "…", "ts": 1737264000000 }
}
```

Cliente → Gateway:

```json
{
  "type": "req",
  "id": "…",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "cli",
      "version": "1.2.3",
      "platform": "macos",
      "mode": "operator"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "caps": [],
    "commands": [],
    "permissions": {},
    "auth": { "token": "…" },
    "locale": "en-US",
    "userAgent": "openclaw-cli/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "…",
      "signature": "…",
      "signedAt": 1737264000000,
      "nonce": "…"
    }
  }
}
```

Gateway → Cliente:

```json
{
  "type": "res",
  "id": "…",
  "ok": true,
  "payload": { "type": "hello-ok", "protocol": 3, "policy": { "tickIntervalMs": 15000 } }
}
```

Quando um token de dispositivo e emitido, `hello-ok` tambem inclui:

```json
{
  "auth": {
    "deviceToken": "…",
    "role": "operator",
    "scopes": ["operator.read", "operator.write"]
  }
}
```

### Exemplo de node

```json
{
  "type": "req",
  "id": "…",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "ios-node",
      "version": "1.2.3",
      "platform": "ios",
      "mode": "node"
    },
    "role": "node",
    "scopes": [],
    "caps": ["camera", "canvas", "screen", "location", "voice"],
    "commands": ["camera.snap", "canvas.navigate", "screen.record", "location.get"],
    "permissions": { "camera.capture": true, "screen.record": false },
    "auth": { "token": "…" },
    "locale": "en-US",
    "userAgent": "openclaw-ios/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "…",
      "signature": "…",
      "signedAt": 1737264000000,
      "nonce": "…"
    }
  }
}
```

## Enquadramento (Framing)

- **Requisicao**: `{type:"req", id, method, params}`
- **Resposta**: `{type:"res", id, ok, payload|error}`
- **Evento**: `{type:"event", event, payload, seq?, stateVersion?}`

Metodos com efeitos colaterais exigem **chaves de idempotencia** (veja o schema).

## Papeis + escopos

### Papeis

- `operator` = cliente do plano de controle (CLI/UI/automacao).
- `node` = host de capacidades (camera/tela/canvas/system.run).

### Escopos (operador)

Escopos comuns:

- `operator.read`
- `operator.write`
- `operator.admin`
- `operator.approvals`
- `operator.pairing`

### Caps/comandos/permissoes (node)

Nodes declaram reivindicacoes de capacidade no momento da conexao:

- `caps`: categorias de capacidades de alto nivel.
- `commands`: allowlist de comandos para invocacao.
- `permissions`: alternancias granulares (por exemplo, `screen.record`, `camera.capture`).

O Gateway trata isso como **claims** e aplica allowlists no lado do servidor.

## Presenca

- `system-presence` retorna entradas indexadas pela identidade do dispositivo.
- As entradas de presenca incluem `deviceId`, `roles` e `scopes` para que as UIs possam mostrar uma unica linha por dispositivo
  mesmo quando ele se conecta como **operador** e **node**.

### Metodos auxiliares de node

- Nodes podem chamar `skills.bins` para buscar a lista atual de executaveis de Skills
  para verificacoes de auto-allow.

## Aprovacoes de exec

- Quando uma solicitacao de exec precisa de aprovacao, o gateway transmite `exec.approval.requested`.
- Clientes operadores resolvem chamando `exec.approval.resolve` (requer o escopo `operator.approvals`).

## Versionamento

- `PROTOCOL_VERSION` vive em `src/gateway/protocol/schema.ts`.
- Clientes enviam `minProtocol` + `maxProtocol`; o servidor rejeita incompatibilidades.
- Schemas + modelos sao gerados a partir de definicoes TypeBox:
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`
  - `pnpm protocol:check`

## Autenticacao

- Se `OPENCLAW_GATEWAY_TOKEN` (ou `--token`) estiver definido, `connect.params.auth.token`
  deve corresponder ou o socket e fechado.
- Apos o pareamento, o Gateway emite um **token de dispositivo** com escopo para o papel + escopos da conexao. Ele e retornado em `hello-ok.auth.deviceToken` e deve ser
  persistido pelo cliente para conexoes futuras.
- Tokens de dispositivo podem ser rotacionados/revogados via `device.token.rotate` e
  `device.token.revoke` (requer o escopo `operator.pairing`).

## Identidade do dispositivo + pareamento

- Nodes devem incluir uma identidade de dispositivo estavel (`device.id`) derivada de uma
  impressao digital de par de chaves.
- Gateways emitem tokens por dispositivo + papel.
- Aprovacoes de pareamento sao exigidas para novos IDs de dispositivo, a menos que a autoaprovacao local esteja habilitada.
- Conexoes **locais** incluem loopback e o endereco tailnet do proprio host do gateway
  (assim, vinculacoes tailnet no mesmo host ainda podem autoaprovar).
- Todos os clientes WS devem incluir a identidade `device` durante `connect` (operador + node).
  A UI de controle pode omiti-la **apenas** quando `gateway.controlUi.allowInsecureAuth` estiver habilitado
  (ou `gateway.controlUi.dangerouslyDisableDeviceAuth` para uso de emergencia).
- Conexoes nao locais devem assinar o nonce `connect.challenge` fornecido pelo servidor.

## TLS + pinning

- TLS e suportado para conexoes WS.
- Clientes podem opcionalmente fazer pin do fingerprint do certificado do gateway (veja a configuracao `gateway.tls`
  mais `gateway.remote.tlsFingerprint` ou o CLI `--tls-fingerprint`).

## Escopo

Este protocolo expõe a **API completa do gateway** (status, canais, modelos, chat,
agente, sessoes, nodes, aprovacoes, etc.). A superficie exata e definida pelos schemas TypeBox em `src/gateway/protocol/schema.ts`.
