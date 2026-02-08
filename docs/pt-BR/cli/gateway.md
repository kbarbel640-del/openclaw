---
summary: "OpenClaw Gateway CLI (`openclaw gateway`) — executar, consultar e descobrir gateways"
read_when:
  - Executando o Gateway a partir da CLI (dev ou servidores)
  - Depurando autenticacao do Gateway, modos de bind e conectividade
  - Descobrindo gateways via Bonjour (LAN + tailnet)
title: "gateway"
x-i18n:
  source_path: cli/gateway.md
  source_hash: cbc1690e6be84073
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:47Z
---

# Gateway CLI

O Gateway é o servidor WebSocket do OpenClaw (canais, nós, sessões, hooks).

Os subcomandos nesta página ficam sob `openclaw gateway …`.

Documentos relacionados:

- [/gateway/bonjour](/gateway/bonjour)
- [/gateway/discovery](/gateway/discovery)
- [/gateway/configuration](/gateway/configuration)

## Executar o Gateway

Execute um processo local do Gateway:

```bash
openclaw gateway
```

Alias em primeiro plano:

```bash
openclaw gateway run
```

Notas:

- Por padrão, o Gateway se recusa a iniciar a menos que `gateway.mode=local` esteja definido em `~/.openclaw/openclaw.json`. Use `--allow-unconfigured` para execuções ad-hoc/dev.
- Vincular além do loopback sem autenticacao é bloqueado (proteção de segurança).
- `SIGUSR1` aciona um reinicio no processo quando autorizado (habilite `commands.restart` ou use a ferramenta/configuracao do gateway apply/update).
- Os manipuladores `SIGINT`/`SIGTERM` encerram o processo do gateway, mas não restauram nenhum estado personalizado do terminal. Se voce envolver a CLI com uma TUI ou entrada em modo raw, restaure o terminal antes de sair.

### Opções

- `--port <port>`: porta WebSocket (o padrão vem da config/env; geralmente `18789`).
- `--bind <loopback|lan|tailnet|auto|custom>`: modo de bind do listener.
- `--auth <token|password>`: substituicao do modo de autenticacao.
- `--token <token>`: substituicao de token (também define `OPENCLAW_GATEWAY_TOKEN` para o processo).
- `--password <password>`: substituicao de senha (também define `OPENCLAW_GATEWAY_PASSWORD` para o processo).
- `--tailscale <off|serve|funnel>`: expor o Gateway via Tailscale.
- `--tailscale-reset-on-exit`: redefinir a configuracao de serve/funnel do Tailscale ao desligar.
- `--allow-unconfigured`: permitir iniciar o gateway sem `gateway.mode=local` na configuracao.
- `--dev`: criar uma configuracao + workspace de dev se estiverem ausentes (ignora BOOTSTRAP.md).
- `--reset`: redefinir configuracao de dev + credenciais + sessoes + workspace (requer `--dev`).
- `--force`: encerrar qualquer listener existente na porta selecionada antes de iniciar.
- `--verbose`: logs verbosos.
- `--claude-cli-logs`: mostrar apenas logs do claude-cli no console (e habilitar seu stdout/stderr).
- `--ws-log <auto|full|compact>`: estilo de log do websocket (padrão `auto`).
- `--compact`: alias para `--ws-log compact`.
- `--raw-stream`: registrar eventos brutos do stream do modelo em jsonl.
- `--raw-stream-path <path>`: caminho do jsonl de stream bruto.

## Consultar um Gateway em execucao

Todos os comandos de consulta usam RPC via WebSocket.

Modos de saída:

- Padrão: legível para humanos (colorido em TTY).
- `--json`: JSON legível por máquina (sem estilo/spinner).
- `--no-color` (ou `NO_COLOR=1`): desabilitar ANSI mantendo o layout humano.

Opções compartilhadas (quando suportadas):

- `--url <url>`: URL do WebSocket do Gateway.
- `--token <token>`: token do Gateway.
- `--password <password>`: senha do Gateway.
- `--timeout <ms>`: tempo limite/orcamento (varia por comando).
- `--expect-final`: aguardar uma resposta “final” (chamadas de agente).

