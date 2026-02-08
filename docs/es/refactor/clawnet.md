---
summary: "Refactorización de Clawnet: unificar protocolo de red, roles, autenticación, aprobaciones e identidad"
read_when:
  - Planificación de un protocolo de red unificado para nodos + clientes operadores
  - Revisión de aprobaciones, emparejamiento, TLS y presencia entre dispositivos
title: "Refactorización de Clawnet"
x-i18n:
  source_path: refactor/clawnet.md
  source_hash: 719b219c3b326479
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:12Z
---

# Refactorización de Clawnet (unificación de protocolo + autenticación)

## Hola

Hola Peter — excelente dirección; esto habilita una UX más simple y una seguridad más fuerte.

## Propósito

Documento único y riguroso para:

- Estado actual: protocolos, flujos, límites de confianza.
- Puntos de dolor: aprobaciones, enrutamiento multi‑salto, duplicación de UI.
- Nuevo estado propuesto: un solo protocolo, roles con alcance, autenticación/emparejamiento unificados, fijación de TLS.
- Modelo de identidad: IDs estables + slugs simpáticos.
- Plan de migración, riesgos y preguntas abiertas.

## Objetivos (de la discusión)

- Un protocolo para todos los clientes (app mac, CLI, iOS, Android, nodo sin cabeza).
- Cada participante de la red autenticado + emparejado.
- Claridad de roles: nodos vs operadores.
- Aprobaciones centrales enrutadas a donde esté el usuario.
- Cifrado TLS + fijación opcional para todo el tráfico remoto.
- Mínima duplicación de código.
- Una sola máquina debe aparecer una vez (sin entrada duplicada de UI/nodo).

## No objetivos (explícitos)

- Eliminar la separación de capacidades (sigue siendo necesario el mínimo privilegio).
- Exponer el plano de control completo del Gateway sin verificaciones de alcance.
- Hacer que la autenticación dependa de etiquetas humanas (los slugs siguen sin ser de seguridad).

---

# Estado actual (tal como está)

## Dos protocolos

### 1) Gateway WebSocket (plano de control)

- Superficie completa de API: configuración, canales, modelos, sesiones, ejecuciones de agentes, logs, nodos, etc.
- Enlace predeterminado: loopback. Acceso remoto vía SSH/Tailscale.
- Autenticación: token/contraseña vía `connect`.
- Sin fijación de TLS (depende de loopback/túnel).
- Código:
  - `src/gateway/server/ws-connection/message-handler.ts`
  - `src/gateway/client.ts`
  - `docs/gateway/protocol.md`

### 2) Bridge (transporte de nodos)

- Superficie con allowlist reducida, identidad de nodo + emparejamiento.
- JSONL sobre TCP; TLS opcional + fijación de huella de certificado.
- TLS anuncia la huella en el TXT de descubrimiento.
- Código:
  - `src/infra/bridge/server/connection.ts`
  - `src/gateway/server-bridge.ts`
  - `src/node-host/bridge-client.ts`
  - `docs/gateway/bridge-protocol.md`

## Clientes del plano de control hoy

- CLI → Gateway WS vía `callGateway` (`src/gateway/call.ts`).
- UI de app macOS → Gateway WS (`GatewayConnection`).
- Web Control UI → Gateway WS.
- ACP → Gateway WS.
- El control desde navegador usa su propio servidor HTTP de control.

## Nodos hoy

- App macOS en modo nodo se conecta al bridge del Gateway (`MacNodeBridgeSession`).
- Apps iOS/Android se conectan al bridge del Gateway.
- Emparejamiento + token por nodo almacenado en el gateway.

## Flujo de aprobación actual (exec)

- El agente usa `system.run` vía Gateway.
- El Gateway invoca al nodo sobre el bridge.
- El runtime del nodo decide la aprobación.
- La UI muestra el aviso en la app mac (cuando el nodo == app mac).
- El nodo devuelve `invoke-res` al Gateway.
- Multi‑salto, UI ligada al host del nodo.

## Presencia + identidad hoy

- Entradas de presencia del Gateway desde clientes WS.
- Entradas de presencia de nodos desde el bridge.
- La app mac puede mostrar dos entradas para la misma máquina (UI + nodo).
- La identidad del nodo se almacena en el almacén de emparejamiento; la identidad de la UI es separada.

---

# Problemas / puntos de dolor

- Dos pilas de protocolos que mantener (WS + Bridge).
- Aprobaciones en nodos remotos: el aviso aparece en el host del nodo, no donde está el usuario.
- La fijación de TLS solo existe para el bridge; WS depende de SSH/Tailscale.
- Duplicación de identidad: la misma máquina aparece como múltiples instancias.
- Roles ambiguos: capacidades de UI + nodo + CLI no claramente separadas.

---

# Nuevo estado propuesto (Clawnet)

## Un protocolo, dos roles

Un solo protocolo WS con rol + alcance.

- **Rol: node** (host de capacidades)
- **Rol: operator** (plano de control)
- **Alcance** opcional para operador:
  - `operator.read` (estado + visualización)
  - `operator.write` (ejecución de agentes, envíos)
  - `operator.admin` (configuración, canales, modelos)

