---
summary: "Referencia da CLI para `openclaw channels` (contas, status, login/logout, logs)"
read_when:
  - Voce quer adicionar/remover contas de canal (WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost (plugin)/Signal/iMessage)
  - Voce quer verificar o status do canal ou acompanhar logs do canal
title: "canais"
x-i18n:
  source_path: cli/channels.md
  source_hash: 16ab1642f247bfa9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:32Z
---

# `openclaw channels`

Gerencie contas de canais de chat e seu status de execucao no Gateway.

Documentacao relacionada:

- Guias de canais: [Channels](/channels/index)
- Configuracao do Gateway: [Configuration](/gateway/configuration)

## Comandos comuns

```bash
openclaw channels list
openclaw channels status
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels logs --channel all
```

## Adicionar / remover contas

```bash
openclaw channels add --channel telegram --token <bot-token>
openclaw channels remove --channel telegram --delete
```

Dica: `openclaw channels add --help` mostra flags por canal (token, app token, caminhos do signal-cli, etc).

## Login / logout (interativo)

```bash
openclaw channels login --channel whatsapp
openclaw channels logout --channel whatsapp
```

## Solucao de problemas

- Execute `openclaw status --deep` para uma verificacao ampla.
- Use `openclaw doctor` para correcoes guiadas.
- `openclaw channels list` imprime `Claude: HTTP 403 ... user:profile` → o snapshot de uso precisa do escopo `user:profile`. Use `--no-usage`, ou forneca uma chave de sessao claude.ai (`CLAUDE_WEB_SESSION_KEY` / `CLAUDE_WEB_COOKIE`), ou reautentique via Claude Code CLI.

## Sonda de capacidades

Busque indicacoes de capacidades do provedor (intents/escopos quando disponiveis) alem do suporte estatico de recursos:

```bash
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
```

Observacoes:

- `--channel` e opcional; omita para listar todos os canais (incluindo extensoes).
- `--target` aceita `channel:<id>` ou um id numerico bruto do canal e so se aplica ao Discord.
- As sondas sao especificas do provedor: intents do Discord + permissoes opcionais de canal; escopos de bot + usuario do Slack; flags de bot + webhook do Telegram; versao do daemon do Signal; token do app do MS Teams + funcoes/escopos do Graph (anotados quando conhecidos). Canais sem sondas informam `Probe: unavailable`.

## Resolver nomes para IDs

Resolva nomes de canais/usuarios para IDs usando o diretorio do provedor:

```bash
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels resolve --channel discord "My Server/#support" "@someone"
openclaw channels resolve --channel matrix "Project Room"
```

Observacoes:

- Use `--kind user|group|auto` para forcar o tipo de destino.
- A resolucao prioriza correspondencias ativas quando multiplas entradas compartilham o mesmo nome.
