---
summary: "Backends de CLI: fallback somente texto via CLIs de IA locais"
read_when:
  - Voce quer um fallback confiavel quando provedores de API falham
  - Voce esta executando Claude Code CLI ou outros CLIs de IA locais e quer reutiliza-los
  - Voce precisa de um caminho somente texto, sem ferramentas, que ainda suporte sessoes e imagens
title: "Backends de CLI"
x-i18n:
  source_path: gateway/cli-backends.md
  source_hash: 8285f4829900bc81
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:19Z
---

# Backends de CLI (runtime de fallback)

O OpenClaw pode executar **CLIs de IA locais** como um **fallback somente texto** quando provedores de API estao fora do ar,
com limite de taxa, ou temporariamente com comportamento inadequado. Isso e intencionalmente conservador:

- **Ferramentas sao desativadas** (sem chamadas de ferramentas).
- **Texto entra → texto sai** (confiavel).
- **Sessoes sao suportadas** (para que turnos de acompanhamento permaneçam coerentes).
- **Imagens podem ser repassadas** se a CLI aceitar caminhos de imagem.

Isso foi projetado como uma **rede de seguranca** em vez de um caminho primario. Use quando voce
quer respostas de texto que “sempre funcionam” sem depender de APIs externas.

## Inicio rapido para iniciantes

Voce pode usar o Claude Code CLI **sem nenhuma configuracao** (o OpenClaw inclui um padrao integrado):

```bash
openclaw agent --message "hi" --model claude-cli/opus-4.6
```

O Codex CLI tambem funciona imediatamente:

```bash
openclaw agent --message "hi" --model codex-cli/gpt-5.3-codex
```

Se o seu Gateway roda sob launchd/systemd e o PATH e minimo, adicione apenas o
caminho do comando:

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": {
          command: "/opt/homebrew/bin/claude",
        },
      },
    },
  },
}
```

E so isso. Sem chaves, sem configuracao extra de autenticacao alem da propria CLI.

## Usando como fallback

Adicione um backend de CLI a sua lista de fallback para que ele so execute quando os modelos primarios falharem:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["claude-cli/opus-4.6", "claude-cli/opus-4.5"],
      },
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "claude-cli/opus-4.6": {},
        "claude-cli/opus-4.5": {},
      },
    },
  },
}
```

Notas:

- Se voce usar `agents.defaults.models` (allowlist), deve incluir `claude-cli/...`.
- Se o provedor primario falhar (auth, limites de taxa, timeouts), o OpenClaw ira
  tentar o backend de CLI em seguida.

## Visao geral da configuracao

Todos os backends de CLI ficam em:

```
agents.defaults.cliBackends
```

Cada entrada e identificada por um **id de provedor** (por exemplo, `claude-cli`, `my-cli`).
O id do provedor se torna o lado esquerdo da sua referencia de modelo:

```
<provider>/<model>
```

