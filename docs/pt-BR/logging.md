---
summary: "Visao geral de logging: logs em arquivo, saida no console, tail via CLI e a UI de Controle"
read_when:
  - Voce precisa de uma visao geral de logging amigavel para iniciantes
  - Voce quer configurar niveis ou formatos de log
  - Voce esta solucionando problemas e precisa encontrar logs rapidamente
title: "Logging"
x-i18n:
  source_path: logging.md
  source_hash: 884fcf4a906adff3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:58Z
---

# Logging

O OpenClaw registra logs em dois lugares:

- **Logs em arquivo** (linhas JSON) gravados pelo Gateway.
- **Saida no console** exibida em terminais e na UI de Controle.

Esta pagina explica onde os logs ficam, como le-los e como configurar niveis e
formatos de log.

## Onde os logs ficam

Por padrao, o Gateway grava um arquivo de log rotativo em:

`/tmp/openclaw/openclaw-YYYY-MM-DD.log`

A data usa o fuso horario local do host do gateway.

Voce pode sobrescrever isso em `~/.openclaw/openclaw.json`:

```json
{
  "logging": {
    "file": "/path/to/openclaw.log"
  }
}
```

## Como ler os logs

### CLI: tail ao vivo (recomendado)

Use a CLI para acompanhar o arquivo de log do gateway via RPC:

```bash
openclaw logs --follow
```

Modos de saida:

- **Sessoes TTY**: linhas de log estruturadas, bonitas e coloridas.
- **Sessoes nao-TTY**: texto simples.
- `--json`: JSON delimitado por linha (um evento de log por linha).
- `--plain`: forcar texto simples em sessoes TTY.
- `--no-color`: desativar cores ANSI.

No modo JSON, a CLI emite objetos marcados com `type`:

- `meta`: metadados do stream (arquivo, cursor, tamanho)
- `log`: entrada de log analisada
- `notice`: dicas de truncamento / rotacao
- `raw`: linha de log nao analisada

Se o Gateway estiver inacessivel, a CLI imprime uma dica curta para executar:

```bash
openclaw doctor
```

### UI de Controle (web)

A aba **Logs** da UI de Controle acompanha o mesmo arquivo usando `logs.tail`.
Veja [/web/control-ui](/web/control-ui) para saber como abri-la.

### Logs apenas de canais

Para filtrar a atividade de canais (WhatsApp/Telegram/etc), use:

```bash
openclaw channels logs --channel whatsapp
```

## Formatos de log

### Logs em arquivo (JSONL)

Cada linha no arquivo de log e um objeto JSON. A CLI e a UI de Controle analisam
essas entradas para renderizar saida estruturada (tempo, nivel, subsistema,
mensagem).

### Saida no console

Os logs do console sao **cientes de TTY** e formatados para legibilidade:

- Prefixos de subsistema (por exemplo, `gateway/channels/whatsapp`)
- Coloracao por nivel (info/warn/error)
- Modo compacto ou JSON opcional

A formatacao do console e controlada por `logging.consoleStyle`.

## Configurando o logging

Toda a configuracao de logging fica sob `logging` em `~/.openclaw/openclaw.json`.

```json
{
  "logging": {
    "level": "info",
    "file": "/tmp/openclaw/openclaw-YYYY-MM-DD.log",
    "consoleLevel": "info",
    "consoleStyle": "pretty",
    "redactSensitive": "tools",
    "redactPatterns": ["sk-.*"]
  }
}
```

### Niveis de log

- `logging.level`: nivel dos **logs em arquivo** (JSONL).
- `logging.consoleLevel`: nivel de verbosidade do **console**.

`--verbose` afeta apenas a saida no console; nao altera os niveis dos logs em arquivo.

### Estilos do console

`logging.consoleStyle`:

- `pretty`: amigavel para humanos, colorido, com timestamps.
- `compact`: saida mais enxuta (melhor para sessoes longas).
- `json`: JSON por linha (para processadores de log).

### Redacao

Resumos de ferramentas podem redigir tokens sensiveis antes de chegarem ao console:

- `logging.redactSensitive`: `off` | `tools` (padrao: `tools`)
- `logging.redactPatterns`: lista de strings regex para sobrescrever o conjunto padrao

A redacao afeta **apenas a saida no console** e nao altera os logs em arquivo.

## Diagnosticos + OpenTelemetry

