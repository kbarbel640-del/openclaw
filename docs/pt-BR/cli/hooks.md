---
summary: "Referencia da CLI para `openclaw hooks` (hooks de agente)"
read_when:
  - Voce quer gerenciar hooks de agente
  - Voce quer instalar ou atualizar hooks
title: "hooks"
x-i18n:
  source_path: cli/hooks.md
  source_hash: e2032e61ff4b9135
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:44Z
---

# `openclaw hooks`

Gerencie hooks de agente (automacoes orientadas a eventos para comandos como `/new`, `/reset` e a inicializacao do gateway).

Relacionado:

- Hooks: [Hooks](/hooks)
- Hooks de plugin: [Plugins](/plugin#plugin-hooks)

## Listar Todos os Hooks

```bash
openclaw hooks list
```

Lista todos os hooks descobertos nos diretorios de workspace, gerenciados e empacotados.

**Opcoes:**

- `--eligible`: Mostrar apenas hooks elegiveis (requisitos atendidos)
- `--json`: Saida em JSON
- `-v, --verbose`: Mostrar informacoes detalhadas, incluindo requisitos ausentes

**Exemplo de saida:**

```
Hooks (4/4 ready)

Ready:
  🚀 boot-md ✓ - Run BOOT.md on gateway startup
  📝 command-logger ✓ - Log all command events to a centralized audit file
  💾 session-memory ✓ - Save session context to memory when /new command is issued
  😈 soul-evil ✓ - Swap injected SOUL content during a purge window or by random chance
```

**Exemplo (detalhado):**

```bash
openclaw hooks list --verbose
```

Mostra requisitos ausentes para hooks nao elegiveis.

**Exemplo (JSON):**

```bash
openclaw hooks list --json
```

Retorna JSON estruturado para uso programatico.

## Obter Informacoes do Hook

```bash
openclaw hooks info <name>
```

Mostra informacoes detalhadas sobre um hook especifico.

**Argumentos:**

- `<name>`: Nome do hook (por exemplo, `session-memory`)

**Opcoes:**

- `--json`: Saida em JSON

**Exemplo:**

```bash
openclaw hooks info session-memory
```

**Saida:**

```
💾 session-memory ✓ Ready

Save session context to memory when /new command is issued

Details:
  Source: openclaw-bundled
  Path: /path/to/openclaw/hooks/bundled/session-memory/HOOK.md
  Handler: /path/to/openclaw/hooks/bundled/session-memory/handler.ts
  Homepage: https://docs.openclaw.ai/hooks#session-memory
  Events: command:new

Requirements:
  Config: ✓ workspace.dir
```

## Verificar Elegibilidade dos Hooks

```bash
openclaw hooks check
```

Mostra um resumo do status de elegibilidade dos hooks (quantos estao prontos vs. nao prontos).

**Opcoes:**

- `--json`: Saida em JSON

**Exemplo de saida:**

```
Hooks Status

Total hooks: 4
Ready: 4
Not ready: 0
```

## Habilitar um Hook

```bash
openclaw hooks enable <name>
```

Habilita um hook especifico adicionando-o a sua configuracao (`~/.openclaw/config.json`).

**Nota:** Hooks gerenciados por plugins mostram `plugin:<id>` em `openclaw hooks list` e
nao podem ser habilitados/desabilitados aqui. Em vez disso, habilite/desabilite o plugin.

**Argumentos:**

- `<name>`: Nome do hook (por exemplo, `session-memory`)

**Exemplo:**

```bash
openclaw hooks enable session-memory
```

**Saida:**

```
✓ Enabled hook: 💾 session-memory
```

**O que faz:**

- Verifica se o hook existe e e elegivel
- Atualiza `hooks.internal.entries.<name>.enabled = true` na sua configuracao
- Salva a configuracao em disco

**Apos habilitar:**

- Reinicie o gateway para que os hooks sejam recarregados (reinicio do app da barra de menu no macOS ou reinicie o processo do gateway em dev).

## Desabilitar um Hook

```bash
openclaw hooks disable <name>
```

Desabilita um hook especifico atualizando sua configuracao.

**Argumentos:**

- `<name>`: Nome do hook (por exemplo, `command-logger`)

**Exemplo:**

```bash
openclaw hooks disable command-logger
```

**Saida:**

```
⏸ Disabled hook: 📝 command-logger
```

**Apos desabilitar:**

- Reinicie o gateway para que os hooks sejam recarregados

## Instalar Hooks

```bash
openclaw hooks install <path-or-spec>
```

Instala um pacote de hooks a partir de uma pasta/arquivo local ou npm.

**O que faz:**

- Copia o pacote de hooks para `~/.openclaw/hooks/<id>`
- Habilita os hooks instalados em `hooks.internal.entries.*`
- Registra a instalacao em `hooks.internal.installs`

**Opcoes:**

- `-l, --link`: Vincular um diretorio local em vez de copiar (adiciona-o a `hooks.internal.load.extraDirs`)

**Arquivos suportados:** `.zip`, `.tgz`, `.tar.gz`, `.tar`

**Exemplos:**

```bash
# Local directory
openclaw hooks install ./my-hook-pack

# Local archive
openclaw hooks install ./my-hook-pack.zip

# NPM package
openclaw hooks install @openclaw/my-hook-pack

# Link a local directory without copying
openclaw hooks install -l ./my-hook-pack
```

## Atualizar Hooks

```bash
openclaw hooks update <id>
openclaw hooks update --all
```

Atualiza pacotes de hooks instalados (apenas instalacoes via npm).

**Opcoes:**

- `--all`: Atualizar todos os pacotes de hooks rastreados
- `--dry-run`: Mostrar o que mudaria sem gravar

## Hooks Empacotados

### session-memory

Salva o contexto da sessao na memoria quando voce emite `/new`.

**Habilitar:**

```bash
openclaw hooks enable session-memory
```

**Saida:** `~/.openclaw/workspace/memory/YYYY-MM-DD-slug.md`

**Veja:** [documentacao do session-memory](/hooks#session-memory)

### command-logger

Registra todos os eventos de comando em um arquivo de auditoria centralizado.

**Habilitar:**

```bash
openclaw hooks enable command-logger
```

**Saida:** `~/.openclaw/logs/commands.log`

**Ver logs:**

```bash
# Recent commands
tail -n 20 ~/.openclaw/logs/commands.log

# Pretty-print
cat ~/.openclaw/logs/commands.log | jq .

# Filter by action
grep '"action":"new"' ~/.openclaw/logs/commands.log | jq .
```

**Veja:** [documentacao do command-logger](/hooks#command-logger)

### soul-evil

Troca conteudo `SOUL.md` injetado por `SOUL_EVIL.md` durante uma janela de limpeza ou por chance aleatoria.

**Habilitar:**

```bash
openclaw hooks enable soul-evil
```

**Veja:** [SOUL Evil Hook](/hooks/soul-evil)

### boot-md

Executa `BOOT.md` quando o gateway inicia (apos os canais iniciarem).

**Eventos**: `gateway:startup`

**Habilitar**:

```bash
openclaw hooks enable boot-md
```

**Veja:** [documentacao do boot-md](/hooks#boot-md)
