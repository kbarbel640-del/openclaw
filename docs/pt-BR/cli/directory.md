---
summary: "Referencia da CLI para `openclaw directory` (self, peers, grupos)"
read_when:
  - Voce quer consultar ids de contatos/grupos/self para um canal
  - Voce esta desenvolvendo um adaptador de diretorio de canais
title: "diretorio"
x-i18n:
  source_path: cli/directory.md
  source_hash: 7c878d9013aeaa22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:36Z
---

# `openclaw directory`

Consultas de diretorio para canais que oferecem suporte (contatos/peers, grupos e “me”).

## Flags comuns

- `--channel <name>`: id/alias do canal (obrigatorio quando varios canais estao configurados; automatico quando apenas um esta configurado)
- `--account <id>`: id da conta (padrao: padrao do canal)
- `--json`: saida em JSON

## Notas

- `directory` serve para ajudar voce a encontrar IDs que podem ser colados em outros comandos (especialmente `openclaw message send --target ...`).
- Para muitos canais, os resultados sao baseados em configuracao (listas de permissao / grupos configurados), em vez de um diretorio vivo do provedor.
- A saida padrao e `id` (e as vezes `name`) separados por uma tabulacao; use `--json` para scripts.

## Usando resultados com `message send`

```bash
openclaw directory peers list --channel slack --query "U0"
openclaw message send --channel slack --target user:U012ABCDEF --message "hello"
```

## Formatos de ID (por canal)

- WhatsApp: `+15551234567` (DM), `1234567890-1234567890@g.us` (grupo)
- Telegram: `@username` ou id numerico de chat; grupos sao ids numericos
- Slack: `user:U…` e `channel:C…`
- Discord: `user:<id>` e `channel:<id>`
- Matrix (plugin): `user:@user:server`, `room:!roomId:server` ou `#alias:server`
- Microsoft Teams (plugin): `user:<id>` e `conversation:<id>`
- Zalo (plugin): id de usuario (Bot API)
- Zalo Personal / `zalouser` (plugin): id de thread (DM/grupo) de `zca` (`me`, `friend list`, `group list`)

## Self (“me”)

```bash
openclaw directory self --channel zalouser
```

## Peers (contatos/usuarios)

```bash
openclaw directory peers list --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory peers list --channel zalouser --limit 50
```

## Grupos

```bash
openclaw directory groups list --channel zalouser
openclaw directory groups list --channel zalouser --query "work"
openclaw directory groups members --channel zalouser --group-id <id>
```
