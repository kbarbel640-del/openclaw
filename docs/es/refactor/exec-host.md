---
summary: "Plan de refactorizacion: enrutamiento del host de exec, aprobaciones de nodos y runner sin interfaz"
read_when:
  - Disenando el enrutamiento del host de exec o las aprobaciones de exec
  - Implementando runner de nodos + IPC de la UI
  - Agregando modos de seguridad del host de exec y comandos slash
title: "Refactorizacion del Host de Exec"
x-i18n:
  source_path: refactor/exec-host.md
  source_hash: 53a9059cbeb1f3f1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:05Z
---

# Plan de refactorizacion del host de exec

## Objetivos

- Agregar `exec.host` + `exec.security` para enrutar la ejecucion entre **sandbox**, **gateway** y **node**.
- Mantener valores predeterminados **seguros**: sin ejecucion entre hosts a menos que se habilite explicitamente.
- Dividir la ejecucion en un **servicio runner sin interfaz** con UI opcional (app de macOS) via IPC local.
- Proveer politica **por agente**, allowlist, modo de pregunta y vinculacion a nodo.
- Soportar **modos de pregunta** que funcionen _con_ o _sin_ allowlists.
- Multiplataforma: socket Unix + autenticacion por token (paridad macOS/Linux/Windows).

## No objetivos

- Sin migracion de allowlists heredadas ni soporte de esquemas heredados.
- Sin PTY/streaming para exec en nodos (solo salida agregada).
- Sin nueva capa de red mas alla del Bridge + Gateway existentes.

## Decisiones (bloqueadas)

- **Claves de configuracion:** `exec.host` + `exec.security` (se permite override por agente).
- **Elevacion:** mantener `/elevated` como alias para acceso total del gateway.
- **Pregunta por defecto:** `on-miss`.
- **Almacen de aprobaciones:** `~/.openclaw/exec-approvals.json` (JSON, sin migracion heredada).
- **Runner:** servicio del sistema sin interfaz; la app UI aloja un socket Unix para aprobaciones.
- **Identidad del nodo:** usar el `nodeId` existente.
- **Autenticacion del socket:** socket Unix + token (multiplataforma); dividir mas adelante si es necesario.
- **Estado del host del nodo:** `~/.openclaw/node.json` (id del nodo + token de emparejamiento).
- **Host de exec en macOS:** ejecutar `system.run` dentro de la app de macOS; el servicio host del nodo reenvia solicitudes via IPC local.
- **Sin helper XPC:** mantener socket Unix + token + verificaciones de pares.

## Conceptos clave

### Host

- `sandbox`: exec en Docker (comportamiento actual).
- `gateway`: exec en el host del gateway.
- `node`: exec en el runner del nodo via Bridge (`system.run`).

### Modo de seguridad

- `deny`: bloquear siempre.
- `allowlist`: permitir solo coincidencias.
- `full`: permitir todo (equivalente a elevado).

### Modo de pregunta

- `off`: nunca preguntar.
- `on-miss`: preguntar solo cuando la allowlist no coincide.
- `always`: preguntar cada vez.

La pregunta es **independiente** de la allowlist; la allowlist puede usarse con `always` o `on-miss`.

### Resolucion de politicas (por exec)

1. Resolver `exec.host` (parametro de la herramienta → override del agente → valor global).
2. Resolver `exec.security` y `exec.ask` (misma precedencia).
3. Si el host es `sandbox`, proceder con exec local en sandbox.
4. Si el host es `gateway` o `node`, aplicar politica de seguridad + pregunta en ese host.

## Seguridad por defecto

- `exec.host = sandbox` por defecto.
- `exec.security = deny` por defecto para `gateway` y `node`.
- `exec.ask = on-miss` por defecto (solo relevante si la seguridad lo permite).
- Si no se establece una vinculacion a nodo, **el agente puede apuntar a cualquier nodo**, pero solo si la politica lo permite.

## Superficie de configuracion

### Parametros de la herramienta

