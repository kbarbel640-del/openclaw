---
summary: "Pareamento de nós de propriedade do Gateway (Opção B) para iOS e outros nós remotos"
read_when:
  - Implementando aprovações de pareamento de nós sem UI do macOS
  - Adicionando fluxos de CLI para aprovar nós remotos
  - Estendendo o protocolo do gateway com gerenciamento de nós
title: "Pareamento de Propriedade do Gateway"
x-i18n:
  source_path: gateway/pairing.md
  source_hash: 1f5154292a75ea2c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:20Z
---

# Pareamento de propriedade do Gateway (Opção B)

No pareamento de propriedade do Gateway, o **Gateway** é a fonte da verdade sobre quais nós
têm permissão para entrar. As UIs (app macOS, clientes futuros) são apenas frontends que
aprovam ou rejeitam solicitações pendentes.

**Importante:** nós WS usam **pareamento de dispositivo** (papel `node`) durante `connect`.
`node.pair.*` é um armazenamento de pareamento separado e **não** controla o handshake WS.
Apenas clientes que chamam explicitamente `node.pair.*` usam este fluxo.

## Conceitos

- **Solicitação pendente**: um nó solicitou entrada; requer aprovação.
- **Nó pareado**: nó aprovado com um token de autenticação emitido.
- **Transporte**: o endpoint WS do Gateway encaminha solicitações, mas não decide
  a associação. (Suporte legado ao bridge TCP está depreciado/removido.)

## Como o pareamento funciona

1. Um nó se conecta ao WS do Gateway e solicita pareamento.
2. O Gateway armazena uma **solicitação pendente** e emite `node.pair.requested`.
3. Você aprova ou rejeita a solicitação (CLI ou UI).
4. Após a aprovação, o Gateway emite um **novo token** (tokens são rotacionados em um novo pareamento).
5. O nó se reconecta usando o token e agora está “pareado”.

Solicitações pendentes expiram automaticamente após **5 minutos**.

## Fluxo de CLI (amigável para headless)

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes reject <requestId>
openclaw nodes status
openclaw nodes rename --node <id|name|ip> --name "Living Room iPad"
```

`nodes status` mostra nós pareados/conectados e suas capacidades.

## Superfície de API (protocolo do gateway)

Eventos:

- `node.pair.requested` — emitido quando uma nova solicitação pendente é criada.
- `node.pair.resolved` — emitido quando uma solicitação é aprovada/rejeitada/expirada.

Métodos:

- `node.pair.request` — cria ou reutiliza uma solicitação pendente.
- `node.pair.list` — lista nós pendentes + pareados.
- `node.pair.approve` — aprova uma solicitação pendente (emite token).
- `node.pair.reject` — rejeita uma solicitação pendente.
- `node.pair.verify` — verifica `{ nodeId, token }`.

Notas:

- `node.pair.request` é idempotente por nó: chamadas repetidas retornam a mesma
  solicitação pendente.
- A aprovação **sempre** gera um token novo; nenhum token é retornado por
  `node.pair.request`.
- As solicitações podem incluir `silent: true` como dica para fluxos de autoaprovação.

## Autoaprovação (app macOS)

O app macOS pode, opcionalmente, tentar uma **aprovação silenciosa** quando:

- a solicitação está marcada como `silent`, e
- o app consegue verificar uma conexão SSH com o host do gateway usando o mesmo usuário.

Se a aprovação silenciosa falhar, ele volta ao prompt normal de “Aprovar/Rejeitar”.

## Armazenamento (local, privado)

O estado de pareamento é armazenado no diretório de estado do Gateway (padrão `~/.openclaw`):

- `~/.openclaw/nodes/paired.json`
- `~/.openclaw/nodes/pending.json`

Se você sobrescrever `OPENCLAW_STATE_DIR`, a pasta `nodes/` é movida junto com ele.

Notas de segurança:

- Tokens são segredos; trate `paired.json` como sensível.
- Rotacionar um token requer nova aprovação (ou a exclusão da entrada do nó).

## Comportamento do transporte

- O transporte é **stateless**; ele não armazena associação.
- Se o Gateway estiver offline ou o pareamento estiver desabilitado, os nós não podem parear.
- Se o Gateway estiver em modo remoto, o pareamento ainda acontece contra o armazenamento do Gateway remoto.
