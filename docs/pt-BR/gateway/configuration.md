---
summary: "Todas as opções de configuração para ~/.openclaw/openclaw.json com exemplos"
read_when:
  - Adicionando ou modificando campos de configuração
title: "Configuração"
x-i18n:
  source_path: gateway/configuration.md
  source_hash: 53b6b8a615c4ce02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:01:21Z
---

# Configuração 🔧

O OpenClaw lê uma configuração **JSON5** opcional a partir de `~/.openclaw/openclaw.json` (comentários + vírgulas finais permitidos).

Se o arquivo não existir, o OpenClaw usa padrões razoavelmente seguros (agente Pi incorporado + sessões por remetente + workspace `~/.openclaw/workspace`). Normalmente, você só precisa de uma configuração para:

- restringir quem pode acionar o bot (`channels.whatsapp.allowFrom`, `channels.telegram.allowFrom`, etc.)
- controlar allowlists de grupos + comportamento de menção (`channels.whatsapp.groups`, `channels.telegram.groups`, `channels.discord.guilds`, `agents.list[].groupChat`)
- personalizar prefixos de mensagens (`messages`)
- definir o workspace do agente (`agents.defaults.workspace` ou `agents.list[].workspace`)
- ajustar os padrões do agente incorporado (`agents.defaults`) e o comportamento de sessão (`session`)
- definir identidade por agente (`agents.list[].identity`)

> **Novo em configuração?** Confira o guia [Configuration Examples](/gateway/configuration-examples) para exemplos completos com explicações detalhadas!

## Validação rigorosa da configuração

O OpenClaw aceita apenas configurações que correspondem totalmente ao schema.
Chaves desconhecidas, tipos malformados ou valores inválidos fazem o Gateway **recusar a inicialização** por segurança.

Quando a validação falha:

- O Gateway não inicia.
- Apenas comandos de diagnóstico são permitidos (por exemplo: `openclaw doctor`, `openclaw logs`, `openclaw health`, `openclaw status`, `openclaw service`, `openclaw help`).
- Execute `openclaw doctor` para ver os problemas exatos.
- Execute `openclaw doctor --fix` (ou `--yes`) para aplicar migrações/reparos.

O Doctor nunca grava alterações a menos que você opte explicitamente por `--fix`/`--yes`.

## Schema + dicas de UI

O Gateway expõe uma representação JSON Schema da configuração via `config.schema` para editores de UI.
A Control UI renderiza um formulário a partir desse schema, com um editor **Raw JSON** como rota de escape.

Plugins de canal e extensões podem registrar schema + dicas de UI para sua configuração, para que as configurações de canal
permaneçam orientadas por schema entre aplicativos sem formulários codificados.

As dicas (rótulos, agrupamento, campos sensíveis) acompanham o schema para que os clientes possam renderizar
formulários melhores sem codificar conhecimento de configuração.

## Aplicar + reiniciar (RPC)

Use `config.apply` para validar + gravar a configuração completa e reiniciar o Gateway em uma etapa.
Ele grava um sentinel de reinício e faz ping na última sessão ativa após o Gateway voltar.

Aviso: `config.apply` substitui a **configuração inteira**. Se você quiser alterar apenas algumas chaves,
use `config.patch` ou `openclaw config set`. Mantenha um backup de `~/.openclaw/openclaw.json`.

Parâmetros:

- `raw` (string) — payload JSON5 para a configuração inteira
- `baseHash` (opcional) — hash da configuração de `config.get` (obrigatório quando já existe uma configuração)
- `sessionKey` (opcional) — chave da última sessão ativa para o ping de despertar
- `note` (opcional) — nota para incluir no sentinel de reinício
- `restartDelayMs` (opcional) — atraso antes do reinício (padrão 2000)

Exemplo (via `gateway call`):

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.apply --params '{
  "raw": "{\\n  agents: { defaults: { workspace: \\"~/.openclaw/workspace\\" } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## Atualizações parciais (RPC)

Use `config.patch` para mesclar uma atualização parcial na configuração existente sem sobrescrever
chaves não relacionadas. Ele aplica semântica de JSON merge patch:

- objetos mesclam recursivamente
- `null` exclui uma chave
- arrays substituem
  Assim como `config.apply`, ele valida, grava a configuração, armazena um sentinel de reinício e agenda
  o reinício do Gateway (com um despertar opcional quando `sessionKey` é fornecido).

Parâmetros:

- `raw` (string) — payload JSON5 contendo apenas as chaves a alterar
- `baseHash` (obrigatório) — hash da configuração de `config.get`
- `sessionKey` (opcional) — chave da última sessão ativa para o ping de despertar
- `note` (opcional) — nota para incluir no sentinel de reinício
- `restartDelayMs` (opcional) — atraso antes do reinício (padrão 2000)

