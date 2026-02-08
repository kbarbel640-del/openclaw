---
summary: "Resumen de emparejamiento: aprobar quién puede enviarle mensajes directos + qué nodos pueden unirse"
read_when:
  - Configurar el control de acceso a Mensajes directos
  - Emparejar un nuevo nodo iOS/Android
  - Revisar la postura de seguridad de OpenClaw
title: "Emparejamiento"
x-i18n:
  source_path: channels/pairing.md
  source_hash: cc6ce9c71db6d96d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:25Z
---

# Emparejamiento

“El **emparejamiento**” es el paso explícito de **aprobación del propietario** de OpenClaw.
Se utiliza en dos lugares:

1. **Emparejamiento de Mensajes directos** (quién tiene permitido hablar con el bot)
2. **Emparejamiento de nodos** (qué dispositivos/nodos pueden unirse a la red del Gateway)

Contexto de seguridad: [Security](/gateway/security)

## 1) Emparejamiento de Mensajes directos (acceso de chat entrante)

Cuando un canal se configura con la política de Mensajes directos `pairing`, los remitentes desconocidos reciben un código corto y su mensaje **no se procesa** hasta que usted lo apruebe.

Las políticas predeterminadas de Mensajes directos están documentadas en: [Security](/gateway/security)

Códigos de emparejamiento:

- 8 caracteres, en mayúsculas, sin caracteres ambiguos (`0O1I`).
- **Expiran después de 1 hora**. El bot solo envía el mensaje de emparejamiento cuando se crea una nueva solicitud (aproximadamente una vez por hora por remitente).
- Las solicitudes de emparejamiento de Mensajes directos pendientes están limitadas a **3 por canal** de forma predeterminada; las solicitudes adicionales se ignoran hasta que una expire o sea aprobada.

### Aprobar a un remitente

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

Canales compatibles: `telegram`, `whatsapp`, `signal`, `imessage`, `discord`, `slack`.

### Dónde vive el estado

Almacenado en `~/.openclaw/credentials/`:

- Solicitudes pendientes: `<channel>-pairing.json`
- Almacén de lista de permitidos aprobados: `<channel>-allowFrom.json`

Trate estos datos como sensibles (controlan el acceso a su asistente).

## 2) Emparejamiento de dispositivos de nodo (nodos iOS/Android/macOS/headless)

Los nodos se conectan al Gateway como **dispositivos** con `role: node`. El Gateway
crea una solicitud de emparejamiento de dispositivo que debe ser aprobada.

### Aprobar un dispositivo de nodo

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

### Almacenamiento del estado de emparejamiento de nodos

Almacenado en `~/.openclaw/devices/`:

- `pending.json` (de corta duración; las solicitudes pendientes expiran)
- `paired.json` (dispositivos emparejados + tokens)

### Notas

- La API heredada `node.pair.*` (CLI: `openclaw nodes pending/approve`) es un
  almacén de emparejamiento separado y propiedad del Gateway. Los nodos WS aún requieren emparejamiento de dispositivos.

## Documentos relacionados

- Modelo de seguridad + inyección de prompts: [Security](/gateway/security)
- Actualización segura (ejecutar doctor): [Updating](/install/updating)
- Configuraciones de canales:
  - Telegram: [Telegram](/channels/telegram)
  - WhatsApp: [WhatsApp](/channels/whatsapp)
  - Signal: [Signal](/channels/signal)
  - BlueBubbles (iMessage): [BlueBubbles](/channels/bluebubbles)
  - iMessage (heredado): [iMessage](/channels/imessage)
  - Discord: [Discord](/channels/discord)
  - Slack: [Slack](/channels/slack)
