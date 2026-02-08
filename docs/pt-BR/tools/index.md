---
summary: "Superfície de ferramentas de agente para o OpenClaw (browser, canvas, nodes, message, cron) substituindo as skills legadas `openclaw-*`"
read_when:
  - Ao adicionar ou modificar ferramentas de agente
  - Ao aposentar ou alterar skills `openclaw-*`
title: "Ferramentas"
x-i18n:
  source_path: tools/index.md
  source_hash: 332c319afb6e65ad
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:16Z
---

# Ferramentas (OpenClaw)

O OpenClaw expõe **ferramentas de agente de primeira classe** para browser, canvas, nodes e cron.
Elas substituem as antigas skills `openclaw-*`: as ferramentas são tipadas, sem shelling,
e o agente deve confiar nelas diretamente.

## Desativando ferramentas

Voce pode permitir/negar ferramentas globalmente via `tools.allow` / `tools.deny` em `openclaw.json`
(a negação prevalece). Isso impede que ferramentas não permitidas sejam enviadas aos provedores de modelo.

```json5
{
  tools: { deny: ["browser"] },
}
```

Notas:

- A correspondência não diferencia maiúsculas de minúsculas.
- Curingas `*` são suportados (`"*"` significa todas as ferramentas).
- Se `tools.allow` referenciar apenas nomes de ferramentas de plugin desconhecidos ou não carregados, o OpenClaw registra um aviso e ignora a allowlist para que as ferramentas principais permaneçam disponíveis.

## Perfis de ferramentas (allowlist base)

`tools.profile` define uma **allowlist base de ferramentas** antes de `tools.allow`/`tools.deny`.
Substituicao por agente: `agents.list[].tools.profile`.

Perfis:

- `minimal`: apenas `session_status`
- `coding`: `group:fs`, `group:runtime`, `group:sessions`, `group:memory`, `image`
- `messaging`: `group:messaging`, `sessions_list`, `sessions_history`, `sessions_send`, `session_status`
- `full`: sem restricao (igual a nao definido)

Exemplo (apenas mensagens por padrao, permitir ferramentas do Slack + Discord tambem):

```json5
{
  tools: {
    profile: "messaging",
    allow: ["slack", "discord"],
  },
}
```

Exemplo (perfil de programacao, mas negar exec/process em todos os lugares):

```json5
{
  tools: {
    profile: "coding",
    deny: ["group:runtime"],
  },
}
```

Exemplo (perfil global de programacao, agente de suporte apenas de mensagens):

```json5
{
  tools: { profile: "coding" },
  agents: {
    list: [
      {
        id: "support",
        tools: { profile: "messaging", allow: ["slack"] },
      },
    ],
  },
}
```

## Politica de ferramentas especifica por provedor

Use `tools.byProvider` para **restringir ainda mais** as ferramentas para provedores especificos
(ou um unico `provider/model`) sem alterar seus padroes globais.
Substituicao por agente: `agents.list[].tools.byProvider`.

Isso e aplicado **apos** o perfil base de ferramentas e **antes** das allow/deny lists,
portanto so pode reduzir o conjunto de ferramentas.
As chaves de provedor aceitam `provider` (por exemplo, `google-antigravity`) ou
`provider/model` (por exemplo, `openai/gpt-5.2`).

Exemplo (manter perfil global de programacao, mas ferramentas minimas para Google Antigravity):

```json5
{
  tools: {
    profile: "coding",
    byProvider: {
      "google-antigravity": { profile: "minimal" },
    },
  },
}
```

Exemplo (allowlist especifica por provedor/modelo para um endpoint instavel):

```json5
{
  tools: {
    allow: ["group:fs", "group:runtime", "sessions_list"],
    byProvider: {
      "openai/gpt-5.2": { allow: ["group:fs", "sessions_list"] },
    },
  },
}
```

Exemplo (substituicao especifica por agente para um unico provedor):

```json5
{
  agents: {
    list: [
      {
        id: "support",
        tools: {
          byProvider: {
            "google-antigravity": { allow: ["message", "sessions_list"] },
          },
        },
      },
    ],
  },
}
```

