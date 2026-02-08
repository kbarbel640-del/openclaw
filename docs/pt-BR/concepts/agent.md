---
summary: "Runtime do agente (pi-mono incorporado), contrato do workspace e bootstrap de sessao"
read_when:
  - Alterando o runtime do agente, o bootstrap do workspace ou o comportamento da sessao
title: "Runtime do Agente"
x-i18n:
  source_path: concepts/agent.md
  source_hash: 04b4e0bc6345d2af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:58Z
---

# Runtime do Agente 🤖

O OpenClaw executa um unico runtime de agente incorporado derivado do **pi-mono**.

## Workspace (obrigatorio)

O OpenClaw usa um unico diretorio de workspace do agente (`agents.defaults.workspace`) como o **unico** diretorio de trabalho (`cwd`) do agente para ferramentas e contexto.

Recomendado: usar `openclaw setup` para criar `~/.openclaw/openclaw.json` caso esteja ausente e inicializar os arquivos do workspace.

Layout completo do workspace + guia de backup: [Workspace do agente](/concepts/agent-workspace)

Se `agents.defaults.sandbox` estiver habilitado, sessoes nao principais podem substituir isso com
workspaces por sessao em `agents.defaults.sandbox.workspaceRoot` (veja
[Configuracao do Gateway](/gateway/configuration)).

## Arquivos de bootstrap (injetados)

Dentro de `agents.defaults.workspace`, o OpenClaw espera estes arquivos editaveis pelo usuario:

- `AGENTS.md` — instrucoes operacionais + “memoria”
- `SOUL.md` — persona, limites, tom
- `TOOLS.md` — notas de ferramentas mantidas pelo usuario (ex.: `imsg`, `sag`, convencoes)
- `BOOTSTRAP.md` — ritual unico de primeira execucao (excluido apos a conclusao)
- `IDENTITY.md` — nome/vibe/emoji do agente
- `USER.md` — perfil do usuario + forma de tratamento preferida

No primeiro turno de uma nova sessao, o OpenClaw injeta o conteudo desses arquivos diretamente no contexto do agente.

Arquivos em branco sao ignorados. Arquivos grandes sao aparados e truncados com um marcador para manter os prompts enxutos (leia o arquivo para o conteudo completo).

Se um arquivo estiver ausente, o OpenClaw injeta uma unica linha de marcador “arquivo ausente” (e `openclaw setup` criara um modelo padrao seguro).

`BOOTSTRAP.md` e criado apenas para um **workspace totalmente novo** (nenhum outro arquivo de bootstrap presente). Se voce o excluir apos concluir o ritual, ele nao deve ser recriado em reinicializacoes posteriores.

Para desativar completamente a criacao de arquivos de bootstrap (para workspaces previamente populados), defina:

```json5
{ agent: { skipBootstrap: true } }
```

## Ferramentas integradas

Ferramentas principais (read/exec/edit/write e ferramentas de sistema relacionadas) estao sempre disponiveis,
sujeitas a politica de ferramentas. `apply_patch` e opcional e condicionado por
`tools.exec.applyPatch`. `TOOLS.md` **nao** controla quais ferramentas existem; e
uma orientacao de como _voce_ deseja que elas sejam usadas.

## Skills

O OpenClaw carrega Skills a partir de tres locais (o workspace vence em caso de conflito de nome):

- Empacotadas (enviadas com a instalacao)
- Gerenciadas/locais: `~/.openclaw/skills`
- Workspace: `<workspace>/skills`

As Skills podem ser condicionadas por configuracao/env (veja `skills` em [Configuracao do Gateway](/gateway/configuration)).

## Integracao com pi-mono

O OpenClaw reutiliza partes da base de codigo do pi-mono (modelos/ferramentas), mas **o gerenciamento de sessoes, a descoberta e a conexao de ferramentas sao de propriedade do OpenClaw**.

- Nenhum runtime de agente de pi-coding.
- Nenhuma configuracao `~/.pi/agent` ou `<workspace>/.pi` e considerada.

## Sessoes

As transcricoes das sessoes sao armazenadas como JSONL em:

- `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`

O ID da sessao e estavel e escolhido pelo OpenClaw.
Pastas de sessao legadas do Pi/Tau **nao** sao lidas.

## Direcionamento durante o streaming

Quando o modo de fila e `steer`, mensagens de entrada sao injetadas na execucao atual.
A fila e verificada **apos cada chamada de ferramenta**; se houver uma mensagem em fila,
as chamadas de ferramenta restantes da mensagem atual do assistente sao ignoradas (resultados de ferramenta com erro
“Skipped due to queued user message.”), e entao a mensagem do usuario em fila
e injetada antes da proxima resposta do assistente.

Quando o modo de fila e `followup` ou `collect`, mensagens de entrada sao retidas ate que o
turno atual termine; em seguida, um novo turno do agente comeca com as cargas enfileiradas. Veja
[Fila](/concepts/queue) para modos + comportamento de debounce/cap.

O streaming por blocos envia blocos completos do assistente assim que eles terminam; ele esta
**desativado por padrao** (`agents.defaults.blockStreamingDefault: "off"`).
Ajuste o limite via `agents.defaults.blockStreamingBreak` (`text_end` vs `message_end`; padrao: text_end).
Controle o particionamento suave de blocos com `agents.defaults.blockStreamingChunk` (padrao:
800–1200 caracteres; prefere quebras de paragrafo, depois novas linhas; frases por ultimo).
Agrupe chunks transmitidos com `agents.defaults.blockStreamingCoalesce` para reduzir
spam de linhas unicas (mesclagem baseada em inatividade antes do envio). Canais nao Telegram exigem
`*.blockStreaming: true` explicito para habilitar respostas em bloco.
Resumos detalhados de ferramentas sao emitidos no inicio da ferramenta (sem debounce); a UI de controle
transmite a saida da ferramenta via eventos do agente quando disponivel.
Mais detalhes: [Streaming + chunking](/concepts/streaming).

## Referencias de modelo

Referencias de modelo na configuracao (por exemplo `agents.defaults.model` e `agents.defaults.models`) sao analisadas dividindo pelo **primeiro** `/`.

- Use `provider/model` ao configurar modelos.
- Se o proprio ID do modelo contiver `/` (estilo OpenRouter), inclua o prefixo do provedor (exemplo: `openrouter/moonshotai/kimi-k2`).
- Se voce omitir o provedor, o OpenClaw trata a entrada como um alias ou um modelo para o **provedor padrao** (so funciona quando nao ha `/` no ID do modelo).

## Configuracao (minima)

No minimo, defina:

- `agents.defaults.workspace`
- `channels.whatsapp.allowFrom` (fortemente recomendado)

---

_Proximo: [Chats em Grupo](/concepts/group-messages)_ 🦞
