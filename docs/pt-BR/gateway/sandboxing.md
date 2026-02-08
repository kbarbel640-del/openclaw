---
summary: "Como funciona o sandboxing do OpenClaw: modos, escopos, acesso ao workspace e imagens"
title: Sandboxing
read_when: "Voce quer uma explicacao dedicada de sandboxing ou precisa ajustar agents.defaults.sandbox."
status: active
x-i18n:
  source_path: gateway/sandboxing.md
  source_hash: 184fc53001fc6b28
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:34Z
---

# Sandboxing

O OpenClaw pode executar **ferramentas dentro de containers Docker** para reduzir o raio de impacto.
Isso é **opcional** e controlado por configuracao (`agents.defaults.sandbox` ou
`agents.list[].sandbox`). Se o sandboxing estiver desativado, as ferramentas rodam no host.
O Gateway permanece no host; a execucao de ferramentas roda em um sandbox isolado
quando habilitado.

Isso nao e um limite de seguranca perfeito, mas limita materialmente o acesso ao
sistema de arquivos e a processos quando o modelo faz algo inadequado.

## O que e colocado em sandbox

- Execucao de ferramentas (`exec`, `read`, `write`, `edit`, `apply_patch`, `process`, etc.).
- Navegador em sandbox opcional (`agents.defaults.sandbox.browser`).
  - Por padrao, o navegador em sandbox inicia automaticamente (garante que o CDP esteja acessivel) quando a ferramenta de navegador precisa.
    Configure via `agents.defaults.sandbox.browser.autoStart` e `agents.defaults.sandbox.browser.autoStartTimeoutMs`.
  - `agents.defaults.sandbox.browser.allowHostControl` permite que sessoes em sandbox apontem explicitamente para o navegador do host.
  - Allowlists opcionais controlam `target: "custom"`: `allowedControlUrls`, `allowedControlHosts`, `allowedControlPorts`.

Nao ficam em sandbox:

- O proprio processo do Gateway.
- Qualquer ferramenta explicitamente autorizada a rodar no host (por exemplo, `tools.elevated`).
  - **Execucao elevada roda no host e ignora o sandboxing.**
  - Se o sandboxing estiver desativado, `tools.elevated` nao muda a execucao (ja esta no host). Veja [Elevated Mode](/tools/elevated).

## Modos

`agents.defaults.sandbox.mode` controla **quando** o sandboxing e usado:

- `"off"`: sem sandboxing.
- `"non-main"`: sandbox apenas para sessoes **nao principais** (padrao se voce quer chats normais no host).
- `"all"`: toda sessao roda em sandbox.
  Observacao: `"non-main"` e baseado em `session.mainKey` (padrao `"main"`), nao no id do agente.
  Sessoes de grupo/canal usam suas proprias chaves, entao contam como nao principais e serao colocadas em sandbox.

## Escopo

`agents.defaults.sandbox.scope` controla **quantos containers** sao criados:

- `"session"` (padrao): um container por sessao.
- `"agent"`: um container por agente.
- `"shared"`: um container compartilhado por todas as sessoes em sandbox.

## Acesso ao workspace

`agents.defaults.sandbox.workspaceAccess` controla **o que o sandbox pode ver**:

- `"none"` (padrao): as ferramentas veem um workspace de sandbox em `~/.openclaw/sandboxes`.
- `"ro"`: monta o workspace do agente como somente leitura em `/agent` (desativa `write`/`edit`/`apply_patch`).
- `"rw"`: monta o workspace do agente com leitura/gravação em `/workspace`.

Midia de entrada e copiada para o workspace de sandbox ativo (`media/inbound/*`).
Nota sobre Skills: a ferramenta `read` tem raiz no sandbox. Com `workspaceAccess: "none"`,
o OpenClaw espelha Skills elegiveis no workspace do sandbox (`.../skills`) para
que possam ser lidas. Com `"rw"`, Skills do workspace sao legiveis a partir de
`/workspace/skills`.

## Bind mounts personalizados

`agents.defaults.sandbox.docker.binds` monta diretorios adicionais do host dentro do container.
Formato: `host:container:mode` (por exemplo, `"/home/user/source:/source:rw"`).

