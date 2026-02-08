---
summary: "Use Anthropic Claude mediante claves de API o setup-token en OpenClaw"
read_when:
  - Quiere usar modelos de Anthropic en OpenClaw
  - Quiere usar setup-token en lugar de claves de API
title: "Anthropic"
x-i18n:
  source_path: providers/anthropic.md
  source_hash: 5e50b3bca35be37e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:40Z
---

# Anthropic (Claude)

Anthropic desarrolla la familia de modelos **Claude** y proporciona acceso mediante una API.
En OpenClaw puede autenticarse con una clave de API o con un **setup-token**.

## Opción A: Clave de API de Anthropic

**Mejor para:** acceso estándar a la API y facturación por uso.
Cree su clave de API en la Consola de Anthropic.

### Configuración de CLI

```bash
openclaw onboard
# choose: Anthropic API key

# or non-interactive
openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY"
```

### Fragmento de configuracion

```json5
{
  env: { ANTHROPIC_API_KEY: "sk-ant-..." },
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Cacheo de prompts (API de Anthropic)

OpenClaw admite la función de cacheo de prompts de Anthropic. Esto es **solo para la API**; la autenticación por suscripción no respeta la configuración de caché.

### Configuracion

Use el parámetro `cacheRetention` en la configuración de su modelo:

| Valor   | Duración de caché | Descripción                                        |
| ------- | ----------------- | -------------------------------------------------- |
| `none`  | Sin caché         | Deshabilitar el cacheo de prompts                  |
| `short` | 5 minutos         | Predeterminado para autenticación con clave de API |
| `long`  | 1 hora            | Caché extendida (requiere bandera beta)            |

```json5
{
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": {
          params: { cacheRetention: "long" },
        },
      },
    },
  },
}
```

### Valores predeterminados

Al usar autenticación con Clave de API de Anthropic, OpenClaw aplica automáticamente `cacheRetention: "short"` (caché de 5 minutos) para todos los modelos de Anthropic. Puede sobrescribir esto estableciendo explícitamente `cacheRetention` en su configuración.

### Parámetro heredado

El parámetro anterior `cacheControlTtl` aún es compatible por compatibilidad hacia atrás:

- `"5m"` se asigna a `short`
- `"1h"` se asigna a `long`

Recomendamos migrar al nuevo parámetro `cacheRetention`.

OpenClaw incluye la bandera beta `extended-cache-ttl-2025-04-11` para solicitudes de la API de Anthropic;
consérvela si sobrescribe los encabezados del proveedor (vea [/gateway/configuration](/gateway/configuration)).

## Opción B: Claude setup-token

**Mejor para:** usar su suscripción de Claude.

### Dónde obtener un setup-token

Los setup-tokens se crean con la **Claude Code CLI**, no con la Consola de Anthropic. Puede ejecutar esto en **cualquier máquina**:

```bash
claude setup-token
```

Pegue el token en OpenClaw (asistente: **Anthropic token (pegar setup-token)**), o ejecútelo en el host del gateway:

```bash
openclaw models auth setup-token --provider anthropic
```

Si generó el token en una máquina diferente, péguelo:

```bash
openclaw models auth paste-token --provider anthropic
```

### Configuración de CLI

```bash
# Paste a setup-token during onboarding
openclaw onboard --auth-choice setup-token
```

### Fragmento de configuracion

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Notas

- Genere el setup-token con `claude setup-token` y péguelo, o ejecute `openclaw models auth setup-token` en el host del gateway.
- Si ve “OAuth token refresh failed …” en una suscripción de Claude, vuelva a autenticarse con un setup-token. Consulte [/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription](/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription).
- Los detalles de autenticación y las reglas de reutilización están en [/concepts/oauth](/concepts/oauth).

## Solucion de problemas

**Errores 401 / token repentinamente inválido**

- La autenticación por suscripción de Claude puede expirar o ser revocada. Vuelva a ejecutar `claude setup-token`
  y péguelo en el **host del gateway**.
- Si el inicio de sesión de la CLI de Claude reside en una máquina diferente, use
  `openclaw models auth paste-token --provider anthropic` en el host del gateway.

**No se encontró una clave de API para el proveedor "anthropic"**

- La autenticación es **por agente**. Los agentes nuevos no heredan las claves del agente principal.
- Vuelva a ejecutar la incorporación para ese agente, o pegue un setup-token / clave de API en el
  host del gateway, luego verifique con `openclaw models status`.

**No se encontraron credenciales para el perfil `anthropic:default`**

- Ejecute `openclaw models status` para ver qué perfil de autenticación está activo.
- Vuelva a ejecutar la incorporación, o pegue un setup-token / clave de API para ese perfil.

**No hay perfil de autenticación disponible (todos en enfriamiento/no disponibles)**

- Verifique `openclaw models status --json` para `auth.unusableProfiles`.
- Agregue otro perfil de Anthropic o espere a que termine el enfriamiento.

Más: [/gateway/troubleshooting](/gateway/troubleshooting) y [/help/faq](/help/faq).
