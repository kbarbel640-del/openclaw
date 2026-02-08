---
summary: "Capacidades de OpenClaw a traves de canales, enrutamiento, medios y experiencia de usuario."
read_when:
  - Quiere una lista completa de lo que OpenClaw admite
title: "Caracteristicas"
x-i18n:
  source_path: concepts/features.md
  source_hash: 1b6aee0bfda75182
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:32Z
---

## Highlights

<Columns>
  <Card title="Channels" icon="message-square">
    WhatsApp, Telegram, Discord e iMessage con un solo Gateway.
  </Card>
  <Card title="Plugins" icon="plug">
    Agregue Mattermost y mas con extensiones.
  </Card>
  <Card title="Routing" icon="route">
    Enrutamiento multi-agente con sesiones aisladas.
  </Card>
  <Card title="Media" icon="image">
    Imagenes, audio y documentos de entrada y salida.
  </Card>
  <Card title="Apps and UI" icon="monitor">
    Interfaz de control web y aplicacion complementaria para macOS.
  </Card>
  <Card title="Mobile nodes" icon="smartphone">
    Nodos iOS y Android con soporte de Canvas.
  </Card>
</Columns>

## Full list

- Integracion con WhatsApp via WhatsApp Web (Baileys)
- Soporte de bots de Telegram (grammY)
- Soporte de bots de Discord (channels.discord.js)
- Soporte de bots de Mattermost (plugin)
- Integracion con iMessage via imsg CLI local (macOS)
- Puente de agente para Pi en modo RPC con tool streaming
- Streaming y fragmentacion para respuestas largas
- Enrutamiento multi-agente para sesiones aisladas por espacio de trabajo o remitente
- Autenticacion por suscripcion para Anthropic y OpenAI via OAuth
- Sesiones: los chats directos se consolidan en `main`; los grupos estan aislados
- Soporte de chats grupales con activacion basada en menciones
- Soporte de medios para imagenes, audio y documentos
- Gancho opcional de transcripcion de notas de voz
- WebChat y aplicacion de barra de menu para macOS
- Nodo iOS con emparejamiento y superficie Canvas
- Nodo Android con emparejamiento, Canvas, chat y camara

<Note>
Se han eliminado las rutas heredadas de Claude, Codex, Gemini y Opencode. Pi es la unica
ruta de agente de codigo.
</Note>
