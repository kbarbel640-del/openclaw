---
summary: "OpenClaw es un gateway multicanal para agentes de IA que se ejecuta en cualquier sistema operativo."
read_when:
  - Presentar OpenClaw a personas nuevas
title: "OpenClaw"
x-i18n:
  source_path: index.md
  source_hash: 97a613c67efb448b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:09Z
---

# OpenClaw 🦞

<p align="center">
    <img
        src="/assets/openclaw-logo-text-dark.png"
        alt="OpenClaw"
        width="500"
        class="dark:hidden"
    />
    <img
        src="/assets/openclaw-logo-text.png"
        alt="OpenClaw"
        width="500"
        class="hidden dark:block"
    />
</p>

> _"¡EXFOLIAR! ¡EXFOLIAR!"_ — Una langosta espacial, probablemente

<p align="center">
  <strong>Gateway para agentes de IA en cualquier sistema operativo a través de WhatsApp, Telegram, Discord, iMessage y más.</strong><br />
  Envíe un mensaje y reciba la respuesta de un agente desde su bolsillo. Los plugins agregan Mattermost y más.
</p>

<Columns>
  <Card title="Primeros Pasos" href="/start/getting-started" icon="rocket">
    Instale OpenClaw y levante el Gateway en minutos.
  </Card>
  <Card title="Ejecutar el asistente" href="/start/wizard" icon="sparkles">
    Configuración guiada con `openclaw onboard` y flujos de emparejamiento.
  </Card>
  <Card title="Abrir la interfaz de control" href="/web/control-ui" icon="layout-dashboard">
    Inicie el panel del navegador para chat, configuracion y sesiones.
  </Card>
</Columns>

## ¿Qué es OpenClaw?

OpenClaw es un **gateway autoalojado** que conecta sus aplicaciones de chat favoritas — WhatsApp, Telegram, Discord, iMessage y más — con agentes de codificación de IA como Pi. Usted ejecuta un único proceso del Gateway en su propia máquina (o en un servidor), y este se convierte en el puente entre sus aplicaciones de mensajería y un asistente de IA siempre disponible.

**¿Para quién es?** Desarrolladores y usuarios avanzados que desean un asistente personal de IA al que puedan escribir desde cualquier lugar, sin renunciar al control de sus datos ni depender de un servicio alojado.

**¿Qué lo hace diferente?**

- **Autoalojado**: se ejecuta en su hardware, bajo sus reglas
- **Multicanal**: un Gateway atiende WhatsApp, Telegram, Discord y más de forma simultánea
- **Nativo para agentes**: diseñado para agentes de codificación con uso de herramientas, sesiones, memoria y enrutamiento multiagente
- **Código abierto**: con licencia MIT e impulsado por la comunidad

**¿Qué necesita?** Node 22+, una clave de API (se recomienda Anthropic) y 5 minutos.

## Cómo funciona

```mermaid
flowchart LR
  A["Chat apps + plugins"] --> B["Gateway"]
  B --> C["Pi agent"]
  B --> D["CLI"]
  B --> E["Web Control UI"]
  B --> F["macOS app"]
  B --> G["iOS and Android nodes"]
```

El Gateway es la única fuente de verdad para sesiones, enrutamiento y conexiones de canales.

## Capacidades clave

<Columns>
  <Card title="Gateway multicanal" icon="network">
    WhatsApp, Telegram, Discord e iMessage con un solo proceso del Gateway.
  </Card>
  <Card title="Canales mediante plugins" icon="plug">
    Agregue Mattermost y más con paquetes de extensión.
  </Card>
  <Card title="Enrutamiento multiagente" icon="route">
    Sesiones aisladas por agente, espacio de trabajo o remitente.
  </Card>
  <Card title="Soporte multimedia" icon="image">
    Envíe y reciba imágenes, audio y documentos.
  </Card>
  <Card title="Interfaz web de control" icon="monitor">
    Panel del navegador para chat, configuracion, sesiones y nodos.
  </Card>
  <Card title="Nodos móviles" icon="smartphone">
    Empareje nodos iOS y Android con soporte de Canvas.
  </Card>
</Columns>

## Inicio rapido

<Steps>
  <Step title="Instalar OpenClaw">
    ```bash
    npm install -g openclaw@latest
    ```
  </Step>
  <Step title="Incorporarse e instalar el servicio">
    ```bash
    openclaw onboard --install-daemon
    ```
  </Step>
  <Step title="Emparejar WhatsApp e iniciar el Gateway">
    ```bash
    openclaw channels login
    openclaw gateway --port 18789
    ```
  </Step>
</Steps>

¿Necesita la instalación completa y la configuracion de desarrollo? Consulte [Inicio rapido](/start/quickstart).

## Panel

Abra la interfaz de control en el navegador después de que el Gateway se inicie.

- Predeterminado local: http://127.0.0.1:18789/
- Acceso remoto: [Superficies web](/web) y [Tailscale](/gateway/tailscale)

<p align="center">
  <img src="whatsapp-openclaw.jpg" alt="OpenClaw" width="420" />
</p>

## Configuracion (opcional)

La configuracion se encuentra en `~/.openclaw/openclaw.json`.

- Si **no hace nada**, OpenClaw usa el binario de Pi incluido en modo RPC con sesiones por remitente.
- Si desea restringirlo, comience con `channels.whatsapp.allowFrom` y (para grupos) reglas de menciones.

Ejemplo:

```json5
{
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
  messages: { groupChat: { mentionPatterns: ["@openclaw"] } },
}
```

## Comience aquí

<Columns>
  <Card title="Centros de documentacion" href="/start/hubs" icon="book-open">
    Toda la documentacion y guías, organizadas por caso de uso.
  </Card>
  <Card title="Configuracion" href="/gateway/configuration" icon="settings">
    Configuracion central del Gateway, tokens y configuracion de proveedores.
  </Card>
  <Card title="Acceso remoto" href="/gateway/remote" icon="globe">
    Patrones de acceso por SSH y tailnet.
  </Card>
  <Card title="Canales" href="/channels/telegram" icon="message-square">
    Configuracion específica de canales para WhatsApp, Telegram, Discord y más.
  </Card>
  <Card title="Nodos" href="/nodes" icon="smartphone">
    Nodos iOS y Android con emparejamiento y Canvas.
  </Card>
  <Card title="Ayuda" href="/help" icon="life-buoy">
    Correcciones comunes y punto de entrada para solucion de problemas.
  </Card>
</Columns>

## Aprenda más

<Columns>
  <Card title="Lista completa de caracteristicas" href="/concepts/features" icon="list">
    Capacidades completas de canales, enrutamiento y multimedia.
  </Card>
  <Card title="Enrutamiento multiagente" href="/concepts/multi-agent" icon="route">
    Aislamiento de espacios de trabajo y sesiones por agente.
  </Card>
  <Card title="Seguridad" href="/gateway/security" icon="shield">
    Tokens, listas de permitidos y controles de seguridad.
  </Card>
  <Card title="Solucion de problemas" href="/gateway/troubleshooting" icon="wrench">
    Diagnósticos del Gateway y errores comunes.
  </Card>
  <Card title="Acerca de y creditos" href="/reference/credits" icon="info">
    Orígenes del proyecto, colaboradores y licencia.
  </Card>
</Columns>
