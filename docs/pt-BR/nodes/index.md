---
summary: "Nodes: pareamento, capacidades, permissoes e auxiliares de CLI para canvas/camera/tela/sistema"
read_when:
  - Pareamento de nodes iOS/Android a um gateway
  - Uso de canvas/camera do node para contexto do agente
  - Adicao de novos comandos de node ou auxiliares de CLI
title: "Nodes"
x-i18n:
  source_path: nodes/index.md
  source_hash: 74e9420f61c653e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:56Z
---

# Nodes

Um **node** e um dispositivo complementar (macOS/iOS/Android/headless) que se conecta ao **WebSocket** do Gateway (mesma porta que os operadores) com `role: "node"` e expõe uma superficie de comandos (por exemplo, `canvas.*`, `camera.*`, `system.*`) via `node.invoke`. Detalhes do protocolo: [Gateway protocol](/gateway/protocol).

Transporte legado: [Bridge protocol](/gateway/bridge-protocol) (TCP JSONL; obsoleto/removido para nodes atuais).

O macOS tambem pode rodar em **modo node**: o app da barra de menus se conecta ao servidor WS do Gateway e expõe seus comandos locais de canvas/camera como um node (assim `openclaw nodes …` funciona contra este Mac).

Notas:

- Nodes sao **perifericos**, nao gateways. Eles nao executam o servico do gateway.
- Mensagens do Telegram/WhatsApp/etc. chegam ao **gateway**, nao aos nodes.

## Pareamento + status

**Nodes WS usam pareamento de dispositivo.** Os nodes apresentam uma identidade de dispositivo durante `connect`; o Gateway
cria uma solicitacao de pareamento de dispositivo para `role: node`. Aprove via a CLI (ou UI) do dispositivo.

CLI rapido:

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
```

Notas:

- `nodes status` marca um node como **pareado** quando sua funcao de pareamento de dispositivo inclui `node`.
- `node.pair.*` (CLI: `openclaw nodes pending/approve/reject`) e um armazenamento de pareamento de node separado, de propriedade do gateway; ele **nao** bloqueia o handshake WS de `connect`.

## Host de node remoto (system.run)

Use um **host de node** quando seu Gateway roda em uma maquina e voce quer que os comandos
sejam executados em outra. O modelo ainda fala com o **gateway**; o gateway
encaminha chamadas `exec` para o **host de node** quando `host=node` e selecionado.

### O que roda onde

- **Host do Gateway**: recebe mensagens, executa o modelo, roteia chamadas de ferramentas.
- **Host do node**: executa `system.run`/`system.which` na maquina do node.
- **Aprovacoes**: aplicadas no host do node via `~/.openclaw/exec-approvals.json`.

### Iniciar um host de node (foreground)

Na maquina do node:

```bash
openclaw node run --host <gateway-host> --port 18789 --display-name "Build Node"
```

### Gateway remoto via tunel SSH (bind em loopback)

Se o Gateway fizer bind em loopback (`gateway.bind=loopback`, padrao no modo local),
hosts de node remotos nao conseguem se conectar diretamente. Crie um tunel SSH e aponte o
host de node para a extremidade local do tunel.

Exemplo (host de node -> host do gateway):

```bash
# Terminal A (keep running): forward local 18790 -> gateway 127.0.0.1:18789
ssh -N -L 18790:127.0.0.1:18789 user@gateway-host

# Terminal B: export the gateway token and connect through the tunnel
export OPENCLAW_GATEWAY_TOKEN="<gateway-token>"
openclaw node run --host 127.0.0.1 --port 18790 --display-name "Build Node"
```

Notas:

- O token e `gateway.auth.token` da configuracao do gateway (`~/.openclaw/openclaw.json` no host do gateway).
- `openclaw node run` le `OPENCLAW_GATEWAY_TOKEN` para autenticacao.

### Iniciar um host de node (servico)

```bash
openclaw node install --host <gateway-host> --port 18789 --display-name "Build Node"
openclaw node restart
```

### Parear + nomear

No host do gateway:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes list
```

Opcoes de nomeacao:

- `--display-name` em `openclaw node run` / `openclaw node install` (persiste em `~/.openclaw/node.json` no node).
- `openclaw nodes rename --node <id|name|ip> --name "Build Node"` (sobrescrita no gateway).

### Allowlist dos comandos

Aprovacoes de exec sao **por host de node**. Adicione entradas de allowlist a partir do gateway:

```bash
openclaw approvals allowlist add --node <id|name|ip> "/usr/bin/uname"
openclaw approvals allowlist add --node <id|name|ip> "/usr/bin/sw_vers"
```