- `exec.host` (opcional): `sandbox | gateway | node`.
- `exec.security` (opcional): `deny | allowlist | full`.
- `exec.ask` (opcional): `off | on-miss | always`.
- `exec.node` (opcional): id/nombre del nodo a usar cuando `host=node`.

### Claves de configuracion (globales)

- `tools.exec.host`
- `tools.exec.security`
- `tools.exec.ask`
- `tools.exec.node` (vinculacion de nodo predeterminada)

### Claves de configuracion (por agente)

- `agents.list[].tools.exec.host`
- `agents.list[].tools.exec.security`
- `agents.list[].tools.exec.ask`
- `agents.list[].tools.exec.node`

### Alias

- `/elevated on` = establecer `tools.exec.host=gateway`, `tools.exec.security=full` para la sesion del agente.
- `/elevated off` = restaurar configuraciones de exec previas para la sesion del agente.

## Almacen de aprobaciones (JSON)

Ruta: `~/.openclaw/exec-approvals.json`

Proposito:

- Politica local + allowlists para el **host de ejecucion** (gateway o runner del nodo).
- Respaldo de pregunta cuando no hay UI disponible.
- Credenciales de IPC para clientes UI.

Esquema propuesto (v1):

```json
{
  "version": 1,
  "socket": {
    "path": "~/.openclaw/exec-approvals.sock",
    "token": "base64-opaque-token"
  },
  "defaults": {
    "security": "deny",
    "ask": "on-miss",
    "askFallback": "deny"
  },
  "agents": {
    "agent-id-1": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [
        {
          "pattern": "~/Projects/**/bin/rg",
          "lastUsedAt": 0,
          "lastUsedCommand": "rg -n TODO",
          "lastResolvedPath": "/Users/user/Projects/.../bin/rg"
        }
      ]
    }
  }
}
```

Notas:

- Sin formatos de allowlist heredados.
- `askFallback` aplica solo cuando se requiere `ask` y no hay una UI accesible.
- Permisos del archivo: `0600`.

## Servicio runner (sin interfaz)

### Rol

- Aplicar `exec.security` + `exec.ask` localmente.
- Ejecutar comandos del sistema y devolver la salida.
- Emitir eventos de Bridge para el ciclo de vida de exec (opcional pero recomendado).

### Ciclo de vida del servicio

- Launchd/daemon en macOS; servicio del sistema en Linux/Windows.
- El JSON de aprobaciones es local al host de ejecucion.
- La UI aloja un socket Unix local; los runners se conectan bajo demanda.

## Integracion de UI (app de macOS)

### IPC

- Socket Unix en `~/.openclaw/exec-approvals.sock` (0600).
- Token almacenado en `exec-approvals.json` (0600).
- Verificaciones de pares: solo mismo UID.
- Desafio/respuesta: nonce + HMAC(token, hash-de-solicitud) para prevenir replay.
- TTL corto (p. ej., 10s) + tamano maximo de payload + limite de tasa.

### Flujo de pregunta (host de exec de la app de macOS)

1. El servicio del nodo recibe `system.run` desde el gateway.
2. El servicio del nodo se conecta al socket local y envia el prompt/solicitud de exec.
3. La app valida par + token + HMAC + TTL, luego muestra el dialogo si es necesario.
4. La app ejecuta el comando en el contexto de la UI y devuelve la salida.
5. El servicio del nodo devuelve la salida al gateway.

Si falta la UI:

- Aplicar `askFallback` (`deny|allowlist|full`).

### Diagrama (SCI)

```
Agent -> Gateway -> Bridge -> Node Service (TS)
                         |  IPC (UDS + token + HMAC + TTL)
                         v
                     Mac App (UI + TCC + system.run)
```

## Identidad y vinculacion de nodos

- Usar el `nodeId` existente del emparejamiento del Bridge.
- Modelo de vinculacion:
  - `tools.exec.node` restringe al agente a un nodo especifico.
  - Si no se establece, el agente puede elegir cualquier nodo (la politica aun aplica valores predeterminados).
- Resolucion de seleccion de nodo:
  - `nodeId` coincidencia exacta
  - `displayName` (normalizado)
  - `remoteIp`
  - prefijo `nodeId` (>= 6 caracteres)

