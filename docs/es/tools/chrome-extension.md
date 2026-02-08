---
summary: "Extensión de Chrome: permita que OpenClaw controle su pestaña existente de Chrome"
read_when:
  - Quiere que el agente controle una pestaña existente de Chrome (botón de la barra de herramientas)
  - Necesita Gateway remoto + automatización del navegador local vía Tailscale
  - Quiere comprender las implicaciones de seguridad de la toma de control del navegador
title: "Extensión de Chrome"
x-i18n:
  source_path: tools/chrome-extension.md
  source_hash: 3b77bdad7d3dab6a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:17Z
---

# Extensión de Chrome (relevo del navegador)

La extensión de Chrome de OpenClaw permite que el agente controle sus **pestañas existentes de Chrome** (su ventana normal de Chrome) en lugar de iniciar un perfil de Chrome separado administrado por OpenClaw.

La conexión/desconexión se realiza mediante **un solo botón en la barra de herramientas de Chrome**.

## Qué es (concepto)

Hay tres partes:

- **Servicio de control del navegador** (Gateway o nodo): la API que llama el agente/herramienta (vía el Gateway)
- **Servidor de relevo local** (CDP en local loopback): crea el puente entre el servidor de control y la extensión (`http://127.0.0.1:18792` por defecto)
- **Extensión Chrome MV3**: se adjunta a la pestaña activa usando `chrome.debugger` y canaliza mensajes CDP hacia el relevo

Luego OpenClaw controla la pestaña adjunta a través de la superficie normal de la herramienta `browser` (seleccionando el perfil correcto).

## Instalar / cargar (sin empaquetar)

1. Instale la extensión en una ruta local estable:

```bash
openclaw browser extension install
```

2. Imprima la ruta del directorio de la extensión instalada:

```bash
openclaw browser extension path
```

3. Chrome → `chrome://extensions`

- Habilite “Modo de desarrollador”
- “Cargar sin empaquetar” → seleccione el directorio impreso arriba

4. Fije la extensión.

## Actualizaciones (sin paso de compilación)

La extensión se distribuye dentro de la versión de OpenClaw (paquete npm) como archivos estáticos. No hay un paso de “compilación” separado.

Después de actualizar OpenClaw:

- Vuelva a ejecutar `openclaw browser extension install` para actualizar los archivos instalados bajo su directorio de estado de OpenClaw.
- Chrome → `chrome://extensions` → haga clic en “Recargar” en la extensión.

## Uso (sin configuración adicional)

OpenClaw incluye un perfil de navegador integrado llamado `chrome` que apunta al relevo de la extensión en el puerto predeterminado.

Úselo:

- CLI: `openclaw browser --browser-profile chrome tabs`
- Herramienta del agente: `browser` con `profile="chrome"`

Si desea un nombre diferente o un puerto de relevo distinto, cree su propio perfil:

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

## Adjuntar / separar (botón de la barra de herramientas)

- Abra la pestaña que quiere que OpenClaw controle.
- Haga clic en el icono de la extensión.
  - La insignia muestra `ON` cuando está adjunta.
- Haga clic nuevamente para separar.

## ¿Qué pestaña controla?

- **No** controla automáticamente “la pestaña que esté viendo”.
- Controla **solo la(s) pestaña(s) que usted adjuntó explícitamente** haciendo clic en el botón de la barra de herramientas.
- Para cambiar: abra la otra pestaña y haga clic en el icono de la extensión allí.

## Insignia + errores comunes

- `ON`: adjunta; OpenClaw puede controlar esa pestaña.
- `…`: conectándose al relevo local.
- `!`: el relevo no es accesible (lo más común: el servidor de relevo del navegador no se está ejecutando en esta máquina).

Si ve `!`:

- Asegúrese de que el Gateway se esté ejecutando localmente (configuración predeterminada), o ejecute un host de nodo en esta máquina si el Gateway se ejecuta en otro lugar.
- Abra la página de Opciones de la extensión; muestra si el relevo es accesible.