As aprovacoes ficam no host do node em `~/.openclaw/exec-approvals.json`.

### Apontar exec para o node

Configure padroes (configuracao do gateway):

```bash
openclaw config set tools.exec.host node
openclaw config set tools.exec.security allowlist
openclaw config set tools.exec.node "<id-or-name>"
```

Ou por sessao:

```
/exec host=node security=allowlist node=<id-or-name>
```

Uma vez definido, qualquer chamada `exec` com `host=node` roda no host do node (sujeito a
allowlist/aprovacoes do node).

Relacionado:

- [Node host CLI](/cli/node)
- [Exec tool](/tools/exec)
- [Exec approvals](/tools/exec-approvals)

## Invocando comandos

Baixo nivel (RPC bruto):

```bash
openclaw nodes invoke --node <idOrNameOrIp> --command canvas.eval --params '{"javaScript":"location.href"}'
```

Existem auxiliares de nivel mais alto para os fluxos comuns de “dar ao agente um anexo de MEDIA”.

## Capturas de tela (snapshots do canvas)

Se o node estiver exibindo o Canvas (WebView), `canvas.snapshot` retorna `{ format, base64 }`.

Auxiliar de CLI (grava em um arquivo temporario e imprime `MEDIA:<path>`):

```bash
openclaw nodes canvas snapshot --node <idOrNameOrIp> --format png
openclaw nodes canvas snapshot --node <idOrNameOrIp> --format jpg --max-width 1200 --quality 0.9
```

### Controles do Canvas

```bash
openclaw nodes canvas present --node <idOrNameOrIp> --target https://example.com
openclaw nodes canvas hide --node <idOrNameOrIp>
openclaw nodes canvas navigate https://example.com --node <idOrNameOrIp>
openclaw nodes canvas eval --node <idOrNameOrIp> --js "document.title"
```

Notas:

- `canvas present` aceita URLs ou caminhos de arquivos locais (`--target`), alem de `--x/--y/--width/--height` opcional para posicionamento.
- `canvas eval` aceita JS inline (`--js`) ou um argumento posicional.

### A2UI (Canvas)

```bash
openclaw nodes canvas a2ui push --node <idOrNameOrIp> --text "Hello"
openclaw nodes canvas a2ui push --node <idOrNameOrIp> --jsonl ./payload.jsonl
openclaw nodes canvas a2ui reset --node <idOrNameOrIp>
```

Notas:

- Apenas A2UI v0.8 JSONL e suportado (v0.9/createSurface e rejeitado).

## Fotos + videos (camera do node)

Fotos (`jpg`):

```bash
openclaw nodes camera list --node <idOrNameOrIp>
openclaw nodes camera snap --node <idOrNameOrIp>            # default: both facings (2 MEDIA lines)
openclaw nodes camera snap --node <idOrNameOrIp> --facing front
```

Clipes de video (`mp4`):

```bash
openclaw nodes camera clip --node <idOrNameOrIp> --duration 10s
openclaw nodes camera clip --node <idOrNameOrIp> --duration 3000 --no-audio
```

Notas:

- O node deve estar **em primeiro plano** para `canvas.*` e `camera.*` (chamadas em segundo plano retornam `NODE_BACKGROUND_UNAVAILABLE`).
- A duracao do clipe e limitada (atualmente `<= 60s`) para evitar payloads base64 muito grandes.
- O Android solicitara permissoes de `CAMERA`/`RECORD_AUDIO` quando possivel; permissoes negadas falham com `*_PERMISSION_REQUIRED`.

## Gravacoes de tela (nodes)

Nodes expoem `screen.record` (mp4). Exemplo:

```bash
openclaw nodes screen record --node <idOrNameOrIp> --duration 10s --fps 10
openclaw nodes screen record --node <idOrNameOrIp> --duration 10s --fps 10 --no-audio
```

Notas:

- `screen.record` requer que o app do node esteja em primeiro plano.
- O Android exibira o prompt do sistema de captura de tela antes de gravar.
- As gravacoes de tela sao limitadas a `<= 60s`.
- `--no-audio` desativa a captura do microfone (suportado em iOS/Android; no macOS usa audio de captura do sistema).
- Use `--screen <index>` para selecionar um display quando varios monitores estiverem disponiveis.

## Localizacao (nodes)

Nodes expoem `location.get` quando Localizacao esta habilitada nas configuracoes.

Auxiliar de CLI:

```bash
openclaw nodes location get --node <idOrNameOrIp>
openclaw nodes location get --node <idOrNameOrIp> --accuracy precise --max-age 15000 --location-timeout 10000
```

Notas:

- A localizacao fica **desativada por padrao**.
- “Sempre” requer permissao do sistema; a busca em segundo plano e de melhor esforco.
- A resposta inclui lat/lon, precisao (metros) e timestamp.

## SMS (nodes Android)

Nodes Android podem expor `sms.send` quando o usuario concede permissao de **SMS** e o dispositivo suporta telefonia.

Invocacao de baixo nivel:

```bash
openclaw nodes invoke --node <idOrNameOrIp> --command sms.send --params '{"to":"+15555550123","message":"Hello from OpenClaw"}'
```

Notas:

- O prompt de permissao deve ser aceito no dispositivo Android antes que a capacidade seja anunciada.
- Dispositivos apenas com Wi‑Fi, sem telefonia, nao anunciarao `sms.send`.

## Comandos de sistema (host de node / node mac)

O node macOS expoe `system.run`, `system.notify` e `system.execApprovals.get/set`.
O host de node headless expoe `system.run`, `system.which` e `system.execApprovals.get/set`.

Exemplos:

```bash
openclaw nodes run --node <idOrNameOrIp> -- echo "Hello from mac node"
openclaw nodes notify --node <idOrNameOrIp> --title "Ping" --body "Gateway ready"
```

Notas:

- `system.run` retorna stdout/stderr/codigo de saida no payload.
- `system.notify` respeita o estado de permissao de notificacoes no app macOS.
- `system.run` suporta `--cwd`, `--env KEY=VAL`, `--command-timeout` e `--needs-screen-recording`.
- `system.notify` suporta `--priority <passive|active|timeSensitive>` e `--delivery <system|overlay|auto>`.
- Nodes macOS descartam sobrescritas de `PATH`; hosts de node headless aceitam `PATH` apenas quando ele prefixa o PATH do host de node.
- No modo node do macOS, `system.run` e controlado por aprovacoes de exec no app macOS (Configuracoes → Exec approvals).
  Perguntar/allowlist/completo se comportam da mesma forma que no host de node headless; prompts negados retornam `SYSTEM_RUN_DENIED`.
- No host de node headless, `system.run` e controlado por aprovacoes de exec (`~/.openclaw/exec-approvals.json`).

## Vinculo de exec ao node

Quando varios nodes estao disponiveis, voce pode vincular exec a um node especifico.
Isso define o node padrao para `exec host=node` (e pode ser sobrescrito por agente).

Padrao global:

```bash
openclaw config set tools.exec.node "node-id-or-name"
```

Sobrescrita por agente:

```bash
openclaw config get agents.list
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
```

Remover para permitir qualquer node:

```bash
openclaw config unset tools.exec.node
openclaw config unset agents.list[0].tools.exec.node
```

## Mapa de permissoes

Nodes podem incluir um mapa `permissions` em `node.list` / `node.describe`, indexado pelo nome da permissao (por exemplo, `screenRecording`, `accessibility`) com valores booleanos (`true` = concedido).

## Host de node headless (multiplataforma)

O OpenClaw pode rodar um **host de node headless** (sem UI) que se conecta ao
WebSocket do Gateway e expoe `system.run` / `system.which`. Isso e util em Linux/Windows
ou para executar um node minimo ao lado de um servidor.

Inicie-o:

```bash
openclaw node run --host <gateway-host> --port 18789
```

Notas:

- O pareamento ainda e necessario (o Gateway exibira um prompt de aprovacao de node).
- O host de node armazena seu id de node, token, nome de exibicao e informacoes de conexao do gateway em `~/.openclaw/node.json`.
- As aprovacoes de exec sao aplicadas localmente via `~/.openclaw/exec-approvals.json`
  (veja [Exec approvals](/tools/exec-approvals)).
- No macOS, o host de node headless prefere o host de exec do app complementar quando acessivel e faz
  fallback para execucao local se o app estiver indisponivel. Defina `OPENCLAW_NODE_EXEC_HOST=app` para exigir
  o app, ou `OPENCLAW_NODE_EXEC_FALLBACK=0` para desativar o fallback.
- Adicione `--tls` / `--tls-fingerprint` quando o WS do Gateway usar TLS.

## Modo node no Mac

- O app da barra de menus do macOS se conecta ao servidor WS do Gateway como um node (assim `openclaw nodes …` funciona contra este Mac).
- No modo remoto, o app abre um tunel SSH para a porta do Gateway e se conecta a `localhost`.