Diagnosticos sao eventos estruturados e legiveis por maquinas para execucoes de modelos **e**
telemetria de fluxo de mensagens (webhooks, enfileiramento, estado de sessao). Eles **nao**
substituem logs; existem para alimentar metricas, traces e outros exporters.

Eventos de diagnostico sao emitidos em-processo, mas exporters so se conectam quando
diagnosticos + o plugin de exporter estao habilitados.

### OpenTelemetry vs OTLP

- **OpenTelemetry (OTel)**: o modelo de dados + SDKs para traces, metricas e logs.
- **OTLP**: o protocolo de transporte usado para exportar dados OTel para um coletor/backend.
- O OpenClaw exporta via **OTLP/HTTP (protobuf)** atualmente.

### Sinais exportados

- **Metricas**: contadores + histogramas (uso de tokens, fluxo de mensagens, enfileiramento).
- **Traces**: spans para uso de modelo + processamento de webhooks/mensagens.
- **Logs**: exportados via OTLP quando `diagnostics.otel.logs` esta habilitado. O volume de
  logs pode ser alto; considere `logging.level` e filtros do exporter.

### Catalogo de eventos de diagnostico

Uso de modelo:

- `model.usage`: tokens, custo, duracao, contexto, provedor/modelo/canal, ids de sessao.

Fluxo de mensagens:

- `webhook.received`: entrada de webhook por canal.
- `webhook.processed`: webhook tratado + duracao.
- `webhook.error`: erros do handler de webhook.
- `message.queued`: mensagem enfileirada para processamento.
- `message.processed`: resultado + duracao + erro opcional.

Fila + sessao:

- `queue.lane.enqueue`: enfileiramento por faixa da fila de comandos + profundidade.
- `queue.lane.dequeue`: desenfileiramento por faixa da fila de comandos + tempo de espera.
- `session.state`: transicao de estado da sessao + motivo.
- `session.stuck`: aviso de sessao travada + idade.
- `run.attempt`: metadados de tentativa/reexecucao.
- `diagnostic.heartbeat`: contadores agregados (webhooks/fila/sessao).

### Habilitar diagnosticos (sem exporter)

Use isto se voce quiser eventos de diagnostico disponiveis para plugins ou destinos personalizados:

```json
{
  "diagnostics": {
    "enabled": true
  }
}
```

### Flags de diagnostico (logs direcionados)

Use flags para ativar logs de debug extras e direcionados sem elevar `logging.level`.
As flags nao diferenciam maiusculas de minusculas e suportam curingas (por exemplo, `telegram.*` ou `*`).

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

Sobrescrita por env (pontual):

