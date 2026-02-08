---
summary: "Manifiesto de plugin + requisitos de esquema JSON (validación estricta de configuración)"
read_when:
  - Usted está creando un plugin de OpenClaw
  - Usted necesita enviar un esquema de configuración de plugin o depurar errores de validación de plugins
title: "Manifiesto de Plugin"
x-i18n:
  source_path: plugins/manifest.md
  source_hash: 47b3e33c915f47bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:37Z
---

# Manifiesto de plugin (openclaw.plugin.json)

Cada plugin **debe** incluir un archivo `openclaw.plugin.json` en la **raíz del plugin**.
OpenClaw usa este manifiesto para validar la configuración **sin ejecutar el código del plugin**. Los manifiestos faltantes o inválidos se tratan como errores del plugin y bloquean la validación de la configuración.

Consulte la guía completa del sistema de plugins: [Plugins](/plugin).

## Campos requeridos

```json
{
  "id": "voice-call",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

Claves requeridas:

- `id` (string): id canónico del plugin.
- `configSchema` (object): Esquema JSON para la configuración del plugin (en línea).

Claves opcionales:

- `kind` (string): tipo de plugin (ejemplo: `"memory"`).
- `channels` (array): ids de canales registrados por este plugin (ejemplo: `["matrix"]`).
- `providers` (array): ids de proveedores registrados por este plugin.
- `skills` (array): directorios de Skills a cargar (relativos a la raíz del plugin).
- `name` (string): nombre para mostrar del plugin.
- `description` (string): resumen corto del plugin.
- `uiHints` (object): etiquetas/campos de marcador/sensibilidad de campos de configuración para el renderizado de la UI.
- `version` (string): versión del plugin (informativo).

## Requisitos del esquema JSON

- **Cada plugin debe incluir un esquema JSON**, incluso si no acepta configuración.
- Un esquema vacío es aceptable (por ejemplo, `{ "type": "object", "additionalProperties": false }`).
- Los esquemas se validan en el momento de lectura/escritura de la configuración, no en tiempo de ejecución.

## Comportamiento de validación

- Las claves `channels.*` desconocidas son **errores**, a menos que el id del canal esté declarado por un manifiesto de plugin.
- `plugins.entries.<id>`, `plugins.allow`, `plugins.deny` y `plugins.slots.*`
  deben referenciar ids de plugins **descubribles**. Los ids desconocidos son **errores**.
- Si un plugin está instalado pero tiene un manifiesto o esquema roto o faltante,
  la validación falla y Doctor informa el error del plugin.
- Si existe configuración del plugin pero el plugin está **deshabilitado**, la configuración se conserva y se muestra una **advertencia** en Doctor + registros.

## Notas

- El manifiesto es **obligatorio para todos los plugins**, incluidos los cargados desde el sistema de archivos local.
- El runtime aún carga el módulo del plugin por separado; el manifiesto es solo para descubrimiento + validación.
- Si su plugin depende de módulos nativos, documente los pasos de compilación y cualquier requisito de allowlist del gestor de paquetes (por ejemplo, pnpm `allow-build-scripts`
  - `pnpm rebuild <package>`).
