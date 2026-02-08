---
summary: "Runbook para o servico Gateway, ciclo de vida e operacoes"
read_when:
  - Ao executar ou depurar o processo do gateway
title: "Runbook do Gateway"
x-i18n:
  source_path: gateway/index.md
  source_hash: 497d58090faaa6bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:51Z
---

# Runbook do servico Gateway

Ultima atualizacao: 2025-12-09

## O que e

- O processo sempre ativo que possui a unica conexao Baileys/Telegram e o plano de controle/eventos.
- Substitui o comando legado `gateway`. Ponto de entrada CLI: `openclaw gateway`.
- Executa ate ser interrompido; sai com codigo diferente de zero em erros fatais para que o supervisor reinicie.

## Como executar (local)

```bash
openclaw gateway --port 18789
# for full debug/trace logs in stdio:
openclaw gateway --port 18789 --verbose
# if the port is busy, terminate listeners then start:
openclaw gateway --force
# dev loop (auto-reload on TS changes):
pnpm gateway:watch
```

- O hot reload de configuracao observa `~/.openclaw/openclaw.json` (ou `OPENCLAW_CONFIG_PATH`).
  - Modo padrao: `gateway.reload.mode="hybrid"` (aplica alteracoes seguras a quente, reinicia em casos criticos).
  - O hot reload usa reinicio em processo via **SIGUSR1** quando necessario.
  - Desative com `gateway.reload.mode="off"`.
- Associa o plano de controle WebSocket a `127.0.0.1:<port>` (padrao 18789).
- A mesma porta tambem serve HTTP (UI de controle, hooks, A2UI). Multiplexacao em porta unica.
  - OpenAI Chat Completions (HTTP): [`/v1/chat/completions`](/gateway/openai-http-api).
  - OpenResponses (HTTP): [`/v1/responses`](/gateway/openresponses-http-api).
  - Tools Invoke (HTTP): [`/tools/invoke`](/gateway/tools-invoke-http-api).
- Inicia um servidor de arquivos Canvas por padrao em `canvasHost.port` (padrao `18793`), servindo `http://<gateway-host>:18793/__openclaw__/canvas/` a partir de `~/.openclaw/workspace/canvas`. Desative com `canvasHost.enabled=false` ou `OPENCLAW_SKIP_CANVAS_HOST=1`.
- Registra logs em stdout; use launchd/systemd para mantê-lo ativo e rotacionar logs.
- Passe `--verbose` para espelhar logs de depuracao (handshakes, req/res, eventos) do arquivo de log para stdio ao solucionar problemas.
- `--force` usa `lsof` para encontrar listeners na porta escolhida, envia SIGTERM, registra o que foi encerrado e entao inicia o gateway (falha rapidamente se `lsof` estiver ausente).
- Se voce executar sob um supervisor (launchd/systemd/modo processo-filho de app mac), um stop/restart normalmente envia **SIGTERM**; builds mais antigos podem expor isso como `pnpm` `ELIFECYCLE` codigo de saida **143** (SIGTERM), que e um desligamento normal, nao um crash.
- **SIGUSR1** aciona um reinicio em processo quando autorizado (gateway tool/config apply/update, ou habilite `commands.restart` para reinicios manuais).
- Autenticacao do Gateway e exigida por padrao: defina `gateway.auth.token` (ou `OPENCLAW_GATEWAY_TOKEN`) ou `gateway.auth.password`. Clientes devem enviar `connect.params.auth.token/password` a menos que usem identidade Tailscale Serve.
- O assistente agora gera um token por padrao, mesmo em loopback.
- Precedencia de portas: `--port` > `OPENCLAW_GATEWAY_PORT` > `gateway.port` > padrao `18789`.

## Acesso remoto

- Tailscale/VPN preferido; caso contrario, tunel SSH:
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- Os clientes entao se conectam a `ws://127.0.0.1:18789` atraves do tunel.
- Se um token estiver configurado, os clientes devem inclui-lo em `connect.params.auth.token` mesmo pelo tunel.

## Multiplos gateways (mesmo host)

Geralmente desnecessario: um Gateway pode atender varios canais de mensagens e agentes. Use multiplos Gateways apenas para redundancia ou isolamento rigoroso (ex: bot de resgate).

Compatível se voce isolar estado + configuracao e usar portas unicas. Guia completo: [Multiplos gateways](/gateway/multiple-gateways).

Os nomes de servico reconhecem perfis:

- macOS: `bot.molt.<profile>` (o legado `com.openclaw.*` ainda pode existir)
- Linux: `openclaw-gateway-<profile>.service`
- Windows: `OpenClaw Gateway (<profile>)`

Os metadados de instalacao ficam incorporados na configuracao do servico:

