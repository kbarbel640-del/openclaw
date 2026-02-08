---
title: Verificación Formal (Modelos de Seguridad)
summary: Modelos de seguridad verificados por máquina para las rutas de mayor riesgo de OpenClaw.
permalink: /security/formal-verification/
x-i18n:
  source_path: gateway/security/formal-verification.md
  source_hash: 8dff6ea41a37fb6b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:07Z
---

# Verificación Formal (Modelos de Seguridad)

Esta página da seguimiento a los **modelos formales de seguridad** de OpenClaw (TLA+/TLC hoy; más según sea necesario).

> Nota: algunos enlaces antiguos pueden referirse al nombre previo del proyecto.

**Objetivo (estrella norte):** proporcionar un argumento verificado por máquina de que OpenClaw aplica su
política de seguridad prevista (autorización, aislamiento de sesiones, control de herramientas y
seguridad ante malas configuraciones), bajo supuestos explícitos.

**Qué es esto (hoy):** una **suite de regresión de seguridad** ejecutable y orientada al atacante:

- Cada afirmación tiene una verificación de modelo ejecutable sobre un espacio de estados finito.
- Muchas afirmaciones tienen un **modelo negativo** emparejado que produce una traza de contraejemplo para una clase realista de errores.

**Qué no es (todavía):** una prueba de que “OpenClaw es seguro en todos los aspectos” ni de que la implementación completa en TypeScript sea correcta.

## Dónde viven los modelos

Los modelos se mantienen en un repositorio separado: [vignesh07/openclaw-formal-models](https://github.com/vignesh07/openclaw-formal-models).

## Advertencias importantes

- Estos son **modelos**, no la implementación completa en TypeScript. Es posible que exista divergencia entre el modelo y el código.
- Los resultados están acotados por el espacio de estados explorado por TLC; estar “en verde” no implica seguridad más allá de los supuestos y límites modelados.
- Algunas afirmaciones dependen de supuestos ambientales explícitos (p. ej., despliegue correcto, entradas de configuración correctas).

## Reproducción de resultados

Hoy, los resultados se reproducen clonando el repositorio de modelos localmente y ejecutando TLC (ver abajo). Una iteración futura podría ofrecer:

- Modelos ejecutados en CI con artefactos públicos (trazas de contraejemplo, registros de ejecución)
- Un flujo de trabajo alojado de “ejecutar este modelo” para verificaciones pequeñas y acotadas

Primeros pasos:

```bash
git clone https://github.com/vignesh07/openclaw-formal-models
cd openclaw-formal-models

# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned `tla2tools.jar` (TLA+ tools) and provides `bin/tlc` + Make targets.

make <target>
```

### Exposición del Gateway y mala configuración de Gateway abierto

**Afirmación:** enlazar más allá del loopback sin autenticación puede hacer posible el compromiso remoto / aumenta la exposición; el token/contraseña bloquea a atacantes no autorizados (según los supuestos del modelo).

- Ejecuciones en verde:
  - `make gateway-exposure-v2`
  - `make gateway-exposure-v2-protected`
- En rojo (esperado):
  - `make gateway-exposure-v2-negative`

Vea también: `docs/gateway-exposure-matrix.md` en el repositorio de modelos.

### Canalización Nodes.run (capacidad de mayor riesgo)

**Afirmación:** `nodes.run` requiere (a) una lista de permitidos de comandos de nodo más comandos declarados y (b) aprobación en vivo cuando está configurado; las aprobaciones están tokenizadas para prevenir reenvíos (en el modelo).

- Ejecuciones en verde:
  - `make nodes-pipeline`
  - `make approvals-token`
- En rojo (esperado):
  - `make nodes-pipeline-negative`
  - `make approvals-token-negative`

### Almacén de emparejamiento (control de Mensajes directos)

**Afirmación:** las solicitudes de emparejamiento respetan el TTL y los límites de solicitudes pendientes.

- Ejecuciones en verde:
  - `make pairing`
  - `make pairing-cap`
- En rojo (esperado):
  - `make pairing-negative`
  - `make pairing-cap-negative`

### Control de ingreso (menciones + bypass de comandos de control)

**Afirmación:** en contextos de grupo que requieren mención, un “comando de control” no autorizado no puede evadir el control por mención.

- En verde:
  - `make ingress-gating`
- En rojo (esperado):
  - `make ingress-gating-negative`

### Aislamiento de enrutamiento/clave de sesión

**Afirmación:** los Mensajes directos de pares distintos no colapsan en la misma sesión a menos que se vinculen/configuren explícitamente.

- En verde:
  - `make routing-isolation`
- En rojo (esperado):
  - `make routing-isolation-negative`

## v1++: modelos acotados adicionales (concurrencia, reintentos, corrección de trazas)

Estos son modelos posteriores que aumentan la fidelidad frente a modos de falla del mundo real (actualizaciones no atómicas, reintentos y fan-out de mensajes).

### Concurrencia / idempotencia del almacén de emparejamiento

**Afirmación:** un almacén de emparejamiento debe aplicar `MaxPending` e idempotencia incluso bajo intercalados (es decir, “verificar y luego escribir” debe ser atómico / con bloqueo; la actualización no debería crear duplicados).

Qué significa:

- Bajo solicitudes concurrentes, no se puede exceder `MaxPending` para un canal.
- Solicitudes/reintentos repetidos para el mismo `(channel, sender)` no deberían crear filas pendientes duplicadas activas.

- Ejecuciones en verde:
  - `make pairing-race` (verificación de límite atómica/con bloqueo)
  - `make pairing-idempotency`
  - `make pairing-refresh`
  - `make pairing-refresh-race`
- En rojo (esperado):
  - `make pairing-race-negative` (condición de carrera de límite por begin/commit no atómico)
  - `make pairing-idempotency-negative`
  - `make pairing-refresh-negative`
  - `make pairing-refresh-race-negative`

### Correlación de trazas de ingreso / idempotencia

**Afirmación:** la ingestión debe preservar la correlación de trazas a través del fan-out y ser idempotente ante reintentos del proveedor.

Qué significa:

- Cuando un evento externo se convierte en múltiples mensajes internos, cada parte mantiene la misma identidad de traza/evento.
- Los reintentos no resultan en doble procesamiento.
- Si faltan IDs de eventos del proveedor, la deduplicación recurre a una clave segura (p. ej., ID de traza) para evitar descartar eventos distintos.

- En verde:
  - `make ingress-trace`
  - `make ingress-trace2`
  - `make ingress-idempotency`
  - `make ingress-dedupe-fallback`
- En rojo (esperado):
  - `make ingress-trace-negative`
  - `make ingress-trace2-negative`
  - `make ingress-idempotency-negative`
  - `make ingress-dedupe-fallback-negative`

### Precedencia de dmScope de enrutamiento + identityLinks

**Afirmación:** el enrutamiento debe mantener las sesiones de Mensaje directo aisladas por defecto, y solo colapsar sesiones cuando se configura explícitamente (precedencia de canal + vínculos de identidad).

Qué significa:

- Las anulaciones de dmScope específicas del canal deben prevalecer sobre los valores globales predeterminados.
- identityLinks solo deberían colapsar dentro de grupos vinculados explícitamente, no entre pares no relacionados.

- En verde:
  - `make routing-precedence`
  - `make routing-identitylinks`
- En rojo (esperado):
  - `make routing-precedence-negative`
  - `make routing-identitylinks-negative`
