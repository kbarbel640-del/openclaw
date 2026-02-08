---
title: Verificacao Formal (Modelos de Seguranca)
summary: Modelos de seguranca verificados por maquina para os caminhos de maior risco do OpenClaw.
permalink: /security/formal-verification/
x-i18n:
  source_path: security/formal-verification.md
  source_hash: 8dff6ea41a37fb6b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:34Z
---

# Verificacao Formal (Modelos de Seguranca)

Esta pagina acompanha os **modelos formais de seguranca** do OpenClaw (TLA+/TLC hoje; mais conforme necessario).

> Nota: alguns links mais antigos podem se referir ao nome anterior do projeto.

**Objetivo (norte):** fornecer um argumento verificado por maquina de que o OpenClaw aplica sua
politica de seguranca pretendida (autorizacao, isolamento de sessao, controle de ferramentas e
seguranca contra configuracoes incorretas), sob suposicoes explicitas.

**O que isto e (hoje):** um **conjunto de regressao de seguranca** executavel e orientado por atacantes:

- Cada afirmacao tem uma verificacao executavel por model-check sobre um espaco de estados finito.
- Muitas afirmacoes tem um **modelo negativo** pareado que produz um rastro de contraexemplo para uma classe realista de bug.

**O que isto nao e (ainda):** uma prova de que “o OpenClaw e seguro em todos os aspectos” ou de que a implementacao completa em TypeScript esta correta.

## Onde os modelos ficam

Os modelos sao mantidos em um repositorio separado: [vignesh07/openclaw-formal-models](https://github.com/vignesh07/openclaw-formal-models).

## Avisos importantes

- Estes sao **modelos**, nao a implementacao completa em TypeScript. Pode haver divergencia entre modelo e codigo.
- Os resultados sao limitados pelo espaco de estados explorado pelo TLC; “verde” nao implica seguranca alem das suposicoes e limites modelados.
- Algumas afirmacoes dependem de suposicoes ambientais explicitas (por exemplo, implantacao correta, entradas de configuracao corretas).

## Reproduzindo os resultados

Hoje, os resultados sao reproduzidos clonando o repositorio de modelos localmente e executando o TLC (veja abaixo). Uma iteracao futura pode oferecer:

- Modelos executados em CI com artefatos publicos (rastros de contraexemplo, logs de execucao)
- Um fluxo de trabalho hospedado de “execute este modelo” para verificacoes pequenas e limitadas

Primeiros passos:

```bash
git clone https://github.com/vignesh07/openclaw-formal-models
cd openclaw-formal-models

# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned `tla2tools.jar` (TLA+ tools) and provides `bin/tlc` + Make targets.

make <target>
```

### Exposicao do Gateway e configuracao incorreta de gateway aberto

**Afirmacao:** vincular alem do loopback sem autenticacao pode tornar possivel um comprometimento remoto / aumenta a exposicao; token/senha bloqueia atacantes nao autenticados (de acordo com as suposicoes do modelo).

- Execucoes verdes:
  - `make gateway-exposure-v2`
  - `make gateway-exposure-v2-protected`
- Vermelho (esperado):
  - `make gateway-exposure-v2-negative`

Veja tambem: `docs/gateway-exposure-matrix.md` no repositorio de modelos.

### Pipeline Nodes.run (capacidade de maior risco)

**Afirmacao:** `nodes.run` requer (a) uma allowlist de comandos de node mais comandos declarados e (b) aprovacao ao vivo quando configurado; aprovacoes sao tokenizadas para evitar replay (no modelo).

- Execucoes verdes:
  - `make nodes-pipeline`
  - `make approvals-token`
- Vermelho (esperado):
  - `make nodes-pipeline-negative`
  - `make approvals-token-negative`

### Armazenamento de pareamento (controle de Mensagens diretas)

**Afirmacao:** solicitacoes de pareamento respeitam TTL e limites de solicitacoes pendentes.

- Execucoes verdes:
  - `make pairing`
  - `make pairing-cap`
- Vermelho (esperado):
  - `make pairing-negative`
  - `make pairing-cap-negative`

### Controle de entrada (mencoes + bypass de comando de controle)

**Afirmacao:** em contextos de grupo que exigem mencao, um “comando de controle” nao autorizado nao pode contornar o controle por mencao.

- Verde:
  - `make ingress-gating`
- Vermelho (esperado):
  - `make ingress-gating-negative`

### Isolamento de roteamento/chave de sessao

**Afirmacao:** Mensagens diretas de pares distintos nao colapsam na mesma sessao a menos que explicitamente vinculadas/configuradas.

- Verde:
  - `make routing-isolation`
- Vermelho (esperado):
  - `make routing-isolation-negative`

## v1++: modelos adicionais limitados (concorrencia, tentativas, corretude de rastreamento)

Estes sao modelos de acompanhamento que aumentam a fidelidade em torno de modos de falha do mundo real (atualizacoes nao atomicas, tentativas e fan-out de mensagens).

### Concorrencia / idempotencia do armazenamento de pareamento

**Afirmacao:** um armazenamento de pareamento deve impor `MaxPending` e idempotencia mesmo sob interleavings (ou seja, “verificar-entao-escrever” deve ser atomico / bloqueado; atualizacao nao deve criar duplicatas).

O que significa:

- Sob solicitacoes concorrentes, nao e possivel exceder `MaxPending` para um canal.
- Solicitacoes/atualizacoes repetidas para o mesmo `(channel, sender)` nao devem criar linhas pendentes duplicadas ativas.

- Execucoes verdes:
  - `make pairing-race` (verificacao de limite atomica/bloqueada)
  - `make pairing-idempotency`
  - `make pairing-refresh`
  - `make pairing-refresh-race`
- Vermelho (esperado):
  - `make pairing-race-negative` (corrida de limite entre inicio/commit nao atomicos)
  - `make pairing-idempotency-negative`
  - `make pairing-refresh-negative`
  - `make pairing-refresh-race-negative`

### Correlacao de rastreamento de entrada / idempotencia

**Afirmacao:** a ingestao deve preservar a correlacao de rastreamento ao longo do fan-out e ser idempotente sob tentativas do provedor.

O que significa:

- Quando um evento externo se torna varias mensagens internas, cada parte mantem a mesma identidade de rastro/evento.
- Tentativas nao resultam em processamento duplicado.
- Se IDs de eventos do provedor estiverem ausentes, a desduplicacao recorre a uma chave segura (por exemplo, ID de rastro) para evitar descartar eventos distintos.

- Verde:
  - `make ingress-trace`
  - `make ingress-trace2`
  - `make ingress-idempotency`
  - `make ingress-dedupe-fallback`
- Vermelho (esperado):
  - `make ingress-trace-negative`
  - `make ingress-trace2-negative`
  - `make ingress-idempotency-negative`
  - `make ingress-dedupe-fallback-negative`

### Precedencia de dmScope no roteamento + identityLinks

**Afirmacao:** o roteamento deve manter sessoes de Mensagens diretas isoladas por padrao e apenas colapsar sessoes quando explicitamente configurado (precedencia de canal + identity links).

O que significa:

- Substituicoes de dmScope especificas do canal devem prevalecer sobre padroes globais.
- identityLinks devem colapsar apenas dentro de grupos explicitamente vinculados, nao entre pares nao relacionados.

- Verde:
  - `make routing-precedence`
  - `make routing-identitylinks`
- Vermelho (esperado):
  - `make routing-precedence-negative`
  - `make routing-identitylinks-negative`
