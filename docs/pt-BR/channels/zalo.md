---
summary: "Status de suporte do bot do Zalo, capacidades e configuracao"
read_when:
  - Trabalhando em recursos ou webhooks do Zalo
title: "Zalo"
x-i18n:
  source_path: channels/zalo.md
  source_hash: 0311d932349f9641
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:35Z
---

# Zalo (Bot API)

Status: experimental. Apenas mensagens diretas; grupos em breve conforme a documentacao do Zalo.

## Plugin necessario

O Zalo e distribuido como um plugin e nao vem incluido na instalacao principal.

- Instale via CLI: `openclaw plugins install @openclaw/zalo`
- Ou selecione **Zalo** durante a integracao inicial e confirme o prompt de instalacao
- Detalhes: [Plugins](/plugin)

## Configuracao rapida (iniciante)

1. Instale o plugin do Zalo:
   - A partir de um checkout do codigo-fonte: `openclaw plugins install ./extensions/zalo`
   - A partir do npm (se publicado): `openclaw plugins install @openclaw/zalo`
   - Ou escolha **Zalo** na integracao inicial e confirme o prompt de instalacao
2. Defina o token:
   - Variavel de ambiente: `ZALO_BOT_TOKEN=...`
   - Ou configuracao: `channels.zalo.botToken: "..."`.
3. Reinicie o Gateway (ou finalize a integracao inicial).
4. O acesso por Mensagem direta usa emparelhamento por padrao; aprove o codigo de emparelhamento no primeiro contato.

Configuracao minima:

```json5
{
  channels: {
    zalo: {
      enabled: true,
      botToken: "12345689:abc-xyz",
      dmPolicy: "pairing",
    },
  },
}
```

## O que e

Zalo e um aplicativo de mensagens focado no Vietna; sua Bot API permite que o Gateway execute um bot para conversas 1:1.
E uma boa opcao para suporte ou notificacoes quando voce quer roteamento deterministico de volta para o Zalo.

- Um canal da Zalo Bot API controlado pelo Gateway.
- Roteamento deterministico: as respostas voltam para o Zalo; o modelo nunca escolhe canais.
- Mensagens diretas compartilham a sessao principal do agente.
- Grupos ainda nao sao suportados (a documentacao do Zalo indica "em breve").

## Configuracao (caminho rapido)

### 1) Criar um token de bot (Zalo Bot Platform)

1. Acesse **https://bot.zaloplatforms.com** e faca login.
2. Crie um novo bot e configure suas opcoes.
3. Copie o token do bot (formato: `12345689:abc-xyz`).

### 2) Configurar o token (variavel de ambiente ou configuracao)

Exemplo:

```json5
{
  channels: {
    zalo: {
      enabled: true,
      botToken: "12345689:abc-xyz",
      dmPolicy: "pairing",
    },
  },
}
```

Opcao via variavel de ambiente: `ZALO_BOT_TOKEN=...` (funciona apenas para a conta padrao).

Suporte a multiplas contas: use `channels.zalo.accounts` com tokens por conta e `name` opcional.

3. Reinicie o Gateway. O Zalo inicia quando um token e resolvido (variavel de ambiente ou configuracao).
4. O acesso por Mensagem direta usa emparelhamento por padrao. Aprove o codigo quando o bot for contatado pela primeira vez.

## Como funciona (comportamento)

- Mensagens de entrada sao normalizadas no envelope de canal compartilhado com placeholders de midia.
- As respostas sempre retornam para o mesmo chat do Zalo.
- Long-polling por padrao; modo webhook disponivel com `channels.zalo.webhookUrl`.

## Limites

- Texto de saida e fragmentado em blocos de 2000 caracteres (limite da API do Zalo).
- Downloads/uploads de midia sao limitados por `channels.zalo.mediaMaxMb` (padrao 5).
- Streaming e bloqueado por padrao devido ao limite de 2000 caracteres tornar o streaming menos util.

## Controle de acesso (Mensagens diretas)

### Acesso por Mensagem direta

- Padrao: `channels.zalo.dmPolicy = "pairing"`. Remetentes desconhecidos recebem um codigo de emparelhamento; mensagens sao ignoradas ate aprovacao (codigos expiram apos 1 hora).
- Aprovar via:
  - `openclaw pairing list zalo`
  - `openclaw pairing approve zalo <CODE>`
- O emparelhamento e a troca de token padrao. Detalhes: [Pairing](/start/pairing)
- `channels.zalo.allowFrom` aceita IDs numericos de usuario (nao ha busca por nome de usuario).

