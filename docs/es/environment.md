---
summary: "Dónde OpenClaw carga las variables de entorno y el orden de precedencia"
read_when:
  - Necesita saber qué variables de entorno se cargan y en qué orden
  - Está depurando claves de API faltantes en el Gateway
  - Está documentando la autenticación de proveedores o los entornos de despliegue
title: "Variables de entorno"
x-i18n:
  source_path: environment.md
  source_hash: b49ae50e5d306612
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:46Z
---

# Variables de entorno

OpenClaw obtiene variables de entorno desde múltiples fuentes. La regla es **nunca sobrescribir valores existentes**.

## Precedencia (mayor → menor)

1. **Entorno del proceso** (lo que el proceso del Gateway ya tiene desde el shell/daemon padre).
2. **`.env` en el directorio de trabajo actual** (valor predeterminado de dotenv; no sobrescribe).
3. **`.env` global** en `~/.openclaw/.env` (también conocido como `$OPENCLAW_STATE_DIR/.env`; no sobrescribe).
4. **Bloque de `env` de Configuracion** en `~/.openclaw/openclaw.json` (se aplica solo si falta).
5. **Importación opcional del shell de inicio de sesion** (`env.shellEnv.enabled` o `OPENCLAW_LOAD_SHELL_ENV=1`), aplicada solo para claves esperadas faltantes.

Si el archivo de configuracion falta por completo, el paso 4 se omite; la importación del shell aun se ejecuta si está habilitada.

## Bloque de `env` de Configuracion

Dos formas equivalentes de establecer variables de entorno en linea (ambas no sobrescriben):

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

## Importación de variables de entorno del shell

`env.shellEnv` ejecuta su shell de inicio de sesion e importa solo las claves **faltantes** esperadas:

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

Equivalentes de variables de entorno:

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

## Sustitución de variables de entorno en la configuracion

Puede referenciar variables de entorno directamente en valores de cadena de la configuracion usando la sintaxis `${VAR_NAME}`:

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
}
```

Consulte [Configuracion: Sustitución de variables de entorno](/gateway/configuration#env-var-substitution-in-config) para mas detalles.

## Relacionado

- [Configuracion del Gateway](/gateway/configuration)
- [Preguntas frecuentes: variables de entorno y carga de .env](/help/faq#env-vars-and-env-loading)
- [Descripcion general de modelos](/concepts/models)
