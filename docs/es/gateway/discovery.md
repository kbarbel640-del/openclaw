---
summary: "Descubrimiento de nodos y transportes (Bonjour, Tailscale, SSH) para encontrar el gateway"
read_when:
  - Implementando o cambiando el descubrimiento/anuncio por Bonjour
  - Ajustando los modos de conexion remota (directo vs SSH)
  - Disenando el descubrimiento de nodos + emparejamiento para nodos remotos
title: "Descubrimiento y Transportes"
x-i18n:
  source_path: gateway/discovery.md
  source_hash: e12172c181515bfa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:58Z
---

# Descubrimiento y transportes

OpenClaw tiene dos problemas distintos que se ven similares en la superficie:

1. **Control remoto del operador**: la app de barra de menu de macOS controlando un gateway que se ejecuta en otro lugar.
2. **Emparejamiento de nodos**: iOS/Android (y nodos futuros) encontrando un gateway y emparejandose de forma segura.

El objetivo de diseno es mantener todo el descubrimiento/anuncio de red en el **Node Gateway** (`openclaw gateway`) y mantener a los clientes (app de mac, iOS) como consumidores.

## Terminos

- **Gateway**: un unico proceso de gateway de larga duracion que posee el estado (sesiones, emparejamiento, registro de nodos) y ejecuta canales. La mayoria de las configuraciones usan uno por host; son posibles configuraciones aisladas con multiples gateways.
- **Gateway WS (plano de control)**: el endpoint WebSocket en `127.0.0.1:18789` por defecto; puede vincularse a LAN/tailnet mediante `gateway.bind`.
- **Transporte WS directo**: un endpoint Gateway WS orientado a LAN/tailnet (sin SSH).
- **Transporte SSH (respaldo)**: control remoto reenviando `127.0.0.1:18789` a traves de SSH.
- **Puente TCP heredado (obsoleto/eliminado)**: transporte de nodos mas antiguo (ver [Protocolo Bridge](/gateway/bridge-protocol)); ya no se anuncia para descubrimiento.

Detalles de protocolo:

- [Protocolo Gateway](/gateway/protocol)
- [Protocolo Bridge (heredado)](/gateway/bridge-protocol)

## Por que mantenemos tanto “directo” como SSH

- **WS directo** ofrece la mejor UX en la misma red y dentro de una tailnet:
  - auto-descubrimiento en LAN mediante Bonjour
  - tokens de emparejamiento + ACLs gestionados por el gateway
  - no requiere acceso a shell; la superficie del protocolo puede mantenerse ajustada y auditable
- **SSH** sigue siendo el respaldo universal:
  - funciona en cualquier lugar donde tenga acceso SSH (incluso a traves de redes no relacionadas)
  - sobrevive a problemas de multicast/mDNS
  - no requiere nuevos puertos de entrada mas alla de SSH

## Entradas de descubrimiento (como los clientes aprenden donde esta el gateway)

### 1) Bonjour / mDNS (solo LAN)

Bonjour es de mejor esfuerzo y no cruza redes. Solo se utiliza para conveniencia en la “misma LAN”.

Direccion objetivo:

- El **gateway** anuncia su endpoint WS mediante Bonjour.
- Los clientes exploran y muestran una lista de “elegir un gateway”, luego almacenan el endpoint elegido.

Solucion de problemas y detalles de beacon: [Bonjour](/gateway/bonjour).

#### Detalles del beacon de servicio

- Tipos de servicio:
  - `_openclaw-gw._tcp` (beacon de transporte del gateway)
- Claves TXT (no secretas):
  - `role=gateway`
  - `lanHost=<hostname>.local`
  - `sshPort=22` (o lo que se anuncie)
  - `gatewayPort=18789` (Gateway WS + HTTP)
  - `gatewayTls=1` (solo cuando TLS esta habilitado)
  - `gatewayTlsSha256=<sha256>` (solo cuando TLS esta habilitado y el fingerprint esta disponible)
  - `canvasPort=18793` (puerto por defecto del host de canvas; sirve `/__openclaw__/canvas/`)
  - `cliPath=<path>` (opcional; ruta absoluta a un entrypoint o binario ejecutable de `openclaw`)
  - `tailnetDns=<magicdns>` (pista opcional; se detecta automaticamente cuando Tailscale esta disponible)

Deshabilitar/anular:

- `OPENCLAW_DISABLE_BONJOUR=1` deshabilita el anuncio.
- `gateway.bind` en `~/.openclaw/openclaw.json` controla el modo de enlace del Gateway.
- `OPENCLAW_SSH_PORT` anula el puerto SSH anunciado en TXT (por defecto 22).
- `OPENCLAW_TAILNET_DNS` publica una pista de `tailnetDns` (MagicDNS).
- `OPENCLAW_CLI_PATH` anula la ruta de CLI anunciada.

### 2) Tailnet (entre redes)

Para configuraciones estilo Londres/Viena, Bonjour no ayudara. El destino “directo” recomendado es:

- Nombre MagicDNS de Tailscale (preferido) o una IP estable de tailnet.

Si el gateway puede detectar que se esta ejecutando bajo Tailscale, publica `tailnetDns` como una pista opcional para los clientes (incluyendo beacons de area amplia).

### 3) Destino manual / SSH

Cuando no hay una ruta directa (o el directo esta deshabilitado), los clientes siempre pueden conectarse mediante SSH reenviando el puerto de gateway de loopback local.

Ver [Acceso remoto](/gateway/remote).

## Seleccion de transporte (politica del cliente)

Comportamiento recomendado del cliente:

1. Si hay un endpoint directo emparejado configurado y accesible, usarlo.
2. De lo contrario, si Bonjour encuentra un gateway en la LAN, ofrecer una opcion de “Usar este gateway” con un toque y guardarlo como el endpoint directo.
3. De lo contrario, si hay un DNS/IP de tailnet configurado, intentar directo.
4. De lo contrario, recurrir a SSH.

## Emparejamiento + autenticacion (transporte directo)

El gateway es la fuente de verdad para la admision de nodos/clientes.

- Las solicitudes de emparejamiento se crean/aprueban/rechazan en el gateway (ver [Emparejamiento del Gateway](/gateway/pairing)).
- El gateway aplica:
  - autenticacion (token / par de claves)
  - alcances/ACLs (el gateway no es un proxy sin procesar a cada metodo)
  - limites de tasa

## Responsabilidades por componente

- **Gateway**: anuncia beacons de descubrimiento, posee las decisiones de emparejamiento y aloja el endpoint WS.
- **App de macOS**: le ayuda a elegir un gateway, muestra solicitudes de emparejamiento y usa SSH solo como respaldo.
- **Nodos iOS/Android**: exploran Bonjour como una conveniencia y se conectan al Gateway WS emparejado.
