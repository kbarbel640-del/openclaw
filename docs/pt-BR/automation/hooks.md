---
summary: "Hooks: automação orientada a eventos para comandos e eventos do ciclo de vida"
read_when:
  - Voce quer automação orientada a eventos para /new, /reset, /stop e eventos do ciclo de vida do agente
  - Voce quer criar, instalar ou depurar hooks
title: "Hooks"
x-i18n:
  source_path: automation/hooks.md
  source_hash: 9fbcf9e04fd9e62c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:31Z
---

# Hooks

Hooks fornecem um sistema extensível orientado a eventos para automatizar ações em resposta a comandos e eventos do agente. Os hooks são descobertos automaticamente a partir de diretórios e podem ser gerenciados via CLI, de forma semelhante a como as Skills funcionam no OpenClaw.

## Introdução

Hooks são pequenos scripts que são executados quando algo acontece. Existem dois tipos:

- **Hooks** (esta página): executam dentro do Gateway quando eventos do agente disparam, como `/new`, `/reset`, `/stop` ou eventos do ciclo de vida.
- **Webhooks**: webhooks HTTP externos que permitem que outros sistemas acionem trabalho no OpenClaw. Veja [Webhook Hooks](/automation/webhook) ou use `openclaw webhooks` para comandos auxiliares do Gmail.

