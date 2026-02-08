---
summary: "Cómo se producen, fusionan y muestran las entradas de presencia de OpenClaw"
read_when:
  - Depuración de la pestaña Instances
  - Investigación de filas de instancias duplicadas o obsoletas
  - Cambio de los beacons de conexión WS del Gateway o de eventos del sistema
title: "Presencia"
x-i18n:
  source_path: concepts/presence.md
  source_hash: c752c76a880878fe
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:37Z
---

# Presencia

La “presencia” de OpenClaw es una vista ligera y de mejor esfuerzo de:

- el **Gateway** en sí, y
- **los clientes conectados al Gateway** (app de mac, WebChat, CLI, etc.)

La presencia se utiliza principalmente para renderizar la pestaña **Instances** de la app de macOS y para
proporcionar visibilidad rápida al operador.

## Campos de presencia (lo que se muestra)

Las entradas de presencia son objetos estructurados con campos como:

- `instanceId` (opcional pero fuertemente recomendado): identidad estable del cliente (usualmente `connect.client.instanceId`)
- `host`: nombre de host legible para humanos
- `ip`: dirección IP de mejor esfuerzo
- `version`: cadena de versión del cliente
- `deviceFamily` / `modelIdentifier`: indicios de hardware
- `mode`: `ui`, `webchat`, `cli`, `backend`, `probe`, `test`, `node`, ...
- `lastInputSeconds`: “segundos desde la última entrada del usuario” (si se conoce)
- `reason`: `self`, `connect`, `node-connected`, `periodic`, ...
- `ts`: marca de tiempo de la última actualización (ms desde epoch)

## Productores (de dónde viene la presencia)

Las entradas de presencia son producidas por múltiples fuentes y **fusionadas**.

### 1) Entrada propia del Gateway

El Gateway siempre inicializa una entrada “propia” al arrancar para que las UIs muestren el host del gateway
incluso antes de que se conecte cualquier cliente.

### 2) Conexión WebSocket

Cada cliente WS comienza con una solicitud `connect`. En un handshake exitoso, el
Gateway inserta o actualiza una entrada de presencia para esa conexión.

#### Por qué los comandos CLI de una sola vez no aparecen

La CLI a menudo se conecta para comandos cortos y puntuales. Para evitar saturar la lista de
Instances, `client.mode === "cli"` **no** se convierte en una entrada de presencia.

### 3) Beacons `system-event`

Los clientes pueden enviar beacons periódicos más ricos mediante el método `system-event`. La app de mac
usa esto para reportar el nombre del host, la IP y `lastInputSeconds`.

### 4) Conexión de nodos (rol: node)

Cuando un nodo se conecta a través del WebSocket del Gateway con `role: node`, el Gateway
inserta o actualiza una entrada de presencia para ese nodo (el mismo flujo que otros clientes WS).

## Reglas de fusión y deduplicación (por qué importa `instanceId`)

Las entradas de presencia se almacenan en un único mapa en memoria:

- Las entradas se indexan por una **clave de presencia**.
- La mejor clave es un `instanceId` estable (de `connect.client.instanceId`) que sobrevive a reinicios.
- Las claves no distinguen mayúsculas y minúsculas.

Si un cliente se reconecta sin un `instanceId` estable, puede aparecer como una
fila **duplicada**.

## TTL y tamaño acotado

La presencia es intencionalmente efímera:

- **TTL:** las entradas con más de 5 minutos se eliminan
- **Máx. entradas:** 200 (se descartan primero las más antiguas)

Esto mantiene la lista actualizada y evita un crecimiento de memoria sin límites.

## Advertencia de remoto/túnel (IPs de loopback)

Cuando un cliente se conecta a través de un túnel SSH / reenvío de puertos local, el Gateway puede
ver la dirección remota como `127.0.0.1`. Para evitar sobrescribir una IP reportada correctamente por el cliente,
las direcciones remotas de loopback se ignoran.

## Consumidores

### Pestaña Instances de macOS

La app de macOS renderiza la salida de `system-presence` y aplica un pequeño indicador de estado
(Activo/Inactivo/Obsoleto) según la antigüedad de la última actualización.

## Consejos de depuración

- Para ver la lista sin procesar, llame a `system-presence` contra el Gateway.
- Si ve duplicados:
  - confirme que los clientes envían un `client.instanceId` estable en el handshake
  - confirme que los beacons periódicos usan el mismo `instanceId`
  - verifique si a la entrada derivada de la conexión le falta `instanceId` (los duplicados son esperables)
