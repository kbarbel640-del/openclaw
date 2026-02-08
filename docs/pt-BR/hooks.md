---
summary: "Hooks: automação orientada a eventos para comandos e eventos do ciclo de vida"
read_when:
  - Voce quer automação orientada a eventos para /new, /reset, /stop e eventos do ciclo de vida do agente
  - Voce quer criar, instalar ou depurar hooks
title: "Hooks"
x-i18n:
  source_path: hooks.md
  source_hash: 853227a0f1abd207
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:48Z
---

# Hooks

Hooks fornecem um sistema extensível orientado a eventos para automatizar ações em resposta a comandos e eventos do agente. Os hooks são descobertos automaticamente a partir de diretórios e podem ser gerenciados via comandos da CLI, de forma semelhante a como as Skills funcionam no OpenClaw.

## Como se orientar

Hooks são pequenos scripts que são executados quando algo acontece. Existem dois tipos:

- **Hooks** (esta página): executam dentro do Gateway quando eventos do agente disparam, como `/new`, `/reset`, `/stop` ou eventos do ciclo de vida.
- **Webhooks**: webhooks HTTP externos que permitem que outros sistemas disparem trabalho no OpenClaw. Veja [Webhook Hooks](/automation/webhook) ou use `openclaw webhooks` para comandos auxiliares do Gmail.

