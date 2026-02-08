---
summary: "Comandos de barra: texto vs nativo, configuracao e comandos suportados"
read_when:
  - Usando ou configurando comandos de chat
  - Depurando roteamento de comandos ou permissoes
title: "Comandos de Barra"
x-i18n:
  source_path: tools/slash-commands.md
  source_hash: ca0deebf89518e8c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:02Z
---

# Comandos de barra

Os comandos sao tratados pelo Gateway. A maioria dos comandos deve ser enviada como uma mensagem **independente** que comeca com `/`.
O comando de chat bash apenas para host usa `! <cmd>` (com `/bash <cmd>` como alias).

Existem dois sistemas relacionados:

- **Comandos**: mensagens independentes `/...`.
- **Diretivas**: `/think`, `/verbose`, `/reasoning`, `/elevated`, `/exec`, `/model`, `/queue`.
  - As diretivas sao removidas da mensagem antes de o modelo ve-la.
  - Em mensagens de chat normais (nao apenas diretivas), elas sao tratadas como “dicas inline” e **nao** persistem configuracoes da sessao.
  - Em mensagens apenas com diretivas (a mensagem contem somente diretivas), elas persistem na sessao e respondem com um reconhecimento.
  - As diretivas sao aplicadas apenas para **remetentes autorizados** (allowlists/pareamento de canal mais `commands.useAccessGroups`).
    Remetentes nao autorizados veem as diretivas tratadas como texto simples.

Tambem existem alguns **atalhos inline** (apenas remetentes allowlisted/autorizados): `/help`, `/commands`, `/status`, `/whoami` (`/id`).
Eles executam imediatamente, sao removidos antes de o modelo ver a mensagem, e o texto restante continua pelo fluxo normal.

## Configuracao

```json5
{
  commands: {
    native: "auto",
    nativeSkills: "auto",
    text: true,
    bash: false,
    bashForegroundMs: 2000,
    config: false,
    debug: false,
    restart: false,
    useAccessGroups: true,
  },
}
```

- `commands.text` (padrao `true`) habilita a analise de `/...` em mensagens de chat.
  - Em superficies sem comandos nativos (WhatsApp/WebChat/Signal/iMessage/Google Chat/MS Teams), comandos de texto ainda funcionam mesmo se voce definir isso como `false`.
- `commands.native` (padrao `"auto"`) registra comandos nativos.
  - Auto: ligado para Discord/Telegram; desligado para Slack (ate voce adicionar comandos de barra); ignorado para provedores sem suporte nativo.
  - Defina `channels.discord.commands.native`, `channels.telegram.commands.native` ou `channels.slack.commands.native` para sobrescrever por provedor (bool ou `"auto"`).
  - `false` limpa comandos previamente registrados no Discord/Telegram na inicializacao. Comandos do Slack sao gerenciados no app do Slack e nao sao removidos automaticamente.
- `commands.nativeSkills` (padrao `"auto"`) registra comandos de **skill** nativamente quando suportado.
  - Auto: ligado para Discord/Telegram; desligado para Slack (o Slack exige criar um comando de barra por skill).
  - Defina `channels.discord.commands.nativeSkills`, `channels.telegram.commands.nativeSkills` ou `channels.slack.commands.nativeSkills` para sobrescrever por provedor (bool ou `"auto"`).
- `commands.bash` (padrao `false`) habilita `! <cmd>` para executar comandos de shell do host (`/bash <cmd>` e um alias; requer allowlists `tools.elevated`).
- `commands.bashForegroundMs` (padrao `2000`) controla quanto tempo o bash espera antes de alternar para o modo em segundo plano (`0` envia para segundo plano imediatamente).
- `commands.config` (padrao `false`) habilita `/config` (le/le `openclaw.json`).
- `commands.debug` (padrao `false`) habilita `/debug` (sobrescritas apenas em tempo de execucao).
- `commands.useAccessGroups` (padrao `true`) impõe allowlists/politicas para comandos.

## Lista de comandos

Texto + nativo (quando habilitado):