## Gateway remoto (use un host de nodo)

### Gateway local (misma máquina que Chrome) — generalmente **sin pasos adicionales**

Si el Gateway se ejecuta en la misma máquina que Chrome, inicia el servicio de control del navegador en loopback
y arranca automáticamente el servidor de relevo. La extensión se comunica con el relevo local; las llamadas de la CLI/herramienta van al Gateway.

### Gateway remoto (el Gateway se ejecuta en otro lugar) — **ejecute un host de nodo**

Si su Gateway se ejecuta en otra máquina, inicie un host de nodo en la máquina que ejecuta Chrome.
El Gateway enviará las acciones del navegador a ese nodo; la extensión + el relevo permanecen locales a la máquina del navegador.

Si hay varios nodos conectados, fije uno con `gateway.nodes.browser.node` o establezca `gateway.nodes.browser.mode`.

## Sandboxing (contenedores de herramientas)

Si su sesión de agente está en sandbox (`agents.defaults.sandbox.mode != "off"`), la herramienta `browser` puede estar restringida:

- Por defecto, las sesiones en sandbox a menudo apuntan al **navegador de sandbox** (`target="sandbox"`), no a su Chrome del host.
- La toma de control mediante el relevo de la extensión de Chrome requiere controlar el servidor de control del navegador del **host**.

Opciones:

- Lo más fácil: use la extensión desde una sesión/agente **no en sandbox**.
- O permita el control del navegador del host para sesiones en sandbox:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

Luego asegúrese de que la herramienta no esté denegada por la política de herramientas y, si es necesario, llame a `browser` con `target="host"`.

Depuración: `openclaw sandbox explain`

## Consejos de acceso remoto

- Mantenga el Gateway y el host de nodo en el mismo tailnet; evite exponer puertos de relevo a la LAN o a Internet público.
- Empareje nodos de forma intencional; deshabilite el enrutamiento proxy del navegador si no desea control remoto (`gateway.nodes.browser.mode="off"`).

## Cómo funciona la “ruta de la extensión”

`openclaw browser extension path` imprime el directorio **instalado** en disco que contiene los archivos de la extensión.

La CLI intencionalmente **no** imprime una ruta `node_modules`. Siempre ejecute `openclaw browser extension install` primero para copiar la extensión a una ubicación estable bajo su directorio de estado de OpenClaw.

Si mueve o elimina ese directorio de instalación, Chrome marcará la extensión como dañada hasta que la recargue desde una ruta válida.

## Implicaciones de seguridad (léalo)

Esto es potente y arriesgado. Trátelo como si le diera al modelo “manos en su navegador”.

- La extensión usa la API de depuración de Chrome (`chrome.debugger`). Cuando está adjunta, el modelo puede:
  - hacer clic/escribir/navegar en esa pestaña
  - leer el contenido de la página
  - acceder a todo lo que pueda acceder la sesión iniciada de esa pestaña
- **Esto no está aislado** como el perfil dedicado administrado por OpenClaw.
  - Si se adjunta a su perfil/pestaña de uso diario, está concediendo acceso a ese estado de cuenta.

Recomendaciones:

- Prefiera un perfil de Chrome dedicado (separado de su navegación personal) para el uso del relevo de la extensión.
- Mantenga el Gateway y cualquier host de nodo solo dentro del tailnet; confíe en la autenticación del Gateway + el emparejamiento de nodos.
- Evite exponer puertos de relevo en la LAN (`0.0.0.0`) y evite Funnel (público).
- El relevo bloquea orígenes que no sean la extensión y requiere un token de autenticación interno para los clientes CDP.

Relacionado:

- Descripción general de la herramienta de navegador: [Browser](/tools/browser)
- Auditoría de seguridad: [Security](/gateway/security)
- Configuración de Tailscale: [Tailscale](/gateway/tailscale)