Hooks também podem ser incluídos dentro de plugins; veja [Plugins](/plugin#plugin-hooks).

Usos comuns:

- Salvar um snapshot de memória ao redefinir uma sessao
- Manter um rastro de auditoria de comandos para solucao de problemas ou conformidade
- Disparar automações de acompanhamento quando uma sessao inicia ou termina
- Gravar arquivos no workspace do agente ou chamar APIs externas quando eventos disparam

Se voce consegue escrever uma pequena funcao em TypeScript, voce consegue escrever um hook. Os hooks sao descobertos automaticamente, e voce os habilita ou desabilita via CLI.

## Visao geral

O sistema de hooks permite que voce:

- Salve o contexto da sessao na memoria quando `/new` for emitido
- Registre todos os comandos para auditoria
- Dispare automacoes personalizadas em eventos do ciclo de vida do agente
- Estenda o comportamento do OpenClaw sem modificar o codigo principal

## Primeiros Passos

### Hooks Incluidos

O OpenClaw vem com quatro hooks incluidos que sao descobertos automaticamente:

- **💾 session-memory**: Salva o contexto da sessao no workspace do agente (padrao `~/.openclaw/workspace/memory/`) quando voce emite `/new`
- **📝 command-logger**: Registra todos os eventos de comando em `~/.openclaw/logs/commands.log`
- **🚀 boot-md**: Executa `BOOT.md` quando o gateway inicia (requer hooks internos habilitados)
- **😈 soul-evil**: Troca conteudo `SOUL.md` injetado por `SOUL_EVIL.md` durante uma janela de purge ou por chance aleatoria

Listar hooks disponiveis:

```bash
openclaw hooks list
```

Habilitar um hook:

```bash
openclaw hooks enable session-memory
```

Verificar status do hook:

```bash
openclaw hooks check
```

Obter informacoes detalhadas:

```bash
openclaw hooks info session-memory
```

### Integracao Inicial

Durante a integracao inicial (`openclaw onboard`), voce sera solicitado a habilitar hooks recomendados. O assistente descobre automaticamente hooks elegiveis e os apresenta para selecao.

## Descoberta de Hooks

Os hooks sao descobertos automaticamente a partir de tres diretorios (em ordem de precedencia):

1. **Hooks do workspace**: `<workspace>/hooks/` (por agente, maior precedencia)
2. **Hooks gerenciados**: `~/.openclaw/hooks/` (instalados pelo usuario, compartilhados entre workspaces)
3. **Hooks incluidos**: `<openclaw>/dist/hooks/bundled/` (enviados com o OpenClaw)

Diretorios de hooks gerenciados podem ser um **hook unico** ou um **pacote de hooks** (diretorio de pacote).

Cada hook e um diretorio contendo:

```
my-hook/
├── HOOK.md          # Metadata + documentation
└── handler.ts       # Handler implementation
```

## Pacotes de Hooks (npm/arquivos)

Pacotes de hooks sao pacotes npm padrao que exportam um ou mais hooks via `openclaw.hooks` em
`package.json`. Instale-os com:

```bash
openclaw hooks install <path-or-spec>
```

Exemplo de `package.json`:

```json
{
  "name": "@acme/my-hooks",
  "version": "0.1.0",
  "openclaw": {
    "hooks": ["./hooks/my-hook", "./hooks/other-hook"]
  }
}
```

Cada entrada aponta para um diretorio de hook contendo `HOOK.md` e `handler.ts` (ou `index.ts`).
Pacotes de hooks podem incluir dependencias; elas serao instaladas em `~/.openclaw/hooks/<id>`.

## Estrutura do Hook

### Formato do HOOK.md

O arquivo `HOOK.md` contem metadados em frontmatter YAML alem de documentacao em Markdown:

```markdown
---
name: my-hook
description: "Short description of what this hook does"
homepage: https://docs.openclaw.ai/hooks#my-hook
metadata:
  { "openclaw": { "emoji": "🔗", "events": ["command:new"], "requires": { "bins": ["node"] } } }
---

# My Hook

Detailed documentation goes here...

## What It Does

- Listens for `/new` commands
- Performs some action
- Logs the result

## Requirements

- Node.js must be installed

## Configuration

No configuration needed.
```

### Campos de Metadados

O objeto `metadata.openclaw` suporta:

- **`emoji`**: Emoji de exibicao para a CLI (ex.: `"💾"`)
- **`events`**: Array de eventos para escutar (ex.: `["command:new", "command:reset"]`)
- **`export`**: Export nomeado a ser usado (padrao `"default"`)
- **`homepage`**: URL da documentacao
- **`requires`**: Requisitos opcionais
  - **`bins`**: Binarios obrigatorios no PATH (ex.: `["git", "node"]`)
  - **`anyBins`**: Pelo menos um desses binarios deve estar presente
  - **`env`**: Variaveis de ambiente obrigatorias
  - **`config`**: Caminhos de configuracao obrigatorios (ex.: `["workspace.dir"]`)
  - **`os`**: Plataformas obrigatorias (ex.: `["darwin", "linux"]`)
- **`always`**: Ignorar verificacoes de elegibilidade (booleano)
- **`install`**: Metodos de instalacao (para hooks incluidos: `[{"id":"bundled","kind":"bundled"}]`)

### Implementacao do Handler

O arquivo `handler.ts` exporta uma funcao `HookHandler`:

```typescript
import type { HookHandler } from "../../src/hooks/hooks.js";

const myHandler: HookHandler = async (event) => {
  // Only trigger on 'new' command
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  console.log(`[my-hook] New command triggered`);
  console.log(`  Session: ${event.sessionKey}`);
  console.log(`  Timestamp: ${event.timestamp.toISOString()}`);

  // Your custom logic here

  // Optionally send message to user
  event.messages.push("✨ My hook executed!");
};

export default myHandler;
```

#### Contexto do Evento

Cada evento inclui:

```typescript
{
  type: 'command' | 'session' | 'agent' | 'gateway',
  action: string,              // e.g., 'new', 'reset', 'stop'
  sessionKey: string,          // Session identifier
  timestamp: Date,             // When the event occurred
  messages: string[],          // Push messages here to send to user
  context: {
    sessionEntry?: SessionEntry,
    sessionId?: string,
    sessionFile?: string,
    commandSource?: string,    // e.g., 'whatsapp', 'telegram'
    senderId?: string,
    workspaceDir?: string,
    bootstrapFiles?: WorkspaceBootstrapFile[],
    cfg?: OpenClawConfig
  }
}
```

## Tipos de Evento

### Eventos de Comando

Disparados quando comandos do agente sao emitidos:

- **`command`**: Todos os eventos de comando (listener geral)
- **`command:new`**: Quando o comando `/new` e emitido
- **`command:reset`**: Quando o comando `/reset` e emitido
- **`command:stop`**: Quando o comando `/stop` e emitido

### Eventos do Agente

- **`agent:bootstrap`**: Antes que arquivos de bootstrap do workspace sejam injetados (hooks podem mutar `context.bootstrapFiles`)

### Eventos do Gateway

Disparados quando o gateway inicia:

- **`gateway:startup`**: Apos os canais iniciarem e os hooks serem carregados

### Hooks de Resultado de Ferramenta (API de Plugin)

Esses hooks nao sao listeners de fluxo de eventos; eles permitem que plugins ajustem sincronicamente resultados de ferramentas antes que o OpenClaw os persista.

- **`tool_result_persist`**: transforma resultados de ferramentas antes de serem gravados no transcript da sessao. Deve ser sincrono; retorne o payload de resultado atualizado da ferramenta ou `undefined` para manter como esta. Veja [Agent Loop](/concepts/agent-loop).

### Eventos Futuros

Tipos de evento planejados:

- **`session:start`**: Quando uma nova sessao comeca
- **`session:end`**: Quando uma sessao termina
- **`agent:error`**: Quando um agente encontra um erro
- **`message:sent`**: Quando uma mensagem e enviada
- **`message:received`**: Quando uma mensagem e recebida

## Criando Hooks Personalizados

### 1. Escolha a Localizacao

- **Hooks do workspace** (`<workspace>/hooks/`): Por agente, maior precedencia
- **Hooks gerenciados** (`~/.openclaw/hooks/`): Compartilhados entre workspaces

### 2. Crie a Estrutura de Diretorios

```bash
mkdir -p ~/.openclaw/hooks/my-hook
cd ~/.openclaw/hooks/my-hook
```

### 3. Crie o HOOK.md

```markdown
---
name: my-hook
description: "Does something useful"
metadata: { "openclaw": { "emoji": "🎯", "events": ["command:new"] } }
---

# My Custom Hook

This hook does something useful when you issue `/new`.
```

### 4. Crie o handler.ts

```typescript
import type { HookHandler } from "../../src/hooks/hooks.js";

const handler: HookHandler = async (event) => {
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  console.log("[my-hook] Running!");
  // Your logic here
};

export default handler;
```

### 5. Habilite e Teste

```bash
# Verify hook is discovered
openclaw hooks list

# Enable it
openclaw hooks enable my-hook

# Restart your gateway process (menu bar app restart on macOS, or restart your dev process)

# Trigger the event
# Send /new via your messaging channel
```

## Configuracao

### Novo Formato de Configuracao (Recomendado)

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "session-memory": { "enabled": true },
        "command-logger": { "enabled": false }
      }
    }
  }
}
```

### Configuracao por Hook

Hooks podem ter configuracao personalizada:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "my-hook": {
          "enabled": true,
          "env": {
            "MY_CUSTOM_VAR": "value"
          }
        }
      }
    }
  }
}
```

