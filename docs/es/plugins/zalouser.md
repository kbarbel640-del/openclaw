---
summary: "Plugin de Zalo Personal: inicio de sesion por QR + mensajeria via zca-cli (instalacion del plugin + configuracion del canal + CLI + herramienta)"
read_when:
  - Desea soporte no oficial de Zalo Personal en OpenClaw
  - Esta configurando o desarrollando el plugin zalouser
title: "Plugin de Zalo Personal"
x-i18n:
  source_path: plugins/zalouser.md
  source_hash: b29b788b023cd507
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:35Z
---

# Zalo Personal (plugin)

Soporte de Zalo Personal para OpenClaw mediante un plugin, usando `zca-cli` para automatizar una cuenta normal de usuario de Zalo.

> **Advertencia:** La automatizacion no oficial puede provocar la suspension o el bloqueo de la cuenta. Use bajo su propio riesgo.

## Naming

El id del canal es `zalouser` para dejar explicito que esto automatiza una **cuenta personal de usuario de Zalo** (no oficial). Mantenemos `zalo` reservado para una posible integracion futura con la API oficial de Zalo.

## Where it runs

Este plugin se ejecuta **dentro del proceso del Gateway**.

Si utiliza un Gateway remoto, instalelo/configurelo en la **maquina que ejecuta el Gateway**, y luego reinicie el Gateway.

## Install

### Option A: install from npm

```bash
openclaw plugins install @openclaw/zalouser
```

Reinicie el Gateway despues.

### Option B: install from a local folder (dev)

```bash
openclaw plugins install ./extensions/zalouser
cd ./extensions/zalouser && pnpm install
```

Reinicie el Gateway despues.

## Prerequisite: zca-cli

La maquina del Gateway debe tener `zca` en `PATH`:

```bash
zca --version
```

## Config

La configuracion del canal se encuentra en `channels.zalouser` (no en `plugins.entries.*`):

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      dmPolicy: "pairing",
    },
  },
}
```

## CLI

```bash
openclaw channels login --channel zalouser
openclaw channels logout --channel zalouser
openclaw channels status --probe
openclaw message send --channel zalouser --target <threadId> --message "Hello from OpenClaw"
openclaw directory peers list --channel zalouser --query "name"
```

## Agent tool

Nombre de la herramienta: `zalouser`

Acciones: `send`, `image`, `link`, `friends`, `groups`, `me`, `status`
