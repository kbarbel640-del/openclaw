---
summary: "Comando Doctor: comprobaciones de salud, migraciones de configuracion y pasos de reparacion"
read_when:
  - Agregar o modificar migraciones de doctor
  - Introducir cambios de configuracion incompatibles
title: "Doctor"
x-i18n:
  source_path: gateway/doctor.md
  source_hash: df7b25f60fd08d50
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:16Z
---

# Doctor

`openclaw doctor` es la herramienta de reparacion + migracion para OpenClaw. Corrige
configuracion/estado obsoleto, comprueba la salud y proporciona pasos de reparacion accionables.

## Inicio rapido

```bash
openclaw doctor
```

### Sin interfaz / automatizacion

```bash
openclaw doctor --yes
```

Aceptar valores predeterminados sin solicitar confirmacion (incluidas acciones de reinicio/servicio/sandbox cuando corresponda).

```bash
openclaw doctor --repair
```

Aplicar reparaciones recomendadas sin solicitar confirmacion (reparaciones + reinicios cuando sea seguro).

```bash
openclaw doctor --repair --force
```

Aplicar tambien reparaciones agresivas (sobrescribe configuraciones personalizadas del supervisor).

```bash
openclaw doctor --non-interactive
```

Ejecutar sin solicitudes y aplicar solo migraciones seguras (normalizacion de configuracion + movimientos de estado en disco). Omite acciones de reinicio/servicio/sandbox que requieren confirmacion humana.
Las migraciones de estado heredado se ejecutan automaticamente cuando se detectan.

```bash
openclaw doctor --deep
```

Escanear servicios del sistema en busca de instalaciones adicionales del gateway (launchd/systemd/schtasks).

Si desea revisar los cambios antes de escribir, abra primero el archivo de configuracion:

```bash
cat ~/.openclaw/openclaw.json
```

## Que hace (resumen)

- Actualizacion previa opcional para instalaciones git (solo interactivo).
- Comprobacion de vigencia del protocolo de la UI (reconstruye la UI de Control cuando el esquema del protocolo es mas reciente).
- Comprobacion de salud + solicitud de reinicio.
- Resumen de estado de Skills (elegibles/faltantes/bloqueadas).
- Normalizacion de configuracion para valores heredados.
- Advertencias de sobrescritura del proveedor OpenCode Zen (`models.providers.opencode`).
- Migracion de estado heredado en disco (sesiones/directorio del agente/autenticacion de WhatsApp).
- Comprobaciones de integridad y permisos del estado (sesiones, transcripciones, directorio de estado).
- Comprobaciones de permisos del archivo de configuracion (chmod 600) al ejecutarse localmente.
- Salud de autenticacion de modelos: comprueba la caducidad de OAuth, puede renovar tokens a punto de expirar e informa estados de enfriamiento/deshabilitacion de perfiles de autenticacion.
- Deteccion de directorios de workspace adicionales (`~/openclaw`).
- Reparacion de imagen de Sandbox cuando sandboxing esta habilitado.
- Migracion de servicios heredados y deteccion de gateways adicionales.
- Comprobaciones de tiempo de ejecucion del Gateway (servicio instalado pero no en ejecucion; etiqueta launchd en cache).
- Advertencias de estado de canales (sondeadas desde el gateway en ejecucion).
- Auditoria de configuracion del supervisor (launchd/systemd/schtasks) con reparacion opcional.
- Comprobaciones de mejores practicas del tiempo de ejecucion del Gateway (Node vs Bun, rutas de gestores de versiones).
- Diagnosticos de colision de puertos del Gateway (predeterminado `18789`).
- Advertencias de seguridad para politicas de Mensajes directos abiertas.
- Advertencias de autenticacion del Gateway cuando no se establece `gateway.auth.token` (modo local; ofrece generacion de token).
- Comprobacion de linger de systemd en Linux.
- Comprobaciones de instalacion desde codigo fuente (desajuste de workspace pnpm, activos de UI faltantes, binario tsx faltante).
- Escribe la configuracion actualizada + metadatos del asistente.

## Comportamiento detallado y justificacion

### 0) Actualizacion opcional (instalaciones git)

Si esto es un checkout de git y doctor se ejecuta de forma interactiva, ofrece
actualizar (fetch/rebase/build) antes de ejecutar doctor.

### 1) Normalizacion de configuracion

Si la configuracion contiene formas de valores heredadas (por ejemplo `messages.ackReaction`
sin una sobrescritura especifica por canal), doctor las normaliza al esquema actual.

### 2) Migraciones de claves de configuracion heredadas

Cuando la configuracion contiene claves obsoletas, otros comandos se niegan a ejecutarse y le piden que ejecute `openclaw doctor`.

Doctor:

- Explica que claves heredadas se encontraron.
- Muestra la migracion que aplico.
- Reescribe `~/.openclaw/openclaw.json` con el esquema actualizado.