### Diretorios Extras

Carregue hooks a partir de diretorios adicionais:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "load": {
        "extraDirs": ["/path/to/more/hooks"]
      }
    }
  }
}
```

### Formato de Configuracao Legado (Ainda Suportado)

O formato de configuracao antigo ainda funciona para compatibilidade retroativa:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "handlers": [
        {
          "event": "command:new",
          "module": "./hooks/handlers/my-handler.ts",
          "export": "default"
        }
      ]
    }
  }
}
```

**Migracao**: Use o novo sistema baseado em descoberta para novos hooks. Handlers legados sao carregados apos hooks baseados em diretorios.

## Comandos da CLI

### Listar Hooks

```bash
# List all hooks
openclaw hooks list

# Show only eligible hooks
openclaw hooks list --eligible

# Verbose output (show missing requirements)
openclaw hooks list --verbose

# JSON output
openclaw hooks list --json
```

### Informacoes do Hook

```bash
# Show detailed info about a hook
openclaw hooks info session-memory

# JSON output
openclaw hooks info session-memory --json
```

### Verificar Elegibilidade

```bash
# Show eligibility summary
openclaw hooks check

# JSON output
openclaw hooks check --json
```

### Habilitar/Desabilitar

```bash
# Enable a hook
openclaw hooks enable session-memory

# Disable a hook
openclaw hooks disable command-logger
```

## Hooks Incluidos

### session-memory

Salva o contexto da sessao na memoria quando voce emite `/new`.

**Eventos**: `command:new`

**Requisitos**: `workspace.dir` deve estar configurado

**Saida**: `<workspace>/memory/YYYY-MM-DD-slug.md` (padrao `~/.openclaw/workspace`)

**O que ele faz**:

1. Usa a entrada de sessao pre-reset para localizar o transcript correto
2. Extrai as ultimas 15 linhas da conversa
3. Usa LLM para gerar um slug de nome de arquivo descritivo
4. Salva metadados da sessao em um arquivo de memoria datado

**Exemplo de saida**:

```markdown
# Session: 2026-01-16 14:30:00 UTC

- **Session Key**: agent:main:main
- **Session ID**: abc123def456
- **Source**: telegram
```

**Exemplos de nomes de arquivo**:

- `2026-01-16-vendor-pitch.md`
- `2026-01-16-api-design.md`
- `2026-01-16-1430.md` (timestamp de fallback se a geracao de slug falhar)

**Habilitar**:

```bash
openclaw hooks enable session-memory
```

### command-logger

Registra todos os eventos de comando em um arquivo de auditoria centralizado.

**Eventos**: `command`

**Requisitos**: Nenhum

