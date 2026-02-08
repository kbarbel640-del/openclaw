---
summary: "Referencia de CLI para `openclaw configure` (indicaciones de configuracion interactiva)"
read_when:
  - Desea ajustar credenciales, dispositivos o valores predeterminados del agente de forma interactiva
title: "configure"
x-i18n:
  source_path: cli/configure.md
  source_hash: 9cb2bb5237b02b3a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:08Z
---

# `openclaw configure`

Indicacion interactiva para configurar credenciales, dispositivos y valores predeterminados del agente.

Nota: La seccion **Model** ahora incluye una seleccion multiple para la
lista de permitidos `agents.defaults.models` (lo que aparece en `/model` y en el selector de modelos).

Consejo: `openclaw config` sin un subcomando abre el mismo asistente. Use
`openclaw config get|set|unset` para ediciones no interactivas.

Relacionado:

- Referencia de configuracion del Gateway: [Configuration](/gateway/configuration)
- CLI de configuracion: [Config](/cli/config)

Notas:

- Elegir donde se ejecuta el Gateway siempre actualiza `gateway.mode`. Puede seleccionar "Continue" sin otras secciones si eso es todo lo que necesita.
- Los servicios orientados a canales (Slack/Discord/Matrix/Microsoft Teams) solicitan listas de permitidos de canales/salas durante la configuracion. Puede ingresar nombres o ID; el asistente resuelve los nombres a ID cuando es posible.

## Ejemplos

```bash
openclaw configure
openclaw configure --section models --section channels
```
