---
title: Sandbox vs Politica de Ferramentas vs Elevado
summary: "Por que uma ferramenta e bloqueada: runtime de sandbox, politica de permitir/negar ferramentas e portas de execucao elevada"
read_when: "Voce encontrou o 'sandbox jail' ou viu uma recusa de ferramenta/elevado e quer a chave de configuracao exata a alterar."
status: active
x-i18n:
  source_path: gateway/sandbox-vs-tool-policy-vs-elevated.md
  source_hash: 863ea5e6d137dfb6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:30Z
---

# Sandbox vs Politica de Ferramentas vs Elevado

O OpenClaw tem tres controles relacionados (mas diferentes):

1. **Sandbox** (`agents.defaults.sandbox.*` / `agents.list[].sandbox.*`) decide **onde as ferramentas rodam** (Docker vs host).
2. **Politica de ferramentas** (`tools.*`, `tools.sandbox.tools.*`, `agents.list[].tools.*`) decide **quais ferramentas estao disponiveis/permitidas**.
3. **Elevado** (`tools.elevated.*`, `agents.list[].tools.elevated.*`) e uma **escapatoria apenas para execucao** para rodar no host quando voce esta em sandbox.

## Depuracao rapida

Use o inspetor para ver o que o OpenClaw esta _realmente_ fazendo:

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

Ele imprime:

- modo/escopo/acesso ao workspace efetivos do sandbox
- se a sessao esta atualmente em sandbox (main vs nao-main)
- permitir/negar efetivo de ferramentas no sandbox (e se veio de agente/global/padrao)
- portas de elevado e caminhos de chaves de correcao

## Sandbox: onde as ferramentas rodam

O Sandboxing e controlado por `agents.defaults.sandbox.mode`:

- `"off"`: tudo roda no host.
- `"non-main"`: apenas sessoes nao-main sao colocadas em sandbox (surpresa comum para grupos/canais).
- `"all"`: tudo fica em sandbox.

Veja [Sandboxing](/gateway/sandboxing) para a matriz completa (escopo, montagens de workspace, imagens).

### Bind mounts (verificacao rapida de seguranca)

- `docker.binds` _perfora_ o sistema de arquivos do sandbox: tudo o que voce monta fica visivel dentro do container com o modo que voce definir (`:ro` ou `:rw`).
- O padrao e leitura-escrita se voce omitir o modo; prefira `:ro` para codigo-fonte/segredos.
- `scope: "shared"` ignora binds por agente (apenas binds globais se aplicam).
- Vincular `/var/run/docker.sock` efetivamente entrega o controle do host ao sandbox; faca isso apenas intencionalmente.
- O acesso ao workspace (`workspaceAccess: "ro"`/`"rw"`) e independente dos modos de bind.

## Politica de ferramentas: quais ferramentas existem/sao chamaveis

Duas camadas importam:

- **Perfil de ferramentas**: `tools.profile` e `agents.list[].tools.profile` (lista base de permitidas)
- **Perfil de ferramentas do provedor**: `tools.byProvider[provider].profile` e `agents.list[].tools.byProvider[provider].profile`
- **Politica de ferramentas global/por agente**: `tools.allow`/`tools.deny` e `agents.list[].tools.allow`/`agents.list[].tools.deny`
- **Politica de ferramentas do provedor**: `tools.byProvider[provider].allow/deny` e `agents.list[].tools.byProvider[provider].allow/deny`
- **Politica de ferramentas do sandbox** (aplica-se apenas quando em sandbox): `tools.sandbox.tools.allow`/`tools.sandbox.tools.deny` e `agents.list[].tools.sandbox.tools.*`

Regras praticas:

- `deny` sempre vence.
- Se `allow` nao estiver vazio, todo o resto e tratado como bloqueado.
- Politica de ferramentas e o bloqueio definitivo: `/exec` nao pode sobrescrever uma ferramenta `exec` negada.
- `/exec` apenas altera padroes de sessao para remetentes autorizados; nao concede acesso a ferramentas.
  As chaves de ferramentas do provedor aceitam `provider` (ex.: `google-antigravity`) ou `provider/model` (ex.: `openai/gpt-5.2`).

### Grupos de ferramentas (atalhos)

As politicas de ferramentas (global, agente, sandbox) suportam entradas `group:*` que se expandem para varias ferramentas:

```json5
{
  tools: {
    sandbox: {
      tools: {
        allow: ["group:runtime", "group:fs", "group:sessions", "group:memory"],
      },
    },
  },
}
```

Grupos disponiveis:

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: todas as ferramentas integradas do OpenClaw (exclui plugins de provedores)

## Elevado: execucao apenas “rodar no host”

Elevado **nao** concede ferramentas extras; ele apenas afeta `exec`.

- Se voce estiver em sandbox, `/elevated on` (ou `exec` com `elevated: true`) roda no host (aprovacoes ainda podem se aplicar).
- Use `/elevated full` para pular aprovacoes de execucao para a sessao.
- Se voce ja estiver rodando direto, elevado e efetivamente um no-op (ainda com portas).
- Elevado **nao** e escopado por skill e **nao** sobrescreve permitir/negar de ferramentas.
- `/exec` e separado de elevado. Ele apenas ajusta padroes de execucao por sessao para remetentes autorizados.

Portas:

- Habilitacao: `tools.elevated.enabled` (e opcionalmente `agents.list[].tools.elevated.enabled`)
- Listas de permissao de remetentes: `tools.elevated.allowFrom.<provider>` (e opcionalmente `agents.list[].tools.elevated.allowFrom.<provider>`)

Veja [Modo Elevado](/tools/elevated).

## Correcoes comuns de “sandbox jail”

### “Ferramenta X bloqueada pela politica de ferramentas do sandbox”

Chaves de correcao (escolha uma):

- Desativar sandbox: `agents.defaults.sandbox.mode=off` (ou por agente `agents.list[].sandbox.mode=off`)
- Permitir a ferramenta dentro do sandbox:
  - removê-la de `tools.sandbox.tools.deny` (ou por agente `agents.list[].tools.sandbox.tools.deny`)
  - ou adicioná-la a `tools.sandbox.tools.allow` (ou permitir por agente)

### “Achei que isso fosse main, por que esta em sandbox?”

No modo `"non-main"`, chaves de grupo/canal _nao_ sao main. Use a chave de sessao main (mostrada por `sandbox explain`) ou mude o modo para `"off"`.
