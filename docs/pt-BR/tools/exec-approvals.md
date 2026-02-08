---
summary: "Aprovacoes de exec, allowlists e prompts de escape de sandbox"
read_when:
  - Configurando aprovacoes de exec ou allowlists
  - Implementando UX de aprovacao de exec no app macOS
  - Revisando prompts de escape de sandbox e implicacoes
title: "Aprovacoes de Exec"
x-i18n:
  source_path: tools/exec-approvals.md
  source_hash: 97736427752eb905
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:49Z
---

# Aprovacoes de exec

As aprovacoes de exec sao o **guardrail do aplicativo complementar / host de node** para permitir que um agente em sandbox execute
comandos em um host real (`gateway` ou `node`). Pense nisso como um intertravamento de seguranca:
os comandos so sao permitidos quando politica + allowlist + (aprovacao opcional do usuario) concordam.
As aprovacoes de exec sao **adicionais** a politica de ferramentas e ao gating elevado (a menos que elevated esteja definido como `full`, o que ignora as aprovacoes).
A politica efetiva e a **mais restritiva** entre `tools.exec.*` e os padroes de aprovacao; se um campo de aprovacao for omitido, o valor de `tools.exec` e usado.

Se a UI do aplicativo complementar **nao estiver disponivel**, qualquer solicitacao que exija um prompt e
resolvida pelo **ask fallback** (padrao: negar).

## Onde se aplica

As aprovacoes de exec sao aplicadas localmente no host de execucao:

- **gateway host** → processo `openclaw` na maquina do gateway
- **node host** → runner do node (aplicativo complementar macOS ou node host headless)

Divisao no macOS:

- **servico do node host** encaminha `system.run` para o **app macOS** via IPC local.
- **app macOS** aplica as aprovacoes + executa o comando no contexto da UI.

## Configuracoes e armazenamento

As aprovacoes ficam em um arquivo JSON local no host de execucao:

`~/.openclaw/exec-approvals.json`

Esquema de exemplo:

```json
{
  "version": 1,
  "socket": {
    "path": "~/.openclaw/exec-approvals.sock",
    "token": "base64url-token"
  },
  "defaults": {
    "security": "deny",
    "ask": "on-miss",
    "askFallback": "deny",
    "autoAllowSkills": false
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "askFallback": "deny",
      "autoAllowSkills": true,
      "allowlist": [
        {
          "id": "B0C8C0B3-2C2D-4F8A-9A3C-5A4B3C2D1E0F",
          "pattern": "~/Projects/**/bin/rg",
          "lastUsedAt": 1737150000000,
          "lastUsedCommand": "rg -n TODO",
          "lastResolvedPath": "/Users/user/Projects/.../bin/rg"
        }
      ]
    }
  }
}
```

## Ajustes de politica

### Seguranca (`exec.security`)

- **deny**: bloqueia todas as solicitacoes de exec no host.
- **allowlist**: permite apenas comandos presentes na allowlist.
- **full**: permite tudo (equivalente a elevated).

### Ask (`exec.ask`)

- **off**: nunca solicitar.
- **on-miss**: solicitar apenas quando a allowlist nao corresponder.
- **always**: solicitar em todo comando.

### Ask fallback (`askFallback`)

Se um prompt for necessario, mas nenhuma UI estiver acessivel, o fallback decide:

- **deny**: bloquear.
- **allowlist**: permitir apenas se a allowlist corresponder.
- **full**: permitir.

## Allowlist (por agente)

As allowlists sao **por agente**. Se existirem varios agentes, alterne qual agente voce esta
editando no app macOS. Os padroes sao **correspondencias glob sem diferenciar maiusculas/minusculas**.
Os padroes devem resolver para **caminhos de binarios** (entradas apenas com o basename sao ignoradas).
Entradas legadas `agents.default` sao migradas para `agents.main` ao carregar.

Exemplos:

- `~/Projects/**/bin/bird`
- `~/.local/bin/*`
- `/opt/homebrew/bin/rg`

Cada entrada da allowlist acompanha:

- **id** UUID estavel usado para identidade na UI (opcional)
- **last used** timestamp
- **last used command**
- **last resolved path**

## Auto-allow de CLIs de Skills

Quando **Auto-allow skill CLIs** esta habilitado, executaveis referenciados por skills conhecidas
sao tratados como allowlisted nos nodes (node macOS ou node host headless). Isso usa
`skills.bins` via RPC do Gateway para buscar a lista de bins das skills. Desative se voce quiser allowlists manuais estritas.

## Safe bins (apenas stdin)

`tools.exec.safeBins` define uma pequena lista de binarios **apenas stdin** (por exemplo `jq`)
que podem executar em modo allowlist **sem** entradas explicitas na allowlist. Safe bins rejeitam
argumentos posicionais de arquivo e tokens do tipo caminho, portanto so podem operar sobre o stream de entrada.
Encadeamento de shell e redirecionamentos nao sao auto-permitidos no modo allowlist.

