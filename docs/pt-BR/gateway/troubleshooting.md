---
summary: "Guia rapido de solucao de problemas para falhas comuns do OpenClaw"
read_when:
  - Investigando problemas ou falhas em tempo de execucao
title: "Solucao de problemas"
x-i18n:
  source_path: gateway/troubleshooting.md
  source_hash: a07bb06f0b5ef568
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:16Z
---

# Solucao de problemas 🔧

Quando o OpenClaw se comporta mal, veja como corrigir.

Comece pelo FAQ em [Primeiros 60 segundos](/help/faq#first-60-seconds-if-somethings-broken) se voce so quer uma receita rapida de triagem. Esta pagina aprofunda falhas em tempo de execucao e diagnosticos.

Atalhos especificos por provedor: [/channels/troubleshooting](/channels/troubleshooting)

## Status e Diagnosticos

Comandos rapidos de triagem (em ordem):

| Command                            | O que informa                                                                                                                 | Quando usar                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `openclaw status`                  | Resumo local: SO + atualizacao, alcançabilidade/modo do gateway, servico, agentes/sessoes, estado da configuracao do provedor | Primeira checagem, visao geral rapida                          |
| `openclaw status --all`            | Diagnostico local completo (somente leitura, colavel, relativamente seguro), incluindo final do log                           | Quando voce precisa compartilhar um relatorio de debug         |
| `openclaw status --deep`           | Executa verificacoes de saude do gateway (incl. sondas de provedores; requer gateway acessivel)                               | Quando “configurado” nao significa “funcionando”               |
| `openclaw gateway probe`           | Descoberta do gateway + alcançabilidade (alvos locais e remotos)                                                              | Quando voce suspeita que esta sondando o gateway errado        |
| `openclaw channels status --probe` | Consulta o gateway em execucao pelo status dos canais (e opcionalmente sonda)                                                 | Quando o gateway esta acessivel mas os canais se comportam mal |
| `openclaw gateway status`          | Estado do supervisor (launchd/systemd/schtasks), PID/saida em tempo de execucao, ultimo erro do gateway                       | Quando o servico “parece carregado” mas nada roda              |
| `openclaw logs --follow`           | Logs ao vivo (melhor sinal para problemas em tempo de execucao)                                                               | Quando voce precisa do motivo real da falha                    |

**Compartilhar saida:** prefira `openclaw status --all` (ele mascara tokens). Se voce colar `openclaw status`, considere definir `OPENCLAW_SHOW_SECRETS=0` antes (previas de token).

Veja tambem: [Health checks](/gateway/health) e [Logging](/logging).

## Problemas comuns

### No API key found for provider "anthropic"

Isso significa que o **armazenamento de autenticacao do agente esta vazio** ou sem credenciais da Anthropic.
A autenticacao e **por agente**, entao um agente novo nao herda as chaves do agente principal.

Opcoes de correcao:

- Reexecute a integracao inicial e escolha **Anthropic** para esse agente.
- Ou cole um setup-token no **host do gateway**:
  ```bash
  openclaw models auth setup-token --provider anthropic
  ```
- Ou copie `auth-profiles.json` do diretorio do agente principal para o diretorio do novo agente.

Verifique:

```bash
openclaw models status
```

### OAuth token refresh failed (Anthropic Claude subscription)

Isso significa que o token OAuth da Anthropic armazenado expirou e a atualizacao falhou.
Se voce esta em uma assinatura Claude (sem API key), a correcao mais confiavel e
mudar para um **Claude Code setup-token** e cola-lo no **host do gateway**.

**Recomendado (setup-token):**

```bash
# Run on the gateway host (paste the setup-token)
openclaw models auth setup-token --provider anthropic
openclaw models status
```

Se voce gerou o token em outro lugar:

```bash
openclaw models auth paste-token --provider anthropic
openclaw models status
```

Mais detalhes: [Anthropic](/providers/anthropic) e [OAuth](/concepts/oauth).

### Control UI falha em HTTP ("device identity required" / "connect failed")

Se voce abre o painel via HTTP simples (por exemplo `http://<lan-ip>:18789/` ou
`http://<tailscale-ip>:18789/`), o navegador roda em um **contexto nao seguro** e
bloqueia o WebCrypto, entao a identidade do dispositivo nao pode ser gerada.

**Correcao:**

- Prefira HTTPS via [Tailscale Serve](/gateway/tailscale).
- Ou abra localmente no host do gateway: `http://127.0.0.1:18789/`.
- Se precisar permanecer em HTTP, habilite `gateway.controlUi.allowInsecureAuth: true` e
  use um token de gateway (somente token; sem identidade/pareamento de dispositivo). Veja
  [Control UI](/web/control-ui#insecure-http).

### CI Secrets Scan Failed

Isso significa que `detect-secrets` encontrou novos candidatos ainda nao presentes no baseline.
Siga [Secret scanning](/gateway/security#secret-scanning-detect-secrets).

### Service Installed but Nothing is Running

Se o servico do gateway esta instalado mas o processo sai imediatamente, o servico
pode parecer “carregado” enquanto nada esta rodando.

**Verifique:**

```bash
openclaw gateway status
openclaw doctor
```

Doctor/servico mostrara o estado em tempo de execucao (PID/ultima saida) e dicas de log.

**Logs:**

- Preferido: `openclaw logs --follow`
- Logs em arquivo (sempre): `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (ou seu `logging.file` configurado)
- macOS LaunchAgent (se instalado): `$OPENCLAW_STATE_DIR/logs/gateway.log` e `gateway.err.log`
- Linux systemd (se instalado): `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`
- Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST`

**Habilitar mais logging:**

- Aumentar detalhe do log em arquivo (JSONL persistido):
  ```json
  { "logging": { "level": "debug" } }
  ```
- Aumentar verbosidade do console (somente saida TTY):
  ```json
  { "logging": { "consoleLevel": "debug", "consoleStyle": "pretty" } }
  ```
- Dica rapida: `--verbose` afeta apenas a saida do **console**. Logs em arquivo continuam controlados por `logging.level`.

Veja [/logging](/logging) para uma visao completa de formatos, configuracao e acesso.

### "Gateway start blocked: set gateway.mode=local"

Isso significa que a configuracao existe, mas `gateway.mode` nao esta definido (ou nao e `local`), entao o
Gateway se recusa a iniciar.

**Correcao (recomendada):**

- Execute o assistente e defina o modo de execucao do Gateway como **Local**:
  ```bash
  openclaw configure
  ```
- Ou defina diretamente:
  ```bash
  openclaw config set gateway.mode local
  ```

**Se voce pretendia executar um Gateway remoto:**

- Defina uma URL remota e mantenha `gateway.mode=remote`:
  ```bash
  openclaw config set gateway.mode remote
  openclaw config set gateway.remote.url "wss://gateway.example.com"
  ```

**Ad-hoc/dev apenas:** passe `--allow-unconfigured` para iniciar o gateway sem
`gateway.mode=local`.

**Ainda sem arquivo de configuracao?** Execute `openclaw setup` para criar uma configuracao inicial e entao reexecute
o gateway.

### Ambiente do Servico (PATH + runtime)

O servico do gateway roda com um **PATH minimo** para evitar sujeira de shell/gerenciadores:

- macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`
- Linux: `/usr/local/bin`, `/usr/bin`, `/bin`

Isso exclui intencionalmente gerenciadores de versao (nvm/fnm/volta/asdf) e gerenciadores
de pacotes (pnpm/npm) porque o servico nao carrega o init do seu shell. Variaveis
de runtime como `DISPLAY` devem ficar em `~/.openclaw/.env` (carregado cedo pelo
gateway).
Exec roda em `host=gateway` e mescla o `PATH` do seu login-shell no ambiente de execucao,
entao ferramentas ausentes geralmente significam que o init do seu shell nao as exporta (ou defina
`tools.exec.pathPrepend`). Veja [/tools/exec](/tools/exec).

Canais WhatsApp e Telegram exigem **Node**; Bun nao e suportado. Se o seu
servico foi instalado com Bun ou um Node via gerenciador de versao, execute `openclaw doctor`
para migrar para uma instalacao de Node do sistema.

### Skill sem API key no sandbox

**Sintoma:** Skill funciona no host mas falha no sandbox com API key ausente.

**Por que:** exec em sandbox roda dentro do Docker e **nao** herda `process.env` do host.

**Correcao:**

- defina `agents.defaults.sandbox.docker.env` (ou por agente `agents.list[].sandbox.docker.env`)
- ou inclua a chave na sua imagem de sandbox personalizada
- depois execute `openclaw sandbox recreate --agent <id>` (ou `--all`)

### Service Running but Port Not Listening

Se o servico reporta **em execucao** mas nada esta escutando na porta do gateway,
o Gateway provavelmente recusou o bind.

**O que “em execucao” significa aqui**

- `Runtime: running` significa que seu supervisor (launchd/systemd/schtasks) acha que o processo esta vivo.
- `RPC probe` significa que a CLI conseguiu conectar ao WebSocket do gateway e chamar `status`.
- Sempre confie em `Probe target:` + `Config (service):` como as linhas de “o que realmente tentamos?”.

**Verifique:**

- `gateway.mode` deve ser `local` para `openclaw gateway` e o servico.
- Se voce definiu `gateway.mode=remote`, a **CLI padrao** aponta para uma URL remota. O servico ainda pode estar rodando localmente, mas sua CLI pode estar sondando o lugar errado. Use `openclaw gateway status` para ver a porta resolvida do servico + alvo de sonda (ou passe `--url`).
- `openclaw gateway status` e `openclaw doctor` exibem o **ultimo erro do gateway** a partir dos logs quando o servico parece rodar mas a porta esta fechada.
- Binds fora de loopback (`lan`/`tailnet`/`custom`, ou `auto` quando loopback nao esta disponivel) exigem autenticacao:
  `gateway.auth.token` (ou `OPENCLAW_GATEWAY_TOKEN`).
- `gateway.remote.token` e apenas para chamadas remotas da CLI; ele **nao** habilita autenticacao local.
- `gateway.token` e ignorado; use `gateway.auth.token`.

**Se `openclaw gateway status` mostrar uma incompatibilidade de configuracao**

- `Config (cli): ...` e `Config (service): ...` normalmente devem coincidir.
- Se nao coincidem, voce quase certamente esta editando uma configuracao enquanto o servico roda outra.
- Correcao: reexecute `openclaw gateway install --force` a partir do mesmo `--profile` / `OPENCLAW_STATE_DIR` que voce quer que o servico use.

**Se `openclaw gateway status` reportar problemas de configuracao do servico**

- A configuracao do supervisor (launchd/systemd/schtasks) esta sem os padroes atuais.
- Correcao: execute `openclaw doctor` para atualiza-la (ou `openclaw gateway install --force` para uma reescrita completa).

**Se `Last gateway error:` mencionar “refusing to bind … without auth”**

- Voce definiu `gateway.bind` para um modo nao-loopback (`lan`/`tailnet`/`custom`, ou `auto` quando loopback nao esta disponivel) mas nao configurou autenticacao.
- Correcao: defina `gateway.auth.mode` + `gateway.auth.token` (ou exporte `OPENCLAW_GATEWAY_TOKEN`) e reinicie o servico.

**Se `openclaw gateway status` disser `bind=tailnet` mas nenhuma interface tailnet foi encontrada**

- O gateway tentou bindar em um IP Tailscale (100.64.0.0/10), mas nenhum foi detectado no host.
- Correcao: ative o Tailscale nessa maquina (ou altere `gateway.bind` para `loopback`/`lan`).

**Se `Probe note:` disser que a sonda usa loopback**

- Isso e esperado para `bind=lan`: o gateway escuta em `0.0.0.0` (todas as interfaces), e o loopback ainda deve conectar localmente.
- Para clientes remotos, use um IP LAN real (nao `0.0.0.0`) mais a porta, e garanta que a autenticacao esteja configurada.

### Address Already in Use (Port 18789)

Isso significa que algo ja esta escutando na porta do gateway.

**Verifique:**

```bash
openclaw gateway status
```

Ele mostrara o(s) listener(s) e causas provaveis (gateway ja rodando, tunel SSH).
Se necessario, pare o servico ou escolha outra porta.

### Extra Workspace Folders Detected

Se voce atualizou de instalacoes antigas, ainda pode ter `~/openclaw` no disco.
Multiplos diretorios de workspace podem causar confusao de autenticacao ou desvio de estado porque
apenas um workspace esta ativo.

**Correcao:** mantenha um unico workspace ativo e arquive/remova o resto. Veja
[Agent workspace](/concepts/agent-workspace#extra-workspace-folders).

### Main chat running in a sandbox workspace

Sintomas: `pwd` ou ferramentas de arquivo mostram `~/.openclaw/sandboxes/...` mesmo que voce
esperasse o workspace do host.

**Por que:** `agents.defaults.sandbox.mode: "non-main"` depende de `session.mainKey` (padrao `"main"`).
Sessoes de grupo/canal usam suas proprias chaves, entao sao tratadas como nao-principais e
recebem workspaces em sandbox.

**Opcoes de correcao:**

- Se voce quer workspaces do host para um agente: defina `agents.list[].sandbox.mode: "off"`.
- Se voce quer acesso ao workspace do host dentro do sandbox: defina `workspaceAccess: "rw"` para esse agente.

### "Agent was aborted"

O agente foi interrompido no meio da resposta.

**Causas:**

- O usuario enviou `stop`, `abort`, `esc`, `wait`, ou `exit`
- Tempo limite excedido
- O processo travou

**Correcao:** Basta enviar outra mensagem. A sessao continua.

### "Agent failed before reply: Unknown model: anthropic/claude-haiku-3-5"

O OpenClaw rejeita intencionalmente **modelos antigos/inseguros** (especialmente os mais
vulneraveis a prompt injection). Se voce ve esse erro, o nome do modelo nao e
mais suportado.

**Correcao:**

- Escolha um modelo **mais recente** para o provedor e atualize sua configuracao ou alias de modelo.
- Se voce nao tem certeza de quais modelos estao disponiveis, execute `openclaw models list` ou
  `openclaw models scan` e escolha um suportado.
- Verifique os logs do gateway para o motivo detalhado da falha.

Veja tambem: [Models CLI](/cli/models) e [Model providers](/concepts/model-providers).

### Messages Not Triggering

**Check 1:** O remetente esta na allowlist?

```bash
openclaw status
```

Procure por `AllowFrom: ...` na saida.

**Check 2:** Para chats em grupo, a mencao e obrigatoria?

```bash
# The message must match mentionPatterns or explicit mentions; defaults live in channel groups/guilds.
# Multi-agent: `agents.list[].groupChat.mentionPatterns` overrides global patterns.
grep -n "agents\\|groupChat\\|mentionPatterns\\|channels\\.whatsapp\\.groups\\|channels\\.telegram\\.groups\\|channels\\.imessage\\.groups\\|channels\\.discord\\.guilds" \
  "${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
```

**Check 3:** Verifique os logs

```bash
openclaw logs --follow
# or if you want quick filters:
tail -f "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | grep "blocked\\|skip\\|unauthorized"
```

### Pairing Code Not Arriving

Se `dmPolicy` estiver `pairing`, remetentes desconhecidos devem receber um codigo e a mensagem e ignorada ate aprovacao.

**Check 1:** Ja existe uma solicitacao pendente aguardando?

```bash
openclaw pairing list <channel>
```

Solicitacoes pendentes de pareamento por DM sao limitadas a **3 por canal** por padrao. Se a lista estiver cheia, novas solicitacoes nao gerarao codigo ate que uma seja aprovada ou expire.

**Check 2:** A solicitacao foi criada mas nenhuma resposta foi enviada?

```bash
openclaw logs --follow | grep "pairing request"
```

**Check 3:** Confirme que `dmPolicy` nao esta `open`/`allowlist` para esse canal.

### Image + Mention Not Working

Problema conhecido: Quando voce envia uma imagem com APENAS uma mencao (sem outro texto), o WhatsApp as vezes nao inclui os metadados da mencao.

**Soluçao alternativa:** Adicione algum texto junto com a mencao:

- ❌ `@openclaw` + imagem
- ✅ `@openclaw check this` + imagem

### Session Not Resuming

**Check 1:** O arquivo da sessao esta la?

```bash
ls -la ~/.openclaw/agents/<agentId>/sessions/
```

**Check 2:** A janela de reset e curta demais?

```json
{
  "session": {
    "reset": {
      "mode": "daily",
      "atHour": 4,
      "idleMinutes": 10080 // 7 days
    }
  }
}
```

**Check 3:** Alguem enviou `/new`, `/reset`, ou um gatilho de reset?

### Agent Timing Out

O tempo limite padrao e 30 minutos. Para tarefas longas:

```json
{
  "reply": {
    "timeoutSeconds": 3600 // 1 hour
  }
}
```

Ou use a ferramenta `process` para colocar comandos longos em background.

### WhatsApp Disconnected

```bash
# Check local status (creds, sessions, queued events)
openclaw status
# Probe the running gateway + channels (WA connect + Telegram + Discord APIs)
openclaw status --deep

# View recent connection events
openclaw logs --limit 200 | grep "connection\\|disconnect\\|logout"
```

**Correcao:** Normalmente reconecta automaticamente quando o Gateway esta rodando. Se voce estiver travado, reinicie o processo do Gateway (da forma como voce o supervisiona), ou execute-o manualmente com saida verbosa:

```bash
openclaw gateway --verbose
```

Se voce estiver deslogado / desvinculado:

```bash
openclaw channels logout
trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/credentials" # if logout can't cleanly remove everything
openclaw channels login --verbose       # re-scan QR
```

### Media Send Failing

**Check 1:** O caminho do arquivo e valido?

```bash
ls -la /path/to/your/image.jpg
```

**Check 2:** E grande demais?

- Imagens: max 6MB
- Audio/Video: max 16MB
- Documentos: max 100MB

**Check 3:** Verifique os logs de midia

```bash
grep "media\\|fetch\\|download" "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | tail -20
```

### High Memory Usage

O OpenClaw mantem o historico de conversa em memoria.

**Correcao:** Reinicie periodicamente ou defina limites de sessao:

```json
{
  "session": {
    "historyLimit": 100 // Max messages to keep
  }
}
```

## Solucao de problemas comuns

### “Gateway won’t start — configuration invalid”

O OpenClaw agora se recusa a iniciar quando a configuracao contem chaves desconhecidas, valores malformados ou tipos invalidos.
Isso e intencional por seguranca.

Corrija com o Doctor:

```bash
openclaw doctor
openclaw doctor --fix
```

Notas:

- `openclaw doctor` reporta cada entrada invalida.
- `openclaw doctor --fix` aplica migracoes/correcoes e reescreve a configuracao.
- Comandos de diagnostico como `openclaw logs`, `openclaw health`, `openclaw status`, `openclaw gateway status` e `openclaw gateway probe` ainda rodam mesmo se a configuracao for invalida.

### “All models failed” — o que devo checar primeiro?

- **Credenciais** presentes para o(s) provedor(es) tentados (perfis de auth + variaveis de ambiente).
- **Roteamento de modelo**: confirme que `agents.defaults.model.primary` e fallbacks sao modelos aos quais voce tem acesso.
- **Logs do gateway** em `/tmp/openclaw/…` para o erro exato do provedor.
- **Status do modelo**: use `/model status` (chat) ou `openclaw models status` (CLI).

### Estou rodando no meu numero pessoal do WhatsApp — por que o auto-chat e estranho?

Habilite o modo de auto-chat e coloque seu proprio numero na allowlist:

```json5
{
  channels: {
    whatsapp: {
      selfChatMode: true,
      dmPolicy: "allowlist",
      allowFrom: ["+15555550123"],
    },
  },
}
```

Veja [WhatsApp setup](/channels/whatsapp).

### WhatsApp me deslogou. Como reautentico?

Execute o comando de login novamente e escaneie o QR code:

```bash
openclaw channels login
```

### Erros de build em `main` — qual e o caminho padrao de correcao?

1. `git pull origin main && pnpm install`
2. `openclaw doctor`
3. Verifique issues no GitHub ou Discord
4. Solucao temporaria: fazer checkout de um commit mais antigo

### npm install falha (allow-build-scripts / tar ou yargs ausentes). E agora?

Se voce esta rodando a partir do codigo-fonte, use o gerenciador de pacotes do repo: **pnpm** (preferido).
O repo declara `packageManager: "pnpm@…"`.

Recuperacao tipica:

```bash
git status   # ensure you’re in the repo root
pnpm install
pnpm build
openclaw doctor
openclaw gateway restart
```

Por que: pnpm e o gerenciador de pacotes configurado para este repo.

### Como alterno entre instalacoes git e npm?

Use o **instalador do site** e selecione o metodo de instalacao com uma flag. Ele
atualiza no lugar e reescreve o servico do gateway para apontar para a nova instalacao.

Mudar **para instalacao git**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
```

Mudar **para npm global**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Notas:

- O fluxo git so faz rebase se o repo estiver limpo. Commit ou stash as alteracoes primeiro.
- Apos mudar, execute:
  ```bash
  openclaw doctor
  openclaw gateway restart
  ```

### Telegram block streaming nao esta dividindo texto entre chamadas de ferramentas. Por que?

Block streaming so envia **blocos de texto concluidos**. Motivos comuns para voce ver uma unica mensagem:

- `agents.defaults.blockStreamingDefault` ainda esta `"off"`.
- `channels.telegram.blockStreaming` esta definido como `false`.
- `channels.telegram.streamMode` esta `partial` ou `block` **e o draft streaming esta ativo**
  (chat privado + topicos). Draft streaming desativa block streaming nesse caso.
- Suas configuracoes de `minChars` / coalesce estao altas demais, entao os blocos sao mesclados.
- O modelo emite um unico bloco grande de texto (sem pontos de flush no meio da resposta).

Checklist de correcao:

1. Coloque as configuracoes de block streaming sob `agents.defaults`, nao na raiz.
2. Defina `channels.telegram.streamMode: "off"` se voce quer respostas em bloco com multiplas mensagens de verdade.
3. Use limites menores de chunk/coalesce durante o debug.

Veja [Streaming](/concepts/streaming).

### Discord nao responde no meu servidor mesmo com `requireMention: false`. Por que?

`requireMention` so controla o gating por mencao **apos** o canal passar pelas allowlists.
Por padrao `channels.discord.groupPolicy` e **allowlist**, entao guilds devem ser explicitamente habilitadas.
Se voce definir `channels.discord.guilds.<guildId>.channels`, apenas os canais listados sao permitidos; omita-o para permitir todos os canais na guild.

Checklist de correcao:

1. Defina `channels.discord.groupPolicy: "open"` **ou** adicione uma entrada de allowlist de guild (e opcionalmente uma allowlist de canal).
2. Use **IDs numericos de canal** em `channels.discord.guilds.<guildId>.channels`.
3. Coloque `requireMention: false` **sob** `channels.discord.guilds` (global ou por canal).
   `channels.discord.requireMention` no nivel superior nao e uma chave suportada.
4. Garanta que o bot tenha **Message Content Intent** e permissoes de canal.
5. Execute `openclaw channels status --probe` para dicas de auditoria.

Docs: [Discord](/channels/discord), [Channels troubleshooting](/channels/troubleshooting).

### Cloud Code Assist API error: invalid tool schema (400). E agora?

Isso quase sempre e um problema de **compatibilidade de schema de ferramenta**. O endpoint Cloud Code Assist
aceita um subconjunto estrito de JSON Schema. O OpenClaw limpa/normaliza schemas
de ferramentas em `main` atual, mas a correcao ainda nao esta na ultima release (ate
13 de janeiro de 2026).

Checklist de correcao:

1. **Atualize o OpenClaw**:
   - Se voce pode rodar a partir do codigo-fonte, puxe `main` e reinicie o gateway.
   - Caso contrario, aguarde a proxima release que inclui o limpador de schema.
2. Evite palavras-chave nao suportadas como `anyOf/oneOf/allOf`, `patternProperties`,
   `additionalProperties`, `minLength`, `maxLength`, `format`, etc.
3. Se voce define ferramentas customizadas, mantenha o schema de nivel superior como `type: "object"` com
   `properties` e enums simples.

Veja [Tools](/tools) e [TypeBox schemas](/concepts/typebox).

## Problemas especificos do macOS

### App trava ao conceder permissoes (Fala/Mic)

Se o app some ou mostra "Abort trap 6" quando voce clica em "Allow" em um prompt de privacidade:

**Correcao 1: Resetar cache TCC**

```bash
tccutil reset All bot.molt.mac.debug
```

**Correcao 2: Forcar novo Bundle ID**
Se resetar nao funcionar, altere o `BUNDLE_ID` em [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) (por exemplo, adicione um sufixo `.test`) e reconstrua. Isso faz o macOS tratar como um novo app.

### Gateway travado em "Starting..."

O app conecta a um gateway local na porta `18789`. Se ficar travado:

**Correcao 1: Parar o supervisor (preferido)**
Se o gateway for supervisionado pelo launchd, matar o PID apenas o fara respawnar. Pare o supervisor primeiro:

```bash
openclaw gateway status
openclaw gateway stop
# Or: launchctl bootout gui/$UID/bot.molt.gateway (replace with bot.molt.<profile>; legacy com.openclaw.* still works)
```

**Correcao 2: Porta ocupada (encontrar o listener)**

```bash
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

Se for um processo nao supervisionado, tente uma parada graciosa primeiro, depois escale:

```bash
kill -TERM <PID>
sleep 1
kill -9 <PID> # last resort
```

**Correcao 3: Verificar a instalacao da CLI**
Garanta que a CLI global `openclaw` esteja instalada e corresponda a versao do app:

```bash
openclaw --version
npm install -g openclaw@<version>
```

## Debug Mode

Obtenha logging verboso:

```bash
# Turn on trace logging in config:
#   ${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json} -> { logging: { level: "trace" } }
#
# Then run verbose commands to mirror debug output to stdout:
openclaw gateway --verbose
openclaw channels login --verbose
```

## Localizacoes de Log

| Log                                       | Local                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logs de arquivo do gateway (estruturados) | `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (ou `logging.file`)                                                                                                                                                                                                                                                               |
| Logs do servico do gateway (supervisor)   | macOS: `$OPENCLAW_STATE_DIR/logs/gateway.log` + `gateway.err.log` (padrao: `~/.openclaw/logs/...`; perfis usam `~/.openclaw-<profile>/logs/...`)<br />Linux: `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`<br />Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST` |
| Arquivos de sessao                        | `$OPENCLAW_STATE_DIR/agents/<agentId>/sessions/`                                                                                                                                                                                                                                                                          |
| Cache de midia                            | `$OPENCLAW_STATE_DIR/media/`                                                                                                                                                                                                                                                                                              |
| Credenciais                               | `$OPENCLAW_STATE_DIR/credentials/`                                                                                                                                                                                                                                                                                        |

## Health Check

```bash
# Supervisor + probe target + config paths
openclaw gateway status
# Include system-level scans (legacy/extra services, port listeners)
openclaw gateway status --deep

# Is the gateway reachable?
openclaw health --json
# If it fails, rerun with connection details:
openclaw health --verbose

# Is something listening on the default port?
lsof -nP -iTCP:18789 -sTCP:LISTEN

# Recent activity (RPC log tail)
openclaw logs --follow
# Fallback if RPC is down
tail -20 /tmp/openclaw/openclaw-*.log
```

## Reset Everything

Opcao nuclear:

```bash
openclaw gateway stop
# If you installed a service and want a clean install:
# openclaw gateway uninstall

trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
openclaw channels login         # re-pair WhatsApp
openclaw gateway restart           # or: openclaw gateway
```

⚠️ Isso perde todas as sessoes e exige novo pareamento do WhatsApp.

## Getting Help

1. Verifique os logs primeiro: `/tmp/openclaw/` (padrao: `openclaw-YYYY-MM-DD.log`, ou seu `logging.file` configurado)
2. Pesquise issues existentes no GitHub
3. Abra uma nova issue com:
   - Versao do OpenClaw
   - Trechos relevantes de log
   - Passos para reproduzir
   - Sua configuracao (mascare segredos!)

---

_"Voce ja tentou desligar e ligar de novo?"_ — Todo profissional de TI, sempre

🦞🔧

### Browser Not Starting (Linux)

Se voce vir `"Failed to start Chrome CDP on port 18800"`:

**Causa mais provavel:** Chromium empacotado como Snap no Ubuntu.

**Correcao rapida:** Instale o Google Chrome:

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
```

Depois defina na configuracao:

```json
{
  "browser": {
    "executablePath": "/usr/bin/google-chrome-stable"
  }
}
```

**Guia completo:** Veja [browser-linux-troubleshooting](/tools/browser-linux-troubleshooting)
