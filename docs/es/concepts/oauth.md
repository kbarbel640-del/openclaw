---
summary: "OAuth en OpenClaw: intercambio de tokens, almacenamiento y patrones de multiples cuentas"
read_when:
  - Quiere entender OAuth en OpenClaw de principio a fin
  - Tiene problemas de invalidacion de tokens / cierre de sesion
  - Quiere flujos de setup-token o autenticacion OAuth
  - Quiere multiples cuentas o enrutamiento por perfiles
title: "OAuth"
x-i18n:
  source_path: concepts/oauth.md
  source_hash: af714bdadc4a8929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:36Z
---

# OAuth

OpenClaw admite “autenticacion por suscripcion” mediante OAuth para proveedores que la ofrecen (en particular **OpenAI Codex (ChatGPT OAuth)**). Para suscripciones de Anthropic, use el flujo **setup-token**. Esta pagina explica:

- como funciona el **intercambio de tokens** OAuth (PKCE)
- donde se **almacenan** los tokens (y por que)
- como manejar **multiples cuentas** (perfiles + anulaciones por sesion)

OpenClaw tambien admite **plugins de proveedores** que incluyen sus propios flujos OAuth o de claves API.
Ejecutelos mediante:

```bash
openclaw models auth login --provider <id>
```

## El sumidero de tokens (por que existe)

Los proveedores OAuth suelen emitir un **nuevo refresh token** durante los flujos de inicio de sesion/renovacion. Algunos proveedores (o clientes OAuth) pueden invalidar refresh tokens antiguos cuando se emite uno nuevo para el mismo usuario/aplicacion.

Sintoma practico:

- usted inicia sesion mediante OpenClaw _y_ mediante Claude Code / Codex CLI → uno de ellos termina “cerrando sesion” de forma aleatoria mas tarde

Para reducir esto, OpenClaw trata `auth-profiles.json` como un **sumidero de tokens**:

- el runtime lee las credenciales desde **un solo lugar**
- podemos mantener multiples perfiles y enrutar de forma deterministica

## Almacenamiento (donde viven los tokens)

Los secretos se almacenan **por agente**:

- Perfiles de autenticacion (OAuth + claves API): `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- Cache de runtime (gestionada automaticamente; no edite): `~/.openclaw/agents/<agentId>/agent/auth.json`

Archivo legado solo para importacion (aun compatible, pero no es el almacen principal):

- `~/.openclaw/credentials/oauth.json` (importado en `auth-profiles.json` en el primer uso)

Todo lo anterior tambien respeta `$OPENCLAW_STATE_DIR` (anulacion del directorio de estado). Referencia completa: [/gateway/configuration](/gateway/configuration#auth-storage-oauth--api-keys)

## Anthropic setup-token (autenticacion por suscripcion)

Ejecute `claude setup-token` en cualquier maquina y luego peguelo en OpenClaw:

```bash
openclaw models auth setup-token --provider anthropic
```

Si genero el token en otro lugar, peguelo manualmente:

```bash
openclaw models auth paste-token --provider anthropic
```

Verifique:

```bash
openclaw models status
```

## Intercambio OAuth (como funciona el inicio de sesion)

Los flujos interactivos de inicio de sesion de OpenClaw estan implementados en `@mariozechner/pi-ai` y conectados a los asistentes/comandos.

### Anthropic (Claude Pro/Max) setup-token

Forma del flujo:

1. ejecute `claude setup-token`
2. pegue el token en OpenClaw
3. guarde como un perfil de autenticacion por token (sin renovacion)

La ruta del asistente es `openclaw onboard` → opcion de autenticacion `setup-token` (Anthropic).

### OpenAI Codex (ChatGPT OAuth)

Forma del flujo (PKCE):

1. genere el verificador/desafio PKCE + un `state` aleatorio
2. abra `https://auth.openai.com/oauth/authorize?...`
3. intente capturar el callback en `http://127.0.0.1:1455/auth/callback`
4. si el callback no puede enlazarse (o usted esta remoto/sin interfaz), pegue la URL/codigo de redireccion
5. intercambie en `https://auth.openai.com/oauth/token`
6. extraiga `accountId` del token de acceso y almacene `{ access, refresh, expires, accountId }`

La ruta del asistente es `openclaw onboard` → opcion de autenticacion `openai-codex`.

## Renovacion + expiracion

Los perfiles almacenan una marca de tiempo `expires`.

En tiempo de ejecucion:

- si `expires` esta en el futuro → use el token de acceso almacenado
- si expiro → renueve (bajo un bloqueo de archivo) y sobrescriba las credenciales almacenadas

El flujo de renovacion es automatico; por lo general no necesita administrar tokens manualmente.

## Multiples cuentas (perfiles) + enrutamiento

Dos patrones:

### 1) Preferido: agentes separados

Si quiere que “personal” y “trabajo” nunca interactuen, use agentes aislados (sesiones + credenciales + espacio de trabajo separados):

```bash
openclaw agents add work
openclaw agents add personal
```

Luego configure la autenticacion por agente (asistente) y enrute los chats al agente correcto.

### 2) Avanzado: multiples perfiles en un solo agente

`auth-profiles.json` admite multiples IDs de perfil para el mismo proveedor.

Elija que perfil se usa:

- globalmente mediante el orden de configuracion (`auth.order`)
- por sesion mediante `/model ...@<profileId>`

Ejemplo (anulacion por sesion):

- `/model Opus@anthropic:work`

Como ver que IDs de perfil existen:

- `openclaw channels list --json` (muestra `auth[]`)

Documentos relacionados:

- [/concepts/model-failover](/concepts/model-failover) (rotacion + reglas de enfriamiento)
- [/tools/slash-commands](/tools/slash-commands) (superficie de comandos)
