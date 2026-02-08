---
summary: "Referencia de la CLI para `openclaw browser` (perfiles, pestañas, acciones, retransmisión de extensiones)"
read_when:
  - Usted usa `openclaw browser` y quiere ejemplos para tareas comunes
  - Usted quiere controlar un navegador que se ejecuta en otra máquina mediante un host de nodo
  - Usted quiere usar la retransmisión de la extensión de Chrome (adjuntar/separar mediante el botón de la barra de herramientas)
title: "navegador"
x-i18n:
  source_path: cli/browser.md
  source_hash: af35adfd68726fd5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:10Z
---

# `openclaw browser`

Administre el servidor de control del navegador de OpenClaw y ejecute acciones del navegador (pestañas, instantáneas, capturas de pantalla, navegación, clics, escritura).

Relacionado:

- Herramienta de navegador + API: [Browser tool](/tools/browser)
- Retransmisión de la extensión de Chrome: [Chrome extension](/tools/chrome-extension)

## Indicadores comunes

- `--url <gatewayWsUrl>`: URL de WebSocket del Gateway (usa la configuración por defecto).
- `--token <token>`: token del Gateway (si es requerido).
- `--timeout <ms>`: tiempo de espera de la solicitud (ms).
- `--browser-profile <name>`: elegir un perfil de navegador (por defecto desde la configuración).
- `--json`: salida legible por máquinas (donde sea compatible).

## Inicio rapido (local)

```bash
openclaw browser --browser-profile chrome tabs
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

## Perfiles

Los perfiles son configuraciones de enrutamiento de navegador con nombre. En la práctica:

- `openclaw`: inicia/se adjunta a una instancia de Chrome dedicada y administrada por OpenClaw (directorio de datos de usuario aislado).
- `chrome`: controla sus pestañas existentes de Chrome mediante la retransmisión de la extensión de Chrome.

```bash
openclaw browser profiles
openclaw browser create-profile --name work --color "#FF5A36"
openclaw browser delete-profile --name work
```

Use un perfil específico:

```bash
openclaw browser --browser-profile work tabs
```

## Pestañas

```bash
openclaw browser tabs
openclaw browser open https://docs.openclaw.ai
openclaw browser focus <targetId>
openclaw browser close <targetId>
```

## Instantánea / captura de pantalla / acciones

Instantánea:

```bash
openclaw browser snapshot
```

Captura de pantalla:

```bash
openclaw browser screenshot
```

Navegar/hacer clic/escribir (automatización de UI basada en referencias):

```bash
openclaw browser navigate https://example.com
openclaw browser click <ref>
openclaw browser type <ref> "hello"
```

## Retransmisión de la extensión de Chrome (adjuntar mediante el botón de la barra de herramientas)

Este modo permite que el agente controle una pestaña existente de Chrome que usted adjunta manualmente (no se adjunta automáticamente).

Instale la extensión desempaquetada en una ruta estable:

```bash
openclaw browser extension install
openclaw browser extension path
```

Luego Chrome → `chrome://extensions` → habilite “Developer mode” → “Load unpacked” → seleccione la carpeta impresa.

Guía completa: [Chrome extension](/tools/chrome-extension)

## Control remoto del navegador (proxy de host de nodo)

Si el Gateway se ejecuta en una máquina diferente a la del navegador, ejecute un **host de nodo** en la máquina que tenga Chrome/Brave/Edge/Chromium. El Gateway enviará por proxy las acciones del navegador a ese nodo (no se requiere un servidor de control del navegador separado).

Use `gateway.nodes.browser.mode` para controlar el enrutamiento automático y `gateway.nodes.browser.node` para fijar un nodo específico si hay varios conectados.

Seguridad + configuración remota: [Browser tool](/tools/browser), [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale), [Security](/gateway/security)
