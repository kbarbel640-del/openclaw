---
summary: "Comando de ubicacion para nodos (location.get), modos de permiso y comportamiento en segundo plano"
read_when:
  - Agregar soporte de nodo de ubicacion o UI de permisos
  - Diseñar flujos de ubicacion en segundo plano + push
title: "Comando de ubicacion"
x-i18n:
  source_path: nodes/location-command.md
  source_hash: 23124096256384d2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:20Z
---

# Comando de ubicacion (nodos)

## TL;DR

- `location.get` es un comando de nodo (via `node.invoke`).
- Desactivado por defecto.
- La configuracion usa un selector: Desactivado / Mientras se usa / Siempre.
- Alternador separado: Ubicacion precisa.

## Por que un selector (no solo un interruptor)

Los permisos del sistema operativo son multinivel. Podemos exponer un selector en la app, pero el sistema operativo aun decide la concesion real.

- iOS/macOS: el usuario puede elegir **Mientras se usa** o **Siempre** en los avisos/Configuracion del sistema. La app puede solicitar una actualizacion, pero el sistema operativo puede requerir ir a Configuracion.
- Android: la ubicacion en segundo plano es un permiso separado; en Android 10+ a menudo requiere un flujo en Configuracion.
- La ubicacion precisa es una concesion separada (iOS 14+ “Precisa”, Android “fina” vs “aproximada”).

El selector en la UI impulsa nuestro modo solicitado; la concesion real vive en la configuracion del sistema operativo.

## Modelo de configuracion

Por dispositivo de nodo:

- `location.enabledMode`: `off | whileUsing | always`
- `location.preciseEnabled`: bool

Comportamiento de la UI:

- Seleccionar `whileUsing` solicita permiso en primer plano.
- Seleccionar `always` primero asegura `whileUsing`, luego solicita segundo plano (o envia al usuario a Configuracion si es requerido).
- Si el sistema operativo deniega el nivel solicitado, se revierte al nivel mas alto concedido y se muestra el estado.

## Mapeo de permisos (node.permissions)

Opcional. El nodo macOS reporta `location` via el mapa de permisos; iOS/Android pueden omitirlo.

## Comando: `location.get`

Llamado via `node.invoke`.

Parametros (sugeridos):

```json
{
  "timeoutMs": 10000,
  "maxAgeMs": 15000,
  "desiredAccuracy": "coarse|balanced|precise"
}
```

Carga de respuesta:

```json
{
  "lat": 48.20849,
  "lon": 16.37208,
  "accuracyMeters": 12.5,
  "altitudeMeters": 182.0,
  "speedMps": 0.0,
  "headingDeg": 270.0,
  "timestamp": "2026-01-03T12:34:56.000Z",
  "isPrecise": true,
  "source": "gps|wifi|cell|unknown"
}
```

Errores (codigos estables):

- `LOCATION_DISABLED`: el selector esta desactivado.
- `LOCATION_PERMISSION_REQUIRED`: permiso faltante para el modo solicitado.
- `LOCATION_BACKGROUND_UNAVAILABLE`: la app esta en segundo plano pero solo se permite Mientras se usa.
- `LOCATION_TIMEOUT`: no hay fijacion a tiempo.
- `LOCATION_UNAVAILABLE`: fallo del sistema / sin proveedores.

## Comportamiento en segundo plano (futuro)

Objetivo: el modelo puede solicitar ubicacion incluso cuando el nodo esta en segundo plano, pero solo cuando:

- El usuario selecciono **Siempre**.
- El sistema operativo concede ubicacion en segundo plano.
- La app tiene permitido ejecutarse en segundo plano para ubicacion (modo en segundo plano de iOS / servicio en primer plano de Android o permiso especial).

Flujo activado por push (futuro):

1. El Gateway envia un push al nodo (push silencioso o datos FCM).
2. El nodo se activa brevemente y solicita ubicacion al dispositivo.
3. El nodo reenvia la carga al Gateway.

Notas:

- iOS: se requiere permiso Siempre + modo de ubicacion en segundo plano. El push silencioso puede ser limitado; espere fallos intermitentes.
- Android: la ubicacion en segundo plano puede requerir un servicio en primer plano; de lo contrario, espere denegacion.

## Integracion de modelo/herramientas

- Superficie de herramientas: la herramienta `nodes` agrega la accion `location_get` (nodo requerido).
- CLI: `openclaw nodes location get --node <id>`.
- Directrices del agente: solo llamar cuando el usuario habilito la ubicacion y entiende el alcance.

## Copia de UX (sugerida)

- Desactivado: “El uso compartido de ubicacion esta desactivado.”
- Mientras se usa: “Solo cuando OpenClaw esta abierto.”
- Siempre: “Permitir ubicacion en segundo plano. Requiere permiso del sistema.”
- Precisa: “Usar ubicacion GPS precisa. Desactive para compartir una ubicacion aproximada.”