El Gateway tambien ejecuta automaticamente las migraciones de doctor al iniciar cuando detecta un formato de configuracion heredado, de modo que las configuraciones obsoletas se reparan sin intervencion manual.

Migraciones actuales:

- `routing.allowFrom` → `channels.whatsapp.allowFrom`
- `routing.groupChat.requireMention` → `channels.whatsapp/telegram/imessage.groups."*".requireMention`
- `routing.groupChat.historyLimit` → `messages.groupChat.historyLimit`
- `routing.groupChat.mentionPatterns` → `messages.groupChat.mentionPatterns`
- `routing.queue` → `messages.queue`
- `routing.bindings` → nivel superior `bindings`
- `routing.agents`/`routing.defaultAgentId` → `agents.list` + `agents.list[].default`
- `routing.agentToAgent` → `tools.agentToAgent`
- `routing.transcribeAudio` → `tools.media.audio.models`
- `bindings[].match.accountID` → `bindings[].match.accountId`
- `identity` → `agents.list[].identity`
- `agent.*` → `agents.defaults` + `tools.*` (tools/elevated/exec/sandbox/subagents)
- `agent.model`/`allowedModels`/`modelAliases`/`modelFallbacks`/`imageModelFallbacks`
  → `agents.defaults.models` + `agents.defaults.model.primary/fallbacks` + `agents.defaults.imageModel.primary/fallbacks`

### 2b) Sobrescrituras del proveedor OpenCode Zen

Si ha agregado `models.providers.opencode` (o `opencode-zen`) manualmente, esto
sobrescribe el catalogo integrado de OpenCode Zen desde `@mariozechner/pi-ai`. Eso puede
forzar todos los modelos a una sola API o poner los costos en cero. Doctor advierte
para que pueda eliminar la sobrescritura y restaurar el enrutamiento por modelo + costos.

### 3) Migraciones de estado heredado (disposicion en disco)

Doctor puede migrar disposiciones antiguas en disco a la estructura actual:

- Almacen de sesiones + transcripciones:
  - de `~/.openclaw/sessions/` a `~/.openclaw/agents/<agentId>/sessions/`
- Directorio del agente:
  - de `~/.openclaw/agent/` a `~/.openclaw/agents/<agentId>/agent/`
- Estado de autenticacion de WhatsApp (Baileys):
  - desde el heredado `~/.openclaw/credentials/*.json` (excepto `oauth.json`)
  - a `~/.openclaw/credentials/whatsapp/<accountId>/...` (id de cuenta predeterminado: `default`)

Estas migraciones son de mejor esfuerzo e idempotentes; doctor emitira advertencias
cuando deje carpetas heredadas como respaldos. El Gateway/CLI tambien migra
automaticamente las sesiones heredadas + el directorio del agente al iniciar para
que el historial/autenticacion/modelos queden en la ruta por agente sin ejecutar
doctor manualmente. La autenticacion de WhatsApp se migra intencionalmente solo via `openclaw doctor`.

### 4) Comprobaciones de integridad del estado (persistencia de sesiones, enrutamiento y seguridad)

El directorio de estado es el tronco cerebral operativo. Si desaparece, usted pierde
sesiones, credenciales, registros y configuracion (a menos que tenga respaldos en otro lugar).

Doctor comprueba:

- **Directorio de estado faltante**: advierte sobre la perdida catastrofica del estado, solicita recrear
  el directorio y le recuerda que no puede recuperar datos faltantes.
- **Permisos del directorio de estado**: verifica la capacidad de escritura; ofrece reparar permisos
  (y emite una pista de `chown` cuando se detecta una discrepancia de propietario/grupo).
- **Directorios de sesion faltantes**: `sessions/` y el directorio del almacen de sesiones son
  necesarios para persistir el historial y evitar fallos de `ENOENT`.
- **Desajuste de transcripciones**: advierte cuando entradas recientes de sesion no tienen
  archivos de transcripcion.
- **Sesion principal “JSONL de una linea”**: marca cuando la transcripcion principal tiene solo una
  linea (el historial no se esta acumulando).
- **Multiples directorios de estado**: advierte cuando existen multiples carpetas `~/.openclaw` en
  directorios home o cuando `OPENCLAW_STATE_DIR` apunta a otro lugar (el historial puede
  dividirse entre instalaciones).
- **Recordatorio de modo remoto**: si `gateway.mode=remote`, doctor le recuerda ejecutar
  en el host remoto (el estado vive alli).
- **Permisos del archivo de configuracion**: advierte si `~/.openclaw/openclaw.json` es
  legible por grupo/mundo y ofrece ajustar a `600`.

### 5) Salud de autenticacion de modelos (caducidad de OAuth)

Doctor inspecciona perfiles OAuth en el almacen de autenticacion, advierte cuando los tokens estan
por expirar/expirados y puede renovarlos cuando es seguro. Si el perfil de Anthropic Claude Code
esta obsoleto, sugiere ejecutar `claude setup-token` (o pegar un setup-token).
Las solicitudes de renovacion solo aparecen al ejecutarse de forma interactiva (TTY); `--non-interactive`
omite intentos de renovacion.