### Comportamientos por rol

**Node**

- Puede registrar capacidades (`caps`, `commands`, permisos).
- Puede recibir comandos `invoke` (`system.run`, `camera.*`, `canvas.*`, `screen.record`, etc).
- Puede enviar eventos: `voice.transcript`, `agent.request`, `chat.subscribe`.
- No puede llamar APIs del plano de control de config/modelos/canales/sesiones/agentes.

**Operator**

- API completa del plano de control, protegida por alcance.
- Recibe todas las aprobaciones.
- No ejecuta directamente acciones del SO; enruta a nodos.

### Regla clave

El rol es por conexión, no por dispositivo. Un dispositivo puede abrir ambos roles, por separado.

---

# Autenticación + emparejamiento unificados

## Identidad del cliente

Cada cliente proporciona:

- `deviceId` (estable, derivado de la clave del dispositivo).
- `displayName` (nombre humano).
- `role` + `scope` + `caps` + `commands`.

## Flujo de emparejamiento (unificado)

- El cliente se conecta sin autenticación.
- El Gateway crea una **solicitud de emparejamiento** para ese `deviceId`.
- El operador recibe el aviso; aprueba/deniega.
- El Gateway emite credenciales vinculadas a:
  - clave pública del dispositivo
  - rol(es)
  - alcance(s)
  - capacidades/comandos
- El cliente persiste el token y se reconecta autenticado.

## Autenticación vinculada al dispositivo (evitar replay de bearer tokens)

Preferido: pares de claves del dispositivo.

- El dispositivo genera un par de claves una sola vez.
- `deviceId = fingerprint(publicKey)`.
- El Gateway envía un nonce; el dispositivo firma; el Gateway verifica.
- Los tokens se emiten a una clave pública (prueba de posesión), no a una cadena.

Alternativas:

- mTLS (certificados de cliente): lo más fuerte, más complejidad operativa.
- Bearer tokens de corta duración solo como fase temporal (rotar + revocar temprano).

## Aprobación silenciosa (heurística SSH)

Definirla con precisión para evitar un eslabón débil. Preferir una:

- **Solo local**: emparejar automáticamente cuando el cliente se conecta vía loopback/socket Unix.
- **Desafío vía SSH**: el Gateway emite un nonce; el cliente demuestra SSH al obtenerlo.
- **Ventana de presencia física**: tras una aprobación local en la UI del host del Gateway, permitir auto‑emparejamiento por una ventana corta (p. ej., 10 minutos).

Siempre registrar y guardar las auto‑aprobaciones.

---

# TLS en todas partes (dev + prod)

## Reutilizar TLS existente del bridge

Usar el runtime TLS actual + fijación de huella:

- `src/infra/bridge/server/tls.ts`
- lógica de verificación de huella en `src/node-host/bridge-client.ts`

## Aplicar a WS

- El servidor WS soporta TLS con el mismo cert/clave + huella.
- Los clientes WS pueden fijar la huella (opcional).
- El descubrimiento anuncia TLS + huella para todos los endpoints.
  - El descubrimiento es solo pistas de localización; nunca un ancla de confianza.

## Por qué

- Reducir la dependencia de SSH/Tailscale para confidencialidad.
- Hacer seguras por defecto las conexiones móviles remotas.

---

# Rediseño de aprobaciones (centralizado)

## Actual

La aprobación ocurre en el host del nodo (runtime del nodo en la app mac). El aviso aparece donde corre el nodo.

## Propuesto

La aprobación es **alojada en el Gateway**, con UI entregada a clientes operadores.

### Nuevo flujo

1. El Gateway recibe la intención `system.run` (agente).
2. El Gateway crea un registro de aprobación: `approval.requested`.
3. Las UI de operador muestran el aviso.
4. La decisión de aprobación se envía al Gateway: `approval.resolve`.
5. El Gateway invoca el comando del nodo si se aprueba.
6. El nodo ejecuta y devuelve `invoke-res`.

### Semántica de aprobación (endurecimiento)

- Difundir a todos los operadores; solo la UI activa muestra un modal (las otras reciben un toast).
- La primera resolución gana; el Gateway rechaza resoluciones posteriores como ya resueltas.
- Tiempo de espera predeterminado: denegar tras N segundos (p. ej., 60 s), registrar motivo.
- La resolución requiere el alcance `operator.approvals`.

## Beneficios

- El aviso aparece donde está el usuario (mac/teléfono).
- Aprobaciones consistentes para nodos remotos.
- El runtime del nodo permanece sin cabeza; sin dependencia de UI.

---

# Ejemplos de claridad de roles

## App de iPhone

- **Rol node** para: micrófono, cámara, chat de voz, ubicación, push‑to‑talk.
- **operator.read** opcional para estado y vista de chat.
- **operator.write/admin** opcional solo cuando se habilita explícitamente.

## App macOS

- Rol operator por defecto (UI de control).
- Rol node cuando se habilita “Mac node” (system.run, pantalla, cámara).
- Mismo deviceId para ambas conexiones → entrada de UI combinada.

## CLI