### Exemplo de configuracao

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": {
          command: "/opt/homebrew/bin/claude",
        },
        "my-cli": {
          command: "my-cli",
          args: ["--json"],
          output: "json",
          input: "arg",
          modelArg: "--model",
          modelAliases: {
            "claude-opus-4-6": "opus",
            "claude-opus-4-5": "opus",
            "claude-sonnet-4-5": "sonnet",
          },
          sessionArg: "--session",
          sessionMode: "existing",
          sessionIdFields: ["session_id", "conversation_id"],
          systemPromptArg: "--system",
          systemPromptWhen: "first",
          imageArg: "--image",
          imageMode: "repeat",
          serialize: true,
        },
      },
    },
  },
}
```

## Como funciona

1. **Seleciona um backend** com base no prefixo do provedor (`claude-cli/...`).
2. **Constroi um prompt de sistema** usando o mesmo prompt do OpenClaw + contexto do workspace.
3. **Executa a CLI** com um id de sessao (se suportado) para que o historico permaneça consistente.
4. **Analisa a saida** (JSON ou texto simples) e retorna o texto final.
5. **Persiste ids de sessao** por backend, para que acompanhamentos reutilizem a mesma sessao da CLI.

## Sessoes

- Se a CLI suportar sessoes, defina `sessionArg` (por exemplo, `--session-id`) ou
  `sessionArgs` (placeholder `{sessionId}`) quando o ID precisar ser inserido
  em multiplas flags.
- Se a CLI usar um **subcomando de retomada** com flags diferentes, defina
  `resumeArgs` (substitui `args` ao retomar) e opcionalmente `resumeOutput`
  (para retomadas nao-JSON).
- `sessionMode`:
  - `always`: sempre enviar um id de sessao (novo UUID se nenhum estiver armazenado).
  - `existing`: enviar um id de sessao apenas se um tiver sido armazenado antes.
  - `none`: nunca enviar um id de sessao.

## Imagens (pass-through)

Se a sua CLI aceitar caminhos de imagem, defina `imageArg`:

```json5
imageArg: "--image",
imageMode: "repeat"
```

O OpenClaw gravara imagens base64 em arquivos temporarios. Se `imageArg` estiver definido, esses
caminhos sao passados como argumentos da CLI. Se `imageArg` estiver ausente, o OpenClaw anexa os
caminhos dos arquivos ao prompt (injecao de caminho), o que e suficiente para CLIs que carregam
automaticamente arquivos locais a partir de caminhos simples (comportamento do Claude Code CLI).

## Entradas / saidas

- `output: "json"` (padrao) tenta analisar JSON e extrair texto + id de sessao.
- `output: "jsonl"` analisa streams JSONL (Codex CLI `--json`) e extrai a
  ultima mensagem do agente mais `thread_id` quando presente.
- `output: "text"` trata stdout como a resposta final.

Modos de entrada:

- `input: "arg"` (padrao) passa o prompt como o ultimo argumento da CLI.
- `input: "stdin"` envia o prompt via stdin.
- Se o prompt for muito longo e `maxPromptArgChars` estiver definido, o stdin e usado.

## Padroes (integrados)

O OpenClaw inclui um padrao para `claude-cli`:

- `command: "claude"`
- `args: ["-p", "--output-format", "json", "--dangerously-skip-permissions"]`
- `resumeArgs: ["-p", "--output-format", "json", "--dangerously-skip-permissions", "--resume", "{sessionId}"]`
- `modelArg: "--model"`
- `systemPromptArg: "--append-system-prompt"`
- `sessionArg: "--session-id"`
- `systemPromptWhen: "first"`
- `sessionMode: "always"`

O OpenClaw tambem inclui um padrao para `codex-cli`:

- `command: "codex"`
- `args: ["exec","--json","--color","never","--sandbox","read-only","--skip-git-repo-check"]`
- `resumeArgs: ["exec","resume","{sessionId}","--color","never","--sandbox","read-only","--skip-git-repo-check"]`
- `output: "jsonl"`
- `resumeOutput: "text"`
- `modelArg: "--model"`
- `imageArg: "--image"`
- `sessionMode: "existing"`

Substitua apenas se necessario (comum: caminho absoluto de `command`).

## Limitacoes

- **Sem ferramentas do OpenClaw** (o backend de CLI nunca recebe chamadas de ferramentas). Algumas CLIs
  ainda podem executar seu proprio tooling de agente.
- **Sem streaming** (a saida da CLI e coletada e depois retornada).
- **Saidas estruturadas** dependem do formato JSON da CLI.
- **Sessoes do Codex CLI** retomam via saida de texto (sem JSONL), o que e menos
  estruturado do que a execucao inicial de `--json`. As sessoes do OpenClaw ainda funcionam
  normalmente.

## Solucao de problemas

- **CLI nao encontrada**: defina `command` para um caminho completo.
- **Nome de modelo errado**: use `modelAliases` para mapear `provider/model` → modelo da CLI.
- **Sem continuidade de sessao**: garanta que `sessionArg` esteja definido e que `sessionMode` nao seja
  `none` (o Codex CLI atualmente nao consegue retomar com saida JSON).
- **Imagens ignoradas**: defina `imageArg` (e verifique se a CLI suporta caminhos de arquivos).