- `/help`
- `/commands`
- `/skill <name> [input]` (executa uma skill pelo nome)
- `/status` (mostra o status atual; inclui uso/cota do provedor para o provedor de modelo atual quando disponivel)
- `/allowlist` (listar/adicionar/remover entradas de allowlist)
- `/approve <id> allow-once|allow-always|deny` (resolver prompts de aprovacao de execucao)
- `/context [list|detail|json]` (explicar “contexto”; `detail` mostra tamanho por arquivo + por ferramenta + por skill + prompt do sistema)
- `/whoami` (mostra seu id de remetente; alias: `/id`)
- `/subagents list|stop|log|info|send` (inspecionar, parar, registrar logs ou enviar mensagens para execucoes de subagentes da sessao atual)
- `/config show|get|set|unset` (persistir configuracao em disco, apenas dono; requer `commands.config: true`)
- `/debug show|set|unset|reset` (sobrescritas em tempo de execucao, apenas dono; requer `commands.debug: true`)
- `/usage off|tokens|full|cost` (rodape de uso por resposta ou resumo local de custo)
- `/tts off|always|inbound|tagged|status|provider|limit|summary|audio` (controlar TTS; veja [/tts](/tts))
  - Discord: o comando nativo e `/voice` (o Discord reserva `/tts`); o texto `/tts` ainda funciona.
- `/stop`
- `/restart`
- `/dock-telegram` (alias: `/dock_telegram`) (alternar respostas para Telegram)
- `/dock-discord` (alias: `/dock_discord`) (alternar respostas para Discord)
- `/dock-slack` (alias: `/dock_slack`) (alternar respostas para Slack)
- `/activation mention|always` (apenas grupos)
- `/send on|off|inherit` (apenas dono)
- `/reset` ou `/new [model]` (dica opcional de modelo; o restante e repassado)
- `/think <off|minimal|low|medium|high|xhigh>` (escolhas dinamicas por modelo/provedor; aliases: `/thinking`, `/t`)
- `/verbose on|full|off` (alias: `/v`)
- `/reasoning on|off|stream` (alias: `/reason`; quando ligado, envia uma mensagem separada prefixada com `Reasoning:`; `stream` = rascunho apenas do Telegram)
- `/elevated on|off|ask|full` (alias: `/elev`; `full` ignora aprovacoes de execucao)
- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>` (envie `/exec` para mostrar o atual)
- `/model <name>` (alias: `/models`; ou `/<alias>` a partir de `agents.defaults.models.*.alias`)
- `/queue <mode>` (mais opcoes como `debounce:2s cap:25 drop:summarize`; envie `/queue` para ver as configuracoes atuais)
- `/bash <command>` (apenas host; alias de `! <command>`; requer allowlists `commands.bash: true` + `tools.elevated`)

Apenas texto:

- `/compact [instructions]` (veja [/concepts/compaction](/concepts/compaction))
- `! <command>` (apenas host; um por vez; use `!poll` + `!stop` para trabalhos de longa duracao)
- `!poll` (verificar saida / status; aceita `sessionId` opcional; `/bash poll` tambem funciona)
- `!stop` (parar o job bash em execucao; aceita `sessionId` opcional; `/bash stop` tambem funciona)

Observacoes:

- Os comandos aceitam um `:` opcional entre o comando e os argumentos (ex.: `/think: high`, `/send: on`, `/help:`).
- `/new <model>` aceita um alias de modelo, `provider/model` ou um nome de provedor (correspondencia aproximada); se nao houver correspondencia, o texto e tratado como o corpo da mensagem.
- Para um detalhamento completo de uso por provedor, use `openclaw status --usage`.
- `/allowlist add|remove` requer `commands.config=true` e respeita `configWrites` do canal.
- `/usage` controla o rodape de uso por resposta; `/usage cost` imprime um resumo local de custo a partir dos logs de sessao do OpenClaw.
- `/restart` vem desativado por padrao; defina `commands.restart: true` para habilita-lo.
- `/verbose` destina-se a depuracao e visibilidade extra; mantenha **desligado** no uso normal.
- `/reasoning` (e `/verbose`) sao arriscados em ambientes de grupo: podem revelar raciocinio interno ou saida de ferramentas que voce nao pretendia expor. Prefira deixa-los desligados, especialmente em chats de grupo.
- **Caminho rapido:** mensagens apenas de comando de remetentes allowlisted sao tratadas imediatamente (ignoram fila + modelo).
- **Bloqueio por mencao em grupo:** mensagens apenas de comando de remetentes allowlisted ignoram requisitos de mencao.
- **Atalhos inline (apenas remetentes allowlisted):** certos comandos tambem funcionam quando embutidos em uma mensagem normal e sao removidos antes de o modelo ver o texto restante.
  - Exemplo: `hey /status` aciona uma resposta de status, e o texto restante continua pelo fluxo normal.
- Atualmente: `/help`, `/commands`, `/status`, `/whoami` (`/id`).
- Mensagens apenas de comando nao autorizadas sao silenciosamente ignoradas, e tokens inline `/...` sao tratados como texto simples.
- **Comandos de skill:** skills `user-invocable` sao expostas como comandos de barra. Os nomes sao sanitizados para `a-z0-9_` (max 32 caracteres); colisoes recebem sufixos numericos (ex.: `_2`).
  - `/skill <name> [input]` executa uma skill pelo nome (util quando limites de comandos nativos impedem comandos por skill).
  - Por padrao, comandos de skill sao encaminhados ao modelo como uma solicitacao normal.
  - Skills podem opcionalmente declarar `command-dispatch: tool` para rotear o comando diretamente para uma ferramenta (deterministico, sem modelo).
  - Exemplo: `/prose` (plugin OpenProse) — veja [OpenProse](/prose).
- **Argumentos de comandos nativos:** o Discord usa autocomplete para opcoes dinamicas (e menus de botoes quando voce omite argumentos obrigatorios). Telegram e Slack mostram um menu de botoes quando um comando oferece escolhas e voce omite o argumento.

## Superficies de uso (o que aparece onde)

- **Uso/cota do provedor** (exemplo: “Claude 80% restante”) aparece em `/status` para o provedor de modelo atual quando o rastreamento de uso esta habilitado.
- **Tokens/custo por resposta** e controlado por `/usage off|tokens|full` (anexado a respostas normais).
- `/model status` trata de **modelos/auth/endpoints**, nao de uso.

## Selecao de modelo (`/model`)

`/model` e implementado como uma diretiva.

Exemplos:

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model opus@anthropic:default
/model status
```