- Rol operator siempre.
- Alcance derivado por subcomando:
  - `status`, `logs` → read
  - `agent`, `message` → write
  - `config`, `channels` → admin
  - aprobaciones + emparejamiento → `operator.approvals` / `operator.pairing`

---

# Identidad + slugs

## ID estable

Requerido para autenticación; nunca cambia.
Preferido:

- Huella del par de claves (hash de clave pública).

## Slug simpático (tema langosta)

Etiqueta solo humana.

- Ejemplo: `scarlet-claw`, `saltwave`, `mantis-pinch`.
- Almacenado en el registro del Gateway, editable.
- Manejo de colisiones: `-2`, `-3`.

## Agrupación en UI

El mismo `deviceId` entre roles → una sola fila de “Instancia”:

- Insignia: `operator`, `node`.
- Muestra capacidades + última vez visto.

---

# Estrategia de migración

## Fase 0: Documentar + alinear

- Publicar este documento.
- Inventariar todas las llamadas de protocolo + flujos de aprobación.

## Fase 1: Agregar roles/alcances a WS

- Extender parámetros de `connect` con `role`, `scope`, `deviceId`.
- Agregar control por allowlist para el rol node.

## Fase 2: Compatibilidad con Bridge

- Mantener el bridge en funcionamiento.
- Agregar soporte de nodo por WS en paralelo.
- Proteger funcionalidades detrás de un flag de configuración.

## Fase 3: Aprobaciones centrales

- Agregar eventos de solicitud y resolución de aprobación en WS.
- Actualizar la UI de la app mac para avisar + responder.
- El runtime del nodo deja de mostrar avisos de UI.

## Fase 4: Unificación TLS

- Agregar configuración TLS para WS usando el runtime TLS del bridge.
- Agregar fijación a los clientes.

## Fase 5: Deprecar bridge

- Migrar nodos iOS/Android/mac a WS.
- Mantener bridge como respaldo; eliminar una vez estable.

## Fase 6: Autenticación vinculada al dispositivo

- Requerir identidad basada en claves para todas las conexiones no locales.
- Agregar UI de revocación + rotación.

---

# Notas de seguridad

- Rol/allowlist aplicados en el límite del Gateway.
- Ningún cliente obtiene la API “completa” sin alcance operator.
- Emparejamiento requerido para _todas_ las conexiones.
- TLS + fijación reduce el riesgo MITM en móvil.
- La aprobación silenciosa por SSH es una conveniencia; aún se registra + es revocable.
- El descubrimiento nunca es un ancla de confianza.
- Las declaraciones de capacidades se verifican contra allowlists del servidor por plataforma/tipo.

# Streaming + cargas grandes (media del nodo)

El plano de control WS es adecuado para mensajes pequeños, pero los nodos también hacen:

- clips de cámara
- grabaciones de pantalla
- streams de audio

Opciones:

1. Marcos binarios WS + fragmentación + reglas de backpressure.
2. Endpoint de streaming separado (aún TLS + autenticación).
3. Mantener el bridge más tiempo para comandos con mucho media, migrar al final.

Elegir uno antes de implementar para evitar deriva.

# Política de capacidades + comandos

- Las capacidades/comandos reportados por nodos se tratan como **claims**.
- El Gateway aplica allowlists por plataforma.
- Cualquier comando nuevo requiere aprobación del operador o cambio explícito de allowlist.
- Auditar cambios con marcas de tiempo.

# Auditoría + limitación de tasa

- Registrar: solicitudes de emparejamiento, aprobaciones/denegaciones, emisión/rotación/revocación de tokens.
- Limitar la tasa de spam de emparejamiento y avisos de aprobación.

# Higiene del protocolo

- Versión explícita del protocolo + códigos de error.
- Reglas de reconexión + política de heartbeat.
- TTL de presencia y semántica de última vez visto.

---

# Preguntas abiertas

1. Un solo dispositivo ejecutando ambos roles: modelo de tokens
   - Recomendar tokens separados por rol (node vs operator).
   - Mismo deviceId; diferentes alcances; revocación más clara.

2. Granularidad de alcance del operador
   - read/write/admin + aprobaciones + emparejamiento (mínimo viable).
   - Considerar alcances por funcionalidad más adelante.

3. UX de rotación + revocación de tokens
   - Rotación automática al cambiar rol.
   - UI para revocar por deviceId + rol.

4. Descubrimiento
   - Extender el TXT de Bonjour actual para incluir huella TLS de WS + pistas de rol.
   - Tratarlo solo como pistas de localización.

5. Aprobación entre redes
   - Difundir a todos los clientes operadores; la UI activa muestra el modal.
   - La primera respuesta gana; el Gateway aplica atomicidad.

---

# Resumen (TL;DR)

- Hoy: plano de control WS + transporte de nodos Bridge.
- Dolor: aprobaciones + duplicación + dos pilas.
- Propuesta: un solo protocolo WS con roles + alcances explícitos, emparejamiento unificado + fijación TLS, aprobaciones alojadas en el Gateway, IDs de dispositivo estables + slugs simpáticos.
- Resultado: UX más simple, seguridad más fuerte, menos duplicación, mejor enrutamiento móvil.