Doctor tambien informa perfiles de autenticacion temporalmente inutilizables debido a:

- enfriamientos cortos (limites de tasa/tiempos de espera/fallos de autenticacion)
- deshabilitaciones mas largas (fallos de facturacion/credito)

### 6) Validacion del modelo de hooks

Si se establece `hooks.gmail.model`, doctor valida la referencia del modelo contra el
catalogo y la allowlist y advierte cuando no se resolvera o no esta permitido.

### 7) Reparacion de imagen de Sandbox

Cuando sandboxing esta habilitado, doctor comprueba las imagenes de Docker y ofrece
construir o cambiar a nombres heredados si falta la imagen actual.

### 8) Migraciones de servicios del Gateway y sugerencias de limpieza

Doctor detecta servicios de gateway heredados (launchd/systemd/schtasks) y
ofrece eliminarlos e instalar el servicio de OpenClaw usando el puerto actual del gateway.
Tambien puede escanear servicios adicionales tipo gateway e imprimir sugerencias de limpieza.
Los servicios del gateway OpenClaw con nombre de perfil se consideran de primera clase y no se
marcan como "adicionales".

### 9) Advertencias de seguridad

Doctor emite advertencias cuando un proveedor esta abierto a Mensajes directos sin una allowlist, o
cuando una politica esta configurada de forma peligrosa.

### 10) Linger de systemd (Linux)

Si se ejecuta como un servicio de usuario systemd, doctor asegura que lingering este habilitado para que el
gateway siga activo despues de cerrar sesion.

### 11) Estado de Skills

Doctor imprime un resumen rapido de Skills elegibles/faltantes/bloqueadas para el workspace actual.

### 12) Comprobaciones de autenticacion del Gateway (token local)

Doctor advierte cuando falta `gateway.auth` en un gateway local y ofrece
generar un token. Use `openclaw doctor --generate-gateway-token` para forzar la
creacion de tokens en automatizacion.

### 13) Comprobacion de salud del Gateway + reinicio

Doctor ejecuta una comprobacion de salud y ofrece reiniciar el gateway cuando parece
no saludable.

### 14) Advertencias de estado de canales

Si el gateway esta saludable, doctor ejecuta un sondeo del estado de canales e informa
advertencias con correcciones sugeridas.

### 15) Auditoria + reparacion de configuracion del supervisor

Doctor comprueba la configuracion del supervisor instalada (launchd/systemd/schtasks) en busca de
valores predeterminados faltantes u obsoletos (p. ej., dependencias network-online de systemd y
retraso de reinicio). Cuando encuentra una discrepancia, recomienda una actualizacion y puede
reescribir el archivo de servicio/tarea a los valores predeterminados actuales.

Notas:

- `openclaw doctor` solicita confirmacion antes de reescribir la configuracion del supervisor.
- `openclaw doctor --yes` acepta las solicitudes de reparacion predeterminadas.
- `openclaw doctor --repair` aplica correcciones recomendadas sin solicitudes.
- `openclaw doctor --repair --force` sobrescribe configuraciones personalizadas del supervisor.
- Siempre puede forzar una reescritura completa mediante `openclaw gateway install --force`.

### 16) Diagnosticos de tiempo de ejecucion + puerto del Gateway

Doctor inspecciona el tiempo de ejecucion del servicio (PID, ultimo estado de salida) y advierte cuando el
servicio esta instalado pero no se esta ejecutando realmente. Tambien comprueba colisiones de puertos
en el puerto del gateway (predeterminado `18789`) e informa causas probables (gateway ya
en ejecucion, tunel SSH).

### 17) Mejores practicas del tiempo de ejecucion del Gateway

Doctor advierte cuando el servicio del gateway se ejecuta en Bun o en una ruta de Node administrada por
un gestor de versiones (`nvm`, `fnm`, `volta`, `asdf`, etc.). Los canales de WhatsApp + Telegram requieren Node,
y las rutas de gestores de versiones pueden romperse despues de actualizaciones porque el servicio no
carga la inicializacion del shell. Doctor ofrece migrar a una instalacion de Node del sistema cuando
este disponible (Homebrew/apt/choco).

### 18) Escritura de configuracion + metadatos del asistente

Doctor persiste cualquier cambio de configuracion y sella metadatos del asistente para registrar la
ejecucion de doctor.

### 19) Consejos de workspace (respaldo + sistema de memoria)

Doctor sugiere un sistema de memoria del workspace cuando falta e imprime un consejo de respaldo
si el workspace no esta ya bajo git.

Consulte [/concepts/agent-workspace](/concepts/agent-workspace) para una guia completa sobre la
estructura del workspace y el respaldo con git (recomendado GitHub o GitLab privados).
