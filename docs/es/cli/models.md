---
summary: "Referencia de la CLI para `openclaw models` (estado/listar/configurar/escaneo, alias, alternativas, autenticación)"
read_when:
  - Quiere cambiar los modelos predeterminados o ver el estado de autenticación del proveedor
  - Quiere escanear modelos/proveedores disponibles y depurar perfiles de autenticación
title: "modelos"
x-i18n:
  source_path: cli/models.md
  source_hash: 923b6ffc7de382ba
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:19Z
---

# `openclaw models`

Descubrimiento, escaneo y configuracion de modelos (modelo predeterminado, alternativas, perfiles de autenticación).

Relacionado:

- Proveedores + modelos: [Models](/providers/models)
- Configuración de autenticación del proveedor: [Primeros Pasos](/start/getting-started)

## Comandos comunes

```bash
openclaw models status
openclaw models list
openclaw models set <model-or-alias>
openclaw models scan
```

`openclaw models status` muestra el valor predeterminado resuelto/alternativas junto con una vista general de autenticación.
Cuando hay instantáneas de uso del proveedor disponibles, la sección de estado OAuth/token incluye
encabezados de uso del proveedor.
Agregue `--probe` para ejecutar pruebas de autenticación en vivo contra cada perfil de proveedor configurado.
Las pruebas son solicitudes reales (pueden consumir tokens y activar límites de tasa).
Use `--agent <id>` para inspeccionar el estado de modelo/autenticación de un agente configurado. Si se omite,
el comando usa `OPENCLAW_AGENT_DIR`/`PI_CODING_AGENT_DIR` si están configurados; de lo contrario, el
agente predeterminado configurado.

Notas:

- `models set <model-or-alias>` acepta `provider/model` o un alias.
- Las referencias de modelos se analizan dividiendo en el **primer** `/`. Si el ID del modelo incluye `/` (estilo OpenRouter), incluya el prefijo del proveedor (ejemplo: `openrouter/moonshotai/kimi-k2`).
- Si omite el proveedor, OpenClaw trata la entrada como un alias o un modelo para el **proveedor predeterminado** (solo funciona cuando no hay `/` en el ID del modelo).

### `models status`

Opciones:

- `--json`
- `--plain`
- `--check` (salida 1=expirado/faltante, 2=por expirar)
- `--probe` (prueba en vivo de perfiles de autenticación configurados)
- `--probe-provider <name>` (probar un proveedor)
- `--probe-profile <id>` (repetir o IDs de perfil separados por comas)
- `--probe-timeout <ms>`
- `--probe-concurrency <n>`
- `--probe-max-tokens <n>`
- `--agent <id>` (ID de agente configurado; anula `OPENCLAW_AGENT_DIR`/`PI_CODING_AGENT_DIR`)

## Alias + alternativas

```bash
openclaw models aliases list
openclaw models fallbacks list
```

## Perfiles de autenticación

```bash
openclaw models auth add
openclaw models auth login --provider <id>
openclaw models auth setup-token
openclaw models auth paste-token
```

`models auth login` ejecuta el flujo de autenticación de un plugin de proveedor (OAuth/clave API). Use
`openclaw plugins list` para ver qué proveedores están instalados.

Notas:

- `setup-token` solicita un valor de token de configuración (genérelo con `claude setup-token` en cualquier máquina).
- `paste-token` acepta una cadena de token generada en otro lugar o desde automatización.