## Grupos de ferramentas (atalhos)

As politicas de ferramentas (global, agente, sandbox) suportam entradas `group:*` que se expandem para varias ferramentas.
Use-as em `tools.allow` / `tools.deny`.

Grupos disponiveis:

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:web`: `web_search`, `web_fetch`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: todas as ferramentas integradas do OpenClaw (exclui plugins de provedor)

Exemplo (permitir apenas ferramentas de arquivo + browser):

```json5
{
  tools: {
    allow: ["group:fs", "browser"],
  },
}
```

## Plugins + ferramentas

Plugins podem registrar **ferramentas adicionais** (e comandos CLI) alem do conjunto principal.
Veja [Plugins](/plugin) para instalacao + configuracao, e [Skills](/tools/skills) para como
a orientacao de uso de ferramentas e injetada nos prompts. Alguns plugins incluem suas proprias skills
junto com ferramentas (por exemplo, o plugin de chamadas de voz).

Ferramentas opcionais de plugin:

- [Lobster](/tools/lobster): runtime de workflow tipado com aprovacoes retomaveis (requer o CLI do Lobster no host do Gateway).
- [LLM Task](/tools/llm-task): etapa de LLM apenas em JSON para saida estruturada de workflow (validacao de schema opcional).

## Inventario de ferramentas

### `apply_patch`

Aplica patches estruturados em um ou mais arquivos. Use para edicoes com multiplos hunks.
Experimental: habilite via `tools.exec.applyPatch.enabled` (apenas modelos OpenAI).

### `exec`

Executa comandos de shell no workspace.

Parametros principais:

- `command` (obrigatorio)
- `yieldMs` (vai para background automaticamente apos timeout, padrao 10000)
- `background` (background imediato)
- `timeout` (segundos; encerra o processo se excedido, padrao 1800)
- `elevated` (bool; executa no host se o modo elevado estiver habilitado/permitido; so altera o comportamento quando o agente esta em sandbox)
- `host` (`sandbox | gateway | node`)
- `security` (`deny | allowlist | full`)
- `ask` (`off | on-miss | always`)
- `node` (id/nome do node para `host=node`)
- Precisa de um TTY real? Defina `pty: true`.

Notas:

- Retorna `status: "running"` com um `sessionId` quando em background.
- Use `process` para consultar/logar/escrever/encerrar/limpar sessoes em background.
- Se `process` estiver negado, `exec` executa de forma sincrona e ignora `yieldMs`/`background`.
- `elevated` e controlado por `tools.elevated` mais qualquer substituicao `agents.list[].tools.elevated` (ambos devem permitir) e e um alias para `host=gateway` + `security=full`.
- `elevated` so altera o comportamento quando o agente esta em sandbox (caso contrario, e um no-op).
- `host=node` pode direcionar para um aplicativo complementar do macOS ou um host de node headless (`openclaw node run`).
- aprovacoes e allowlists de gateway/node: [Exec approvals](/tools/exec-approvals).

### `process`

Gerencia sessoes de exec em background.

Acoes principais:

- `list`, `poll`, `log`, `write`, `kill`, `clear`, `remove`

Notas:

- `poll` retorna nova saida e status de saida quando concluido.
- `log` suporta `offset`/`limit` baseados em linhas (omita `offset` para capturar as ultimas N linhas).
- `process` e escopado por agente; sessoes de outros agentes nao sao visiveis.

### `web_search`

Pesquisa na web usando a API Brave Search.

Parametros principais:

- `query` (obrigatorio)
- `count` (1–10; padrao de `tools.web.search.maxResults`)

Notas:

- Requer uma chave da API Brave (recomendado: `openclaw configure --section web`, ou defina `BRAVE_API_KEY`).
- Habilite via `tools.web.search.enabled`.
- As respostas sao cacheadas (padrao 15 min).
- Veja [Web tools](/tools/web) para configuracao.

### `web_fetch`

Busca e extrai conteudo legivel de uma URL (HTML → markdown/texto).

Parametros principais:

- `url` (obrigatorio)
- `extractMode` (`markdown` | `text`)
- `maxChars` (truncar paginas longas)

Notas:

- Habilite via `tools.web.fetch.enabled`.
- `maxChars` e limitado por `tools.web.fetch.maxCharsCap` (padrao 50000).
- As respostas sao cacheadas (padrao 15 min).
- Para sites pesados em JS, prefira a ferramenta de browser.
- Veja [Web tools](/tools/web) para configuracao.
- Veja [Firecrawl](/tools/firecrawl) para o fallback anti-bot opcional.

### `browser`

Controla o browser dedicado gerenciado pelo OpenClaw.

Acoes principais:

- `status`, `start`, `stop`, `tabs`, `open`, `focus`, `close`
- `snapshot` (aria/ai)
- `screenshot` (retorna bloco de imagem + `MEDIA:<path>`)
- `act` (acoes de UI: click/type/press/hover/drag/select/fill/resize/wait/evaluate)
- `navigate`, `console`, `pdf`, `upload`, `dialog`

Gerenciamento de perfis:

- `profiles` — listar todos os perfis de browser com status
- `create-profile` — criar novo perfil com porta alocada automaticamente (ou `cdpUrl`)
- `delete-profile` — parar o browser, excluir dados do usuario, remover da configuracao (apenas local)
- `reset-profile` — encerrar processo orfao na porta do perfil (apenas local)

Parametros comuns:

- `profile` (opcional; padrao `browser.defaultProfile`)
- `target` (`sandbox` | `host` | `node`)
- `node` (opcional; seleciona um id/nome de node especifico)
  Notas:
- Requer `browser.enabled=true` (padrao `true`; defina `false` para desabilitar).
- Todas as acoes aceitam o parametro opcional `profile` para suporte a multiplas instancias.
- Quando `profile` e omitido, usa `browser.defaultProfile` (padrao "chrome").
- Nomes de perfil: apenas alfanumerico em minusculas + hifens (max 64 caracteres).
- Intervalo de portas: 18800-18899 (~100 perfis no maximo).
- Perfis remotos sao apenas para anexacao (sem iniciar/parar/resetar).
- Se um node com capacidade de browser estiver conectado, a ferramenta pode rotear automaticamente para ele (a menos que voce fixe `target`).
- `snapshot` usa `ai` por padrao quando o Playwright esta instalado; use `aria` para a arvore de acessibilidade.
- `snapshot` tambem suporta opcoes de role-snapshot (`interactive`, `compact`, `depth`, `selector`) que retornam refs como `e12`.
- `act` requer `ref` de `snapshot` (valor numerico `12` de snapshots de AI, ou `e12` de snapshots de role); use `evaluate` para necessidades raras de seletor CSS.
- Evite `act` → `wait` por padrao; use apenas em casos excepcionais (sem estado de UI confiavel para aguardar).
- `upload` pode opcionalmente passar um `ref` para auto-clique apos armar.
- `upload` tambem suporta `inputRef` (ref aria) ou `element` (seletor CSS) para definir `<input type="file">` diretamente.

### `canvas`

Controla o Canvas do node (present, eval, snapshot, A2UI).

Acoes principais:

- `present`, `hide`, `navigate`, `eval`
- `snapshot` (retorna bloco de imagem + `MEDIA:<path>`)
- `a2ui_push`, `a2ui_reset`

Notas:

- Usa `node.invoke` do Gateway por baixo dos panos.
- Se nenhum `node` for fornecido, a ferramenta escolhe um padrao (node unico conectado ou node mac local).
- A2UI e apenas v0.8 (sem `createSurface`); a CLI rejeita JSONL v0.9 com erros de linha.
- Teste rapido: `openclaw nodes canvas a2ui push --node <id> --text "Hello from A2UI"`.

### `nodes`

Descobre e direciona nodes pareados; envia notificacoes; captura camera/tela.

Acoes principais:

- `status`, `describe`
- `pending`, `approve`, `reject` (pareamento)
- `notify` (macOS `system.notify`)
- `run` (macOS `system.run`)
- `camera_snap`, `camera_clip`, `screen_record`
- `location_get`

Notas:

- Comandos de camera/tela exigem que o app do node esteja em primeiro plano.
- Imagens retornam blocos de imagem + `MEDIA:<path>`.
- Videos retornam `FILE:<path>` (mp4).
- Localizacao retorna um payload JSON (lat/lon/accuracy/timestamp).
- Parametros de `run`: array argv `command`; `cwd` opcional, `env` (`KEY=VAL`), `commandTimeoutMs`, `invokeTimeoutMs`, `needsScreenRecording`.

Exemplo (`run`):

```json
{
  "action": "run",
  "node": "office-mac",
  "command": ["echo", "Hello"],
  "env": ["FOO=bar"],
  "commandTimeoutMs": 12000,
  "invokeTimeoutMs": 45000,
  "needsScreenRecording": false
}
```

### `image`

Analisa uma imagem com o modelo de imagem configurado.

Parametros principais:

- `image` (caminho ou URL obrigatorio)
- `prompt` (opcional; padrao "Describe the image.")
- `model` (substituicao opcional)
- `maxBytesMb` (limite de tamanho opcional)

Notas:

- Disponivel apenas quando `agents.defaults.imageModel` esta configurado (primario ou fallbacks), ou quando um modelo de imagem implicito pode ser inferido a partir do seu modelo padrao + autenticacao configurada (emparelhamento best-effort).
- Usa o modelo de imagem diretamente (independente do modelo principal de chat).

### `message`

Envia mensagens e acoes de canal em Discord/Google Chat/Slack/Telegram/WhatsApp/Signal/iMessage/MS Teams.

Acoes principais:

- `send` (texto + midia opcional; MS Teams tambem suporta `card` para Adaptive Cards)
- `poll` (enquetes do WhatsApp/Discord/MS Teams)
- `react` / `reactions` / `read` / `edit` / `delete`
- `pin` / `unpin` / `list-pins`
- `permissions`
- `thread-create` / `thread-list` / `thread-reply`
- `search`
- `sticker`
- `member-info` / `role-info`
- `emoji-list` / `emoji-upload` / `sticker-upload`
- `role-add` / `role-remove`
- `channel-info` / `channel-list`
- `voice-status`
- `event-list` / `event-create`
- `timeout` / `kick` / `ban`

Notas:

- `send` roteia o WhatsApp via o Gateway; outros canais vao direto.
- `poll` usa o Gateway para WhatsApp e MS Teams; enquetes do Discord vao direto.
- Quando uma chamada de ferramenta de mensagem esta vinculada a uma sessao de chat ativa, os envios sao restritos ao destino dessa sessao para evitar vazamentos entre contextos.

### `cron`

Gerencia jobs de cron e wakeups do Gateway.

Acoes principais:

- `status`, `list`
- `add`, `update`, `remove`, `run`, `runs`
- `wake` (enfileirar evento do sistema + heartbeat imediato opcional)

Notas:

- `add` espera um objeto completo de job cron (mesmo schema do RPC `cron.add`).
- `update` usa `{ id, patch }`.

### `gateway`

Reinicia ou aplica atualizacoes ao processo em execucao do Gateway (in-place).

Acoes principais:

- `restart` (autoriza + envia `SIGUSR1` para reinicio no processo; `openclaw gateway` reinicia in-place)
- `config.get` / `config.schema`
- `config.apply` (validar + gravar configuracao + reiniciar + acordar)
- `config.patch` (mesclar atualizacao parcial + reiniciar + acordar)
- `update.run` (executar atualizacao + reiniciar + acordar)

Notas:

- Use `delayMs` (padrao 2000) para evitar interromper uma resposta em andamento.
- `restart` esta desabilitado por padrao; habilite com `commands.restart: true`.

### `sessions_list` / `sessions_history` / `sessions_send` / `sessions_spawn` / `session_status`

Lista sessoes, inspeciona o historico de transcricoes ou envia para outra sessao.

Parametros principais:

- `sessions_list`: `kinds?`, `limit?`, `activeMinutes?`, `messageLimit?` (0 = nenhum)
- `sessions_history`: `sessionKey` (ou `sessionId`), `limit?`, `includeTools?`
- `sessions_send`: `sessionKey` (ou `sessionId`), `message`, `timeoutSeconds?` (0 = fire-and-forget)
- `sessions_spawn`: `task`, `label?`, `agentId?`, `model?`, `runTimeoutSeconds?`, `cleanup?`
- `session_status`: `sessionKey?` (padrao atual; aceita `sessionId`), `model?` (`default` limpa a substituicao)

Notas:

- `main` e a chave canonica de chat direto; global/desconhecido ficam ocultos.
- `messageLimit > 0` busca as ultimas N mensagens por sessao (mensagens de ferramentas filtradas).
- `sessions_send` aguarda a conclusao final quando `timeoutSeconds > 0`.
- A entrega/anuncio acontece apos a conclusao e e best-effort; `status: "ok"` confirma que a execucao do agente terminou, nao que o anuncio foi entregue.
- `sessions_spawn` inicia uma execucao de subagente e publica uma resposta de anuncio de volta ao chat solicitante.
- `sessions_spawn` nao bloqueia e retorna `status: "accepted"` imediatamente.
- `sessions_send` executa um ping-pong de resposta de retorno (responda `REPLY_SKIP` para parar; max de turnos via `session.agentToAgent.maxPingPongTurns`, 0–5).
- Apos o ping-pong, o agente de destino executa uma **etapa de anuncio**; responda `ANNOUNCE_SKIP` para suprimir o anuncio.

### `agents_list`

Lista ids de agentes que a sessao atual pode direcionar com `sessions_spawn`.

Notas:

- O resultado e restrito a allowlists por agente (`agents.list[].subagents.allowAgents`).
- Quando `["*"]` esta configurado, a ferramenta inclui todos os agentes configurados e marca `allowAny: true`.

## Parametros (comuns)

Ferramentas com suporte do Gateway (`canvas`, `nodes`, `cron`):

- `gatewayUrl` (padrao `ws://127.0.0.1:18789`)
- `gatewayToken` (se a autenticacao estiver habilitada)
- `timeoutMs`

