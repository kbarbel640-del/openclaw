---
summary: "Tratamento de fuso horário para agentes, envelopes e prompts"
read_when:
  - Voce precisa entender como os timestamps sao normalizados para o modelo
  - Configuracao do fuso horario do usuario para prompts do sistema
title: "Fusos horarios"
x-i18n:
  source_path: concepts/timezone.md
  source_hash: 9ee809c96897db11
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:00Z
---

# Fusos horarios

O OpenClaw padroniza timestamps para que o modelo veja um **unico tempo de referencia**.

## Envelopes de mensagens (local por padrao)

Mensagens de entrada sao encapsuladas em um envelope como:

```
[Provider ... 2026-01-05 16:26 PST] message text
```

O timestamp no envelope e **local do host por padrao**, com precisao de minutos.

Voce pode substituir isso com:

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
- `envelopeTimezone: "user"` usa `agents.defaults.userTimezone` (retorna ao fuso horario do host).
- Use um fuso horario IANA explicito (por exemplo, `"Europe/Vienna"`) para um offset fixo.
- `envelopeTimestamp: "off"` remove timestamps absolutos dos cabecalhos do envelope.
- `envelopeElapsed: "off"` remove sufixos de tempo decorrido (o estilo `+2m`).

### Exemplos

**Local (padrao):**

```
[Signal Alice +1555 2026-01-18 00:19 PST] hello
```

**Fuso horario fixo:**

```
[Signal Alice +1555 2026-01-18 06:19 GMT+1] hello
```

**Tempo decorrido:**

```
[Signal Alice +1555 +2m 2026-01-18T05:19Z] follow-up
```

## Cargas de ferramentas (dados brutos do provedor + campos normalizados)

Chamadas de ferramentas (`channels.discord.readMessages`, `channels.slack.readMessages`, etc.) retornam **timestamps brutos do provedor**.
Tambem anexamos campos normalizados para consistencia:

- `timestampMs` (milissegundos de epoca UTC)
- `timestampUtc` (string ISO 8601 em UTC)

Os campos brutos do provedor sao preservados.

## Fuso horario do usuario para o prompt do sistema

Defina `agents.defaults.userTimezone` para informar ao modelo o fuso horario local do usuario. Se estiver
nao definido, o OpenClaw resolve o **fuso horario do host em tempo de execucao** (sem gravacao de configuracao).

```json5
{
  agents: { defaults: { userTimezone: "America/Chicago" } },
}
```

O prompt do sistema inclui:

- Secao `Current Date & Time` com hora local e fuso horario
- `Time format: 12-hour` ou `24-hour`

Voce pode controlar o formato do prompt com `agents.defaults.timeFormat` (`auto` | `12` | `24`).

Veja [Date & Time](/date-time) para o comportamento completo e exemplos.
