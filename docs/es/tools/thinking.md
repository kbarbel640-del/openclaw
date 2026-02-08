---
summary: "Sintaxis de directivas para /think + /verbose y cómo afectan el razonamiento del modelo"
read_when:
  - Ajustar el análisis o el análisis de directivas verbose o sus valores predeterminados
title: "Niveles de Pensamiento"
x-i18n:
  source_path: tools/thinking.md
  source_hash: 0ae614147675be32
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:21Z
---

# Niveles de Pensamiento (directivas /think)

## Qué hace

- Directiva en línea en cualquier cuerpo entrante: `/t <level>`, `/think:<level>` o `/thinking <level>`.
- Niveles (alias): `off | minimal | low | medium | high | xhigh` (solo modelos GPT-5.2 + Codex)
  - minimal → “think”
  - low → “think hard”
  - medium → “think harder”
  - high → “ultrathink” (presupuesto máximo)
  - xhigh → “ultrathink+” (solo modelos GPT-5.2 + Codex)
  - `x-high`, `x_high`, `extra-high`, `extra high` y `extra_high` se asignan a `xhigh`.
  - `highest`, `max` se asignan a `high`.
- Notas del proveedor:
  - Z.AI (`zai/*`) solo admite pensamiento binario (`on`/`off`). Cualquier nivel que no sea `off` se trata como `on` (asignado a `low`).

## Orden de resolución

1. Directiva en línea en el mensaje (se aplica solo a ese mensaje).
2. Anulación de sesión (establecida enviando un mensaje solo con la directiva).
3. Valor predeterminado global (`agents.defaults.thinkingDefault` en la configuración).
4. Alternativa: low para modelos con capacidad de razonamiento; off en caso contrario.

## Configurar un valor predeterminado de sesión

- Envíe un mensaje que sea **solo** la directiva (se permite espacio en blanco), p. ej., `/think:medium` o `/t high`.
- Esto permanece para la sesión actual (por remitente de forma predeterminada); se borra con `/think:off` o por reinicio de inactividad de la sesión.
- Se envía una respuesta de confirmación (`Thinking level set to high.` / `Thinking disabled.`). Si el nivel no es válido (p. ej., `/thinking big`), el comando se rechaza con una sugerencia y el estado de la sesión se deja sin cambios.
- Envíe `/think` (o `/think:`) sin argumento para ver el nivel de pensamiento actual.

## Aplicación por agente

- **Pi incrustado**: el nivel resuelto se pasa al runtime del agente Pi en proceso.

## Directivas verbose (/verbose o /v)

- Niveles: `on` (minimal) | `full` | `off` (predeterminado).
- Un mensaje solo con la directiva alterna el verbose de la sesión y responde `Verbose logging enabled.` / `Verbose logging disabled.`; los niveles no válidos devuelven una sugerencia sin cambiar el estado.
- `/verbose off` almacena una anulación explícita de la sesión; bórrela mediante la UI de Sesiones eligiendo `inherit`.
- La directiva en línea afecta solo a ese mensaje; de lo contrario se aplican los valores predeterminados de sesión/globales.
- Envíe `/verbose` (o `/verbose:`) sin argumento para ver el nivel verbose actual.
- Cuando verbose está activado, los agentes que emiten resultados de herramientas estructurados (Pi, otros agentes JSON) envían cada llamada de herramienta como su propio mensaje solo de metadatos, con el prefijo `<emoji> <tool-name>: <arg>` cuando esté disponible (ruta/comando). Estos resúmenes de herramientas se envían tan pronto como cada herramienta comienza (burbujas separadas), no como deltas en streaming.
- Cuando verbose está en `full`, los resultados de las herramientas también se reenvían tras la finalización (burbuja separada, truncada a una longitud segura). Si alterna `/verbose on|full|off` mientras una ejecución está en curso, las burbujas de herramientas posteriores respetan la nueva configuración.

## Visibilidad del razonamiento (/reasoning)

- Niveles: `on|off|stream`.
- Un mensaje solo con la directiva alterna si los bloques de pensamiento se muestran en las respuestas.
- Cuando está habilitado, el razonamiento se envía como un **mensaje separado** con el prefijo `Reasoning:`.
- `stream` (solo Telegram): transmite el razonamiento en el borrador de Telegram mientras se genera la respuesta y luego envía la respuesta final sin razonamiento.
- Alias: `/reason`.
- Envíe `/reasoning` (o `/reasoning:`) sin argumento para ver el nivel de razonamiento actual.

## Relacionado

- La documentación del modo elevado se encuentra en [Modo elevado](/tools/elevated).

## Heartbeats

- El cuerpo de la sonda de heartbeat es el prompt de heartbeat configurado (predeterminado: `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`). Las directivas en línea en un mensaje de heartbeat se aplican como de costumbre (pero evite cambiar los valores predeterminados de la sesión desde los heartbeats).
- La entrega del heartbeat se limita de forma predeterminada a la carga final. Para enviar también el mensaje separado `Reasoning:` (cuando esté disponible), establezca `agents.defaults.heartbeat.includeReasoning: true` o por agente `agents.list[].heartbeat.includeReasoning: true`.

## UI de chat web

- El selector de pensamiento del chat web refleja el nivel almacenado de la sesión desde el almacén/configuración de sesiones entrantes cuando se carga la página.
- Elegir otro nivel se aplica solo al siguiente mensaje (`thinkingOnce`); después de enviar, el selector vuelve al nivel de sesión almacenado.
- Para cambiar el valor predeterminado de la sesión, envíe una directiva `/think:<level>` (como antes); el selector lo reflejará tras la siguiente recarga.
