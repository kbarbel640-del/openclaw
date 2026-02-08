---
summary: "Status de suporte do Nextcloud Talk, capacidades e configuracao"
read_when:
  - Trabalhando em recursos do canal Nextcloud Talk
title: "Nextcloud Talk"
x-i18n:
  source_path: channels/nextcloud-talk.md
  source_hash: 4062946ebf333903
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:26Z
---

# Nextcloud Talk (plugin)

Status: suportado via plugin (bot de webhook). Mensagens diretas, salas, reacoes e mensagens em markdown sao suportadas.

## Plugin necessario

O Nextcloud Talk e distribuido como um plugin e nao vem incluido na instalacao principal.

Instale via CLI (registro npm):

```bash
openclaw plugins install @openclaw/nextcloud-talk
```

Checkout local (ao executar a partir de um repositorio git):

```bash
openclaw plugins install ./extensions/nextcloud-talk
```

Se voce escolher Nextcloud Talk durante a configuracao/integracao inicial e um checkout git for detectado,
o OpenClaw oferecera automaticamente o caminho de instalacao local.

Detalhes: [Plugins](/plugin)

## Configuracao rapida (iniciante)

1. Instale o plugin do Nextcloud Talk.
2. No seu servidor Nextcloud, crie um bot:
   ```bash
   ./occ talk:bot:install "OpenClaw" "<shared-secret>" "<webhook-url>" --feature reaction
   ```
3. Ative o bot nas configuracoes da sala de destino.
4. Configure o OpenClaw:
   - Config: `channels.nextcloud-talk.baseUrl` + `channels.nextcloud-talk.botSecret`
   - Ou env: `NEXTCLOUD_TALK_BOT_SECRET` (apenas conta padrao)
5. Reinicie o Gateway (ou conclua a integracao inicial).

Configuracao minima:

```json5
{
  channels: {
    "nextcloud-talk": {
      enabled: true,
      baseUrl: "https://cloud.example.com",
      botSecret: "shared-secret",
      dmPolicy: "pairing",
    },
  },
}
```

## Observacoes

- Bots nao podem iniciar Mensagens diretas. O usuario deve enviar mensagem ao bot primeiro.
- A URL do webhook deve ser acessivel pelo Gateway; defina `webhookPublicUrl` se estiver atras de um proxy.
- Uploads de midia nao sao suportados pela API do bot; a midia e enviada como URLs.
- O payload do webhook nao distingue Mensagens diretas vs salas; defina `apiUser` + `apiPassword` para habilitar consultas de tipo de sala (caso contrario, Mensagens diretas sao tratadas como salas).

## Controle de acesso (Mensagens diretas)

- Padrao: `channels.nextcloud-talk.dmPolicy = "pairing"`. Remetentes desconhecidos recebem um codigo de pareamento.
- Aprovar via:
  - `openclaw pairing list nextcloud-talk`
  - `openclaw pairing approve nextcloud-talk <CODE>`
- Mensagens diretas publicas: `channels.nextcloud-talk.dmPolicy="open"` mais `channels.nextcloud-talk.allowFrom=["*"]`.
- `allowFrom` corresponde apenas a IDs de usuarios do Nextcloud; nomes de exibicao sao ignorados.

## Salas (grupos)

- Padrao: `channels.nextcloud-talk.groupPolicy = "allowlist"` (controlado por mencao).
- Permitir salas com `channels.nextcloud-talk.rooms`:

```json5
{
  channels: {
    "nextcloud-talk": {
      rooms: {
        "room-token": { requireMention: true },
      },
    },
  },
}
```

- Para nao permitir nenhuma sala, mantenha a allowlist vazia ou defina `channels.nextcloud-talk.groupPolicy="disabled"`.

## Capacidades

| Recurso           | Status        |
| ----------------- | ------------- |
| Mensagens diretas | Suportado     |
| Salas             | Suportado     |
| Threads           | Nao suportado |
| Midia             | Somente URL   |
| Reacoes           | Suportado     |
| Comandos nativos  | Nao suportado |

## Referencia de configuracao (Nextcloud Talk)

Configuracao completa: [Configuration](/gateway/configuration)

Opcoes do provedor:

- `channels.nextcloud-talk.enabled`: habilitar/desabilitar a inicializacao do canal.
- `channels.nextcloud-talk.baseUrl`: URL da instancia do Nextcloud.
- `channels.nextcloud-talk.botSecret`: segredo compartilhado do bot.
- `channels.nextcloud-talk.botSecretFile`: caminho do arquivo de segredo.
- `channels.nextcloud-talk.apiUser`: usuario da API para consultas de sala (deteccao de Mensagens diretas).
- `channels.nextcloud-talk.apiPassword`: senha da API/app para consultas de sala.
- `channels.nextcloud-talk.apiPasswordFile`: caminho do arquivo de senha da API.
- `channels.nextcloud-talk.webhookPort`: porta do listener de webhook (padrao: 8788).
- `channels.nextcloud-talk.webhookHost`: host do webhook (padrao: 0.0.0.0).
- `channels.nextcloud-talk.webhookPath`: caminho do webhook (padrao: /nextcloud-talk-webhook).
- `channels.nextcloud-talk.webhookPublicUrl`: URL do webhook acessivel externamente.
- `channels.nextcloud-talk.dmPolicy`: `pairing | allowlist | open | disabled`.
- `channels.nextcloud-talk.allowFrom`: allowlist de Mensagens diretas (IDs de usuario). `open` requer `"*"`.
- `channels.nextcloud-talk.groupPolicy`: `allowlist | open | disabled`.
- `channels.nextcloud-talk.groupAllowFrom`: allowlist de grupos (IDs de usuario).
- `channels.nextcloud-talk.rooms`: configuracoes por sala e allowlist.
- `channels.nextcloud-talk.historyLimit`: limite de historico de grupos (0 desabilita).
- `channels.nextcloud-talk.dmHistoryLimit`: limite de historico de Mensagens diretas (0 desabilita).
- `channels.nextcloud-talk.dms`: sobrescritas por Mensagem direta (historyLimit).
- `channels.nextcloud-talk.textChunkLimit`: tamanho do bloco de texto de saida (caracteres).
- `channels.nextcloud-talk.chunkMode`: `length` (padrao) ou `newline` para dividir em linhas em branco (limites de paragrafo) antes do particionamento por comprimento.
- `channels.nextcloud-talk.blockStreaming`: desabilitar block streaming para este canal.
- `channels.nextcloud-talk.blockStreamingCoalesce`: ajuste de agregacao do block streaming.
- `channels.nextcloud-talk.mediaMaxMb`: limite de midia de entrada (MB).