Encadeamento de shell (`&&`, `||`, `;`) e permitido quando cada segmento de nivel superior satisfaz a allowlist
(incluindo safe bins ou auto-allow de skills). Redirecionamentos continuam sem suporte no modo allowlist.
Substituicao de comandos (`$()` / crases) e rejeitada durante a analise da allowlist, inclusive dentro de
aspas duplas; use aspas simples se voce precisar de texto literal `$()`.

Safe bins padrao: `jq`, `grep`, `cut`, `sort`, `uniq`, `head`, `tail`, `tr`, `wc`.

## Edicao pela Control UI

Use o cartao **Control UI → Nodes → Exec approvals** para editar padroes, sobrescritas
por agente e allowlists. Escolha um escopo (Padroes ou um agente), ajuste a politica,
adicione/remova padroes da allowlist e clique em **Save**. A UI mostra metadados de **last used**
por padrao para que voce mantenha a lista organizada.

O seletor de destino escolhe **Gateway** (aprovacoes locais) ou um **Node**. Os nodes
devem anunciar `system.execApprovals.get/set` (app macOS ou node host headless).
Se um node ainda nao anunciar aprovacoes de exec, edite seu
`~/.openclaw/exec-approvals.json` local diretamente.

CLI: `openclaw approvals` oferece suporte a edicao no gateway ou no node (veja [Approvals CLI](/cli/approvals)).

## Fluxo de aprovacao

Quando um prompt e necessario, o gateway transmite `exec.approval.requested` para os clientes operadores.
A Control UI e o app macOS resolvem isso via `exec.approval.resolve`, e entao o gateway encaminha a
solicitacao aprovada para o node host.

Quando aprovacoes sao necessarias, a ferramenta de exec retorna imediatamente com um id de aprovacao. Use esse id para
correlacionar eventos de sistema posteriores (`Exec finished` / `Exec denied`). Se nenhuma decisao chegar antes do
timeout, a solicitacao e tratada como timeout de aprovacao e apresentada como motivo de negacao.

O dialogo de confirmacao inclui:

- comando + args
- cwd
- id do agente
- caminho do executavel resolvido
- metadados do host + politica

Acoes:

- **Allow once** → executar agora
- **Always allow** → adicionar a allowlist + executar
- **Deny** → bloquear

## Encaminhamento de aprovacao para canais de chat

Voce pode encaminhar prompts de aprovacao de exec para qualquer canal de chat (incluindo canais de plugins) e aprova-los
com `/approve`. Isso usa o pipeline normal de entrega de saida.

Configuracao:

```json5
{
  approvals: {
    exec: {
      enabled: true,
      mode: "session", // "session" | "targets" | "both"
      agentFilter: ["main"],
      sessionFilter: ["discord"], // substring or regex
      targets: [
        { channel: "slack", to: "U12345678" },
        { channel: "telegram", to: "123456789" },
      ],
    },
  },
}
```

Resposta no chat:

```
/approve <id> allow-once
/approve <id> allow-always
/approve <id> deny
```

### Fluxo de IPC no macOS

```
Gateway -> Node Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             Mac App (UI + approvals + system.run)
```

Notas de seguranca:

- Modo de socket Unix `0600`, token armazenado em `exec-approvals.json`.
- Verificacao de par com mesmo UID.
- Desafio/resposta (nonce + token HMAC + hash da solicitacao) + TTL curto.

## Eventos do sistema

O ciclo de vida do exec e exposto como mensagens do sistema:

- `Exec running` (apenas se o comando exceder o limite de aviso de execucao)
- `Exec finished`
- `Exec denied`

Esses eventos sao publicados na sessao do agente apos o node reportar o evento.
Aprovacoes de exec no host do gateway emitem os mesmos eventos de ciclo de vida quando o comando termina (e opcionalmente quando executa por mais tempo que o limite).
Execs com aprovacao reutilizam o id de aprovacao como o `runId` nessas mensagens para facilitar a correlacao.

## Implicacoes

- **full** e poderoso; prefira allowlists quando possivel.
- **ask** mantem voce no loop enquanto ainda permite aprovacoes rapidas.
- Allowlists por agente impedem que aprovacoes de um agente vazem para outros.
- As aprovacoes so se aplicam a solicitacoes de exec no host de **remetentes autorizados**. Remetentes nao autorizados nao podem emitir `/exec`.
- `/exec security=full` e uma conveniencia em nivel de sessao para operadores autorizados e ignora aprovacoes por design.
  Para bloquear rigidamente o exec no host, defina a seguranca de aprovacoes como `deny` ou negue a ferramenta `exec` via politica de ferramentas.

Relacionado:

- [Exec tool](/tools/exec)
- [Elevated mode](/tools/elevated)
- [Skills](/tools/skills)