Nota: quando voce define `--url`, a CLI não faz fallback para credenciais de configuracao ou ambiente.
Passe `--token` ou `--password` explicitamente. A ausencia de credenciais explícitas é um erro.

### `gateway health`

```bash
openclaw gateway health --url ws://127.0.0.1:18789
```

### `gateway status`

`gateway status` mostra o serviço do Gateway (launchd/systemd/schtasks) além de uma sondagem RPC opcional.

```bash
openclaw gateway status
openclaw gateway status --json
```

Opções:

- `--url <url>`: substituir a URL da sonda.
- `--token <token>`: autenticacao por token para a sonda.
- `--password <password>`: autenticacao por senha para a sonda.
- `--timeout <ms>`: tempo limite da sonda (padrão `10000`).
- `--no-probe`: pular a sondagem RPC (visao apenas do serviço).
- `--deep`: varrer serviços em nível de sistema também.

### `gateway probe`

`gateway probe` é o comando “depurar tudo”. Ele sempre sonda:

- seu gateway remoto configurado (se definido), e
- localhost (loopback) **mesmo que o remoto esteja configurado**.

Se vários gateways estiverem acessíveis, ele imprime todos. Vários gateways são suportados quando voce usa perfis/portas isolados (por exemplo, um bot de resgate), mas a maioria das instalacoes ainda executa um único gateway.

```bash
openclaw gateway probe
openclaw gateway probe --json
```

#### Remoto via SSH (paridade com app Mac)

O modo “Remote over SSH” do app macOS usa um redirecionamento de porta local para que o gateway remoto (que pode estar vinculado apenas ao loopback) fique acessível em `ws://127.0.0.1:<port>`.

Equivalente na CLI:

```bash
openclaw gateway probe --ssh user@gateway-host
```

Opções:

- `--ssh <target>`: `user@host` ou `user@host:port` (a porta padrão é `22`).
- `--ssh-identity <path>`: arquivo de identidade.
- `--ssh-auto`: escolher o primeiro host de gateway descoberto como alvo SSH (apenas LAN/WAB).

Configuracao (opcional, usada como padrões):

- `gateway.remote.sshTarget`
- `gateway.remote.sshIdentity`

### `gateway call <method>`

Auxiliar RPC de baixo nível.

```bash
openclaw gateway call status
openclaw gateway call logs.tail --params '{"sinceMs": 60000}'
```

## Gerenciar o serviço do Gateway

```bash
openclaw gateway install
openclaw gateway start
openclaw gateway stop
openclaw gateway restart
openclaw gateway uninstall
```

Notas:

- `gateway install` suporta `--port`, `--runtime`, `--token`, `--force`, `--json`.
- Comandos de ciclo de vida aceitam `--json` para scripts.

## Descobrir gateways (Bonjour)

`gateway discover` varre por beacons do Gateway (`_openclaw-gw._tcp`).

- Multicast DNS-SD: `local.`
- Unicast DNS-SD (Wide-Area Bonjour): escolha um dominio (exemplo: `openclaw.internal.`) e configure split DNS + um servidor DNS; veja [/gateway/bonjour](/gateway/bonjour)

Apenas gateways com descoberta Bonjour habilitada (padrão) anunciam o beacon.

Registros de descoberta Wide-Area incluem (TXT):

- `role` (dica de papel do gateway)
- `transport` (dica de transporte, por exemplo `gateway`)
- `gatewayPort` (porta WebSocket, geralmente `18789`)
- `sshPort` (porta SSH; padrão `22` se não presente)
- `tailnetDns` (hostname MagicDNS, quando disponível)
- `gatewayTls` / `gatewayTlsSha256` (TLS habilitado + fingerprint do certificado)
- `cliPath` (dica opcional para instalacoes remotas)

### `gateway discover`

```bash
openclaw gateway discover
```

Opções:

- `--timeout <ms>`: tempo limite por comando (browse/resolve); padrão `2000`.
- `--json`: saída legível por máquina (também desabilita estilo/spinner).

Exemplos:

```bash
openclaw gateway discover --timeout 4000
openclaw gateway discover --json | jq '.beacons[].wsUrl'
```
