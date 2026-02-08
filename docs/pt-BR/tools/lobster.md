---
title: Lobster
summary: "Runtime de workflow tipado para OpenClaw com portões de aprovação retomáveis."
description: Runtime de workflow tipado para OpenClaw — pipelines componíveis com portões de aprovação.
read_when:
  - Você quer workflows determinísticos de múltiplas etapas com aprovações explícitas
  - Você precisa retomar um workflow sem reexecutar etapas anteriores
x-i18n:
  source_path: tools/lobster.md
  source_hash: ff84e65f4be162ad
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:50Z
---

# Lobster

Lobster é um shell de workflow que permite ao OpenClaw executar sequências de ferramentas de múltiplas etapas como uma única operação determinística, com checkpoints de aprovação explícitos.

## Hook

Seu assistente pode construir as ferramentas que gerenciam a si mesmo. Peça um workflow e, 30 minutos depois, você tem uma CLI mais pipelines que rodam como uma única chamada. Lobster é a peça que faltava: pipelines determinísticos, aprovações explícitas e estado retomável.

## Por quê

Hoje, workflows complexos exigem muitas chamadas de ferramentas de ida e volta. Cada chamada custa tokens, e o LLM precisa orquestrar cada etapa. Lobster move essa orquestração para um runtime tipado:

- **Uma chamada em vez de muitas**: OpenClaw executa uma única chamada de ferramenta do Lobster e obtém um resultado estruturado.
- **Aprovações integradas**: Efeitos colaterais (enviar e-mail, postar comentário) interrompem o workflow até serem explicitamente aprovados.
- **Retomável**: Workflows interrompidos retornam um token; aprove e retome sem reexecutar tudo.

## Por que um DSL em vez de programas simples?

Lobster é intencionalmente pequeno. O objetivo não é “uma nova linguagem”, é uma especificação de pipeline previsível e amigável para IA, com aprovações de primeira classe e tokens de retomada.

- **Aprovar/retomar é nativo**: Um programa normal pode solicitar um humano, mas não consegue _pausar e retomar_ com um token durável sem que você invente esse runtime por conta própria.
- **Determinismo + auditabilidade**: Pipelines são dados, então é fácil registrar logs, fazer diff, reproduzir e revisar.
- **Superfície restrita para IA**: Uma gramática pequena + piping JSON reduz caminhos de código “criativos” e torna a validação realista.
- **Política de segurança embutida**: Timeouts, limites de saída, verificações de sandbox e allowlists são aplicados pelo runtime, não por cada script.
- **Ainda programável**: Cada etapa pode chamar qualquer CLI ou script. Se você quiser JS/TS, gere arquivos `.lobster` a partir de código.

## Como funciona

OpenClaw inicia a CLI local `lobster` em **modo de ferramenta** e faz o parse de um envelope JSON a partir do stdout.
Se o pipeline pausar para aprovação, a ferramenta retorna um `resumeToken` para que você possa continuar depois.

## Padrão: CLI pequena + pipes JSON + aprovações

Construa comandos pequenos que falem JSON e, em seguida, encadeie-os em uma única chamada do Lobster. (Nomes de comandos de exemplo abaixo — substitua pelos seus.)

```bash
inbox list --json
inbox categorize --json
inbox apply --json
```

```json
{
  "action": "run",
  "pipeline": "exec --json --shell 'inbox list --json' | exec --stdin json --shell 'inbox categorize --json' | exec --stdin json --shell 'inbox apply --json' | approve --preview-from-stdin --limit 5 --prompt 'Apply changes?'",
  "timeoutMs": 30000
}
```

Se o pipeline solicitar aprovação, retome com o token:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

A IA dispara o workflow; o Lobster executa as etapas. Portões de aprovação mantêm os efeitos colaterais explícitos e auditáveis.

Exemplo: mapear itens de entrada em chamadas de ferramentas:

```bash
gog.gmail.search --query 'newer_than:1d' \
  | openclaw.invoke --tool message --action send --each --item-key message --args-json '{"provider":"telegram","to":"..."}'
```

