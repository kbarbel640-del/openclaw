---
summary: "Interface de Terminal (TUI): conecte-se ao Gateway a partir de qualquer maquina"
read_when:
  - Voce quer um passo a passo amigavel para iniciantes do TUI
  - Voce precisa da lista completa de recursos, comandos e atalhos do TUI
title: "TUI"
x-i18n:
  source_path: web/tui.md
  source_hash: 6ab8174870e4722d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:27Z
---

# TUI (Interface de Terminal)

## Inicio rapido

1. Inicie o Gateway.

```bash
openclaw gateway
```

2. Abra o TUI.

```bash
openclaw tui
```

3. Digite uma mensagem e pressione Enter.

Gateway remoto:

```bash
openclaw tui --url ws://<host>:<port> --token <gateway-token>
```

Use `--password` se o seu Gateway usar autenticacao por senha.

## O que voce ve

- Cabecalho: URL de conexao, agente atual, sessao atual.
- Log do chat: mensagens do usuario, respostas do assistente, avisos do sistema, cards de ferramentas.
- Linha de status: estado de conexao/execucao (conectando, executando, transmitindo, ocioso, erro).
- Rodape: estado da conexao + agente + sessao + modelo + pensar/verboso/raciocinio + contagem de tokens + entrega.
- Entrada: editor de texto com autocomplete.

## Modelo mental: agentes + sessoes

- Agentes sao slugs unicos (ex.: `main`, `research`). O Gateway expoe a lista.
- Sessoes pertencem ao agente atual.
- Chaves de sessao sao armazenadas como `agent:<agentId>:<sessionKey>`.
  - Se voce digitar `/session main`, o TUI expande para `agent:<currentAgent>:main`.
  - Se voce digitar `/session agent:other:main`, voce muda explicitamente para essa sessao do agente.
- Escopo da sessao:
  - `per-sender` (padrao): cada agente tem muitas sessoes.
  - `global`: o TUI sempre usa a sessao `global` (o seletor pode estar vazio).
- O agente + sessao atuais estao sempre visiveis no rodape.

## Envio + entrega

- As mensagens sao enviadas ao Gateway; a entrega aos provedores fica desativada por padrao.
- Ative a entrega:
  - `/deliver on`
  - ou no painel de Configuracoes
  - ou inicie com `openclaw tui --deliver`

## Seletores + sobreposicoes

- Seletor de modelo: lista os modelos disponiveis e define a sobreposicao da sessao.
- Seletor de agente: escolha um agente diferente.
- Seletor de sessao: mostra apenas sessoes do agente atual.
- Configuracoes: alternar entrega, expansao de saida de ferramentas e visibilidade do pensamento.

## Atalhos de teclado

- Enter: enviar mensagem
- Esc: abortar execucao ativa
- Ctrl+C: limpar entrada (pressione duas vezes para sair)
- Ctrl+D: sair
- Ctrl+L: seletor de modelo
- Ctrl+G: seletor de agente
- Ctrl+P: seletor de sessao
- Ctrl+O: alternar expansao de saida de ferramentas
- Ctrl+T: alternar visibilidade do pensamento (recarrega o historico)

## Comandos de barra

Nucleo:

- `/help`
- `/status`
- `/agent <id>` (ou `/agents`)
- `/session <key>` (ou `/sessions`)
- `/model <provider/model>` (ou `/models`)

Controles de sessao:

- `/think <off|minimal|low|medium|high>`
- `/verbose <on|full|off>`
- `/reasoning <on|off|stream>`
- `/usage <off|tokens|full>`
- `/elevated <on|off|ask|full>` (alias: `/elev`)
- `/activation <mention|always>`
- `/deliver <on|off>`

Ciclo de vida da sessao:

- `/new` ou `/reset` (redefine a sessao)
- `/abort` (aborta a execucao ativa)
- `/settings`
- `/exit`

Outros comandos de barra do Gateway (por exemplo, `/context`) sao encaminhados ao Gateway e mostrados como saida do sistema. Veja [Slash commands](/tools/slash-commands).

## Comandos locais de shell

- Prefixe uma linha com `!` para executar um comando de shell local no host do TUI.
- O TUI solicita permissao uma vez por sessao para permitir execucao local; ao recusar, `!` permanece desativado para a sessao.
- Os comandos rodam em um shell novo, nao interativo, no diretorio de trabalho do TUI (sem `cd`/env persistentes).
- Um `!` isolado e enviado como mensagem normal; espacos iniciais nao disparam execucao local.

## Saida de ferramentas

- Chamadas de ferramentas aparecem como cards com argumentos + resultados.
- Ctrl+O alterna entre visualizacoes recolhida/expandida.
- Enquanto as ferramentas executam, atualizacoes parciais sao transmitidas no mesmo card.

## Historico + streaming

- Ao conectar, o TUI carrega o historico mais recente (padrao 200 mensagens).
- Respostas em streaming atualizam no lugar ate serem finalizadas.
- O TUI tambem escuta eventos de ferramentas do agente para cards de ferramentas mais ricos.

## Detalhes de conexao

- O TUI se registra no Gateway como `mode: "tui"`.
- Reconexoes mostram uma mensagem do sistema; lacunas de eventos aparecem no log.

## Opcoes

- `--url <url>`: URL do WebSocket do Gateway (padrao da configuracao ou `ws://127.0.0.1:<port>`)
- `--token <token>`: token do Gateway (se necessario)
- `--password <password>`: senha do Gateway (se necessario)
- `--session <key>`: chave de sessao (padrao: `main`, ou `global` quando o escopo e global)
- `--deliver`: entregar respostas do assistente ao provedor (padrao desativado)
- `--thinking <level>`: substituir o nivel de pensamento para envios
- `--timeout-ms <ms>`: timeout do agente em ms (padrao `agents.defaults.timeoutSeconds`)

Observacao: quando voce define `--url`, o TUI nao recorre a configuracao nem a credenciais de ambiente.
Passe `--token` ou `--password` explicitamente. A ausencia de credenciais explicitas e um erro.

## Solucao de problemas

Sem saida apos enviar uma mensagem:

- Execute `/status` no TUI para confirmar que o Gateway esta conectado e ocioso/ocupado.
- Verifique os logs do Gateway: `openclaw logs --follow`.
- Confirme que o agente pode executar: `openclaw status` e `openclaw models status`.
- Se voce espera mensagens em um canal de chat, ative a entrega (`/deliver on` ou `--deliver`).
- `--history-limit <n>`: entradas de historico a carregar (padrao 200)

## Solucao de problemas de conexao

- `disconnected`: garanta que o Gateway esteja em execucao e que suas `--url/--token/--password` estejam corretas.
- Nenhum agente no seletor: verifique `openclaw agents list` e sua configuracao de roteamento.
- Seletor de sessao vazio: voce pode estar no escopo global ou ainda nao ter sessoes.