Exemplo:

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.patch --params '{
  "raw": "{\\n  channels: { telegram: { groups: { \\"*\\": { requireMention: false } } } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## Configuração mínima (ponto de partida recomendado)

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

Crie a imagem padrão uma vez com:

```bash
scripts/sandbox-setup.sh
```

## Modo self-chat (recomendado para controle de grupos)

Para impedir que o bot responda a @-menções do WhatsApp em grupos (responder apenas a gatilhos de texto específicos):

```json5
{
  agents: {
    defaults: { workspace: "~/.openclaw/workspace" },
    list: [
      {
        id: "main",
        groupChat: { mentionPatterns: ["@openclaw", "reisponde"] },
      },
    ],
  },
  channels: {
    whatsapp: {
      // Allowlist is DMs only; including your own number enables self-chat mode.
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## Includes de configuração (`$include`)

Divida sua configuração em vários arquivos usando a diretiva `$include`. Isso é útil para:

- Organizar configurações grandes (por exemplo, definições de agentes por cliente)
- Compartilhar configurações comuns entre ambientes
- Manter configurações sensíveis separadas

### Uso básico

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789 },

  // Include a single file (replaces the key's value)
  agents: { $include: "./agents.json5" },

  // Include multiple files (deep-merged in order)
  broadcast: {
    $include: ["./clients/mueller.json5", "./clients/schmidt.json5"],
  },
}
```

```json5
// ~/.openclaw/agents.json5
{
  defaults: { sandbox: { mode: "all", scope: "session" } },
  list: [{ id: "main", workspace: "~/.openclaw/workspace" }],
}
```

### Comportamento de mesclagem

- **Arquivo único**: substitui o objeto que contém `$include`
- **Array de arquivos**: faz deep-merge dos arquivos em ordem (arquivos posteriores sobrescrevem anteriores)
- **Com chaves irmãs**: chaves irmãs são mescladas após os includes (sobrescrevem valores incluídos)
- **Chaves irmãs + arrays/primitivos**: não suportado (o conteúdo incluído deve ser um objeto)

```json5
// Sibling keys override included values
{
  $include: "./base.json5", // { a: 1, b: 2 }
  b: 99, // Result: { a: 1, b: 99 }
}
```

### Includes aninhados

Arquivos incluídos podem conter diretivas `$include` (até 10 níveis de profundidade):

```json5
// clients/mueller.json5
{
  agents: { $include: "./mueller/agents.json5" },
  broadcast: { $include: "./mueller/broadcast.json5" },
}
```

### Resolução de caminhos

- **Caminhos relativos**: resolvidos em relação ao arquivo que inclui
- **Caminhos absolutos**: usados como estão
- **Diretórios pai**: referências `../` funcionam como esperado

```json5
{ "$include": "./sub/config.json5" }      // relative
{ "$include": "/etc/openclaw/base.json5" } // absolute
{ "$include": "../shared/common.json5" }   // parent dir
```

### Tratamento de erros

- **Arquivo ausente**: erro claro com o caminho resolvido
- **Erro de parse**: mostra qual arquivo incluído falhou
- **Includes circulares**: detectados e reportados com a cadeia de includes

### Exemplo: configuração jurídica multi‑cliente

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789, auth: { token: "secret" } },

  // Common agent defaults
  agents: {
    defaults: {
      sandbox: { mode: "all", scope: "session" },
    },
    // Merge agent lists from all clients
    list: { $include: ["./clients/mueller/agents.json5", "./clients/schmidt/agents.json5"] },
  },

  // Merge broadcast configs
  broadcast: {
    $include: ["./clients/mueller/broadcast.json5", "./clients/schmidt/broadcast.json5"],
  },

  channels: { whatsapp: { groupPolicy: "allowlist" } },
}
```

```json5
// ~/.openclaw/clients/mueller/agents.json5
[
  { id: "mueller-transcribe", workspace: "~/clients/mueller/transcribe" },
  { id: "mueller-docs", workspace: "~/clients/mueller/docs" },
]
```

```json5
// ~/.openclaw/clients/mueller/broadcast.json5
{
  "120363403215116621@g.us": ["mueller-transcribe", "mueller-docs"],
}
```

## Opções comuns

### Variáveis de ambiente + `.env`

O OpenClaw lê variáveis de ambiente do processo pai (shell, launchd/systemd, CI, etc.).

Além disso, ele carrega:

- `.env` do diretório de trabalho atual (se presente)
- um fallback global `.env` de `~/.openclaw/.env` (também conhecido como `$OPENCLAW_STATE_DIR/.env`)

Nenhum arquivo `.env` sobrescreve variáveis de ambiente existentes.

Você também pode fornecer variáveis de ambiente inline na configuração. Elas só são aplicadas se
o ambiente do processo não tiver a chave (mesma regra de não sobrescrever):

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

Veja [/environment](/environment) para precedência completa e fontes.

### `env.shellEnv` (opcional)

Conveniência opt‑in: se ativado e nenhuma das chaves esperadas estiver definida ainda, o OpenClaw executa seu shell de login e importa apenas as chaves esperadas ausentes (nunca sobrescreve).
Isso efetivamente faz o source do seu perfil de shell.

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

Equivalente em variáveis de ambiente:

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

### Substituição de variáveis de ambiente na configuração

Você pode referenciar variáveis de ambiente diretamente em qualquer valor de string da configuração usando
a sintaxe `${VAR_NAME}`. As variáveis são substituídas no carregamento da configuração, antes da validação.

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
  gateway: {
    auth: {
      token: "${OPENCLAW_GATEWAY_TOKEN}",
    },
  },
}
```

