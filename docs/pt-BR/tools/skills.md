---
summary: "Skills: gerenciadas vs workspace, regras de gating e conexao de config/env"
read_when:
  - Adicionando ou modificando skills
  - Alterando gating ou regras de carregamento de skills
title: "Skills"
x-i18n:
  source_path: tools/skills.md
  source_hash: 54685da5885600b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:03Z
---

# Skills (OpenClaw)

O OpenClaw usa pastas de skills **compatíveis com [AgentSkills](https://agentskills.io)** para ensinar o agente a usar ferramentas. Cada skill é um diretório que contém um `SKILL.md` com frontmatter YAML e instruções. O OpenClaw carrega **skills empacotadas** mais substituições locais opcionais e as filtra no momento do carregamento com base no ambiente, na configuracao e na presença de binários.

## Locais e precedencia

As skills são carregadas de **três** lugares:

1. **Skills empacotadas**: enviadas com a instalação (pacote npm ou OpenClaw.app)
2. **Skills gerenciadas/locais**: `~/.openclaw/skills`
3. **Skills do workspace**: `<workspace>/skills`

Se houver conflito de nome de skill, a precedencia é:

`<workspace>/skills` (mais alta) → `~/.openclaw/skills` → skills empacotadas (mais baixa)

Além disso, voce pode configurar pastas extras de skills (menor precedencia) via
`skills.load.extraDirs` em `~/.openclaw/openclaw.json`.

## Skills por agente vs compartilhadas

Em configuracoes **multi-agente**, cada agente tem seu proprio workspace. Isso significa:

- **Skills por agente** ficam em `<workspace>/skills` apenas para esse agente.
- **Skills compartilhadas** ficam em `~/.openclaw/skills` (gerenciadas/locais) e são visiveis
  para **todos os agentes** na mesma maquina.
- **Pastas compartilhadas** também podem ser adicionadas via `skills.load.extraDirs` (menor
  precedencia) se voce quiser um pacote comum de skills usado por varios agentes.

Se o mesmo nome de skill existir em mais de um lugar, a precedencia usual se aplica:
workspace vence, depois gerenciada/local, depois empacotada.

## Plugins + skills

Plugins podem enviar suas proprias skills listando diretórios `skills` em
`openclaw.plugin.json` (caminhos relativos à raiz do plugin). As skills do plugin carregam
quando o plugin está habilitado e participam das regras normais de precedencia de skills.
Voce pode fazer gating delas via `metadata.openclaw.requires.config` na entrada de configuracao do plugin.
Veja [Plugins](/plugin) para descoberta/configuracao e [Tools](/tools) para a superficie
de ferramentas que essas skills ensinam.

## ClawHub (instalacao + sincronizacao)

O ClawHub é o registro publico de skills do OpenClaw. Navegue em
https://clawhub.com. Use-o para descobrir, instalar, atualizar e fazer backup de skills.
Guia completo: [ClawHub](/tools/clawhub).

Fluxos comuns:

- Instalar uma skill no seu workspace:
  - `clawhub install <skill-slug>`
- Atualizar todas as skills instaladas:
  - `clawhub update --all`
- Sincronizar (varrer + publicar atualizacoes):
  - `clawhub sync --all`

Por padrao, `clawhub` instala em `./skills` sob o seu diretorio de trabalho
atual (ou faz fallback para o workspace configurado do OpenClaw). O OpenClaw reconhece
isso como `<workspace>/skills` na proxima sessao.

## Notas de seguranca

- Trate skills de terceiros como **codigo nao confiavel**. Leia-as antes de habilitar.
- Prefira execucoes em sandbox para entradas nao confiaveis e ferramentas arriscadas.
  Veja [Sandboxing](/gateway/sandboxing).
- `skills.entries.*.env` e `skills.entries.*.apiKey` injetam segredos no processo **host**
  para aquele turno do agente (nao no sandbox). Mantenha segredos fora de prompts e logs.
- Para um modelo de ameacas mais amplo e checklists, veja [Security](/gateway/security).

## Formato (AgentSkills + compativel com Pi)

`SKILL.md` deve incluir pelo menos:

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
---
```

Notas:

- Seguimos a especificacao AgentSkills para layout/intencao.
- O parser usado pelo agente embutido suporta apenas chaves de frontmatter **em uma unica linha**.
- `metadata` deve ser um **objeto JSON de uma unica linha**.
- Use `{baseDir}` nas instrucoes para referenciar o caminho da pasta da skill.
- Chaves opcionais de frontmatter:
  - `homepage` — URL exibida como “Website” na UI de Skills do macOS (também suportado via `metadata.openclaw.homepage`).
  - `user-invocable` — `true|false` (padrao: `true`). Quando `true`, a skill é exposta como um comando de barra para o usuario.
  - `disable-model-invocation` — `true|false` (padrao: `false`). Quando `true`, a skill é excluida do prompt do modelo (ainda disponivel via invocacao do usuario).
  - `command-dispatch` — `tool` (opcional). Quando definido como `tool`, o comando de barra ignora o modelo e despacha diretamente para uma ferramenta.
  - `command-tool` — nome da ferramenta a invocar quando `command-dispatch: tool` está definido.
  - `command-arg-mode` — `raw` (padrao). Para despacho de ferramenta, encaminha a string de argumentos brutos para a ferramenta (sem parsing do core).

    A ferramenta é invocada com os parametros:
    `{ command: "<raw args>", commandName: "<slash command>", skillName: "<skill name>" }`.

## Gating (filtros em tempo de carregamento)

O OpenClaw **filtra skills no momento do carregamento** usando `metadata` (JSON de uma unica linha):

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["uv"], "env": ["GEMINI_API_KEY"], "config": ["browser.enabled"] },
        "primaryEnv": "GEMINI_API_KEY",
      },
  }
---
```

Campos sob `metadata.openclaw`:

- `always: true` — sempre incluir a skill (ignora outros gates).
- `emoji` — emoji opcional usado pela UI de Skills do macOS.
- `homepage` — URL opcional exibida como “Website” na UI de Skills do macOS.
- `os` — lista opcional de plataformas (`darwin`, `linux`, `win32`). Se definido, a skill só é elegivel nesses SOs.
- `requires.bins` — lista; cada um deve existir em `PATH`.
- `requires.anyBins` — lista; pelo menos um deve existir em `PATH`.
- `requires.env` — lista; a variavel de ambiente deve existir **ou** ser fornecida na configuracao.
- `requires.config` — lista de caminhos `openclaw.json` que devem ser truthy.
- `primaryEnv` — nome da variavel de ambiente associada a `skills.entries.<name>.apiKey`.
- `install` — array opcional de especificacoes de instalador usadas pela UI de Skills do macOS (brew/node/go/uv/download).

Nota sobre sandboxing:

- `requires.bins` é verificado no **host** no momento do carregamento da skill.
- Se um agente estiver em sandbox, o binario também deve existir **dentro do container**.
  Instale-o via `agents.defaults.sandbox.docker.setupCommand` (ou uma imagem customizada).
  `setupCommand` roda uma vez após o container ser criado.
  Instalacoes de pacotes também exigem saida de rede, um FS raiz gravavel e um usuario root no sandbox.
  Exemplo: a skill `summarize` (`skills/summarize/SKILL.md`) precisa do CLI `summarize`
  no container do sandbox para rodar ali.

Exemplo de instalador:

```markdown
---
name: gemini
description: Use Gemini CLI for coding assistance and Google search lookups.
metadata:
  {
    "openclaw":
      {
        "emoji": "♊️",
        "requires": { "bins": ["gemini"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "gemini-cli",
              "bins": ["gemini"],
              "label": "Install Gemini CLI (brew)",
            },
          ],
      },
  }
---
```

Notas:

- Se varios instaladores forem listados, o Gateway escolhe **uma unica** opcao preferida (brew quando disponivel, caso contrario node).
- Se todos os instaladores forem `download`, o OpenClaw lista cada entrada para que voce veja os artefatos disponiveis.
- Especificacoes de instalador podem incluir `os: ["darwin"|"linux"|"win32"]` para filtrar opcoes por plataforma.
- Instalacoes Node respeitam `skills.install.nodeManager` em `openclaw.json` (padrao: npm; opcoes: npm/pnpm/yarn/bun).
  Isso afeta apenas **instalacoes de skills**; o runtime do Gateway ainda deve ser Node
  (Bun nao é recomendado para WhatsApp/Telegram).
- Instalacoes Go: se `go` estiver ausente e `brew` estiver disponivel, o gateway instala Go via Homebrew primeiro e define `GOBIN` para o `bin` do Homebrew quando possivel.
- Instalacoes por download: `url` (obrigatorio), `archive` (`tar.gz` | `tar.bz2` | `zip`), `extract` (padrao: auto quando arquivo detectado), `stripComponents`, `targetDir` (padrao: `~/.openclaw/tools/<skillKey>`).

Se nenhum `metadata.openclaw` estiver presente, a skill é sempre elegivel (a menos que
desabilitada na configuracao ou bloqueada por `skills.allowBundled` para skills empacotadas).

## Substituicoes de configuracao (`~/.openclaw/openclaw.json`)

Skills empacotadas/gerenciadas podem ser alternadas e receber valores de env:

```json5
{
  skills: {
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
        config: {
          endpoint: "https://example.invalid",
          model: "nano-pro",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

Nota: se o nome da skill contiver hifens, coloque a chave entre aspas (JSON5 permite chaves com aspas).

As chaves de configuracao correspondem ao **nome da skill** por padrao. Se uma skill definir
`metadata.openclaw.skillKey`, use essa chave sob `skills.entries`.

Regras:

- `enabled: false` desabilita a skill mesmo se estiver empacotada/instalada.
- `env`: injetado **somente se** a variavel ainda nao estiver definida no processo.
- `apiKey`: conveniencia para skills que declaram `metadata.openclaw.primaryEnv`.
- `config`: bolsa opcional para campos customizados por skill; chaves customizadas devem viver aqui.
- `allowBundled`: allowlist opcional apenas para skills **empacotadas**. Se definido, apenas
  as skills empacotadas na lista são elegiveis (skills gerenciadas/workspace nao sao afetadas).

## Injecao de ambiente (por execucao do agente)

Quando uma execucao do agente comeca, o OpenClaw:

1. Le os metadados das skills.
2. Aplica quaisquer `skills.entries.<key>.env` ou `skills.entries.<key>.apiKey` a
   `process.env`.
3. Constroi o prompt do sistema com skills **elegiveis**.
4. Restaura o ambiente original após o termino da execucao.

Isso é **escopado à execucao do agente**, nao a um ambiente de shell global.

## Snapshot de sessao (desempenho)

O OpenClaw cria um snapshot das skills elegiveis **quando uma sessao comeca** e reutiliza essa lista para turnos subsequentes na mesma sessao. Mudancas em skills ou configuracao entram em vigor na proxima nova sessao.

As skills também podem atualizar no meio da sessao quando o watcher de skills está habilitado ou quando um novo node remoto elegivel aparece (veja abaixo). Pense nisso como um **hot reload**: a lista atualizada é capturada no proximo turno do agente.

## Nodes macOS remotos (Gateway Linux)

Se o Gateway estiver rodando no Linux mas um **node macOS** estiver conectado **com `system.run` permitido** (seguranca de aprovacoes Exec nao definida como `deny`), o OpenClaw pode tratar skills exclusivas do macOS como elegiveis quando os binarios necessarios estiverem presentes nesse node. O agente deve executar essas skills via a ferramenta `nodes` (tipicamente `nodes.run`).

Isso depende do node relatar seu suporte a comandos e de uma sondagem de binarios via `system.run`. Se o node macOS ficar offline depois, as skills permanecem visiveis; as invocacoes podem falhar até o node reconectar.

## Skills watcher (auto-atualizacao)

Por padrao, o OpenClaw observa pastas de skills e incrementa o snapshot de skills quando arquivos `SKILL.md` mudam. Configure isso em `skills.load`:

```json5
{
  skills: {
    load: {
      watch: true,
      watchDebounceMs: 250,
    },
  },
}
```

## Impacto de tokens (lista de skills)

Quando skills são elegiveis, o OpenClaw injeta uma lista XML compacta das skills disponiveis no prompt do sistema (via `formatSkillsForPrompt` em `pi-coding-agent`). O custo é deterministico:

- **Overhead base (apenas quando ≥1 skill):** 195 caracteres.
- **Por skill:** 97 caracteres + o comprimento dos valores XML-escaped de `<name>`, `<description>` e `<location>`.

Formula (caracteres):

```
total = 195 + Σ (97 + len(name_escaped) + len(description_escaped) + len(location_escaped))
```

Notas:

- O escape XML expande `& < > " '` em entidades (`&amp;`, `&lt;`, etc.), aumentando o comprimento.
- Contagens de tokens variam por tokenizer do modelo. Uma estimativa aproximada no estilo OpenAI é ~4 chars/token, então **97 chars ≈ 24 tokens** por skill, mais os comprimentos reais dos campos.

## Ciclo de vida de skills gerenciadas

O OpenClaw envia um conjunto base de skills como **skills empacotadas** como parte da
instalacao (pacote npm ou OpenClaw.app). `~/.openclaw/skills` existe para substituicoes locais
(por exemplo, fixar/aplicar patch em uma skill sem alterar a copia empacotada).
Skills do workspace pertencem ao usuario e substituem ambas em conflitos de nome.

## Referencia de configuracao

Veja [Configuracao de Skills](/tools/skills-config) para o schema completo de configuracao.

## Procurando mais skills?

Navegue em https://clawhub.com.

---
