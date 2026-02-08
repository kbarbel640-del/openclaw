---
summary: "Referencia do CLI do OpenClaw para comandos, subcomandos e opcoes do `openclaw`"
read_when:
  - Ao adicionar ou modificar comandos ou opcoes do CLI
  - Ao documentar novas superficies de comando
title: "Referencia do CLI"
x-i18n:
  source_path: cli/index.md
  source_hash: 973e7806d0261c6a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:38Z
---

# Referencia do CLI

Esta pagina descreve o comportamento atual do CLI. Se os comandos mudarem, atualize este documento.

## Paginas de comandos

- [`setup`](/cli/setup)
- [`onboard`](/cli/onboard)
- [`configure`](/cli/configure)
- [`config`](/cli/config)
- [`doctor`](/cli/doctor)
- [`dashboard`](/cli/dashboard)
- [`reset`](/cli/reset)
- [`uninstall`](/cli/uninstall)
- [`update`](/cli/update)
- [`message`](/cli/message)
- [`agent`](/cli/agent)
- [`agents`](/cli/agents)
- [`acp`](/cli/acp)
- [`status`](/cli/status)
- [`health`](/cli/health)
- [`sessions`](/cli/sessions)
- [`gateway`](/cli/gateway)
- [`logs`](/cli/logs)
- [`system`](/cli/system)
- [`models`](/cli/models)
- [`memory`](/cli/memory)
- [`nodes`](/cli/nodes)
- [`devices`](/cli/devices)
- [`node`](/cli/node)
- [`approvals`](/cli/approvals)
- [`sandbox`](/cli/sandbox)
- [`tui`](/cli/tui)
- [`browser`](/cli/browser)
- [`cron`](/cli/cron)
- [`dns`](/cli/dns)
- [`docs`](/cli/docs)
- [`hooks`](/cli/hooks)
- [`webhooks`](/cli/webhooks)
- [`pairing`](/cli/pairing)
- [`plugins`](/cli/plugins) (comandos de plugin)
- [`channels`](/cli/channels)
- [`security`](/cli/security)
- [`skills`](/cli/skills)
- [`voicecall`](/cli/voicecall) (plugin; se instalado)

## Flags globais

- `--dev`: isola o estado em `~/.openclaw-dev` e muda as portas padrao.
- `--profile <name>`: isola o estado em `~/.openclaw-<name>`.
- `--no-color`: desativa cores ANSI.
- `--update`: atalho para `openclaw update` (apenas instalacoes de origem).
- `-V`, `--version`, `-v`: imprime a versao e sai.

## Estilo de saida

- Cores ANSI e indicadores de progresso so sao renderizados em sessoes TTY.
- Hiperlinks OSC-8 sao renderizados como links clicaveis em terminais compatíveis; caso contrario, usamos URLs simples.
- `--json` (e `--plain` quando suportado) desativa o estilo para uma saida limpa.
- `--no-color` desativa o estilo ANSI; `NO_COLOR=1` tambem e respeitado.
- Comandos de longa duracao exibem um indicador de progresso (OSC 9;4 quando suportado).

## Paleta de cores

O OpenClaw usa uma paleta lobster para a saida do CLI.

