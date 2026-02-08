---
summary: "Plano de refatoracao: roteamento do exec host, aprovacoes de node e runner headless"
read_when:
  - Ao projetar o roteamento de exec host ou aprovacoes de exec
  - Ao implementar runner de node + IPC de UI
  - Ao adicionar modos de seguranca de exec host e comandos de barra
title: "Refatoracao do Exec Host"
x-i18n:
  source_path: refactor/exec-host.md
  source_hash: 53a9059cbeb1f3f1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:31Z
---

# Plano de refatoracao do exec host

## Objetivos

- Adicionar `exec.host` + `exec.security` para rotear a execucao entre **sandbox**, **gateway** e **node**.
- Manter os padroes **seguros**: nenhuma execucao entre hosts a menos que explicitamente habilitada.
- Dividir a execucao em um **servico de runner headless** com UI opcional (app macOS) via IPC local.
- Fornecer politica **por agente**, allowlist, modo de pergunta e vinculacao de node.
- Suportar **modos de pergunta** que funcionem _com_ ou _sem_ allowlists.
- Multiplataforma: socket Unix + autenticacao por token (paridade macOS/Linux/Windows).

## Nao objetivos

- Nenhuma migracao de allowlist legado ou suporte a schema legado.
- Nenhum PTY/streaming para exec em node (apenas saida agregada).
- Nenhuma nova camada de rede alem da Bridge + Gateway existentes.

## Decisoes (travadas)

- **Chaves de config:** `exec.host` + `exec.security` (override por agente permitido).
- **Elevacao:** manter `/elevated` como alias para acesso total do gateway.
- **Padrao de pergunta:** `on-miss`.
- **Armazenamento de aprovacoes:** `~/.openclaw/exec-approvals.json` (JSON, sem migracao legada).
- **Runner:** servico de sistema headless; o app de UI hospeda um socket Unix para aprovacoes.
- **Identidade do node:** usar o `nodeId` existente.
- **Autenticacao do socket:** socket Unix + token (multiplataforma); dividir depois se necessario.
- **Estado do host de node:** `~/.openclaw/node.json` (id do node + token de pareamento).
- **Exec host no macOS:** executar `system.run` dentro do app macOS; o servico de host de node encaminha requisicoes via IPC local.
- **Sem helper XPC:** manter socket Unix + token + verificacoes de peer.

## Conceitos-chave

### Host

- `sandbox`: Docker exec (comportamento atual).
- `gateway`: exec no host do gateway.
- `node`: exec no runner de node via Bridge (`system.run`).

### Modo de seguranca

- `deny`: sempre bloquear.
- `allowlist`: permitir apenas correspondencias.
- `full`: permitir tudo (equivalente a elevado).

### Modo de pergunta

- `off`: nunca perguntar.
- `on-miss`: perguntar apenas quando a allowlist nao corresponder.
- `always`: perguntar sempre.

Perguntar e **independente** da allowlist; a allowlist pode ser usada com `always` ou `on-miss`.

### Resolucao de politica (por execucao)

1. Resolver `exec.host` (parametro da ferramenta → override do agente → padrao global).
2. Resolver `exec.security` e `exec.ask` (mesma precedencia).
3. Se o host for `sandbox`, prosseguir com execucao local em sandbox.
4. Se o host for `gateway` ou `node`, aplicar politica de seguranca + pergunta naquele host.

## Seguranca padrao

- Padrao `exec.host = sandbox`.
- Padrao `exec.security = deny` para `gateway` e `node`.
- Padrao `exec.ask = on-miss` (relevante apenas se a seguranca permitir).
- Se nenhuma vinculacao de node estiver definida, **o agente pode direcionar qualquer node**, mas apenas se a politica permitir.

## Superficie de configuracao

### Parametros da ferramenta

- `exec.host` (opcional): `sandbox | gateway | node`.
- `exec.security` (opcional): `deny | allowlist | full`.
- `exec.ask` (opcional): `off | on-miss | always`.
- `exec.node` (opcional): id/nome do node a usar quando `host=node`.