## Etapas LLM somente JSON (llm-task)

Para workflows que precisam de uma **etapa LLM estruturada**, habilite a ferramenta de plugin opcional
`llm-task` e chame-a a partir do Lobster. Isso mantém o workflow
determinístico enquanto ainda permite classificar/resumir/redigir com um modelo.

Habilite a ferramenta:

```json
{
  "plugins": {
    "entries": {
      "llm-task": { "enabled": true }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "allow": ["llm-task"] }
      }
    ]
  }
}
```

Use-a em um pipeline:

```lobster
openclaw.invoke --tool llm-task --action json --args-json '{
  "prompt": "Given the input email, return intent and draft.",
  "input": { "subject": "Hello", "body": "Can you help?" },
  "schema": {
    "type": "object",
    "properties": {
      "intent": { "type": "string" },
      "draft": { "type": "string" }
    },
    "required": ["intent", "draft"],
    "additionalProperties": false
  }
}'
```

Veja [LLM Task](/tools/llm-task) para detalhes e opções de configuração.

## Arquivos de workflow (.lobster)

Lobster pode executar arquivos de workflow YAML/JSON com campos `name`, `args`, `steps`, `env`, `condition` e `approval`. Em chamadas de ferramenta do OpenClaw, defina `pipeline` como o caminho do arquivo.

```yaml
name: inbox-triage
args:
  tag:
    default: "family"
steps:
  - id: collect
    command: inbox list --json
  - id: categorize
    command: inbox categorize --json
    stdin: $collect.stdout
  - id: approve
    command: inbox apply --approve
    stdin: $categorize.stdout
    approval: required
  - id: execute
    command: inbox apply --execute
    stdin: $categorize.stdout
    condition: $approve.approved
```

Notas:

- `stdin: $step.stdout` e `stdin: $step.json` passam a saída de uma etapa anterior.
- `condition` (ou `when`) pode condicionar etapas com base em `$step.approved`.

## Instalar o Lobster