Nota: quando `gatewayUrl` esta definido, inclua `gatewayToken` explicitamente. As ferramentas nao herdam configuracao
ou credenciais de ambiente para substituicoes, e a ausencia de credenciais explicitas e um erro.

Ferramenta de browser:

- `profile` (opcional; padrao `browser.defaultProfile`)
- `target` (`sandbox` | `host` | `node`)
- `node` (opcional; fixa um id/nome de node especifico)

## Fluxos recomendados de agente

Automacao de browser:

1. `browser` → `status` / `start`
2. `snapshot` (ai ou aria)
3. `act` (click/type/press)
4. `screenshot` se precisar de confirmacao visual

Renderizacao de canvas:

1. `canvas` → `present`
2. `a2ui_push` (opcional)
3. `snapshot`

Direcionamento de node:

1. `nodes` → `status`
2. `describe` no node escolhido
3. `notify` / `run` / `camera_snap` / `screen_record`

## Seguranca

- Evite `system.run` direto; use `nodes` → `run` apenas com consentimento explicito do usuario.
- Respeite o consentimento do usuario para captura de camera/tela.
- Use `status/describe` para garantir permissoes antes de invocar comandos de midia.

## Como as ferramentas sao apresentadas ao agente

As ferramentas sao expostas em dois canais paralelos:

1. **Texto do prompt de sistema**: uma lista legivel por humanos + orientacao.
2. **Schema de ferramentas**: as definicoes estruturadas de funcoes enviadas para a API do modelo.

Isso significa que o agente ve tanto “quais ferramentas existem” quanto “como chamá-las”. Se uma ferramenta
nao aparece no prompt de sistema ou no schema, o modelo nao consegue chamá-la.
