---
summary: "Esquema de configuracion de Skills y ejemplos"
read_when:
  - Agregar o modificar la configuracion de Skills
  - Ajustar la allowlist incluida o el comportamiento de instalacion
title: "Configuracion de Skills"
x-i18n:
  source_path: tools/skills-config.md
  source_hash: e265c93da7856887
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:15Z
---

# Configuracion de Skills

Toda la configuracion relacionada con Skills vive bajo `skills` en `~/.openclaw/openclaw.json`.

```json5
{
  skills: {
    allowBundled: ["gemini", "peekaboo"],
    load: {
      extraDirs: ["~/Projects/agent-scripts/skills", "~/Projects/oss/some-skill-pack/skills"],
      watch: true,
      watchDebounceMs: 250,
    },
    install: {
      preferBrew: true,
      nodeManager: "npm", // npm | pnpm | yarn | bun (Gateway runtime still Node; bun not recommended)
    },
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

## Campos

- `allowBundled`: allowlist opcional solo para Skills **incluidas**. Cuando se establece, solo
  las Skills incluidas en la lista son elegibles (las Skills gestionadas/del workspace no se ven afectadas).
- `load.extraDirs`: directorios adicionales de Skills para escanear (precedencia mas baja).
- `load.watch`: observar carpetas de Skills y refrescar la instantanea de Skills (predeterminado: true).
- `load.watchDebounceMs`: debounce para eventos del observador de Skills en milisegundos (predeterminado: 250).
- `install.preferBrew`: preferir instaladores brew cuando esten disponibles (predeterminado: true).
- `install.nodeManager`: preferencia del instalador de node (`npm` | `pnpm` | `yarn` | `bun`, predeterminado: npm).
  Esto solo afecta a las **instalaciones de Skills**; el runtime del Gateway aun debe ser Node
  (Bun no recomendado para WhatsApp/Telegram).
- `entries.<skillKey>`: anulaciones por Skill.

Campos por Skill:

- `enabled`: establezca `false` para deshabilitar una Skill incluso si esta incluida/instalada.
- `env`: variables de entorno inyectadas para la ejecucion del agente (solo si no estan ya establecidas).
- `apiKey`: conveniencia opcional para Skills que declaran una variable de entorno primaria.

## Notas

- Las claves bajo `entries` se asignan al nombre de la Skill de forma predeterminada. Si una Skill define
  `metadata.openclaw.skillKey`, use esa clave en su lugar.
- Los cambios en las Skills se detectan en el siguiente turno del agente cuando el observador esta habilitado.

### Skills en sandbox + variables de entorno

Cuando una sesion esta **sandboxed**, los procesos de Skills se ejecutan dentro de Docker. El sandbox
**no** hereda el `process.env` del host.

Use una de las siguientes opciones:

- `agents.defaults.sandbox.docker.env` (o por agente `agents.list[].sandbox.docker.env`)
- incorpore las variables de entorno en su imagen de sandbox personalizada

`env` y `skills.entries.<skill>.env/apiKey` globales se aplican solo a ejecuciones en el **host**.