Observacoes:

- `/model` e `/model list` mostram um seletor compacto e numerado (familia de modelos + provedores disponiveis).
- `/model <#>` seleciona a partir desse seletor (e prefere o provedor atual quando possivel).
- `/model status` mostra a visualizacao detalhada, incluindo o endpoint do provedor configurado (`baseUrl`) e o modo de API (`api`) quando disponivel.

## Sobrescritas de depuracao

`/debug` permite definir sobrescritas de configuracao **apenas em tempo de execucao** (memoria, nao disco). Apenas dono. Desativado por padrao; habilite com `commands.debug: true`.

Exemplos:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug set channels.whatsapp.allowFrom=["+1555","+4477"]
/debug unset messages.responsePrefix
/debug reset
```

Observacoes:

- As sobrescritas se aplicam imediatamente a novas leituras de configuracao, mas **nao** gravam em `openclaw.json`.
- Use `/debug reset` para limpar todas as sobrescritas e retornar a configuracao em disco.

## Atualizacoes de configuracao

`/config` grava na sua configuracao em disco (`openclaw.json`). Apenas dono. Desativado por padrao; habilite com `commands.config: true`.

Exemplos:

```
/config show
/config show messages.responsePrefix
/config get messages.responsePrefix
/config set messages.responsePrefix="[openclaw]"
/config unset messages.responsePrefix
```

Observacoes:

- A configuracao e validada antes da gravacao; alteracoes invalidas sao rejeitadas.
- Atualizacoes `/config` persistem entre reinicios.

## Observacoes de superficie

- **Comandos de texto** executam na sessao normal de chat (Mensagens diretas compartilham `main`, grupos tem sua propria sessao).
- **Comandos nativos** usam sessoes isoladas:
  - Discord: `agent:<agentId>:discord:slash:<userId>`
  - Slack: `agent:<agentId>:slack:slash:<userId>` (prefixo configuravel via `channels.slack.slashCommand.sessionPrefix`)
  - Telegram: `telegram:slash:<userId>` (direciona a sessao de chat via `CommandTargetSessionKey`)
- **`/stop`** direciona a sessao de chat ativa para que possa abortar a execucao atual.
- **Slack:** `channels.slack.slashCommand` ainda e suportado para um unico comando no estilo `/openclaw`. Se voce habilitar `commands.native`, deve criar um comando de barra do Slack por comando embutido (mesmos nomes de `/help`). Menus de argumentos de comando para Slack sao entregues como botoes efemeros do Block Kit.