```
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

Notas:

- Logs de flags vao para o arquivo de log padrao (o mesmo de `logging.file`).
- A saida continua sendo redigida de acordo com `logging.redactSensitive`.
- Guia completo: [/diagnostics/flags](/diagnostics/flags).

### Exportar para OpenTelemetry

Os diagnosticos podem ser exportados via o plugin `diagnostics-otel` (OTLP/HTTP). Isso
funciona com qualquer coletor/backend OpenTelemetry que aceite OTLP/HTTP.

```json
{
  "plugins": {
    "allow": ["diagnostics-otel"],
    "entries": {
      "diagnostics-otel": {
        "enabled": true
      }
    }
  },
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "endpoint": "http://otel-collector:4318",
      "protocol": "http/protobuf",
      "serviceName": "openclaw-gateway",
      "traces": true,
      "metrics": true,
      "logs": true,
      "sampleRate": 0.2,
      "flushIntervalMs": 60000
    }
  }
}
```

Notas:

- Voce tambem pode habilitar o plugin com `openclaw plugins enable diagnostics-otel`.
- `protocol` atualmente suporta apenas `http/protobuf`. `grpc` e ignorado.
- As metricas incluem uso de tokens, custo, tamanho de contexto, duracao de execucao e
  contadores/histogramas de fluxo de mensagens (webhooks, enfileiramento, estado de sessao, profundidade/espera da fila).
- Traces/metricas podem ser alternados com `traces` / `metrics` (padrao: ligado). Traces
  incluem spans de uso de modelo mais spans de processamento de webhooks/mensagens quando habilitados.
- Defina `headers` quando seu coletor exigir autenticacao.
- Variaveis de ambiente suportadas: `OTEL_EXPORTER_OTLP_ENDPOINT`,
  `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_PROTOCOL`.

### Metricas exportadas (nomes + tipos)

Uso de modelo:

- `openclaw.tokens` (contador, attrs: `openclaw.token`, `openclaw.channel`,
  `openclaw.provider`, `openclaw.model`)
- `openclaw.cost.usd` (contador, attrs: `openclaw.channel`, `openclaw.provider`,
  `openclaw.model`)
- `openclaw.run.duration_ms` (histograma, attrs: `openclaw.channel`,
  `openclaw.provider`, `openclaw.model`)
- `openclaw.context.tokens` (histograma, attrs: `openclaw.context`,
  `openclaw.channel`, `openclaw.provider`, `openclaw.model`)

Fluxo de mensagens:

- `openclaw.webhook.received` (contador, attrs: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.webhook.error` (contador, attrs: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.webhook.duration_ms` (histograma, attrs: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.message.queued` (contador, attrs: `openclaw.channel`,
  `openclaw.source`)
- `openclaw.message.processed` (contador, attrs: `openclaw.channel`,
  `openclaw.outcome`)
- `openclaw.message.duration_ms` (histograma, attrs: `openclaw.channel`,
  `openclaw.outcome`)

Filas + sessoes:

- `openclaw.queue.lane.enqueue` (contador, attrs: `openclaw.lane`)
- `openclaw.queue.lane.dequeue` (contador, attrs: `openclaw.lane`)
- `openclaw.queue.depth` (histograma, attrs: `openclaw.lane` ou
  `openclaw.channel=heartbeat`)
- `openclaw.queue.wait_ms` (histograma, attrs: `openclaw.lane`)
- `openclaw.session.state` (contador, attrs: `openclaw.state`, `openclaw.reason`)
- `openclaw.session.stuck` (contador, attrs: `openclaw.state`)
- `openclaw.session.stuck_age_ms` (histograma, attrs: `openclaw.state`)
- `openclaw.run.attempt` (contador, attrs: `openclaw.attempt`)

### Spans exportados (nomes + atributos-chave)

- `openclaw.model.usage`
  - `openclaw.channel`, `openclaw.provider`, `openclaw.model`
  - `openclaw.sessionKey`, `openclaw.sessionId`
  - `openclaw.tokens.*` (input/output/cache_read/cache_write/total)
- `openclaw.webhook.processed`
  - `openclaw.channel`, `openclaw.webhook`, `openclaw.chatId`
- `openclaw.webhook.error`
  - `openclaw.channel`, `openclaw.webhook`, `openclaw.chatId`,
    `openclaw.error`
- `openclaw.message.processed`
  - `openclaw.channel`, `openclaw.outcome`, `openclaw.chatId`,
    `openclaw.messageId`, `openclaw.sessionKey`, `openclaw.sessionId`,
    `openclaw.reason`
- `openclaw.session.stuck`
  - `openclaw.state`, `openclaw.ageMs`, `openclaw.queueDepth`,
    `openclaw.sessionKey`, `openclaw.sessionId`

### Amostragem + flushing

- Amostragem de traces: `diagnostics.otel.sampleRate` (0.0–1.0, apenas spans raiz).
- Intervalo de exportacao de metricas: `diagnostics.otel.flushIntervalMs` (min 1000ms).

### Notas de protocolo

- Endpoints OTLP/HTTP podem ser definidos via `diagnostics.otel.endpoint` ou
  `OTEL_EXPORTER_OTLP_ENDPOINT`.
- Se o endpoint ja contiver `/v1/traces` ou `/v1/metrics`, ele e usado como esta.
- Se o endpoint ja contiver `/v1/logs`, ele e usado como esta para logs.
- `diagnostics.otel.logs` habilita a exportacao de logs OTLP para a saida principal do logger.

### Comportamento de exportacao de logs

- Logs OTLP usam os mesmos registros estruturados gravados em `logging.file`.
- Respeitam `logging.level` (nivel de log em arquivo). A redacao do console **nao** se aplica
  aos logs OTLP.
- Instalacoes de alto volume devem preferir amostragem/filtragem no coletor OTLP.

## Dicas de solucao de problemas

- **Gateway inacessivel?** Execute `openclaw doctor` primeiro.
- **Logs vazios?** Verifique se o Gateway esta em execucao e gravando no caminho do arquivo
  em `logging.file`.
- **Precisa de mais detalhes?** Defina `logging.level` como `debug` ou `trace` e tente novamente.