Hooks também podem ser empacotados dentro de plugins; veja [Plugins](/tools/plugin#plugin-hooks).

Usos comuns:

- Salvar um snapshot de memória quando voce redefine uma sessao
- Manter uma trilha de auditoria de comandos para solucao de problemas ou conformidade
- Disparar automações de acompanhamento quando uma sessao começa ou termina
- Escrever arquivos no workspace do agente ou chamar APIs externas quando eventos disparam

Se voce consegue escrever uma pequena função em TypeScript, voce consegue escrever um hook. Os hooks são descobertos automaticamente, e voce os habilita ou desabilita via CLI.

## Visão Geral

O sistema de hooks permite que voce:

- Salve o contexto da sessao na memória quando `/new` é emitido
- Registre todos os comandos para auditoria
- Dispare automações personalizadas em eventos do ciclo de vida do agente
- Estenda o comportamento do OpenClaw sem modificar o código principal

## Primeiros Passos

### Hooks Integrados

O OpenClaw vem com quatro hooks integrados que são descobertos automaticamente:

- **💾 session-memory**: Salva o contexto da sessao no workspace do agente (padrão `~/.openclaw/workspace/memory/`) quando voce emite `/new`
- **📝 command-logger**: Registra todos os eventos de comando em `~/.openclaw/logs/commands.log`
- **🚀 boot-md**: Executa `BOOT.md` quando o gateway inicia (requer hooks internos habilitados)
- **😈 soul-evil**: Troca o conteúdo injetado de `SOUL.md` por `SOUL_EVIL.md` durante uma janela de purge ou por chance aleatória

Listar hooks disponíveis:

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

Obter informações detalhadas:

```bash
openclaw hooks info session-memory
```

### Integracao Inicial

Durante a integracao inicial (`openclaw onboard`), voce será solicitado a habilitar hooks recomendados. O assistente descobre automaticamente hooks elegíveis e os apresenta para seleção.

## Descoberta de Hooks

Os hooks são descobertos automaticamente a partir de três diretórios (em ordem de precedência):

1. **Hooks do workspace**: `<workspace>/hooks/` (por agente, maior precedência)
2. **Hooks gerenciados**: `~/.openclaw/hooks/` (instalados pelo usuário, compartilhados entre workspaces)
3. **Hooks integrados**: `<openclaw>/dist/hooks/bundled/` (fornecidos com o OpenClaw)

Diretórios de hooks gerenciados podem ser tanto um **hook único** quanto um **pacote de hooks** (diretório de pacote).

Cada hook é um diretório contendo:

```
my-hook/
├── HOOK.md          # Metadata + documentation
└── handler.ts       # Handler implementation
```

## Pacotes de Hooks (npm/arquivos)

Pacotes de hooks são pacotes npm padrão que exportam um ou mais hooks via `openclaw.hooks` em
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

Cada entrada aponta para um diretório de hook contendo `HOOK.md` e `handler.ts` (ou `index.ts`).
Pacotes de hooks podem incluir dependências; elas serão instaladas em `~/.openclaw/hooks/<id>`.

## Estrutura de Hook

### Formato do HOOK.md

O arquivo `HOOK.md` contém metadados em frontmatter YAML além de documentação em Markdown:

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

- **`emoji`**: Emoji de exibição para a CLI (por exemplo, `"💾"`)
- **`events`**: Array de eventos para escutar (por exemplo, `["command:new", "command:reset"]`)
- **`export`**: Exportação nomeada a usar (padrão `"default"`)
- **`homepage`**: URL de documentação
- **`requires`**: Requisitos opcionais
  - **`bins`**: Binários obrigatórios no PATH (por exemplo, `["git", "node"]`)
  - **`anyBins`**: Pelo menos um desses binários deve estar presente
  - **`env`**: Variáveis de ambiente obrigatórias
  - **`config`**: Caminhos de configuração obrigatórios (por exemplo, `["workspace.dir"]`)
  - **`os`**: Plataformas obrigatórias (por exemplo, `["darwin", "linux"]`)
- **`always`**: Ignorar verificações de elegibilidade (booleano)
- **`install`**: Métodos de instalação (para hooks integrados: `[{"id":"bundled","kind":"bundled"}]`)

### Implementação do Handler

O arquivo `handler.ts` exporta uma função `HookHandler`:

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

Disparados quando comandos do agente são emitidos:

- **`command`**: Todos os eventos de comando (listener geral)
- **`command:new`**: Quando o comando `/new` é emitido
- **`command:reset`**: Quando o comando `/reset` é emitido
- **`command:stop`**: Quando o comando `/stop` é emitido

### Eventos do Agente

- **`agent:bootstrap`**: Antes que arquivos de bootstrap do workspace sejam injetados (hooks podem mutar `context.bootstrapFiles`)

### Eventos do Gateway

Disparados quando o gateway inicia:

- **`gateway:startup`**: Após os canais iniciarem e os hooks serem carregados

### Hooks de Resultado de Ferramenta (API de Plugin)

Esses hooks não são listeners de fluxo de eventos; eles permitem que plugins ajustem de forma síncrona resultados de ferramentas antes que o OpenClaw os persista.

- **`tool_result_persist`**: transforma resultados de ferramentas antes de serem gravados na transcrição da sessao. Deve ser síncrono; retorne o payload de resultado de ferramenta atualizado ou `undefined` para mantê-lo como está. Veja [Agent Loop](/concepts/agent-loop).

### Eventos Futuros

Tipos de evento planejados:

- **`session:start`**: Quando uma nova sessao começa
- **`session:end`**: Quando uma sessao termina
- **`agent:error`**: Quando um agente encontra um erro
- **`message:sent`**: Quando uma mensagem é enviada
- **`message:received`**: Quando uma mensagem é recebida

## Criando Hooks Personalizados

### 1. Escolher Local

- **Hooks do workspace** (`<workspace>/hooks/`): Por agente, maior precedência
- **Hooks gerenciados** (`~/.openclaw/hooks/`): Compartilhados entre workspaces

### 2. Criar Estrutura de Diretórios

```bash
mkdir -p ~/.openclaw/hooks/my-hook
cd ~/.openclaw/hooks/my-hook
```

### 3. Criar HOOK.md

```markdown
---
name: my-hook
description: "Does something useful"
metadata: { "openclaw": { "emoji": "🎯", "events": ["command:new"] } }
---

# My Custom Hook

This hook does something useful when you issue `/new`.
```

### 4. Criar handler.ts

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

### 5. Habilitar e Testar

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

### Diretórios Extras

Carregar hooks a partir de diretórios adicionais:

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

**Migracao**: Use o novo sistema baseado em descoberta para novos hooks. Handlers legados são carregados após hooks baseados em diretório.

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

## Referência de hooks integrados

### session-memory

Salva o contexto da sessao na memória quando voce emite `/new`.

**Eventos**: `command:new`

**Requisitos**: `workspace.dir` deve estar configurado

**Saída**: `<workspace>/memory/YYYY-MM-DD-slug.md` (padrão `~/.openclaw/workspace`)

**O que ele faz**:

1. Usa a entrada de sessao pré-reset para localizar a transcrição correta
2. Extrai as últimas 15 linhas da conversa
3. Usa LLM para gerar um slug descritivo de nome de arquivo
4. Salva metadados da sessao em um arquivo de memória datado

**Exemplo de saída**:

```markdown
# Session: 2026-01-16 14:30:00 UTC

- **Session Key**: agent:main:main
- **Session ID**: abc123def456
- **Source**: telegram
```

**Exemplos de nome de arquivo**:

- `2026-01-16-vendor-pitch.md`
- `2026-01-16-api-design.md`
- `2026-01-16-1430.md` (timestamp de fallback se a geração do slug falhar)

**Habilitar**:

```bash
openclaw hooks enable session-memory
```

### command-logger

Registra todos os eventos de comando em um arquivo de auditoria centralizado.

**Eventos**: `command`

**Requisitos**: Nenhum

**Saída**: `~/.openclaw/logs/commands.log`

**O que ele faz**:

1. Captura detalhes do evento (ação do comando, timestamp, chave da sessao, ID do remetente, origem)
2. Acrescenta ao arquivo de log no formato JSONL
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

Troca conteúdo injetado de `SOUL.md` por `SOUL_EVIL.md` durante uma janela de purge ou por chance aleatória.

**Eventos**: `agent:bootstrap`

**Docs**: [SOUL Evil Hook](/hooks/soul-evil)

**Saída**: Nenhum arquivo gravado; as trocas acontecem apenas em memória.

**Habilitar**:

```bash
openclaw hooks enable soul-evil
```

**Configuracao**:

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

Executa `BOOT.md` quando o gateway inicia (após os canais iniciarem).
Hooks internos devem estar habilitados para que isso seja executado.

**Eventos**: `gateway:startup`

**Requisitos**: `workspace.dir` deve estar configurado

**O que ele faz**:

1. Lê `BOOT.md` do seu workspace
2. Executa as instruções via o runner do agente
3. Envia quaisquer mensagens de saída solicitadas via a ferramenta de mensagens

**Habilitar**:

```bash
openclaw hooks enable boot-md
```

## Boas Práticas

### Mantenha Handlers Rápidos

Hooks são executados durante o processamento de comandos. Mantenha-os leves:

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

### Trate Erros com Elegância

Sempre envolva operações arriscadas:

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

Retorne cedo se o evento não for relevante:

```typescript
const handler: HookHandler = async (event) => {
  // Only handle 'new' commands
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  // Your logic here
};
```

### Use Chaves de Evento Específicas

Especifique eventos exatos nos metadados quando possível:

```yaml
metadata: { "openclaw": { "events": ["command:new"] } } # Specific
```

Em vez de:

```yaml
metadata: { "openclaw": { "events": ["command"] } } # General - more overhead
```

## Depuracao

### Habilitar Logs de Hook

O gateway registra o carregamento de hooks na inicialização:

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

No seu handler, registre quando ele é chamado:

```typescript
const handler: HookHandler = async (event) => {
  console.log("[my-handler] Triggered:", event.type, event.action);
  // Your logic
};
```

### Verificar Elegibilidade

Verifique por que um hook não é elegível:

```bash
openclaw hooks info my-hook
```

Procure por requisitos ausentes na saída.

## Testes

### Logs do Gateway

Monitore os logs do gateway para ver a execução dos hooks:

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

- **`src/hooks/types.ts`**: Definições de tipos
- **`src/hooks/workspace.ts`**: Varredura e carregamento de diretórios
- **`src/hooks/frontmatter.ts`**: Parsing de metadados do HOOK.md
- **`src/hooks/config.ts`**: Verificação de elegibilidade
- **`src/hooks/hooks-status.ts`**: Relato de status
- **`src/hooks/loader.ts`**: Carregador dinâmico de módulos
- **`src/cli/hooks-cli.ts`**: Comandos da CLI
- **`src/gateway/server-startup.ts`**: Carrega hooks na inicialização do gateway
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

### Hook Não Descoberto

1. Verifique a estrutura de diretórios:

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

### Hook Não Elegível

Verifique os requisitos:

```bash
openclaw hooks info my-hook
```

Procure por ausências de:

- Binários (verifique o PATH)
- Variáveis de ambiente
- Valores de configuracao
- Compatibilidade de SO

### Hook Não Executando

1. Verifique se o hook está habilitado:

   ```bash
   openclaw hooks list
   # Should show ✓ next to enabled hooks
   ```

2. Reinicie o processo do gateway para que os hooks sejam recarregados.

3. Verifique os logs do gateway para erros:

   ```bash
   ./scripts/clawlog.sh | grep hook
   ```

### Erros no Handler

Verifique erros de TypeScript/importação:

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

1. Crie o diretório do hook:

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

**Benefícios da migracao**:

- Descoberta automática
- Gerenciamento via CLI
- Verificação de elegibilidade
- Melhor documentação
- Estrutura consistente

## Veja Também

- [Referência da CLI: hooks](/cli/hooks)
- [README de Hooks Integrados](https://github.com/openclaw/openclaw/tree/main/src/hooks/bundled)
- [Webhook Hooks](/automation/webhook)
- [Configuracao](/gateway/configuration#hooks)