### Chaves de config (global)

- `tools.exec.host`
- `tools.exec.security`
- `tools.exec.ask`
- `tools.exec.node` (vinculacao padrao de node)

### Chaves de config (por agente)

- `agents.list[].tools.exec.host`
- `agents.list[].tools.exec.security`
- `agents.list[].tools.exec.ask`
- `agents.list[].tools.exec.node`

### Alias

- `/elevated on` = definir `tools.exec.host=gateway`, `tools.exec.security=full` para a sessao do agente.
- `/elevated off` = restaurar as configuracoes de execucao anteriores para a sessao do agente.

## Armazenamento de aprovacoes (JSON)

Caminho: `~/.openclaw/exec-approvals.json`

Proposito:

- Politica local + allowlists para o **host de execucao** (gateway ou runner de node).
- Fallback de pergunta quando nenhuma UI estiver disponivel.
- Credenciais de IPC para clientes de UI.

Schema proposto (v1):

```json
{
  "version": 1,
  "socket": {
    "path": "~/.openclaw/exec-approvals.sock",
    "token": "base64-opaque-token"
  },
  "defaults": {
    "security": "deny",
    "ask": "on-miss",
    "askFallback": "deny"
  },
  "agents": {
    "agent-id-1": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [
        {
          "pattern": "~/Projects/**/bin/rg",
          "lastUsedAt": 0,
          "lastUsedCommand": "rg -n TODO",
          "lastResolvedPath": "/Users/user/Projects/.../bin/rg"
        }
      ]
    }
  }
}
```

Notas:

- Nenhum formato de allowlist legado.
- `askFallback` aplica-se apenas quando `ask` e requerido e nenhuma UI esta acessivel.
- Permissoes de arquivo: `0600`.

## Servico de runner (headless)

### Papel

- Aplicar `exec.security` + `exec.ask` localmente.
- Executar comandos do sistema e retornar a saida.
- Emitir eventos da Bridge para o ciclo de vida do exec (opcional, mas recomendado).

### Ciclo de vida do servico

- Launchd/daemon no macOS; servico de sistema no Linux/Windows.
- O JSON de aprovacoes e local ao host de execucao.
- A UI hospeda um socket Unix local; runners conectam sob demanda.

## Integracao de UI (app macOS)

### IPC

- Socket Unix em `~/.openclaw/exec-approvals.sock` (0600).
- Token armazenado em `exec-approvals.json` (0600).
- Verificacoes de peer: apenas mesmo UID.
- Desafio/resposta: nonce + HMAC(token, hash-da-requisicao) para prevenir replay.
- TTL curto (ex.: 10s) + payload maximo + rate limit.

### Fluxo de pergunta (exec host do app macOS)

1. O servico de node recebe `system.run` do gateway.
2. O servico de node conecta ao socket local e envia o prompt/requisicao de execucao.
3. O app valida peer + token + HMAC + TTL, entao mostra o dialogo se necessario.
4. O app executa o comando no contexto da UI e retorna a saida.
5. O servico de node retorna a saida ao gateway.

Se a UI estiver ausente:

- Aplicar `askFallback` (`deny|allowlist|full`).

### Diagrama (SCI)

```
Agent -> Gateway -> Bridge -> Node Service (TS)
                         |  IPC (UDS + token + HMAC + TTL)
                         v
                     Mac App (UI + TCC + system.run)
```

## Identidade + vinculacao de node

- Usar o `nodeId` existente do pareamento da Bridge.
- Modelo de vinculacao:
  - `tools.exec.node` restringe o agente a um node especifico.
  - Se nao definido, o agente pode escolher qualquer node (a politica ainda aplica os padroes).
- Resolucao de selecao de node:
  - `nodeId` correspondencia exata
  - `displayName` (normalizado)
  - `remoteIp`
  - `nodeId` prefixo (>= 6 caracteres)

## Eventos

### Quem ve eventos