Binds globais e por agente sao **mesclados** (nao substituidos). Em `scope: "shared"`, binds por agente sao ignorados.

Exemplo (fonte somente leitura + socket do Docker):

```json5
{
  agents: {
    defaults: {
      sandbox: {
        docker: {
          binds: ["/home/user/source:/source:ro", "/var/run/docker.sock:/var/run/docker.sock"],
        },
      },
    },
    list: [
      {
        id: "build",
        sandbox: {
          docker: {
            binds: ["/mnt/cache:/cache:rw"],
          },
        },
      },
    ],
  },
}
```

Notas de seguranca:

- Binds ignoram o sistema de arquivos do sandbox: eles expõem caminhos do host com o modo que voce definir (`:ro` ou `:rw`).
- Montagens sensiveis (por exemplo, `docker.sock`, segredos, chaves SSH) devem ser `:ro` a menos que sejam absolutamente necessarias.
- Combine com `workspaceAccess: "ro"` se voce so precisa de acesso de leitura ao workspace; os modos de bind permanecem independentes.
- Veja [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) para como binds interagem com politica de ferramentas e execucao elevada.

## Imagens + configuracao

Imagem padrao: `openclaw-sandbox:bookworm-slim`

Construa uma vez:

```bash
scripts/sandbox-setup.sh
```

Observacao: a imagem padrao **nao** inclui Node. Se uma Skill precisar de Node (ou
outros runtimes), ou incorpore uma imagem personalizada ou instale via
`sandbox.docker.setupCommand` (requer egresso de rede + raiz gravavel +
usuario root).

Imagem do navegador em sandbox:

```bash
scripts/sandbox-browser-setup.sh
```

Por padrao, containers de sandbox rodam **sem rede**.
Sobrescreva com `agents.defaults.sandbox.docker.network`.

Instalacoes do Docker e o Gateway em container vivem aqui:
[Docker](/install/docker)

## setupCommand (configuracao unica do container)

`setupCommand` roda **uma vez** depois que o container de sandbox e criado (nao a cada execucao).
Ele executa dentro do container via `sh -lc`.

Caminhos:

- Global: `agents.defaults.sandbox.docker.setupCommand`
- Por agente: `agents.list[].sandbox.docker.setupCommand`

Armadi lhas comuns:

- O padrao de `docker.network` e `"none"` (sem egresso), entao instalacoes de pacotes falham.
- `readOnlyRoot: true` impede gravacoes; defina `readOnlyRoot: false` ou incorpore uma imagem personalizada.
- `user` deve ser root para instalacoes de pacotes (omita `user` ou defina `user: "0:0"`).
- Execucao em sandbox **nao** herda `process.env` do host. Use
  `agents.defaults.sandbox.docker.env` (ou uma imagem personalizada) para chaves de API de Skills.

## Politica de ferramentas + rotas de escape

Politicas de permitir/negar ferramentas ainda se aplicam antes das regras de sandbox. Se uma ferramenta for negada
globalmente ou por agente, o sandboxing nao a traz de volta.

`tools.elevated` e uma rota de escape explicita que executa `exec` no host.
Diretivas `/exec` so se aplicam a remetentes autorizados e persistem por sessao; para desativar rigidamente
`exec`, use negar na politica de ferramentas (veja [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)).

Depuracao:

- Use `openclaw sandbox explain` para inspecionar o modo de sandbox efetivo, politica de ferramentas e chaves de configuracao de correcao.
- Veja [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) para o modelo mental de “por que isto esta bloqueado?”.
  Mantenha-o restrito.

## Substituicoes multiagente

Cada agente pode substituir sandbox + ferramentas:
`agents.list[].sandbox` e `agents.list[].tools` (alem de `agents.list[].tools.sandbox.tools` para politica de ferramentas do sandbox).
Veja [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) para precedencia.

## Exemplo minimo de habilitacao

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
      },
    },
  },
}
```

## Documentos relacionados

- [Sandbox Configuration](/gateway/configuration#agentsdefaults-sandbox)
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools)
- [Security](/gateway/security)