- `accent` (#FF5A2D): titulos, rotulos, destaques primarios.
- `accentBright` (#FF7A3D): nomes de comandos, enfase.
- `accentDim` (#D14A22): texto de destaque secundario.
- `info` (#FF8A5B): valores informativos.
- `success` (#2FBF71): estados de sucesso.
- `warn` (#FFB020): avisos, fallbacks, atencao.
- `error` (#E23D2D): erros, falhas.
- `muted` (#8B7F77): des enfase, metadados.

Fonte de verdade da paleta: `src/terminal/palette.ts` (tambem conhecido como “lobster seam”).

## Arvore de comandos

```
openclaw [--dev] [--profile <name>] <command>
  setup
  onboard
  configure
  config
    get
    set
    unset
  doctor
  security
    audit
  reset
  uninstall
  update
  channels
    list
    status
    logs
    add
    remove
    login
    logout
  skills
    list
    info
    check
  plugins
    list
    info
    install
    enable
    disable
    doctor
  memory
    status
    index
    search
  message
  agent
  agents
    list
    add
    delete
  acp
  status
  health
  sessions
  gateway
    call
    health
    status
    probe
    discover
    install
    uninstall
    start
    stop
    restart
    run
  logs
  system
    event
    heartbeat last|enable|disable
    presence
  models
    list
    status
    set
    set-image
    aliases list|add|remove
    fallbacks list|add|remove|clear
    image-fallbacks list|add|remove|clear
    scan
    auth add|setup-token|paste-token
    auth order get|set|clear
  sandbox
    list
    recreate
    explain
  cron
    status
    list
    add
    edit
    rm
    enable
    disable
    runs
    run
  nodes
  devices
  node
    run
    status
    install
    uninstall
    start
    stop
    restart
  approvals
    get
    set
    allowlist add|remove
  browser
    status
    start
    stop
    reset-profile
    tabs
    open
    focus
    close
    profiles
    create-profile
    delete-profile
    screenshot
    snapshot
    navigate
    resize
    click
    type
    press
    hover
    drag
    select
    upload
    fill
    dialog
    wait
    evaluate
    console
    pdf
  hooks
    list
    info
    check
    enable
    disable
    install
    update
  webhooks
    gmail setup|run
  pairing
    list
    approve
  docs
  dns
    setup
  tui
```

Nota: plugins podem adicionar comandos adicionais de nivel superior (por exemplo `openclaw voicecall`).

## Seguranca

- `openclaw security audit` — audita a configuracao + estado local para armadilhas comuns de seguranca.
- `openclaw security audit --deep` — sonda ao vivo do Gateway com melhor esforco.
- `openclaw security audit --fix` — reforca padroes seguros e ajusta permissoes de estado/config.

## Plugins

Gerencie extensoes e suas configuracoes:

- `openclaw plugins list` — descobre plugins (use `--json` para saida de maquina).
- `openclaw plugins info <id>` — mostra detalhes de um plugin.
- `openclaw plugins install <path|.tgz|npm-spec>` — instala um plugin (ou adiciona um caminho de plugin a `plugins.load.paths`).
- `openclaw plugins enable <id>` / `disable <id>` — alterna `plugins.entries.<id>.enabled`.
- `openclaw plugins doctor` — relata erros de carregamento de plugins.

A maioria das mudancas de plugin exige reinicio do gateway. Veja [/plugin](/plugin).

## Memoria

Busca vetorial sobre `MEMORY.md` + `memory/*.md`:

- `openclaw memory status` — mostra estatisticas do indice.
- `openclaw memory index` — reindexa arquivos de memoria.
- `openclaw memory search "<query>"` — busca semantica na memoria.

## Comandos de barra no chat

Mensagens de chat suportam comandos `/...` (texto e nativos). Veja [/tools/slash-commands](/tools/slash-commands).

Destaques:

- `/status` para diagnosticos rapidos.
- `/config` para mudancas de configuracao persistidas.
- `/debug` para sobrescritas de configuracao apenas em tempo de execucao (memoria, nao disco; requer `commands.debug: true`).

## Setup + integracao inicial

### `setup`

Inicializa configuracao + workspace.

Opcoes:

- `--workspace <dir>`: caminho do workspace do agente (padrao `~/.openclaw/workspace`).
- `--wizard`: executa o assistente de integracao inicial.
- `--non-interactive`: executa o assistente sem prompts.
- `--mode <local|remote>`: modo do assistente.
- `--remote-url <url>`: URL remota do Gateway.
- `--remote-token <token>`: token remoto do Gateway.

O assistente executa automaticamente quando qualquer flag do assistente estiver presente (`--non-interactive`, `--mode`, `--remote-url`, `--remote-token`).

### `onboard`

Assistente interativo para configurar gateway, workspace e skills.

Opcoes:

- `--workspace <dir>`
- `--reset` (redefine configuracao + credenciais + sessoes + workspace antes do assistente)
- `--non-interactive`
- `--mode <local|remote>`
- `--flow <quickstart|advanced|manual>` (manual e um alias para advanced)
- `--auth-choice <setup-token|token|chutes|openai-codex|openai-api-key|openrouter-api-key|ai-gateway-api-key|moonshot-api-key|moonshot-api-key-cn|kimi-code-api-key|synthetic-api-key|venice-api-key|gemini-api-key|zai-api-key|apiKey|minimax-api|minimax-api-lightning|opencode-zen|skip>`
- `--token-provider <id>` (nao interativo; usado com `--auth-choice token`)
- `--token <token>` (nao interativo; usado com `--auth-choice token`)
- `--token-profile-id <id>` (nao interativo; padrao: `<provider>:manual`)
- `--token-expires-in <duration>` (nao interativo; ex.: `365d`, `12h`)
- `--anthropic-api-key <key>`
- `--openai-api-key <key>`
- `--openrouter-api-key <key>`
- `--ai-gateway-api-key <key>`
- `--moonshot-api-key <key>`
- `--kimi-code-api-key <key>`
- `--gemini-api-key <key>`
- `--zai-api-key <key>`
- `--minimax-api-key <key>`
- `--opencode-zen-api-key <key>`
- `--gateway-port <port>`
- `--gateway-bind <loopback|lan|tailnet|auto|custom>`
- `--gateway-auth <token|password>`
- `--gateway-token <token>`
- `--gateway-password <password>`
- `--remote-url <url>`
- `--remote-token <token>`
- `--tailscale <off|serve|funnel>`
- `--tailscale-reset-on-exit`
- `--install-daemon`
- `--no-install-daemon` (alias: `--skip-daemon`)
- `--daemon-runtime <node|bun>`
- `--skip-channels`
- `--skip-skills`
- `--skip-health`
- `--skip-ui`
- `--node-manager <npm|pnpm|bun>` (pnpm recomendado; bun nao recomendado para runtime do Gateway)
- `--json`

### `configure`

Assistente interativo de configuracao (modelos, canais, skills, gateway).

### `config`

Ajudantes de configuracao nao interativos (get/set/unset). Executar `openclaw config` sem
subcomando inicia o assistente.

Subcomandos:

- `config get <path>`: imprime um valor de configuracao (caminho com ponto/colchetes).
- `config set <path> <value>`: define um valor (JSON5 ou string bruta).
- `config unset <path>`: remove um valor.

### `doctor`

Verificacoes de saude + correcoes rapidas (configuracao + gateway + servicos legados).

Opcoes:

- `--no-workspace-suggestions`: desativa dicas de memoria do workspace.
- `--yes`: aceita padroes sem solicitar (headless).
- `--non-interactive`: ignora prompts; aplica apenas migracoes seguras.
- `--deep`: varre servicos do sistema em busca de instalacoes extras do gateway.

## Ajudantes de canais

### `channels`

Gerencie contas de canais de chat (WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost (plugin)/Signal/iMessage/MS Teams).

Subcomandos:

- `channels list`: mostra canais configurados e perfis de autenticacao.
- `channels status`: verifica alcancabilidade do gateway e saude do canal (`--probe` executa verificacoes extras; use `openclaw health` ou `openclaw status --deep` para sondas de saude do gateway).
- Dica: `channels status` imprime avisos com correcoes sugeridas quando consegue detectar configuracoes incorretas comuns (e entao aponta para `openclaw doctor`).
- `channels logs`: mostra logs recentes do canal a partir do arquivo de log do gateway.
- `channels add`: configuracao em estilo assistente quando nenhuma flag e passada; flags mudam para modo nao interativo.
- `channels remove`: desativado por padrao; passe `--delete` para remover entradas de configuracao sem prompts.
- `channels login`: login interativo de canal (apenas WhatsApp Web).
- `channels logout`: faz logout de uma sessao de canal (se suportado).

Opcoes comuns:

- `--channel <name>`: `whatsapp|telegram|discord|googlechat|slack|mattermost|signal|imessage|msteams`
- `--account <id>`: id da conta do canal (padrao `default`)
- `--name <label>`: nome de exibicao da conta

Opcoes de `channels login`:

- `--channel <channel>` (padrao `whatsapp`; suporta `whatsapp`/`web`)
- `--account <id>`
- `--verbose`

Opcoes de `channels logout`:

- `--channel <channel>` (padrao `whatsapp`)
- `--account <id>`

Opcoes de `channels list`:

- `--no-usage`: ignora snapshots de uso/cota do provedor de modelo (apenas com OAuth/API).
- `--json`: saida em JSON (inclui uso, a menos que `--no-usage` esteja definido).

Opcoes de `channels logs`:

- `--channel <name|all>` (padrao `all`)
- `--lines <n>` (padrao `200`)
- `--json`

Mais detalhes: [/concepts/oauth](/concepts/oauth)

Exemplos:

```bash
openclaw channels add --channel telegram --account alerts --name "Alerts Bot" --token $TELEGRAM_BOT_TOKEN
openclaw channels add --channel discord --account work --name "Work Bot" --token $DISCORD_BOT_TOKEN
openclaw channels remove --channel discord --account work --delete
openclaw channels status --probe
openclaw status --deep
```

### `skills`

Lista e inspeciona skills disponiveis, alem de informacoes de prontidao.

Subcomandos:

- `skills list`: lista skills (padrao quando nao ha subcomando).
- `skills info <name>`: mostra detalhes de uma skill.
- `skills check`: resumo de prontas vs requisitos ausentes.

Opcoes:

- `--eligible`: mostra apenas skills prontas.
- `--json`: saida em JSON (sem estilo).
- `-v`, `--verbose`: inclui detalhes de requisitos ausentes.

Dica: use `npx clawhub` para buscar, instalar e sincronizar skills.

### `pairing`

Aprova solicitacoes de pareamento de Mensagens diretas entre canais.

Subcomandos:

- `pairing list <channel> [--json]`
- `pairing approve <channel> <code> [--notify]`

### `webhooks gmail`

Configuracao e executor de hook do Gmail Pub/Sub. Veja [/automation/gmail-pubsub](/automation/gmail-pubsub).

Subcomandos:

- `webhooks gmail setup` (requer `--account <email>`; suporta `--project`, `--topic`, `--subscription`, `--label`, `--hook-url`, `--hook-token`, `--push-token`, `--bind`, `--port`, `--path`, `--include-body`, `--max-bytes`, `--renew-minutes`, `--tailscale`, `--tailscale-path`, `--tailscale-target`, `--push-endpoint`, `--json`)
- `webhooks gmail run` (sobrescritas de runtime para as mesmas flags)

### `dns setup`

Ajudante de DNS para descoberta em area ampla (CoreDNS + Tailscale). Veja [/gateway/discovery](/gateway/discovery).

Opcoes:

- `--apply`: instala/atualiza configuracao do CoreDNS (requer sudo; apenas macOS).

## Mensageria + agente

### `message`

Mensageria de saida unificada + acoes de canal.

Veja: [/cli/message](/cli/message)

Subcomandos:

- `message send|poll|react|reactions|read|edit|delete|pin|unpin|pins|permissions|search|timeout|kick|ban`
- `message thread <create|list|reply>`
- `message emoji <list|upload>`
- `message sticker <send|upload>`
- `message role <info|add|remove>`
- `message channel <info|list>`
- `message member info`
- `message voice status`
- `message event <list|create>`

Exemplos:

- `openclaw message send --target +15555550123 --message "Hi"`
- `openclaw message poll --channel discord --target channel:123 --poll-question "Snack?" --poll-option Pizza --poll-option Sushi`

### `agent`

Executa um turno de agente via o Gateway (ou `--local` incorporado).

Obrigatorio:

- `--message <text>`

Opcoes:

- `--to <dest>` (para chave de sessao e entrega opcional)
- `--session-id <id>`
- `--thinking <off|minimal|low|medium|high|xhigh>` (apenas modelos GPT-5.2 + Codex)
- `--verbose <on|full|off>`
- `--channel <whatsapp|telegram|discord|slack|mattermost|signal|imessage|msteams>`
- `--local`
- `--deliver`
- `--json`
- `--timeout <seconds>`

### `agents`

Gerencia agentes isolados (workspaces + auth + roteamento).

#### `agents list`

Lista agentes configurados.

Opcoes:

- `--json`
- `--bindings`

#### `agents add [name]`

Adiciona um novo agente isolado. Executa o assistente guiado a menos que flags (ou `--non-interactive`) sejam passadas; `--workspace` e obrigatorio no modo nao interativo.

Opcoes:

- `--workspace <dir>`
- `--model <id>`
- `--agent-dir <dir>`
- `--bind <channel[:accountId]>` (repetivel)
- `--non-interactive`
- `--json`

Especificacoes de binding usam `channel[:accountId]`. Quando `accountId` e omitido para WhatsApp, o id de conta padrao e usado.

#### `agents delete <id>`

Exclui um agente e remove seu workspace + estado.

Opcoes:

- `--force`
- `--json`

### `acp`

Executa a ponte ACP que conecta IDEs ao Gateway.

Veja [`acp`](/cli/acp) para todas as opcoes e exemplos.

### `status`

Mostra a saude de sessoes vinculadas e destinatarios recentes.

Opcoes:

- `--json`
- `--all` (diagnostico completo; somente leitura, colavel)
- `--deep` (sonda canais)
- `--usage` (mostra uso/cota do provedor de modelo)
- `--timeout <ms>`
- `--verbose`
- `--debug` (alias para `--verbose`)

Notas:

- A visao geral inclui status do Gateway + servico do host do node quando disponivel.

### Rastreamento de uso

O OpenClaw pode expor uso/cota do provedor quando credenciais OAuth/API estao disponiveis.

Superficies:

- `/status` (adiciona uma linha curta de uso do provedor quando disponivel)
- `openclaw status --usage` (imprime o detalhamento completo do provedor)
- barra de menu do macOS (secao Usage em Context)

Notas:

- Os dados vem diretamente dos endpoints de uso do provedor (sem estimativas).
- Provedores: Anthropic, GitHub Copilot, OpenAI Codex OAuth, alem de Gemini CLI/Antigravity quando esses plugins de provedor estao habilitados.
- Se nao existirem credenciais correspondentes, o uso fica oculto.
- Detalhes: veja [Usage tracking](/concepts/usage-tracking).

### `health`

Busca a saude do Gateway em execucao.

Opcoes:

- `--json`
- `--timeout <ms>`
- `--verbose`

### `sessions`

Lista sessoes de conversas armazenadas.

Opcoes:

- `--json`
- `--verbose`
- `--store <path>`
- `--active <minutes>`

## Reset / Desinstalacao

### `reset`

Redefine configuracao/estado local (mantem o CLI instalado).

Opcoes:

- `--scope <config|config+creds+sessions|full>`
- `--yes`
- `--non-interactive`
- `--dry-run`

Notas:

- `--non-interactive` requer `--scope` e `--yes`.

### `uninstall`

Desinstala o servico do gateway + dados locais (o CLI permanece).

Opcoes:

- `--service`
- `--state`
- `--workspace`
- `--app`
- `--all`
- `--yes`
- `--non-interactive`
- `--dry-run`

Notas:

- `--non-interactive` requer `--yes` e escopos explicitos (ou `--all`).

## Gateway

### `gateway`

Executa o Gateway WebSocket.

Opcoes:

- `--port <port>`
- `--bind <loopback|tailnet|lan|auto|custom>`
- `--token <token>`
- `--auth <token|password>`
- `--password <password>`
- `--tailscale <off|serve|funnel>`
- `--tailscale-reset-on-exit`
- `--allow-unconfigured`
- `--dev`
- `--reset` (redefine config de dev + credenciais + sessoes + workspace)
- `--force` (encerra listener existente na porta)
- `--verbose`
- `--claude-cli-logs`
- `--ws-log <auto|full|compact>`
- `--compact` (alias para `--ws-log compact`)
- `--raw-stream`
- `--raw-stream-path <path>`

### `gateway service`

Gerencia o servico do Gateway (launchd/systemd/schtasks).

Subcomandos:

- `gateway status` (sonda o RPC do Gateway por padrao)
- `gateway install` (instalacao do servico)
- `gateway uninstall`
- `gateway start`
- `gateway stop`
- `gateway restart`

Notas:

- `gateway status` sonda o RPC do Gateway por padrao usando a porta/config resolvidas do servico (sobrescreva com `--url/--token/--password`).
- `gateway status` suporta `--no-probe`, `--deep` e `--json` para scripts.
- `gateway status` tambem expõe servicos de gateway legados ou extras quando consegue detecta-los (`--deep` adiciona varreduras em nivel de sistema). Servicos OpenClaw nomeados por perfil sao tratados como primeira classe e nao sao marcados como "extras".
- `gateway status` imprime qual caminho de configuracao o CLI usa vs qual configuracao o servico provavelmente usa (env do servico), alem da URL de destino da sonda resolvida.
- `gateway install|uninstall|start|stop|restart` suporta `--json` para scripts (a saida padrao permanece amigavel).
- `gateway install` usa Node runtime por padrao; bun **nao e recomendado** (bugs no WhatsApp/Telegram).
- Opcoes de `gateway install`: `--port`, `--runtime`, `--token`, `--force`, `--json`.

### `logs`

Acompanha logs de arquivo do Gateway via RPC.

Notas:

- Sessoes TTY renderizam uma visualizacao estruturada e colorida; nao TTY volta para texto simples.
- `--json` emite JSON delimitado por linha (um evento de log por linha).

Exemplos:

```bash
openclaw logs --follow
openclaw logs --limit 200
openclaw logs --plain
openclaw logs --json
openclaw logs --no-color
```

### `gateway <subcommand>`

Ajudantes do CLI do Gateway (use `--url`, `--token`, `--password`, `--timeout`, `--expect-final` para subcomandos RPC).
Quando voce passa `--url`, o CLI nao aplica automaticamente configuracao nem credenciais de ambiente.
Inclua `--token` ou `--password` explicitamente. Credenciais explicitas ausentes e um erro.

Subcomandos:

- `gateway call <method> [--params <json>]`
- `gateway health`
- `gateway status`
- `gateway probe`
- `gateway discover`
- `gateway install|uninstall|start|stop|restart`
- `gateway run`

RPCs comuns:

- `config.apply` (validar + gravar config + reiniciar + acordar)
- `config.patch` (mesclar uma atualizacao parcial + reiniciar + acordar)
- `update.run` (executar atualizacao + reiniciar + acordar)

Dica: ao chamar `config.set`/`config.apply`/`config.patch` diretamente, passe `baseHash` de
`config.get` se uma configuracao ja existir.

## Modelos

Veja [/concepts/models](/concepts/models) para comportamento de fallback e estrategia de varredura.

Autenticacao Anthropic preferida (setup-token):

```bash
claude setup-token
openclaw models auth setup-token --provider anthropic
openclaw models status
```

### `models` (raiz)

`openclaw models` e um alias para `models status`.

Opcoes da raiz:

- `--status-json` (alias para `models status --json`)
- `--status-plain` (alias para `models status --plain`)

### `models list`

Opcoes:

- `--all`
- `--local`
- `--provider <name>`
- `--json`
- `--plain`

### `models status`

Opcoes:

- `--json`
- `--plain`
- `--check` (saida 1=expirado/ausente, 2=expirando)
- `--probe` (sonda ao vivo dos perfis de auth configurados)
- `--probe-provider <name>`
- `--probe-profile <id>` (repetir ou separado por virgulas)
- `--probe-timeout <ms>`
- `--probe-concurrency <n>`
- `--probe-max-tokens <n>`

Sempre inclui a visao geral de auth e o status de expiracao OAuth para perfis no armazenamento de auth.
`--probe` executa requisicoes ao vivo (pode consumir tokens e acionar limites de taxa).

### `models set <model>`

Define `agents.defaults.model.primary`.

### `models set-image <model>`

Define `agents.defaults.imageModel.primary`.

### `models aliases list|add|remove`

Opcoes:

- `list`: `--json`, `--plain`
- `add <alias> <model>`
- `remove <alias>`

### `models fallbacks list|add|remove|clear`

Opcoes:

- `list`: `--json`, `--plain`
- `add <model>`
- `remove <model>`
- `clear`

### `models image-fallbacks list|add|remove|clear`

Opcoes:

- `list`: `--json`, `--plain`
- `add <model>`
- `remove <model>`
- `clear`

### `models scan`

Opcoes:

- `--min-params <b>`
- `--max-age-days <days>`
- `--provider <name>`
- `--max-candidates <n>`
- `--timeout <ms>`
- `--concurrency <n>`
- `--no-probe`
- `--yes`
- `--no-input`
- `--set-default`
- `--set-image`
- `--json`

### `models auth add|setup-token|paste-token`

Opcoes:

- `add`: ajudante interativo de auth
- `setup-token`: `--provider <name>` (padrao `anthropic`), `--yes`
- `paste-token`: `--provider <name>`, `--profile-id <id>`, `--expires-in <duration>`

### `models auth order get|set|clear`

Opcoes:

- `get`: `--provider <name>`, `--agent <id>`, `--json`
- `set`: `--provider <name>`, `--agent <id>`, `<profileIds...>`
- `clear`: `--provider <name>`, `--agent <id>`

## Sistema

### `system event`

Enfileira um evento do sistema e opcionalmente aciona um heartbeat (RPC do Gateway).

Obrigatorio:

- `--text <text>`

Opcoes:

- `--mode <now|next-heartbeat>`
- `--json`
- `--url`, `--token`, `--timeout`, `--expect-final`

### `system heartbeat last|enable|disable`

Controles de heartbeat (RPC do Gateway).

Opcoes:

- `--json`
- `--url`, `--token`, `--timeout`, `--expect-final`

### `system presence`

Lista entradas de presenca do sistema (RPC do Gateway).

Opcoes:

- `--json`
- `--url`, `--token`, `--timeout`, `--expect-final`

## Cron

Gerencie jobs agendados (RPC do Gateway). Veja [/automation/cron-jobs](/automation/cron-jobs).

Subcomandos:

- `cron status [--json]`
- `cron list [--all] [--json]` (saida em tabela por padrao; use `--json` para bruto)
- `cron add` (alias: `create`; requer `--name` e exatamente um de `--at` | `--every` | `--cron`, e exatamente um payload de `--system-event` | `--message`)
- `cron edit <id>` (patch de campos)
- `cron rm <id>` (aliases: `remove`, `delete`)
- `cron enable <id>`
- `cron disable <id>`
- `cron runs --id <id> [--limit <n>]`
- `cron run <id> [--force]`

Todos os comandos `cron` aceitam `--url`, `--token`, `--timeout`, `--expect-final`.

## Host de node

`node` executa um **host de node headless** ou o gerencia como um servico em segundo plano. Veja
[`openclaw node`](/cli/node).

Subcomandos:

- `node run --host <gateway-host> --port 18789`
- `node status`
- `node install [--host <gateway-host>] [--port <port>] [--tls] [--tls-fingerprint <sha256>] [--node-id <id>] [--display-name <name>] [--runtime <node|bun>] [--force]`
- `node uninstall`
- `node stop`
- `node restart`

## Nodes

`nodes` conversa com o Gateway e direciona nodes pareados. Veja [/nodes](/nodes).

Opcoes comuns:

- `--url`, `--token`, `--timeout`, `--json`

Subcomandos:

- `nodes status [--connected] [--last-connected <duration>]`
- `nodes describe --node <id|name|ip>`
- `nodes list [--connected] [--last-connected <duration>]`
- `nodes pending`
- `nodes approve <requestId>`
- `nodes reject <requestId>`
- `nodes rename --node <id|name|ip> --name <displayName>`
- `nodes invoke --node <id|name|ip> --command <command> [--params <json>] [--invoke-timeout <ms>] [--idempotency-key <key>]`
- `nodes run --node <id|name|ip> [--cwd <path>] [--env KEY=VAL] [--command-timeout <ms>] [--needs-screen-recording] [--invoke-timeout <ms>] <command...>` (node mac ou host de node headless)
- `nodes notify --node <id|name|ip> [--title <text>] [--body <text>] [--sound <name>] [--priority <passive|active|timeSensitive>] [--delivery <system|overlay|auto>] [--invoke-timeout <ms>]` (apenas mac)

Camera:

- `nodes camera list --node <id|name|ip>`
- `nodes camera snap --node <id|name|ip> [--facing front|back|both] [--device-id <id>] [--max-width <px>] [--quality <0-1>] [--delay-ms <ms>] [--invoke-timeout <ms>]`
- `nodes camera clip --node <id|name|ip> [--facing front|back] [--device-id <id>] [--duration <ms|10s|1m>] [--no-audio] [--invoke-timeout <ms>]`

Canvas + tela:

- `nodes canvas snapshot --node <id|name|ip> [--format png|jpg|jpeg] [--max-width <px>] [--quality <0-1>] [--invoke-timeout <ms>]`
- `nodes canvas present --node <id|name|ip> [--target <urlOrPath>] [--x <px>] [--y <px>] [--width <px>] [--height <px>] [--invoke-timeout <ms>]`
- `nodes canvas hide --node <id|name|ip> [--invoke-timeout <ms>]`
- `nodes canvas navigate <url> --node <id|name|ip> [--invoke-timeout <ms>]`
- `nodes canvas eval [<js>] --node <id|name|ip> [--js <code>] [--invoke-timeout <ms>]`
- `nodes canvas a2ui push --node <id|name|ip> (--jsonl <path> | --text <text>) [--invoke-timeout <ms>]`
- `nodes canvas a2ui reset --node <id|name|ip> [--invoke-timeout <ms>]`
- `nodes screen record --node <id|name|ip> [--screen <index>] [--duration <ms|10s>] [--fps <n>] [--no-audio] [--out <path>] [--invoke-timeout <ms>]`

Localizacao:

- `nodes location get --node <id|name|ip> [--max-age <ms>] [--accuracy <coarse|balanced|precise>] [--location-timeout <ms>] [--invoke-timeout <ms>]`

## Navegador

CLI de controle de navegador (Chrome/Brave/Edge/Chromium dedicados). Veja [`openclaw browser`](/cli/browser) e a [Browser tool](/tools/browser).

Opcoes comuns:

- `--url`, `--token`, `--timeout`, `--json`
- `--browser-profile <name>`

Gerenciar:

- `browser status`
- `browser start`
- `browser stop`
- `browser reset-profile`
- `browser tabs`
- `browser open <url>`
- `browser focus <targetId>`
- `browser close [targetId]`
- `browser profiles`
- `browser create-profile --name <name> [--color <hex>] [--cdp-url <url>]`
- `browser delete-profile --name <name>`

Inspecionar:

- `browser screenshot [targetId] [--full-page] [--ref <ref>] [--element <selector>] [--type png|jpeg]`
- `browser snapshot [--format aria|ai] [--target-id <id>] [--limit <n>] [--interactive] [--compact] [--depth <n>] [--selector <sel>] [--out <path>]`

Acoes:

- `browser navigate <url> [--target-id <id>]`
- `browser resize <width> <height> [--target-id <id>]`
- `browser click <ref> [--double] [--button <left|right|middle>] [--modifiers <csv>] [--target-id <id>]`
- `browser type <ref> <text> [--submit] [--slowly] [--target-id <id>]`
- `browser press <key> [--target-id <id>]`
- `browser hover <ref> [--target-id <id>]`
- `browser drag <startRef> <endRef> [--target-id <id>]`
- `browser select <ref> <values...> [--target-id <id>]`
- `browser upload <paths...> [--ref <ref>] [--input-ref <ref>] [--element <selector>] [--target-id <id>] [--timeout-ms <ms>]`
- `browser fill [--fields <json>] [--fields-file <path>] [--target-id <id>]`
- `browser dialog --accept|--dismiss [--prompt <text>] [--target-id <id>] [--timeout-ms <ms>]`
- `browser wait [--time <ms>] [--text <value>] [--text-gone <value>] [--target-id <id>]`
- `browser evaluate --fn <code> [--ref <ref>] [--target-id <id>]`
- `browser console [--level <error|warn|info>] [--target-id <id>]`
- `browser pdf [--target-id <id>]`

## Busca na documentacao

### `docs [query...]`

Pesquisa o indice ao vivo da documentacao.

## TUI

### `tui`

Abre a interface de terminal conectada ao Gateway.

Opcoes:

- `--url <url>`
- `--token <token>`
- `--password <password>`
- `--session <key>`
- `--deliver`
- `--thinking <level>`
- `--message <text>`
- `--timeout-ms <ms>` (padrao para `agents.defaults.timeoutSeconds`)
- `--history-limit <n>`