**Saida**: `~/.openclaw/logs/commands.log`

**O que ele faz**:

1. Captura detalhes do evento (acao do comando, timestamp, chave da sessao, ID do remetente, origem)
2. Anexa ao arquivo de log no formato JSONL
3. Executa silenciosamente em segundo plano

**Exemplos de entradas de log**:

```jsonl
{"timestamp":"2026-01-16T14:30:00.000Z","action":"new","sessionKey":"agent:main:main","senderId":"+1234567890","source":"telegram"}
{"timestamp":"2026-01-16T15:45:22.000Z","action":"stop","sessionKey":"agent:main:main","senderId":"user@example.com","source":"whatsapp"}
```

**Ver logs**:

```bash
# View recent commands
tail -n 20 ~/.openclaw/logs/commands.log

# Pretty-print with jq
cat ~/.openclaw/logs/commands.log | jq .

# Filter by action
grep '"action":"new"' ~/.openclaw/logs/commands.log | jq .
```

**Habilitar**:

```bash
openclaw hooks enable command-logger
```

### soul-evil

Troca conteudo `SOUL.md` injetado por `SOUL_EVIL.md` durante uma janela de purge ou por chance aleatoria.

**Eventos**: `agent:bootstrap`

**Docs**: [SOUL Evil Hook](/hooks/soul-evil)

**Saida**: Nenhum arquivo gravado; as trocas acontecem apenas em memoria.

**Habilitar**:

```bash
openclaw hooks enable soul-evil
```

**Config**:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "soul-evil": {
          "enabled": true,
          "file": "SOUL_EVIL.md",
          "chance": 0.1,
          "purge": { "at": "21:00", "duration": "15m" }
        }
      }
    }
  }
}
```

### boot-md

Executa `BOOT.md` quando o gateway inicia (apos os canais iniciarem).
Hooks internos devem estar habilitados para que isso execute.

**Eventos**: `gateway:startup`

**Requisitos**: `workspace.dir` deve estar configurado

**O que ele faz**:

1. Le `BOOT.md` do seu workspace
2. Executa as instrucoes via o runner do agente
3. Envia quaisquer mensagens de saida solicitadas via a ferramenta de mensagens

**Habilitar**:

```bash
openclaw hooks enable boot-md
```

## Boas Praticas

### Mantenha Handlers Rapidos

Hooks executam durante o processamento de comandos. Mantenha-os leves:

```typescript
// ✓ Good - async work, returns immediately
const handler: HookHandler = async (event) => {
  void processInBackground(event); // Fire and forget
};

// ✗ Bad - blocks command processing
const handler: HookHandler = async (event) => {
  await slowDatabaseQuery(event);
  await evenSlowerAPICall(event);
};
```

### Trate Erros com Elegancia

Sempre envolva operacoes arriscadas:

```typescript
const handler: HookHandler = async (event) => {
  try {
    await riskyOperation(event);
  } catch (err) {
    console.error("[my-handler] Failed:", err instanceof Error ? err.message : String(err));
    // Don't throw - let other handlers run
  }
};
```

### Filtre Eventos Cedo

Retorne cedo se o evento nao for relevante:

```typescript
const handler: HookHandler = async (event) => {
  // Only handle 'new' commands
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  // Your logic here
};
```

### Use Chaves de Evento Especificas

Especifique eventos exatos nos metadados quando possivel:

```yaml
metadata: { "openclaw": { "events": ["command:new"] } } # Specific
```

Em vez de:

```yaml
metadata: { "openclaw": { "events": ["command"] } } # General - more overhead
```

## Depuracao

### Habilitar Logs de Hooks

O gateway registra o carregamento de hooks na inicializacao:

```
Registered hook: session-memory -> command:new
Registered hook: command-logger -> command
Registered hook: boot-md -> gateway:startup
```

### Verificar Descoberta

Liste todos os hooks descobertos:

```bash
openclaw hooks list --verbose
```

### Verificar Registro

No seu handler, registre quando ele for chamado:

```typescript
const handler: HookHandler = async (event) => {
  console.log("[my-handler] Triggered:", event.type, event.action);
  // Your logic
};
```

### Verificar Elegibilidade

Verifique por que um hook nao esta elegivel:

```bash
openclaw hooks info my-hook
```

Procure por requisitos ausentes na saida.

## Testes

### Logs do Gateway

Monitore os logs do gateway para ver a execucao dos hooks:

```bash
# macOS
./scripts/clawlog.sh -f

