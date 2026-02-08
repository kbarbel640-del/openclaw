---
summary: "OpenProse: fluxos de trabalho .prose, comandos de barra e estado no OpenClaw"
read_when:
  - Voce quer executar ou escrever fluxos de trabalho .prose
  - Voce quer habilitar o plugin OpenProse
  - Voce precisa entender o armazenamento de estado
title: "OpenProse"
x-i18n:
  source_path: prose.md
  source_hash: cf7301e927b9a463
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:03Z
---

# OpenProse

OpenProse é um formato de fluxo de trabalho portátil, markdown-first, para orquestrar sessoes de IA. No OpenClaw, ele é distribuído como um plugin que instala um pacote de Skills OpenProse, além de um comando de barra `/prose`. Os programas ficam em arquivos `.prose` e podem criar vários subagentes com controle de fluxo explícito.

Site oficial: https://www.prose.md

## O que ele pode fazer

- Pesquisa e síntese multiagente com paralelismo explícito.
- Fluxos de trabalho repetíveis e seguros para aprovação (revisão de código, triagem de incidentes, pipelines de conteúdo).
- Programas reutilizáveis `.prose` que voce pode executar em runtimes de agentes compatíveis.

## Instalar + habilitar

Plugins incluídos vêm desativados por padrão. Habilite o OpenProse:

```bash
openclaw plugins enable open-prose
```

Reinicie o Gateway após habilitar o plugin.

Checkout dev/local: `openclaw plugins install ./extensions/open-prose`

Docs relacionados: [Plugins](/plugin), [Manifesto de plugin](/plugins/manifest), [Skills](/tools/skills).

## Comando de barra

O OpenProse registra `/prose` como um comando de Skill invocável pelo usuário. Ele encaminha para as instruções da VM do OpenProse e usa ferramentas do OpenClaw por baixo dos panos.

Comandos comuns:

```
/prose help
/prose run <file.prose>
/prose run <handle/slug>
/prose run <https://example.com/file.prose>
/prose compile <file.prose>
/prose examples
/prose update
```

## Exemplo: um arquivo simples `.prose`

```prose
# Research + synthesis with two agents running in parallel.

input topic: "What should we research?"

agent researcher:
  model: sonnet
  prompt: "You research thoroughly and cite sources."

agent writer:
  model: opus
  prompt: "You write a concise summary."

parallel:
  findings = session: researcher
    prompt: "Research {topic}."
  draft = session: writer
    prompt: "Summarize {topic}."

session "Merge the findings + draft into a final answer."
context: { findings, draft }
```

## Localização dos arquivos

O OpenProse mantém o estado em `.prose/` no seu workspace:

```
.prose/
├── .env
├── runs/
│   └── {YYYYMMDD}-{HHMMSS}-{random}/
│       ├── program.prose
│       ├── state.md
│       ├── bindings/
│       └── agents/
└── agents/
```

Agentes persistentes no nível do usuário ficam em:

```
~/.prose/agents/
```

## Modos de estado

O OpenProse oferece suporte a vários backends de estado:

- **filesystem** (padrão): `.prose/runs/...`
- **in-context**: transitório, para programas pequenos
- **sqlite** (experimental): requer o binário `sqlite3`
- **postgres** (experimental): requer `psql` e uma string de conexão

Notas:

- sqlite/postgres são opcionais e experimentais.
- As credenciais do postgres fluem para os logs de subagentes; use um banco de dados dedicado com o menor privilégio possível.

## Programas remotos

`/prose run <handle/slug>` resolve para `https://p.prose.md/<handle>/<slug>`.
URLs diretas são buscadas como estão. Isso usa a ferramenta `web_fetch` (ou `exec` para POST).

## Mapeamento de runtime do OpenClaw

Programas OpenProse mapeiam para primitivas do OpenClaw:

| Conceito OpenProse             | Ferramenta OpenClaw |
| ------------------------------ | ------------------- |
| Criar sessao / ferramenta Task | `sessions_spawn`    |
| Leitura/gravação de arquivos   | `read` / `write`    |
| Busca na web                   | `web_fetch`         |

Se sua allowlist de ferramentas bloquear essas ferramentas, os programas OpenProse falharão. Veja [configuracao de Skills](/tools/skills-config).

## Segurança + aprovações

Trate arquivos `.prose` como código. Revise antes de executar. Use allowlists de ferramentas do OpenClaw e gates de aprovação para controlar efeitos colaterais.

Para fluxos de trabalho determinísticos e com aprovação controlada, compare com [Lobster](/tools/lobster).