- `OPENCLAW_SERVICE_MARKER=openclaw`
- `OPENCLAW_SERVICE_KIND=gateway`
- `OPENCLAW_SERVICE_VERSION=<version>`

Padrao Rescue-Bot: mantenha um segundo Gateway isolado com seu proprio perfil, diretorio de estado, workspace e espacamento de portas base. Guia completo: [Guia de rescue-bot](/gateway/multiple-gateways#rescue-bot-guide).

### Perfil dev (`--dev`)

Caminho rapido: execute uma instancia dev totalmente isolada (config/estado/workspace) sem tocar na sua configuracao principal.

```bash
openclaw --dev setup
openclaw --dev gateway --allow-unconfigured
# then target the dev instance:
openclaw --dev status
openclaw --dev health
```

Padroes (podem ser substituidos via env/flags/config):

- `OPENCLAW_STATE_DIR=~/.openclaw-dev`
- `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
- `OPENCLAW_GATEWAY_PORT=19001` (Gateway WS + HTTP)
- porta do servico de controle do navegador = `19003` (derivada: `gateway.port+2`, somente loopback)
- `canvasHost.port=19005` (derivada: `gateway.port+4`)
- `agents.defaults.workspace` passa a ser `~/.openclaw/workspace-dev` por padrao quando voce executa `setup`/`onboard` sob `--dev`.

Portas derivadas (regras praticas):

- Porta base = `gateway.port` (ou `OPENCLAW_GATEWAY_PORT` / `--port`)
- porta do servico de controle do navegador = base + 2 (somente loopback)
- `canvasHost.port = base + 4` (ou `OPENCLAW_CANVAS_HOST_PORT` / override de config)
- Portas CDP do perfil do navegador alocam automaticamente a partir de `browser.controlPort + 9 .. + 108` (persistidas por perfil).

Checklist por instancia:

- `gateway.port` exclusivo
- `OPENCLAW_CONFIG_PATH` exclusivo
- `OPENCLAW_STATE_DIR` exclusivo
- `agents.defaults.workspace` exclusivo
- numeros de WhatsApp separados (se usar WA)

Instalacao de servico por perfil:

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```

Exemplo:

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/a.json OPENCLAW_STATE_DIR=~/.openclaw-a openclaw gateway --port 19001
OPENCLAW_CONFIG_PATH=~/.openclaw/b.json OPENCLAW_STATE_DIR=~/.openclaw-b openclaw gateway --port 19002
```

## Protocolo (visao do operador)

- Documentacao completa: [Protocolo do Gateway](/gateway/protocol) e [Protocolo Bridge (legado)](/gateway/bridge-protocol).
- Primeiro frame obrigatorio do cliente: `req {type:"req", id, method:"connect", params:{minProtocol,maxProtocol,client:{id,displayName?,version,platform,deviceFamily?,modelIdentifier?,mode,instanceId?}, caps, auth?, locale?, userAgent? } }`.
- O Gateway responde `res {type:"res", id, ok:true, payload:hello-ok }` (ou `ok:false` com erro, depois fecha).
- Apos o handshake:
  - Requisicoes: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - Eventos: `{type:"event", event, payload, seq?, stateVersion?}`
- Entradas de presenca estruturadas: `{host, ip, version, platform?, deviceFamily?, modelIdentifier?, mode, lastInputSeconds?, ts, reason?, tags?[], instanceId? }` (para clientes WS, `instanceId` vem de `connect.client.instanceId`).
- Respostas `agent` sao em dois estagios: primeiro `res` ack `{runId,status:"accepted"}`, depois um `res` final `{runId,status:"ok"|"error",summary}` apos a execucao terminar; saida em streaming chega como `event:"agent"`.

## Metodos (conjunto inicial)

- `health` — snapshot completo de saude (mesma estrutura de `openclaw health --json`).
- `status` — resumo curto.
- `system-presence` — lista de presenca atual.
- `system-event` — postar uma nota de presenca/sistema (estruturada).
- `send` — enviar uma mensagem via o(s) canal(is) ativo(s).
- `agent` — executar um turno do agente (transmite eventos de volta na mesma conexao).
- `node.list` — listar nos emparelhados + nos atualmente conectados (inclui `caps`, `deviceFamily`, `modelIdentifier`, `paired`, `connected` e `commands` anunciados).
- `node.describe` — descrever um no (capacidades + comandos `node.invoke` suportados; funciona para nos emparelhados e para nos nao emparelhados atualmente conectados).
- `node.invoke` — invocar um comando em um no (ex: `canvas.*`, `camera.*`).
- `node.pair.*` — ciclo de vida de emparelhamento (`request`, `list`, `approve`, `reject`, `verify`).

Veja tambem: [Presenca](/concepts/presence) para como a presenca e produzida/deduplicada e por que um `client.instanceId` estavel importa.

## Eventos

- `agent` — eventos de ferramenta/saida transmitidos da execucao do agente (marcados por seq).
- `presence` — atualizacoes de presenca (deltas com stateVersion) enviadas a todos os clientes conectados.
- `tick` — keepalive/no-op periodico para confirmar vivacidade.
- `shutdown` — o Gateway esta encerrando; o payload inclui `reason` e opcional `restartExpectedMs`. Clientes devem reconectar.

## Integracao com WebChat

- WebChat e uma UI nativa SwiftUI que fala diretamente com o WebSocket do Gateway para historico, envios, abortar e eventos.
- O uso remoto passa pelo mesmo tunel SSH/Tailscale; se um token do gateway estiver configurado, o cliente o inclui durante `connect`.
- O app macOS conecta via um unico WS (conexao compartilhada); ele hidrata a presenca a partir do snapshot inicial e escuta eventos `presence` para atualizar a UI.

## Tipagem e validacao

- O servidor valida cada frame de entrada com AJV contra JSON Schema emitido a partir das definicoes do protocolo.
- Clientes (TS/Swift) consomem tipos gerados (TS diretamente; Swift via o gerador do repositorio).
- As definicoes do protocolo sao a fonte da verdade; regenere schema/modelos com:
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`

## Snapshot de conexao

- `hello-ok` inclui um `snapshot` com `presence`, `health`, `stateVersion` e `uptimeMs` mais `policy {maxPayload,maxBufferedBytes,tickIntervalMs}` para que os clientes renderizem imediatamente sem requisicoes extras.
- `health`/`system-presence` permanecem disponiveis para atualizacao manual, mas nao sao obrigatorios no momento da conexao.

## Codigos de erro (formato res.error)

- Erros usam `{ code, message, details?, retryable?, retryAfterMs? }`.
- Codigos padrao:
  - `NOT_LINKED` — WhatsApp nao autenticado.
  - `AGENT_TIMEOUT` — o agente nao respondeu dentro do prazo configurado.
  - `INVALID_REQUEST` — falha de validacao de schema/parametros.
  - `UNAVAILABLE` — o Gateway esta desligando ou uma dependencia esta indisponivel.

## Comportamento de keepalive

- Eventos `tick` (ou WS ping/pong) sao emitidos periodicamente para que os clientes saibam que o Gateway esta ativo mesmo quando nao ha trafego.
- Acks de envio/agente permanecem respostas separadas; nao sobrecarregue ticks para envios.

## Replay / lacunas

- Eventos nao sao reproduzidos. Clientes detectam lacunas de seq e devem atualizar (`health` + `system-presence`) antes de continuar. WebChat e clientes macOS agora atualizam automaticamente ao detectar lacuna.

## Supervisao (exemplo macOS)

- Use launchd para manter o servico ativo:
  - Program: caminho para `openclaw`
  - Arguments: `gateway`
  - KeepAlive: true
  - StandardOut/Err: caminhos de arquivo ou `syslog`
- Em falha, o launchd reinicia; uma misconfiguracao fatal deve continuar saindo para que o operador perceba.
- LaunchAgents sao por usuario e exigem uma sessao com login; para setups headless use um LaunchDaemon customizado (nao fornecido).
  - `openclaw gateway install` grava `~/Library/LaunchAgents/bot.molt.gateway.plist`
    (ou `bot.molt.<profile>.plist`; o legado `com.openclaw.*` e limpo).
  - `openclaw doctor` audita a configuracao do LaunchAgent e pode atualiza-la para os padroes atuais.

## Gerenciamento do servico Gateway (CLI)

Use a CLI do Gateway para instalar/iniciar/parar/reiniciar/status:

```bash
openclaw gateway status
openclaw gateway install
openclaw gateway stop
openclaw gateway restart
openclaw logs --follow
```

Notas:

- `gateway status` verifica o RPC do Gateway por padrao usando a porta/config resolvidas do servico (override com `--url`).
- `gateway status --deep` adiciona varreduras em nivel de sistema (LaunchDaemons/unidades systemd).
- `gateway status --no-probe` ignora a verificacao RPC (util quando a rede esta fora).
- `gateway status --json` e estavel para scripts.
- `gateway status` relata **tempo de execucao do supervisor** (launchd/systemd em execucao) separadamente de **alcancabilidade RPC** (conexao WS + status RPC).
- `gateway status` imprime o caminho da config + alvo da verificacao para evitar confusao “localhost vs bind LAN” e incompatibilidades de perfil.
- `gateway status` inclui a ultima linha de erro do gateway quando o servico parece em execucao mas a porta esta fechada.
- `logs` faz tail do log de arquivo do Gateway via RPC (sem `tail`/`grep` manuais).
- Se outros servicos semelhantes a gateway forem detectados, a CLI avisa a menos que sejam servicos de perfil OpenClaw.
  Ainda recomendamos **um gateway por maquina** para a maioria dos setups; use perfis/portas isolados para redundancia ou um bot de resgate. Veja [Multiplos gateways](/gateway/multiple-gateways).
  - Limpeza: `openclaw gateway uninstall` (servico atual) e `openclaw doctor` (migracoes legadas).
- `gateway install` e no-op quando ja instalado; use `openclaw gateway install --force` para reinstalar (alteracoes de perfil/env/caminho).

App mac empacotado:

- OpenClaw.app pode empacotar um relay de gateway baseado em Node e instalar um LaunchAgent por usuario rotulado
  `bot.molt.gateway` (ou `bot.molt.<profile>`; rotulos legados `com.openclaw.*` ainda descarregam corretamente).
- Para parar de forma limpa, use `openclaw gateway stop` (ou `launchctl bootout gui/$UID/bot.molt.gateway`).
- Para reiniciar, use `openclaw gateway restart` (ou `launchctl kickstart -k gui/$UID/bot.molt.gateway`).
  - `launchctl` so funciona se o LaunchAgent estiver instalado; caso contrario use `openclaw gateway install` primeiro.
  - Substitua o rotulo por `bot.molt.<profile>` ao executar um perfil nomeado.

## Supervisao (unit de usuario systemd)

O OpenClaw instala um **servico de usuario systemd** por padrao no Linux/WSL2. Recomendamos
servicos de usuario para maquinas de usuario unico (ambiente mais simples, config por usuario).
Use um **servico de sistema** para servidores multiusuario ou sempre ativos (sem necessidade de lingering, supervisao compartilhada).

`openclaw gateway install` grava a unit de usuario. `openclaw doctor` audita a
unit e pode atualiza-la para corresponder aos padroes recomendados atuais.

Crie `~/.config/systemd/user/openclaw-gateway[-<profile>].service`:

```
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5
Environment=OPENCLAW_GATEWAY_TOKEN=
WorkingDirectory=/home/youruser

[Install]
WantedBy=default.target
```

Habilite lingering (necessario para que o servico de usuario sobreviva a logout/idle):

```
sudo loginctl enable-linger youruser
```

A integracao inicial executa isso no Linux/WSL2 (pode solicitar sudo; grava `/var/lib/systemd/linger`).
Depois habilite o servico:

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```

**Alternativa (servico de sistema)** - para servidores sempre ativos ou multiusuario, voce pode
instalar uma unit **de sistema** systemd em vez de uma unit de usuario (sem lingering).
Crie `/etc/systemd/system/openclaw-gateway[-<profile>].service` (copie a unit acima,
altere `WantedBy=multi-user.target`, defina `User=` + `WorkingDirectory=`), depois:

```
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway[-<profile>].service
```

## Windows (WSL2)

Instalacoes no Windows devem usar **WSL2** e seguir a secao systemd do Linux acima.

## Verificacoes operacionais

- Vivacidade: abra WS e envie `req:connect` → espere `res` com `payload.type="hello-ok"` (com snapshot).
- Prontidao: chame `health` → espere `ok: true` e um canal vinculado em `linkChannel` (quando aplicavel).
- Depuracao: inscreva-se nos eventos `tick` e `presence`; garanta que `status` mostre idade de vinculo/autenticacao; entradas de presenca mostram o host do Gateway e clientes conectados.

## Garantias de seguranca

- Assuma um Gateway por host por padrao; se voce executar multiplos perfis, isole portas/estado e aponte para a instancia correta.
- Sem fallback para conexoes diretas Baileys; se o Gateway estiver fora, os envios falham rapidamente.
- Frames iniciais nao-conect ou JSON malformado sao rejeitados e o socket e fechado.
- Desligamento gracioso: emitir evento `shutdown` antes de fechar; clientes devem lidar com fechamento + reconexao.

## Ajudantes de CLI

- `openclaw gateway health|status` — solicitar saude/status pelo WS do Gateway.
- `openclaw message send --target <num> --message "hi" [--media ...]` — enviar via Gateway (idempotente para WhatsApp).
- `openclaw agent --message "hi" --to <num>` — executar um turno do agente (aguarda o final por padrao).
- `openclaw gateway call <method> --params '{"k":"v"}'` — invocador de metodo bruto para depuracao.
- `openclaw gateway stop|restart` — parar/reiniciar o servico de gateway supervisionado (launchd/systemd).
- Subcomandos auxiliares do Gateway assumem um gateway em execucao em `--url`; eles nao iniciam mais automaticamente um.

## Orientacao de migracao

- Descontinue usos de `openclaw gateway` e da porta de controle TCP legada.
- Atualize clientes para falar o protocolo WS com connect obrigatorio e presenca estruturada.
