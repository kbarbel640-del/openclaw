---
summary: "Resumen de emparejamiento: aprobar quién puede enviarle Mensajes directos + qué nodos pueden unirse"
read_when:
  - Configurar el control de acceso a Mensajes directos
  - Emparejar un nuevo nodo iOS/Android
  - Revisar la postura de seguridad de OpenClaw
title: "Emparejamiento"
x-i18n:
  source_path: start/pairing.md
  source_hash: 5a0539932f905536
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:00Z
---

# Emparejamiento

“El emparejamiento” es el paso explícito de **aprobación del propietario** de OpenClaw.
Se utiliza en dos lugares:

1. **Emparejamiento de Mensajes directos** (quién tiene permitido hablar con el bot)
2. **Emparejamiento de nodos** (qué dispositivos/nodos tienen permitido unirse a la red del Gateway)

Contexto de seguridad: [Security](/gateway/security)

## 1) Emparejamiento de Mensajes directos (acceso de chat entrante)

Cuando un canal está configurado con la política de Mensajes directos `pairing`, los remitentes desconocidos reciben un código corto y su mensaje **no se procesa** hasta que usted lo apruebe.

Las políticas predeterminadas de Mensajes directos están documentadas en: [Security](/gateway/security)

Códigos de emparejamiento:

- 8 caracteres, en mayúsculas, sin caracteres ambiguos (`0O1I`).
- **Expiran después de 1 hora**. El bot solo envía el mensaje de emparejamiento cuando se crea una nueva solicitud (aproximadamente una vez por hora por remitente).
- Las solicitudes pendientes de emparejamiento de Mensajes directos están limitadas a **3 por canal** de forma predeterminada; las solicitudes adicionales se ignoran hasta que una expire o sea aprobada.

### Aprobar a un remitente

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

Canales compatibles: `telegram`, `whatsapp`, `signal`, `imessage`, `discord`, `slack`.

### Dónde vive el estado

Almacenado en `~/.openclaw/credentials/`:

- Solicitudes pendientes: `<channel>-pairing.json`
- Almacén de la lista de permitidos aprobados: `<channel>-allowFrom.json`

Trátelos como sensibles (controlan el acceso a su asistente).

## 2) Emparejamiento de dispositivos nodo (nodos iOS/Android/macOS/sin interfaz)

Los nodos se conectan al Gateway como **dispositivos** con `role: node`. El Gateway
crea una solicitud de emparejamiento de dispositivo que debe ser aprobada.

### Aprobar un dispositivo nodo

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

### Dónde vive el estado

Almacenado en `~/.openclaw/devices/`:

- `pending.json` (de corta duración; las solicitudes pendientes expiran)
- `paired.json` (dispositivos emparejados + tokens)

### Notas

- La API heredada `node.pair.*` (CLI: `openclaw nodes pending/approve`) es un
  almacén de emparejamiento independiente propiedad del Gateway. Los nodos WS aún requieren emparejamiento de dispositivo.

## Documentos relacionados

- Modelo de seguridad + inyección de prompts: [Security](/gateway/security)
- Actualizar de forma segura (ejecutar doctor): [Updating](/install/updating)
- Configuraciones de canales:
  - Telegram: [Telegram](/channels/telegram)
  - WhatsApp: [WhatsApp](/channels/whatsapp)
  - Signal: [Signal](/channels/signal)
  - BlueBubbles (iMessage): [BlueBubbles](/channels/bluebubbles)
  - iMessage (heredado): [iMessage](/channels/imessage)
  - Discord: [Discord](/channels/discord)
  - Slack: [Slack](/channels/slack)
