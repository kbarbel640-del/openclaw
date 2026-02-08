---
summary: "Ejecuciones directas del CLI `openclaw agent` (con entrega opcional)"
read_when:
  - Agregar o modificar el punto de entrada del CLI del agente
title: "Envio del Agente"
x-i18n:
  source_path: tools/agent-send.md
  source_hash: a84d6a304333eebe
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:06Z
---

# `openclaw agent` (ejecuciones directas del agente)

`openclaw agent` ejecuta un solo turno del agente sin necesidad de un mensaje de chat entrante.
De forma predeterminada pasa **por el Gateway**; agregue `--local` para forzar el
runtime integrado en la maquina actual.

## Comportamiento

- Requerido: `--message <text>`
- Seleccion de sesion:
  - `--to <dest>` deriva la clave de sesion (los destinos de grupo/canal preservan el aislamiento; los chats directos se colapsan a `main`), **o**
  - `--session-id <id>` reutiliza una sesion existente por id, **o**
  - `--agent <id>` apunta directamente a un agente configurado (usa la clave de sesion `main` de ese agente)
- Ejecuta el mismo runtime de agente integrado que las respuestas entrantes normales.
- Las banderas de pensamiento/verboso persisten en el almacen de sesiones.
- Salida:
  - predeterminada: imprime el texto de respuesta (mas lineas de `MEDIA:<url>`)
  - `--json`: imprime la carga estructurada + metadatos
- Entrega opcional de vuelta a un canal con `--deliver` + `--channel` (los formatos de destino coinciden con `openclaw message --target`).
- Use `--reply-channel`/`--reply-to`/`--reply-account` para sobrescribir la entrega sin cambiar la sesion.

Si el Gateway no es accesible, el CLI **hace fallback** a la ejecucion local integrada.

## Ejemplos

```bash
openclaw agent --to +15555550123 --message "status update"
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --to +15555550123 --message "Trace logs" --verbose on --json
openclaw agent --to +15555550123 --message "Summon reply" --deliver
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```

## Banderas

- `--local`: ejecutar localmente (requiere claves de API del proveedor del modelo en su shell)
- `--deliver`: enviar la respuesta al canal elegido
- `--channel`: canal de entrega (`whatsapp|telegram|discord|googlechat|slack|signal|imessage`, predeterminado: `whatsapp`)
- `--reply-to`: sobrescritura del destino de entrega
- `--reply-channel`: sobrescritura del canal de entrega
- `--reply-account`: sobrescritura del id de la cuenta de entrega
- `--thinking <off|minimal|low|medium|high|xhigh>`: persistir el nivel de pensamiento (solo modelos GPT-5.2 + Codex)
- `--verbose <on|full|off>`: persistir el nivel verboso
- `--timeout <seconds>`: sobrescribir el tiempo de espera del agente
- `--json`: salida JSON estructurada
