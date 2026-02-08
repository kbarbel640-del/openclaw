---
summary: "Referencia da CLI para `openclaw devices` (emparelhamento de dispositivos + rotacao/revogacao de tokens)"
read_when:
  - Voce esta aprovando solicitacoes de emparelhamento de dispositivos
  - Voce precisa rotacionar ou revogar tokens de dispositivos
title: "dispositivos"
x-i18n:
  source_path: cli/devices.md
  source_hash: ac7d130ecdc5d429
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:35Z
---

# `openclaw devices`

Gerencie solicitacoes de emparelhamento de dispositivos e tokens com escopo de dispositivo.

## Commands

### `openclaw devices list`

Liste solicitacoes de emparelhamento pendentes e dispositivos emparelhados.

```
openclaw devices list
openclaw devices list --json
```

### `openclaw devices approve <requestId>`

Aprove uma solicitacao de emparelhamento de dispositivo pendente.

```
openclaw devices approve <requestId>
```

### `openclaw devices reject <requestId>`

Rejeite uma solicitacao de emparelhamento de dispositivo pendente.

```
openclaw devices reject <requestId>
```

### `openclaw devices rotate --device <id> --role <role> [--scope <scope...>]`

Rotacione um token de dispositivo para uma funcao especifica (opcionalmente atualizando escopos).

```
openclaw devices rotate --device <deviceId> --role operator --scope operator.read --scope operator.write
```

### `openclaw devices revoke --device <id> --role <role>`

Revogue um token de dispositivo para uma funcao especifica.

```
openclaw devices revoke --device <deviceId> --role node
```

## Common options

- `--url <url>`: URL do WebSocket do Gateway (padrao para `gateway.remote.url` quando configurado).
- `--token <token>`: Token do Gateway (se necessario).
- `--password <password>`: Senha do Gateway (autenticacao por senha).
- `--timeout <ms>`: Tempo limite de RPC.
- `--json`: Saida JSON (recomendado para scripts).

Nota: quando voce define `--url`, a CLI nao recorre a credenciais de configuracao ou de ambiente.
Passe `--token` ou `--password` explicitamente. A ausencia de credenciais explicitas e um erro.

## Notes

- A rotacao de token retorna um novo token (sensivel). Trate-o como um segredo.
- Esses comandos exigem o escopo `operator.pairing` (ou `operator.admin`).
