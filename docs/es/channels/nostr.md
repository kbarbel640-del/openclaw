---
summary: "Canal de Mensajes directos de Nostr mediante mensajes cifrados NIP-04"
read_when:
  - Quiere que OpenClaw reciba Mensajes directos mediante Nostr
  - Está configurando mensajería descentralizada
title: "Nostr"
x-i18n:
  source_path: channels/nostr.md
  source_hash: 6b9fe4c74bf5e7c0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:05Z
---

# Nostr

**Estado:** Plugin opcional (deshabilitado de forma predeterminada).

Nostr es un protocolo descentralizado para redes sociales. Este canal permite que OpenClaw reciba y responda a Mensajes directos (DMs) cifrados mediante NIP-04.

## Instalacion (bajo demanda)

### Incorporacion (recomendado)

- El asistente de incorporacion (`openclaw onboard`) y `openclaw channels add` enumeran plugins de canales opcionales.
- Al seleccionar Nostr, se le solicita instalar el plugin bajo demanda.

Valores predeterminados de instalacion:

- **Canal Dev + git checkout disponible:** usa la ruta local del plugin.
- **Stable/Beta:** descarga desde npm.

Siempre puede anular la eleccion en el aviso.

### Instalacion manual

```bash
openclaw plugins install @openclaw/nostr
```

Use un checkout local (flujos de trabajo de desarrollo):

```bash
openclaw plugins install --link <path-to-openclaw>/extensions/nostr
```

Reinicie el Gateway despues de instalar o habilitar plugins.

## Configuracion rapida

1. Genere un par de claves de Nostr (si es necesario):

```bash
# Using nak
nak key generate
```

2. Agregue a la configuracion:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}"
    }
  }
}
```

3. Exporte la clave:

```bash
export NOSTR_PRIVATE_KEY="nsec1..."
```

4. Reinicie el Gateway.

## Referencia de configuracion

| Clave        | Tipo     | Predeterminado                              | Descripcion                           |
| ------------ | -------- | ------------------------------------------- | ------------------------------------- |
| `privateKey` | string   | requerido                                   | Clave privada en formato `nsec` o hex |
| `relays`     | string[] | `['wss://relay.damus.io', 'wss://nos.lol']` | URLs de relay (WebSocket)             |
| `dmPolicy`   | string   | `pairing`                                   | Politica de acceso a DM               |
| `allowFrom`  | string[] | `[]`                                        | Pubkeys de remitentes permitidos      |
| `enabled`    | boolean  | `true`                                      | Habilitar/deshabilitar canal          |
| `name`       | string   | -                                           | Nombre para mostrar                   |
| `profile`    | object   | -                                           | Metadatos de perfil NIP-01            |

## Metadatos de perfil

Los datos del perfil se publican como un evento `kind:0` de NIP-01. Puede gestionarlos desde la UI de Control (Canales -> Nostr -> Perfil) o configurarlos directamente en la configuracion.

Ejemplo:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "profile": {
        "name": "openclaw",
        "displayName": "OpenClaw",
        "about": "Personal assistant DM bot",
        "picture": "https://example.com/avatar.png",
        "banner": "https://example.com/banner.png",
        "website": "https://example.com",
        "nip05": "openclaw@example.com",
        "lud16": "openclaw@example.com"
      }
    }
  }
}
```

Notas:

- Las URLs del perfil deben usar `https://`.
- La importacion desde relays combina campos y conserva las anulaciones locales.

## Control de acceso

### Politicas de DM

- **pairing** (predeterminado): los remitentes desconocidos reciben un codigo de emparejamiento.
- **allowlist**: solo los pubkeys en `allowFrom` pueden enviar DM.
- **open**: DMs entrantes publicos (requiere `allowFrom: ["*"]`).
- **disabled**: ignora los DMs entrantes.

### Ejemplo de allowlist

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "dmPolicy": "allowlist",
      "allowFrom": ["npub1abc...", "npub1xyz..."]
    }
  }
}
```

## Formatos de clave

Formatos aceptados:

- **Clave privada:** `nsec...` o hex de 64 caracteres
- **Pubkeys (`allowFrom`):** `npub...` o hex

## Relays

Predeterminados: `relay.damus.io` y `nos.lol`.

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nostr.wine"]
    }
  }
}
```

Consejos:

- Use 2-3 relays para redundancia.
- Evite demasiados relays (latencia, duplicacion).
- Los relays de pago pueden mejorar la confiabilidad.
- Los relays locales son adecuados para pruebas (`ws://localhost:7777`).

## Soporte de protocolo

| NIP    | Estado      | Descripcion                                     |
| ------ | ----------- | ----------------------------------------------- |
| NIP-01 | Compatible  | Formato basico de eventos + metadatos de perfil |
| NIP-04 | Compatible  | DMs cifrados (`kind:4`)                         |
| NIP-17 | Planificado | DMs con envoltura de regalo                     |
| NIP-44 | Planificado | Cifrado versionado                              |

## Pruebas

### Relay local

```bash
# Start strfry
docker run -p 7777:7777 ghcr.io/hoytech/strfry
```

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["ws://localhost:7777"]
    }
  }
}
```

### Prueba manual

1. Anote el pubkey del bot (npub) desde los registros.
2. Abra un cliente de Nostr (Damus, Amethyst, etc.).
3. Envie un DM al pubkey del bot.
4. Verifique la respuesta.

## Solucion de problemas

### No se reciben mensajes

- Verifique que la clave privada sea valida.
- Asegurese de que las URLs de relay sean accesibles y usen `wss://` (o `ws://` para local).
- Confirme que `enabled` no sea `false`.
- Revise los registros del Gateway para errores de conexion a relays.

### No se envian respuestas

- Verifique que el relay acepte escrituras.
- Verifique la conectividad de salida.
- Observe los limites de tasa del relay.

### Respuestas duplicadas

- Es esperado al usar multiples relays.
- Los mensajes se deduplican por ID de evento; solo la primera entrega activa una respuesta.

## Seguridad

- Nunca haga commit de claves privadas.
- Use variables de entorno para las claves.
- Considere `allowlist` para bots en produccion.

## Limitaciones (MVP)

- Solo mensajes directos (sin chats grupales).
- Sin adjuntos multimedia.
- Solo NIP-04 (NIP-17 con envoltura de regalo planificado).
