---
summary: "Tratamento de data e hora em envelopes, prompts, ferramentas e conectores"
read_when:
  - Voce esta alterando como carimbos de data e hora sao exibidos para o modelo ou para os usuarios
  - Voce esta depurando a formatacao de hora em mensagens ou na saida do prompt do sistema
title: "Data e Hora"
x-i18n:
  source_path: date-time.md
  source_hash: 753af5946a006215
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:09Z
---

# Data & Hora

O OpenClaw usa por padrao **hora local do host para carimbos de data e hora de transporte** e **fuso horario do usuario apenas no prompt do sistema**.
Os carimbos de data e hora do provedor sao preservados para que as ferramentas mantenham suas semanticas nativas (a hora atual esta disponivel via `session_status`).

## Envelopes de mensagem (local por padrao)

Mensagens de entrada sao envolvidas com um carimbo de data e hora (precisao de minuto):

```
[Provider ... 2026-01-05 16:26 PST] message text
```

Esse carimbo de data e hora do envelope e **local do host por padrao**, independentemente do fuso horario do provedor.

Voce pode substituir esse comportamento:

```json5
{
  agents: {
    defaults: {
      envelopeTimezone: "local", // "utc" | "local" | "user" | IANA timezone
      envelopeTimestamp: "on", // "on" | "off"
      envelopeElapsed: "on", // "on" | "off"
    },
  },
}
```

- `envelopeTimezone: "utc"` usa UTC.
- `envelopeTimezone: "local"` usa o fuso horario do host.
- `envelopeTimezone: "user"` usa `agents.defaults.userTimezone` (retorna ao fuso horario do host).
- Use um fuso horario IANA explicito (por exemplo, `"America/Chicago"`) para uma zona fixa.
- `envelopeTimestamp: "off"` remove carimbos de data e hora absolutos dos cabecalhos do envelope.
- `envelopeElapsed: "off"` remove sufixos de tempo decorrido (o estilo `+2m`).

### Exemplos

**Local (padrao):**

```
[WhatsApp +1555 2026-01-18 00:19 PST] hello
```

**Fuso horario do usuario:**

```
[WhatsApp +1555 2026-01-18 00:19 CST] hello
```

**Tempo decorrido ativado:**

```
[WhatsApp +1555 +30s 2026-01-18T05:19Z] follow-up
```

## Prompt do sistema: Data e Hora Atuais

Se o fuso horario do usuario for conhecido, o prompt do sistema inclui uma secao dedicada
**Data e Hora Atuais** apenas com o **fuso horario** (sem relogio/formato de hora)
para manter o cache do prompt estavel:

```
Time zone: America/Chicago
```

Quando o agente precisar da hora atual, use a ferramenta `session_status`; o cartao
de status inclui uma linha de carimbo de data e hora.

## Linhas de eventos do sistema (local por padrao)

Eventos de sistema enfileirados inseridos no contexto do agente recebem um prefixo com carimbo de data e hora usando a
mesma selecao de fuso horario dos envelopes de mensagem (padrao: local do host).

```
System: [2026-01-12 12:19:17 PST] Model switched.
```

### Configurar fuso horario + formato do usuario

```json5
{
  agents: {
    defaults: {
      userTimezone: "America/Chicago",
      timeFormat: "auto", // auto | 12 | 24
    },
  },
}
```

- `userTimezone` define o **fuso horario local do usuario** para o contexto do prompt.
- `timeFormat` controla a **exibicao 12h/24h** no prompt. `auto` segue as preferencias do SO.

## Deteccao de formato de hora (automatica)

Quando `timeFormat: "auto"`, o OpenClaw inspeciona a preferencia do SO (macOS/Windows)
e recorre a formatacao por localidade. O valor detectado e **armazenado em cache por processo**
para evitar chamadas repetidas ao sistema.

## Cargas de ferramentas + conectores (hora bruta do provedor + campos normalizados)

Ferramentas de canal retornam **carimbos de data e hora nativos do provedor** e adicionam campos normalizados para consistencia:

- `timestampMs`: milissegundos desde a epoca (UTC)
- `timestampUtc`: string ISO 8601 em UTC

Campos brutos do provedor sao preservados para que nada seja perdido.

- Slack: strings semelhantes a epoch da API
- Discord: carimbos ISO UTC
- Telegram/WhatsApp: carimbos numericos/ISO especificos do provedor

Se voce precisar de hora local, converta a jusante usando o fuso horario conhecido.

## Documentos relacionados

- [Prompt do Sistema](/concepts/system-prompt)
- [Fusos Horarios](/concepts/timezone)
- [Mensagens](/concepts/messages)