Instale a CLI do Lobster no **mesmo host** que executa o OpenClaw Gateway (veja o [repositório do Lobster](https://github.com/openclaw/lobster)) e garanta que `lobster` esteja no `PATH`.
Se quiser usar um local de binário personalizado, passe um `lobsterPath` **absoluto** na chamada da ferramenta.

## Habilitar a ferramenta

Lobster é uma ferramenta de plugin **opcional** (não habilitada por padrão).

Recomendado (aditivo, seguro):

```json
{
  "tools": {
    "alsoAllow": ["lobster"]
  }
}
```

Ou por agente:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "alsoAllow": ["lobster"]
        }
      }
    ]
  }
}
```

Evite usar `tools.allow: ["lobster"]` a menos que você pretenda executar em modo restritivo de allowlist.

Nota: allowlists são opt-in para plugins opcionais. Se sua allowlist nomear apenas
ferramentas de plugin (como `lobster`), o OpenClaw mantém as ferramentas principais habilitadas. Para restringir ferramentas principais,
inclua também na allowlist as ferramentas ou grupos principais desejados.

## Exemplo: triagem de e-mails

Sem Lobster:

```
User: "Check my email and draft replies"
→ openclaw calls gmail.list
→ LLM summarizes
→ User: "draft replies to #2 and #5"
→ LLM drafts
→ User: "send #2"
→ openclaw calls gmail.send
(repeat daily, no memory of what was triaged)
```

Com Lobster:

```json
{
  "action": "run",
  "pipeline": "email.triage --limit 20",
  "timeoutMs": 30000
}
```

Retorna um envelope JSON (truncado):

```json
{
  "ok": true,
  "status": "needs_approval",
  "output": [{ "summary": "5 need replies, 2 need action" }],
  "requiresApproval": {
    "type": "approval_request",
    "prompt": "Send 2 draft replies?",
    "items": [],
    "resumeToken": "..."
  }
}
```

Usuário aprova → retomar:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

Um workflow. Determinístico. Seguro.

## Parâmetros da ferramenta

### `run`

Execute um pipeline em modo de ferramenta.

```json
{
  "action": "run",
  "pipeline": "gog.gmail.search --query 'newer_than:1d' | email.triage",
  "cwd": "/path/to/workspace",
  "timeoutMs": 30000,
  "maxStdoutBytes": 512000
}
```

Execute um arquivo de workflow com argumentos:

```json
{
  "action": "run",
  "pipeline": "/path/to/inbox-triage.lobster",
  "argsJson": "{\"tag\":\"family\"}"
}
```

### `resume`

Continue um workflow interrompido após aprovação.

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

### Entradas opcionais

- `lobsterPath`: Caminho absoluto para o binário do Lobster (omita para usar `PATH`).
- `cwd`: Diretório de trabalho para o pipeline (padrão: diretório de trabalho do processo atual).
- `timeoutMs`: Encerra o subprocesso se exceder esta duração (padrão: 20000).
- `maxStdoutBytes`: Encerra o subprocesso se stdout exceder este tamanho (padrão: 512000).
- `argsJson`: String JSON passada para `lobster run --args-json` (apenas arquivos de workflow).

## Envelope de saída

Lobster retorna um envelope JSON com um de três status:

- `ok` → finalizado com sucesso
- `needs_approval` → pausado; `requiresApproval.resumeToken` é necessário para retomar
- `cancelled` → explicitamente negado ou cancelado

A ferramenta expõe o envelope tanto em `content` (JSON formatado) quanto em `details` (objeto bruto).

## Aprovações

Se `requiresApproval` estiver presente, inspecione o prompt e decida:

- `approve: true` → retomar e continuar os efeitos colaterais
- `approve: false` → cancelar e finalizar o workflow

Use `approve --preview-from-stdin --limit N` para anexar uma prévia JSON a solicitações de aprovação sem colagem personalizada de jq/heredoc. Tokens de retomada agora são compactos: o Lobster armazena o estado de retomada do workflow em seu diretório de estado e retorna uma pequena chave de token.

## OpenProse

OpenProse combina bem com Lobster: use `/prose` para orquestrar a preparação multiagente e, em seguida, execute um pipeline do Lobster para aprovações determinísticas. Se um programa Prose precisar do Lobster, permita a ferramenta `lobster` para subagentes via `tools.subagents.tools`. Veja [OpenProse](/prose).

## Segurança

- **Apenas subprocessos locais** — nenhuma chamada de rede a partir do próprio plugin.
- **Sem segredos** — Lobster não gerencia OAuth; ele chama ferramentas do OpenClaw que gerenciam.
- **Ciente de sandbox** — desabilitado quando o contexto da ferramenta está em sandbox.
- **Endurecido** — `lobsterPath` deve ser absoluto se especificado; timeouts e limites de saída são aplicados.

## Solução de problemas

- **`lobster subprocess timed out`** → aumente `timeoutMs` ou divida um pipeline longo.
- **`lobster output exceeded maxStdoutBytes`** → aumente `maxStdoutBytes` ou reduza o tamanho da saída.
- **`lobster returned invalid JSON`** → garanta que o pipeline rode em modo de ferramenta e imprima apenas JSON.
- **`lobster failed (code …)`** → execute o mesmo pipeline em um terminal para inspecionar stderr.

## Saiba mais

- [Plugins](/plugin)
- [Criação de ferramentas de plugin](/plugins/agent-tools)

## Estudo de caso: workflows da comunidade

Um exemplo público: uma CLI de “segundo cérebro” + pipelines do Lobster que gerenciam três cofres Markdown (pessoal, parceiro, compartilhado). A CLI emite JSON para estatísticas, listagens de inbox e varreduras de obsolescência; o Lobster encadeia esses comandos em workflows como `weekly-review`, `inbox-triage`, `memory-consolidation` e `shared-task-sync`, cada um com portões de aprovação. A IA lida com julgamento (categorização) quando disponível e recorre a regras determinísticas quando não.

- Thread: https://x.com/plattenschieber/status/2014508656335770033
- Repo: https://github.com/bloomedai/brain-cli