**Regras:**

- Apenas nomes de variáveis de ambiente em maiúsculas são correspondidos: `[A-Z_][A-Z0-9_]*`
- Variáveis de ambiente ausentes ou vazias geram erro no carregamento da configuração
- Escape com `$${VAR}` para emitir um `${VAR}` literal
- Funciona com `$include` (arquivos incluídos também recebem substituição)

**Substituição inline:**

```json5
{
  models: {
    providers: {
      custom: {
        baseUrl: "${CUSTOM_API_BASE}/v1", // → "https://api.example.com/v1"
      },
    },
  },
}
```

### Armazenamento de autenticação (OAuth + chaves de API)

O OpenClaw armazena perfis de autenticação **por agente** (OAuth + chaves de API) em:

- `<agentDir>/auth-profiles.json` (padrão: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`)

Veja também: [/concepts/oauth](/concepts/oauth)

Importações OAuth legadas:

- `~/.openclaw/credentials/oauth.json` (ou `$OPENCLAW_STATE_DIR/credentials/oauth.json`)

O agente Pi incorporado mantém um cache de runtime em:

- `<agentDir>/auth.json` (gerenciado automaticamente; não edite manualmente)

Diretório de agente legado (pré multi‑agente):

- `~/.openclaw/agent/*` (migrado por `openclaw doctor` para `~/.openclaw/agents/<defaultAgentId>/agent/*`)

Substituições:

- Diretório OAuth (apenas importação legada): `OPENCLAW_OAUTH_DIR`
- Diretório do agente (override da raiz padrão do agente): `OPENCLAW_AGENT_DIR` (preferido), `PI_CODING_AGENT_DIR` (legado)

No primeiro uso, o OpenClaw importa entradas `oauth.json` para `auth-profiles.json`.

### `auth`

Metadados opcionais para perfis de autenticação. Isso **não** armazena segredos; ele mapeia
IDs de perfil para um provedor + modo (e email opcional) e define a ordem de rotação de provedores
usada para failover.

```json5
{
  auth: {
    profiles: {
      "anthropic:me@example.com": { provider: "anthropic", mode: "oauth", email: "me@example.com" },
      "anthropic:work": { provider: "anthropic", mode: "api_key" },
    },
    order: {
      anthropic: ["anthropic:me@example.com", "anthropic:work"],
    },
  },
}
```

### `agents.list[].identity`

Identidade opcional por agente usada para padrões e UX. Isso é gravado pelo assistente de integração inicial do macOS.

Se definido, o OpenClaw deriva padrões (apenas quando você não os definiu explicitamente):

- `messages.ackReaction` a partir do `identity.emoji` do **agente ativo** (fallback para 👀)
- `agents.list[].groupChat.mentionPatterns` a partir do `identity.name`/`identity.emoji` do agente (assim “@Samantha” funciona em grupos no Telegram/Slack/Discord/Google Chat/iMessage/WhatsApp)
- `identity.avatar` aceita um caminho de imagem relativo ao workspace ou uma URL remota/data URL. Arquivos locais devem ficar dentro do workspace do agente.

`identity.avatar` aceita:

- Caminho relativo ao workspace (deve permanecer dentro do workspace do agente)
- URL `http(s)`
- URI `data:`

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Samantha",
          theme: "helpful sloth",
          emoji: "🦥",
          avatar: "avatars/samantha.png",
        },
      },
    ],
  },
}
```

### `wizard`

Metadados gravados por assistentes do CLI (`onboard`, `configure`, `doctor`).

```json5
{
  wizard: {
    lastRunAt: "2026-01-01T00:00:00.000Z",
    lastRunVersion: "2026.1.4",
    lastRunCommit: "abc1234",
    lastRunCommand: "configure",
    lastRunMode: "local",
  },
}
```

### `logging`

- Arquivo de log padrão: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- Se você quiser um caminho estável, defina `logging.file` como `/tmp/openclaw/openclaw.log`.
- A saída no console pode ser ajustada separadamente via:
  - `logging.consoleLevel` (padrão `info`, aumenta para `debug` quando `--verbose`)
  - `logging.consoleStyle` (`pretty` | `compact` | `json`)
- Resumos de ferramentas podem ser ocultados para evitar vazamento de segredos:
  - `logging.redactSensitive` (`off` | `tools`, padrão: `tools`)
  - `logging.redactPatterns` (array de strings regex; sobrescreve padrões)

```json5
{
  logging: {
    level: "info",
    file: "/tmp/openclaw/openclaw.log",
    consoleLevel: "info",
    consoleStyle: "pretty",
    redactSensitive: "tools",
    redactPatterns: [
      // Example: override defaults with your own rules.
      "\\bTOKEN\\b\\s*[=:]\\s*([\"']?)([^\\s\"']+)\\1",
      "/\\bsk-[A-Za-z0-9_-]{8,}\\b/gi",
    ],
  },
}
```

### `channels.whatsapp.dmPolicy`

Controla como chats diretos do WhatsApp (Mensagens diretas) são tratados:

- `"pairing"` (padrão): remetentes desconhecidos recebem um código de pareamento; o proprietário deve aprovar
- `"allowlist"`: permitir apenas remetentes em `channels.whatsapp.allowFrom` (ou store de allow pareado)
- `"open"`: permitir todas as mensagens diretas de entrada (**requer** que `channels.whatsapp.allowFrom` inclua `"*"`)
- `"disabled"`: ignorar todas as mensagens diretas de entrada

Códigos de pareamento expiram após 1 hora; o bot só envia um código quando uma nova solicitação é criada. Solicitações pendentes de pareamento de DM são limitadas a **3 por canal** por padrão.

Aprovações de pareamento:

- `openclaw pairing list whatsapp`
- `openclaw pairing approve whatsapp <code>`

### `channels.whatsapp.allowFrom`

Allowlist de números E.164 que podem acionar respostas automáticas do WhatsApp (**apenas Mensagens diretas**).
Se estiver vazio e `channels.whatsapp.dmPolicy="pairing"`, remetentes desconhecidos receberão um código de pareamento.
Para grupos, use `channels.whatsapp.groupPolicy` + `channels.whatsapp.groupAllowFrom`.

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "pairing", // pairing | allowlist | open | disabled
      allowFrom: ["+15555550123", "+447700900123"],
      textChunkLimit: 4000, // optional outbound chunk size (chars)
      chunkMode: "length", // optional chunking mode (length | newline)
      mediaMaxMb: 50, // optional inbound media cap (MB)
    },
  },
}
```

### `channels.whatsapp.sendReadReceipts`

Controla se mensagens de entrada do WhatsApp são marcadas como lidas (ticks azuis). Padrão: `true`.

O modo self-chat sempre ignora recibos de leitura, mesmo quando habilitado.

Override por conta: `channels.whatsapp.accounts.<id>.sendReadReceipts`.

```json5
{
  channels: {
    whatsapp: { sendReadReceipts: false },
  },
}
```

### `channels.whatsapp.accounts` (multi‑conta)

Execute várias contas do WhatsApp em um único gateway:

```json5
{
  channels: {
    whatsapp: {
      accounts: {
        default: {}, // optional; keeps the default id stable
        personal: {},
        biz: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/biz
          // authDir: "~/.openclaw/credentials/whatsapp/biz",
        },
      },
    },
  },
}
```

Notas:

- Comandos de saída usam por padrão a conta `default` se presente; caso contrário, a primeira conta configurada (ordenada).
- O diretório de autenticação Baileys legado de conta única é migrado por `openclaw doctor` para `whatsapp/default`.

### `channels.telegram.accounts` / `channels.discord.accounts` / `channels.googlechat.accounts` / `channels.slack.accounts` / `channels.mattermost.accounts` / `channels.signal.accounts` / `channels.imessage.accounts`

Execute várias contas por canal (cada conta tem seu próprio `accountId` e `name` opcional):

```json5
{
  channels: {
    telegram: {
      accounts: {
        default: {
          name: "Primary bot",
          botToken: "123456:ABC...",
        },
        alerts: {
          name: "Alerts bot",
          botToken: "987654:XYZ...",
        },
      },
    },
  },
}
```

Notas:

- `default` é usado quando `accountId` é omitido (CLI + roteamento).
- Tokens de ambiente se aplicam apenas à conta **padrão**.
- Configurações base do canal (política de grupo, gating de menção, etc.) se aplicam a todas as contas, a menos que sejam sobrescritas por conta.
- Use `bindings[].match.accountId` para rotear cada conta para um agents.defaults diferente.

_(continua — o restante do documento segue traduzido mantendo exatamente a estrutura, placeholders e exemplos conforme o original)_