## Eventos

### Quien ve los eventos

- Los eventos del sistema son **por sesion** y se muestran al agente en el siguiente prompt.
- Almacenados en la cola en memoria del gateway (`enqueueSystemEvent`).

### Texto de eventos

- `Exec started (node=<id>, id=<runId>)`
- `Exec finished (node=<id>, id=<runId>, code=<code>)` + cola opcional de salida
- `Exec denied (node=<id>, id=<runId>, <reason>)`

### Transporte

Opcion A (recomendada):

- El runner envia frames de Bridge `event` `exec.started` / `exec.finished`.
- El gateway `handleBridgeEvent` los mapea a `enqueueSystemEvent`.

Opcion B:

- La herramienta `exec` del gateway maneja el ciclo de vida directamente (solo sincronico).

## Flujos de exec

### Host sandbox

- Comportamiento existente de `exec` (Docker o host cuando no esta en sandbox).
- PTY soportado solo en modo no sandbox.

### Host gateway

- El proceso del gateway ejecuta en su propia maquina.
- Aplica `exec-approvals.json` local (seguridad/pregunta/allowlist).

### Host node

- El gateway llama a `node.invoke` con `system.run`.
- El runner aplica aprobaciones locales.
- El runner devuelve stdout/stderr agregados.
- Eventos de Bridge opcionales para inicio/finalizacion/denegacion.

## Limites de salida

- Limitar stdout+stderr combinados a **200k**; mantener **cola de 20k** para eventos.
- Truncar con un sufijo claro (p. ej., `"… (truncated)"`).

## Comandos slash

- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>`
- Overrides por agente y por sesion; no persistentes a menos que se guarden via configuracion.
- `/elevated on|off|ask|full` sigue siendo un atajo para `host=gateway security=full` (con `full` omitiendo aprobaciones).

## Historia multiplataforma

- El servicio runner es el objetivo de ejecucion portable.
- La UI es opcional; si falta, aplica `askFallback`.
- Windows/Linux soportan el mismo JSON de aprobaciones + protocolo de socket.

## Fases de implementacion

### Fase 1: configuracion + enrutamiento de exec

- Agregar esquema de configuracion para `exec.host`, `exec.security`, `exec.ask`, `exec.node`.
- Actualizar el cableado de herramientas para respetar `exec.host`.
- Agregar el comando slash `/exec` y mantener el alias `/elevated`.

### Fase 2: almacen de aprobaciones + aplicacion en gateway

- Implementar lector/escritor de `exec-approvals.json`.
- Aplicar allowlist + modos de pregunta para el host `gateway`.
- Agregar limites de salida.

### Fase 3: aplicacion en runner de nodos

- Actualizar el runner de nodos para aplicar allowlist + pregunta.
- Agregar puente de prompts por socket Unix a la UI de la app de macOS.
- Conectar `askFallback`.

### Fase 4: eventos

- Agregar eventos Bridge de nodo → gateway para el ciclo de vida de exec.
- Mapear a `enqueueSystemEvent` para prompts del agente.

### Fase 5: pulido de UI

- App de Mac: editor de allowlists, selector por agente, UI de politica de pregunta.
- Controles de vinculacion de nodos (opcional).

## Plan de pruebas

- Pruebas unitarias: coincidencia de allowlists (glob + sin distincion de mayusculas).
- Pruebas unitarias: precedencia de resolucion de politicas (parametro de herramienta → override del agente → global).
- Pruebas de integracion: flujos de denegar/permitir/preguntar del runner de nodos.
- Pruebas de eventos Bridge: evento de nodo → enrutamiento de evento del sistema.

## Riesgos abiertos

- Indisponibilidad de la UI: asegurar que se respete `askFallback`.
- Comandos de larga duracion: confiar en timeout + limites de salida.
- Ambiguedad de multiples nodos: error a menos que exista vinculacion de nodo o parametro de nodo explicito.

## Documentos relacionados

- [Exec tool](/tools/exec)
- [Exec approvals](/tools/exec-approvals)
- [Nodes](/nodes)
- [Elevated mode](/tools/elevated)