# Other platforms
tail -f ~/.openclaw/gateway.log
```

### Testar Hooks Diretamente

Teste seus handlers de forma isolada:

```typescript
import { test } from "vitest";
import { createHookEvent } from "./src/hooks/hooks.js";
import myHandler from "./hooks/my-hook/handler.js";

test("my handler works", async () => {
  const event = createHookEvent("command", "new", "test-session", {
    foo: "bar",
  });

  await myHandler(event);

  // Assert side effects
});
```

## Arquitetura

### Componentes Principais

- **`src/hooks/types.ts`**: Definicoes de tipo
- **`src/hooks/workspace.ts`**: Varredura e carregamento de diretorios
- **`src/hooks/frontmatter.ts`**: Parsing de metadados do HOOK.md
- **`src/hooks/config.ts`**: Verificacao de elegibilidade
- **`src/hooks/hooks-status.ts`**: Relatorio de status
- **`src/hooks/loader.ts`**: Carregador dinamico de modulos
- **`src/cli/hooks-cli.ts`**: Comandos da CLI
- **`src/gateway/server-startup.ts`**: Carrega hooks na inicializacao do gateway
- **`src/auto-reply/reply/commands-core.ts`**: Dispara eventos de comando

### Fluxo de Descoberta

```
Gateway startup
    ↓
Scan directories (workspace → managed → bundled)
    ↓
Parse HOOK.md files
    ↓
Check eligibility (bins, env, config, os)
    ↓
Load handlers from eligible hooks
    ↓
Register handlers for events
```

### Fluxo de Eventos

```
User sends /new
    ↓
Command validation
    ↓
Create hook event
    ↓
Trigger hook (all registered handlers)
    ↓
Command processing continues
    ↓
Session reset
```

## Solucao de Problemas

### Hook Nao Descoberto

1. Verifique a estrutura de diretorios:

   ```bash
   ls -la ~/.openclaw/hooks/my-hook/
   # Should show: HOOK.md, handler.ts
   ```

2. Verifique o formato do HOOK.md:

   ```bash
   cat ~/.openclaw/hooks/my-hook/HOOK.md
   # Should have YAML frontmatter with name and metadata
   ```

3. Liste todos os hooks descobertos:
   ```bash
   openclaw hooks list
   ```

### Hook Nao Elegivel

Verifique os requisitos:

```bash
openclaw hooks info my-hook
```

Procure por ausentes:

- Binarios (verifique o PATH)
- Variaveis de ambiente
- Valores de configuracao
- Compatibilidade com o SO

### Hook Nao Executando

1. Verifique se o hook esta habilitado:

   ```bash
   openclaw hooks list
   # Should show ✓ next to enabled hooks
   ```

2. Reinicie o processo do gateway para que os hooks sejam recarregados.

3. Verifique os logs do gateway por erros:
   ```bash
   ./scripts/clawlog.sh | grep hook
   ```

### Erros no Handler

Verifique erros de TypeScript/importacao:

```bash
# Test import directly
node -e "import('./path/to/handler.ts').then(console.log)"
```

## Guia de Migracao

### Do Config Legado para Descoberta

**Antes**:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "handlers": [
        {
          "event": "command:new",
          "module": "./hooks/handlers/my-handler.ts"
        }
      ]
    }
  }
}
```

**Depois**:

1. Crie o diretorio do hook:

   ```bash
   mkdir -p ~/.openclaw/hooks/my-hook
   mv ./hooks/handlers/my-handler.ts ~/.openclaw/hooks/my-hook/handler.ts
   ```

2. Crie o HOOK.md:

   ```markdown
   ---
   name: my-hook
   description: "My custom hook"
   metadata: { "openclaw": { "emoji": "🎯", "events": ["command:new"] } }
   ---

   # My Hook

   Does something useful.
   ```

3. Atualize a configuracao:

   ```json
   {
     "hooks": {
       "internal": {
         "enabled": true,
         "entries": {
           "my-hook": { "enabled": true }
         }
       }
     }
   }
   ```

4. Verifique e reinicie o processo do gateway:
   ```bash
   openclaw hooks list
   # Should show: 🎯 my-hook ✓
   ```

**Beneficios da migracao**:

- Descoberta automatica
- Gerenciamento via CLI
- Verificacao de elegibilidade
- Melhor documentacao
- Estrutura consistente

## Veja Tambem

- [Referencia da CLI: hooks](/cli/hooks)
- [README de Hooks Incluidos](https://github.com/openclaw/openclaw/tree/main/src/hooks/bundled)
- [Webhook Hooks](/automation/webhook)
- [Configuracao](/gateway/configuration#hooks)