## Long-polling vs webhook

- Padrao: long-polling (nao requer URL publica).
- Modo webhook: defina `channels.zalo.webhookUrl` e `channels.zalo.webhookSecret`.
  - O segredo do webhook deve ter entre 8 e 256 caracteres.
  - A URL do webhook deve usar HTTPS.
  - O Zalo envia eventos com o cabecalho `X-Bot-Api-Secret-Token` para verificacao.
  - O HTTP do Gateway trata requisicoes de webhook em `channels.zalo.webhookPath` (padrao para o caminho da URL do webhook).

**Nota:** getUpdates (polling) e webhook sao mutuamente exclusivos conforme a documentacao da API do Zalo.

## Tipos de mensagens suportados

- **Mensagens de texto**: Suporte completo com fragmentacao em 2000 caracteres.
- **Mensagens de imagem**: Baixa e processa imagens de entrada; envia imagens via `sendPhoto`.
- **Figurinhas**: Registradas em log, mas nao totalmente processadas (sem resposta do agente).
- **Tipos nao suportados**: Registrados em log (por exemplo, mensagens de usuarios protegidos).

## Capacidades

| Recurso           | Status                                   |
| ----------------- | ---------------------------------------- |
| Mensagens diretas | ✅ Suportado                             |
| Grupos            | ❌ Em breve (conforme docs do Zalo)      |
| Midia (imagens)   | ✅ Suportado                             |
| Reacoes           | ❌ Nao suportado                         |
| Threads           | ❌ Nao suportado                         |
| Enquetes          | ❌ Nao suportado                         |
| Comandos nativos  | ❌ Nao suportado                         |
| Streaming         | ⚠️ Bloqueado (limite de 2000 caracteres) |

## Destinos de entrega (CLI/cron)

- Use um chat id como destino.
- Exemplo: `openclaw message send --channel zalo --target 123456789 --message "hi"`.

## Solucao de problemas

**O bot nao responde:**

- Verifique se o token e valido: `openclaw channels status --probe`
- Confirme se o remetente esta aprovado (emparelhamento ou allowFrom)
- Verifique os logs do Gateway: `openclaw logs --follow`

**Webhook nao esta recebendo eventos:**

- Garanta que a URL do webhook use HTTPS
- Verifique se o token secreto tem entre 8 e 256 caracteres
- Confirme que o endpoint HTTP do Gateway esta acessivel no caminho configurado
- Verifique se o polling getUpdates nao esta em execucao (sao mutuamente exclusivos)

## Referencia de configuracao (Zalo)

Configuracao completa: [Configuration](/gateway/configuration)

Opcoes do provedor:

- `channels.zalo.enabled`: habilitar/desabilitar a inicializacao do canal.
- `channels.zalo.botToken`: token do bot da Zalo Bot Platform.
- `channels.zalo.tokenFile`: ler token a partir de um caminho de arquivo.
- `channels.zalo.dmPolicy`: `pairing | allowlist | open | disabled` (padrao: emparelhamento).
- `channels.zalo.allowFrom`: lista de permissao para Mensagens diretas (IDs de usuario). `open` requer `"*"`. O assistente solicitara IDs numericos.
- `channels.zalo.mediaMaxMb`: limite de midia de entrada/saida (MB, padrao 5).
- `channels.zalo.webhookUrl`: habilitar modo webhook (HTTPS obrigatorio).
- `channels.zalo.webhookSecret`: segredo do webhook (8-256 caracteres).
- `channels.zalo.webhookPath`: caminho do webhook no servidor HTTP do Gateway.
- `channels.zalo.proxy`: URL de proxy para requisicoes da API.

Opcoes de multiplas contas:

- `channels.zalo.accounts.<id>.botToken`: token por conta.
- `channels.zalo.accounts.<id>.tokenFile`: arquivo de token por conta.
- `channels.zalo.accounts.<id>.name`: nome de exibicao.
- `channels.zalo.accounts.<id>.enabled`: habilitar/desabilitar conta.
- `channels.zalo.accounts.<id>.dmPolicy`: politica de Mensagens diretas por conta.
- `channels.zalo.accounts.<id>.allowFrom`: lista de permissao por conta.
- `channels.zalo.accounts.<id>.webhookUrl`: URL de webhook por conta.
- `channels.zalo.accounts.<id>.webhookSecret`: segredo de webhook por conta.
- `channels.zalo.accounts.<id>.webhookPath`: caminho de webhook por conta.
- `channels.zalo.accounts.<id>.proxy`: URL de proxy por conta.