- Eventos do sistema sao **por sessao** e mostrados ao agente no proximo prompt.
- Armazenados no gateway em uma fila em memoria (`enqueueSystemEvent`).

### Texto do evento

- `Exec started (node=<id>, id=<runId>)`
- `Exec finished (node=<id>, id=<runId>, code=<code>)` + cauda de saida opcional
- `Exec denied (node=<id>, id=<runId>, <reason>)`

### Transporte

Opcao A (recomendada):

- O runner envia frames da Bridge `event` `exec.started` / `exec.finished`.
- O gateway `handleBridgeEvent` mapeia isso para `enqueueSystemEvent`.

Opcao B:

- A ferramenta `exec` do gateway lida diretamente com o ciclo de vida (apenas sincrono).

## Fluxos de execucao

### Host sandbox

- Comportamento existente de `exec` (Docker ou host quando fora de sandbox).
- PTY suportado apenas no modo sem sandbox.

### Host gateway

- O processo do gateway executa na propria maquina.
- Aplica `exec-approvals.json` local (seguranca/pergunta/allowlist).

### Host node

- O gateway chama `node.invoke` com `system.run`.
- O runner aplica aprovacoes locais.
- O runner retorna stdout/stderr agregados.
- Eventos opcionais da Bridge para inicio/fim/negacao.

## Limites de saida

- Limitar stdout+stderr combinados a **200k**; manter **cauda de 20k** para eventos.
- Truncar com um sufixo claro (ex.: `"… (truncated)"`).

## Comandos de barra

- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>`
- Overrides por agente, por sessao; nao persistentes a menos que salvos via config.
- `/elevated on|off|ask|full` permanece um atalho para `host=gateway security=full` (com `full` pulando aprovacoes).

## Historia multiplataforma

- O servico de runner e o alvo de execucao portavel.
- A UI e opcional; se ausente, aplica-se `askFallback`.
- Windows/Linux suportam o mesmo JSON de aprovacoes + protocolo de socket.

## Fases de implementacao

### Fase 1: config + roteamento de execucao

- Adicionar schema de config para `exec.host`, `exec.security`, `exec.ask`, `exec.node`.
- Atualizar o encanamento da ferramenta para respeitar `exec.host`.
- Adicionar o comando de barra `/exec` e manter o alias `/elevated`.

### Fase 2: armazenamento de aprovacoes + aplicacao no gateway

- Implementar leitor/gravador de `exec-approvals.json`.
- Aplicar allowlist + modos de pergunta para o host `gateway`.
- Adicionar limites de saida.

### Fase 3: aplicacao no runner de node

- Atualizar o runner de node para aplicar allowlist + pergunta.
- Adicionar ponte de prompt por socket Unix para a UI do app macOS.
- Conectar `askFallback`.

### Fase 4: eventos

- Adicionar eventos da Bridge do node → gateway para o ciclo de vida do exec.
- Mapear para `enqueueSystemEvent` para prompts do agente.

### Fase 5: polimento da UI

- App Mac: editor de allowlist, seletor por agente, UI de politica de pergunta.
- Controles de vinculacao de node (opcional).

## Plano de testes

- Testes unitarios: correspondencia de allowlist (glob + sem diferenca de maiusculas/minusculas).
- Testes unitarios: precedencia de resolucao de politica (parametro da ferramenta → override do agente → global).
- Testes de integracao: fluxos de negar/permitir/perguntar do runner de node.
- Testes de eventos da Bridge: evento de node → roteamento de evento do sistema.

## Riscos em aberto

- Indisponibilidade da UI: garantir que `askFallback` seja respeitado.
- Comandos de longa duracao: depender de timeout + limites de saida.
- Ambiguidade multi-node: erro a menos que haja vinculacao de node ou parametro de node explicito.

## Documentos relacionados

- [Ferramenta exec](/tools/exec)
- [Aprovacoes de exec](/tools/exec-approvals)
- [Nodes](/nodes)
- [Modo elevado](/tools/elevated)
