---
summary: "Guía rápida de solución de problemas para fallas comunes de OpenClaw"
read_when:
  - Investigando problemas o fallas en tiempo de ejecución
title: "Solución de problemas"
x-i18n:
  source_path: gateway/troubleshooting.md
  source_hash: a07bb06f0b5ef568
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:49Z
---

# Solución de problemas 🔧

Cuando OpenClaw se porta mal, aquí le mostramos cómo arreglarlo.

Comience con los [Primeros 60 segundos](/help/faq#first-60-seconds-if-somethings-broken) de las Preguntas frecuentes si solo quiere una receta rápida de triaje. Esta página profundiza en fallas en tiempo de ejecución y diagnósticos.

Atajos específicos por proveedor: [/channels/troubleshooting](/channels/troubleshooting)

## Estado y diagnósticos

Comandos rápidos de triaje (en orden):

| Comando                            | Qué le indica                                                                                                                  | Cuándo usarlo                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `openclaw status`                  | Resumen local: SO + actualización, alcance/modo del gateway, servicio, agentes/sesiones, estado de configuración del proveedor | Primera verificación, vista rápida                          |
| `openclaw status --all`            | Diagnóstico local completo (solo lectura, pegable, relativamente seguro) incl. cola de logs                                    | Cuando necesita compartir un informe de depuración          |
| `openclaw status --deep`           | Ejecuta verificaciones de salud del gateway (incl. sondas de proveedores; requiere gateway accesible)                          | Cuando “configurado” no significa “funcionando”             |
| `openclaw gateway probe`           | Descubrimiento del Gateway + alcance (objetivos locales + remotos)                                                             | Cuando sospecha que está sondeando el gateway incorrecto    |
| `openclaw channels status --probe` | Pregunta al Gateway en ejecución por el estado de los canales (y opcionalmente sondea)                                         | Cuando el Gateway es accesible pero los canales fallan      |
| `openclaw gateway status`          | Estado del supervisor (launchd/systemd/schtasks), PID/salida en tiempo de ejecución, último error del Gateway                  | Cuando el servicio “parece cargado” pero no se ejecuta nada |
| `openclaw logs --follow`           | Logs en vivo (la mejor señal para problemas en tiempo de ejecución)                                                            | Cuando necesita la razón real de la falla                   |

**Compartir salida:** prefiera `openclaw status --all` (redacta tokens). Si pega `openclaw status`, considere configurar primero `OPENCLAW_SHOW_SECRETS=0` (vistas previas de tokens).

Vea también: [Health checks](/gateway/health) y [Logging](/logging).

## Problemas comunes

### No API key found for provider "anthropic"

Esto significa que **el almacén de autenticación del agente está vacío** o le faltan credenciales de Anthropic.
La autenticación es **por agente**, por lo que un agente nuevo no heredará las claves del agente principal.

Opciones de solución:

- Vuelva a ejecutar la incorporación y elija **Anthropic** para ese agente.
- O pegue un setup-token en el **host del gateway**:
  ```bash
  openclaw models auth setup-token --provider anthropic
  ```
- O copie `auth-profiles.json` del directorio del agente principal al directorio del nuevo agente.

Verifique:

```bash
openclaw models status
```

### OAuth token refresh failed (Anthropic Claude subscription)

Esto significa que el token OAuth de Anthropic almacenado expiró y la actualización falló.
Si usa una suscripción de Claude (sin API key), la solución más confiable es
cambiar a un **setup-token de Claude Code** y pegarlo en el **host del gateway**.

**Recomendado (setup-token):**

```bash
# Run on the gateway host (paste the setup-token)
openclaw models auth setup-token --provider anthropic
openclaw models status
```

Si generó el token en otro lugar:

```bash
openclaw models auth paste-token --provider anthropic
openclaw models status
```

Más detalles: [Anthropic](/providers/anthropic) y [OAuth](/concepts/oauth).

### La UI de control falla en HTTP ("device identity required" / "connect failed")

Si abre el panel en HTTP plano (p. ej. `http://<lan-ip>:18789/` o
`http://<tailscale-ip>:18789/`), el navegador se ejecuta en un **contexto no seguro** y
bloquea WebCrypto, por lo que no se puede generar la identidad del dispositivo.

**Solución:**

- Prefiera HTTPS mediante [Tailscale Serve](/gateway/tailscale).
- O ábralo localmente en el host del gateway: `http://127.0.0.1:18789/`.
- Si debe quedarse en HTTP, habilite `gateway.controlUi.allowInsecureAuth: true` y
  use un token del gateway (solo token; sin identidad/emparejamiento de dispositivo). Consulte
  [Control UI](/web/control-ui#insecure-http).

### CI Secrets Scan Failed

Esto significa que `detect-secrets` encontró nuevos candidatos que aún no están en la línea base.
Siga [Secret scanning](/gateway/security#secret-scanning-detect-secrets).

### Servicio instalado pero nada está ejecutándose

Si el servicio del gateway está instalado pero el proceso sale inmediatamente, el servicio
puede parecer “cargado” mientras no hay nada ejecutándose.

**Verifique:**

```bash
openclaw gateway status
openclaw doctor
```

Doctor/servicio mostrará el estado de ejecución (PID/última salida) y pistas en los logs.

**Logs:**

- Preferido: `openclaw logs --follow`
- Logs de archivo (siempre): `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (o su `logging.file` configurado)
- macOS LaunchAgent (si está instalado): `$OPENCLAW_STATE_DIR/logs/gateway.log` y `gateway.err.log`
- Linux systemd (si está instalado): `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`
- Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST`

**Habilitar más registro:**

- Aumentar detalle del log de archivo (JSONL persistente):
  ```json
  { "logging": { "level": "debug" } }
  ```
- Aumentar verbosidad de consola (solo salida TTY):
  ```json
  { "logging": { "consoleLevel": "debug", "consoleStyle": "pretty" } }
  ```
- Consejo rápido: `--verbose` afecta **solo** la salida de la consola. Los logs de archivo siguen controlados por `logging.level`.

Vea [/logging](/logging) para una vista completa de formatos, configuración y acceso.

### "Gateway start blocked: set gateway.mode=local"

Esto significa que la configuración existe pero `gateway.mode` no está establecido (o no es `local`), por lo que el
Gateway se niega a iniciar.

**Solución (recomendada):**

- Ejecute el asistente y establezca el modo de ejecución del Gateway en **Local**:
  ```bash
  openclaw configure
  ```
- O configúrelo directamente:
  ```bash
  openclaw config set gateway.mode local
  ```

**Si pretendía ejecutar un Gateway remoto en su lugar:**

- Establezca una URL remota y mantenga `gateway.mode=remote`:
  ```bash
  openclaw config set gateway.mode remote
  openclaw config set gateway.remote.url "wss://gateway.example.com"
  ```

**Ad-hoc/dev solamente:** pase `--allow-unconfigured` para iniciar el gateway sin
`gateway.mode=local`.

**¿Aún no hay archivo de configuración?** Ejecute `openclaw setup` para crear una configuración inicial, luego vuelva a ejecutar
el gateway.

### Entorno del servicio (PATH + runtime)

El servicio del gateway se ejecuta con un **PATH mínimo** para evitar residuos de shell/gestor:

- macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`
- Linux: `/usr/local/bin`, `/usr/bin`, `/bin`

Esto excluye intencionalmente gestores de versiones (nvm/fnm/volta/asdf) y gestores
de paquetes (pnpm/npm) porque el servicio no carga su init de shell. Variables de
runtime como `DISPLAY` deben vivir en `~/.openclaw/.env` (cargado temprano por el
gateway).
Las ejecuciones de Exec en `host=gateway` fusionan su `PATH` del shell de inicio de sesión en el entorno de ejecución,
por lo que las herramientas faltantes suelen significar que su init de shell no las exporta (o establezca
`tools.exec.pathPrepend`). Vea [/tools/exec](/tools/exec).

Los canales de WhatsApp + Telegram requieren **Node**; Bun no es compatible. Si su
servicio se instaló con Bun o una ruta de Node gestionada por versiones, ejecute `openclaw doctor`
para migrar a una instalación de Node del sistema.

### A la Skill le falta la API key en sandbox

**Síntoma:** La Skill funciona en el host pero falla en sandbox por falta de API key.

**Por qué:** la ejecución en sandbox corre dentro de Docker y **no** hereda `process.env` del host.

**Solución:**

- establezca `agents.defaults.sandbox.docker.env` (o por agente `agents.list[].sandbox.docker.env`)
- o incorpore la clave en su imagen de sandbox personalizada
- luego ejecute `openclaw sandbox recreate --agent <id>` (o `--all`)

### Servicio en ejecución pero el puerto no escucha

Si el servicio reporta **en ejecución** pero nada escucha en el puerto del gateway,
el Gateway probablemente se negó a enlazar.

**Qué significa “en ejecución” aquí**

- `Runtime: running` significa que su supervisor (launchd/systemd/schtasks) cree que el proceso está vivo.
- `RPC probe` significa que la CLI pudo conectarse realmente al WebSocket del gateway y llamar a `status`.
- Confíe siempre en `Probe target:` + `Config (service):` como las líneas de “¿qué intentamos realmente?”.

**Verifique:**

- `gateway.mode` debe ser `local` para `openclaw gateway` y el servicio.
- Si configuró `gateway.mode=remote`, la **CLI por defecto** usa una URL remota. El servicio puede seguir ejecutándose localmente, pero su CLI podría estar sondeando el lugar equivocado. Use `openclaw gateway status` para ver el puerto resuelto del servicio + el objetivo del sondeo (o pase `--url`).
- `openclaw gateway status` y `openclaw doctor` exponen el **último error del Gateway** desde los logs cuando el servicio parece en ejecución pero el puerto está cerrado.
- Enlaces no loopback (`lan`/`tailnet`/`custom`, o `auto` cuando loopback no está disponible) requieren autenticación:
  `gateway.auth.token` (o `OPENCLAW_GATEWAY_TOKEN`).
- `gateway.remote.token` es solo para llamadas remotas de la CLI; **no** habilita autenticación local.
- `gateway.token` se ignora; use `gateway.auth.token`.

**Si `openclaw gateway status` muestra una discrepancia de configuración**

- `Config (cli): ...` y `Config (service): ...` normalmente deben coincidir.
- Si no coinciden, casi seguro está editando una configuración mientras el servicio ejecuta otra.
- Solución: vuelva a ejecutar `openclaw gateway install --force` desde el mismo `--profile` / `OPENCLAW_STATE_DIR` que desea que use el servicio.

**Si `openclaw gateway status` reporta problemas de configuración del servicio**

- La configuración del supervisor (launchd/systemd/schtasks) carece de valores predeterminados actuales.
- Solución: ejecute `openclaw doctor` para actualizarla (o `openclaw gateway install --force` para una reescritura completa).

**Si `Last gateway error:` menciona “refusing to bind … without auth”**

- Estableció `gateway.bind` a un modo no loopback (`lan`/`tailnet`/`custom`, o `auto` cuando loopback no está disponible) pero no configuró autenticación.
- Solución: establezca `gateway.auth.mode` + `gateway.auth.token` (o exporte `OPENCLAW_GATEWAY_TOKEN`) y reinicie el servicio.

**Si `openclaw gateway status` dice `bind=tailnet` pero no se encontró una interfaz tailnet**

- El gateway intentó enlazar a una IP de Tailscale (100.64.0.0/10) pero no se detectó ninguna en el host.
- Solución: inicie Tailscale en esa máquina (o cambie `gateway.bind` a `loopback`/`lan`).

**Si `Probe note:` dice que la sonda usa loopback**

- Eso es esperado para `bind=lan`: el gateway escucha en `0.0.0.0` (todas las interfaces), y loopback aún debería conectarse localmente.
- Para clientes remotos, use una IP LAN real (no `0.0.0.0`) más el puerto, y asegúrese de que la autenticación esté configurada.

### Dirección ya en uso (Puerto 18789)

Esto significa que algo ya está escuchando en el puerto del gateway.

**Verifique:**

```bash
openclaw gateway status
```

Mostrará los oyentes y las causas probables (gateway ya en ejecución, túnel SSH).
Si es necesario, detenga el servicio o elija un puerto diferente.

### Carpetas de workspace adicionales detectadas

Si actualizó desde instalaciones antiguas, aún podría tener `~/openclaw` en disco.
Múltiples directorios de workspace pueden causar una deriva confusa de autenticación o estado porque
solo un workspace está activo.

**Solución:** mantenga un solo workspace activo y archive/elimine el resto. Consulte
[Agent workspace](/concepts/agent-workspace#extra-workspace-folders).

### Chat principal ejecutándose en un workspace sandbox

Síntomas: `pwd` o las herramientas de archivos muestran `~/.openclaw/sandboxes/...` aunque
esperaba el workspace del host.

**Por qué:** `agents.defaults.sandbox.mode: "non-main"` se basa en `session.mainKey` (predeterminado `"main"`).
Las sesiones de grupo/canal usan sus propias claves, por lo que se tratan como no principales y
obtienen workspaces sandbox.

**Opciones de solución:**

- Si desea workspaces del host para un agente: establezca `agents.list[].sandbox.mode: "off"`.
- Si desea acceso al workspace del host dentro de sandbox: establezca `workspaceAccess: "rw"` para ese agente.

### "Agent was aborted"

El agente fue interrumpido a mitad de la respuesta.

**Causas:**

- El usuario envió `stop`, `abort`, `esc`, `wait` o `exit`
- Se excedió el tiempo de espera
- El proceso se bloqueó

**Solución:** Simplemente envíe otro mensaje. La sesión continúa.

### "Agent failed before reply: Unknown model: anthropic/claude-haiku-3-5"

OpenClaw rechaza intencionalmente **modelos antiguos/inseguros** (especialmente aquellos más
vulnerables a la inyección de prompts). Si ve este error, el nombre del modelo ya no es compatible.

**Solución:**

- Elija un modelo **más reciente** para el proveedor y actualice su configuración o alias de modelo.
- Si no está seguro de qué modelos están disponibles, ejecute `openclaw models list` o
  `openclaw models scan` y elija uno compatible.
- Revise los logs del gateway para conocer la razón detallada de la falla.

Vea también: [Models CLI](/cli/models) y [Model providers](/concepts/model-providers).

### Los mensajes no se activan

**Verificación 1:** ¿El remitente está en la allowlist?

```bash
openclaw status
```

Busque `AllowFrom: ...` en la salida.

**Verificación 2:** Para chats grupales, ¿se requiere mención?

```bash
# The message must match mentionPatterns or explicit mentions; defaults live in channel groups/guilds.
# Multi-agent: `agents.list[].groupChat.mentionPatterns` overrides global patterns.
grep -n "agents\\|groupChat\\|mentionPatterns\\|channels\\.whatsapp\\.groups\\|channels\\.telegram\\.groups\\|channels\\.imessage\\.groups\\|channels\\.discord\\.guilds" \
  "${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
```

**Verificación 3:** Revise los logs

```bash
openclaw logs --follow
# or if you want quick filters:
tail -f "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | grep "blocked\\|skip\\|unauthorized"
```

### El código de emparejamiento no llega

Si `dmPolicy` está en `pairing`, los remitentes desconocidos deberían recibir un código y su mensaje se ignora hasta ser aprobado.

**Verificación 1:** ¿Ya hay una solicitud pendiente esperando?

```bash
openclaw pairing list <channel>
```

Las solicitudes de emparejamiento por Mensaje directo pendientes están limitadas a **3 por canal** de forma predeterminada. Si la lista está llena, las nuevas solicitudes no generarán un código hasta que una sea aprobada o expire.

**Verificación 2:** ¿La solicitud se creó pero no se envió respuesta?

```bash
openclaw logs --follow | grep "pairing request"
```

**Verificación 3:** Confirme que `dmPolicy` no sea `open`/`allowlist` para ese canal.

### Imagen + mención no funciona

Problema conocido: cuando envía una imagen SOLO con una mención (sin otro texto), WhatsApp a veces no incluye los metadatos de la mención.

**Solución alternativa:** agregue algo de texto con la mención:

- ❌ `@openclaw` + imagen
- ✅ `@openclaw check this` + imagen

### La sesión no se reanuda

**Verificación 1:** ¿Está el archivo de sesión?

```bash
ls -la ~/.openclaw/agents/<agentId>/sessions/
```

**Verificación 2:** ¿La ventana de reinicio es demasiado corta?

```json
{
  "session": {
    "reset": {
      "mode": "daily",
      "atHour": 4,
      "idleMinutes": 10080 // 7 days
    }
  }
}
```

**Verificación 3:** ¿Alguien envió `/new`, `/reset` o un disparador de reinicio?

### El agente agota el tiempo

El tiempo de espera predeterminado es de 30 minutos. Para tareas largas:

```json
{
  "reply": {
    "timeoutSeconds": 3600 // 1 hour
  }
}
```

O use la herramienta `process` para ejecutar comandos largos en segundo plano.

### WhatsApp desconectado

```bash
# Check local status (creds, sessions, queued events)
openclaw status
# Probe the running gateway + channels (WA connect + Telegram + Discord APIs)
openclaw status --deep

# View recent connection events
openclaw logs --limit 200 | grep "connection\\|disconnect\\|logout"
```

**Solución:** Por lo general se reconecta automáticamente una vez que el Gateway está en ejecución. Si queda atascado, reinicie el proceso del Gateway (como sea que lo supervise) o ejecútelo manualmente con salida detallada:

```bash
openclaw gateway --verbose
```

Si se cerró la sesión / se desvinculó:

```bash
openclaw channels logout
trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/credentials" # if logout can't cleanly remove everything
openclaw channels login --verbose       # re-scan QR
```

### Falla el envío de medios

**Verificación 1:** ¿La ruta del archivo es válida?

```bash
ls -la /path/to/your/image.jpg
```

**Verificación 2:** ¿Es demasiado grande?

- Imágenes: máx. 6 MB
- Audio/Video: máx. 16 MB
- Documentos: máx. 100 MB

**Verificación 3:** Revise los logs de medios

```bash
grep "media\\|fetch\\|download" "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | tail -20
```

### Uso alto de memoria

OpenClaw mantiene el historial de conversaciones en memoria.

**Solución:** Reinicie periódicamente o establezca límites de sesión:

```json
{
  "session": {
    "historyLimit": 100 // Max messages to keep
  }
}
```

## Solución de problemas comunes

### “El Gateway no inicia — configuración inválida”

OpenClaw ahora se niega a iniciar cuando la configuración contiene claves desconocidas, valores mal formados o tipos inválidos.
Esto es intencional por seguridad.

Arréglelo con Doctor:

```bash
openclaw doctor
openclaw doctor --fix
```

Notas:

- `openclaw doctor` reporta cada entrada inválida.
- `openclaw doctor --fix` aplica migraciones/reparaciones y reescribe la configuración.
- Los comandos de diagnóstico como `openclaw logs`, `openclaw health`, `openclaw status`, `openclaw gateway status` y `openclaw gateway probe` aún se ejecutan incluso si la configuración es inválida.

### “All models failed” — ¿qué debo verificar primero?

- **Credenciales** presentes para el/los proveedor(es) que se están probando (perfiles de autenticación + variables de entorno).
- **Enrutamiento de modelos**: confirme que `agents.defaults.model.primary` y los fallbacks sean modelos a los que puede acceder.
- **Logs del Gateway** en `/tmp/openclaw/…` para el error exacto del proveedor.
- **Estado del modelo**: use `/model status` (chat) o `openclaw models status` (CLI).

### Estoy ejecutando en mi número personal de WhatsApp — ¿por qué el auto‑chat es extraño?

Habilite el modo de auto‑chat y agregue su propio número a la allowlist:

```json5
{
  channels: {
    whatsapp: {
      selfChatMode: true,
      dmPolicy: "allowlist",
      allowFrom: ["+15555550123"],
    },
  },
}
```

Vea [WhatsApp setup](/channels/whatsapp).

### WhatsApp me cerró la sesión. ¿Cómo vuelvo a autenticar?

Ejecute nuevamente el comando de inicio de sesión y escanee el código QR:

```bash
openclaw channels login
```

### Errores de build en `main` — ¿cuál es la ruta estándar de solución?

1. `git pull origin main && pnpm install`
2. `openclaw doctor`
3. Revise issues de GitHub o Discord
4. Solución temporal: cambie a un commit anterior

### npm install falla (allow-build-scripts / falta tar o yargs). ¿Y ahora?

Si ejecuta desde el código fuente, use el gestor de paquetes del repo: **pnpm** (preferido).
El repo declara `packageManager: "pnpm@…"`.

Recuperación típica:

```bash
git status   # ensure you’re in the repo root
pnpm install
pnpm build
openclaw doctor
openclaw gateway restart
```

Por qué: pnpm es el gestor de paquetes configurado para este repo.

### ¿Cómo cambio entre instalaciones por git y por npm?

Use el **instalador del sitio web** y seleccione el método de instalación con una bandera. Actualiza en el lugar y reescribe el servicio del gateway para apuntar a la nueva instalación.

Cambiar **a instalación por git**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
```

Cambiar **a npm global**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Notas:

- El flujo de git solo hace rebase si el repo está limpio. Haga commit o stash de los cambios primero.
- Después de cambiar, ejecute:
  ```bash
  openclaw doctor
  openclaw gateway restart
  ```

### El block streaming de Telegram no divide el texto entre llamadas de herramientas. ¿Por qué?

El block streaming solo envía **bloques de texto completados**. Razones comunes por las que ve un solo mensaje:

- `agents.defaults.blockStreamingDefault` sigue en `"off"`.
- `channels.telegram.blockStreaming` está configurado en `false`.
- `channels.telegram.streamMode` es `partial` o `block` **y el draft streaming está activo**
  (chat privado + temas). El draft streaming deshabilita el block streaming en ese caso.
- Sus configuraciones de `minChars` / coalesce son demasiado altas, por lo que los fragmentos se fusionan.
- El modelo emite un solo bloque grande de texto (sin puntos de vaciado a mitad de respuesta).

Lista de verificación para solucionar:

1. Coloque las configuraciones de block streaming bajo `agents.defaults`, no en la raíz.
2. Establezca `channels.telegram.streamMode: "off"` si desea respuestas de bloques reales con múltiples mensajes.
3. Use umbrales de fragmentos/coalesce más pequeños mientras depura.

Vea [Streaming](/concepts/streaming).

### Discord no responde en mi servidor incluso con `requireMention: false`. ¿Por qué?

`requireMention` solo controla el bloqueo por mención **después** de que el canal pasa las allowlists.
De forma predeterminada `channels.discord.groupPolicy` es **allowlist**, por lo que los guilds deben habilitarse explícitamente.
Si establece `channels.discord.guilds.<guildId>.channels`, solo los canales listados están permitidos; omítalo para permitir todos los canales del guild.

Lista de verificación para solucionar:

1. Establezca `channels.discord.groupPolicy: "open"` **o** agregue una entrada de allowlist de guild (y opcionalmente una allowlist de canal).
2. Use **IDs numéricos de canal** en `channels.discord.guilds.<guildId>.channels`.
3. Coloque `requireMention: false` **debajo de** `channels.discord.guilds` (global o por canal).
   El `channels.discord.requireMention` de nivel superior no es una clave compatible.
4. Asegúrese de que el bot tenga **Message Content Intent** y permisos de canal.
5. Ejecute `openclaw channels status --probe` para obtener pistas de auditoría.

Docs: [Discord](/channels/discord), [Channels troubleshooting](/channels/troubleshooting).

### Error de Cloud Code Assist API: esquema de herramienta inválido (400). ¿Y ahora?

Esto casi siempre es un problema de **compatibilidad del esquema de herramientas**. El endpoint de Cloud Code Assist
acepta un subconjunto estricto de JSON Schema. OpenClaw limpia/normaliza los esquemas de herramientas en la versión actual de `main`, pero la solución aún no está en la última versión (a
13 de enero de 2026).

Lista de verificación para solucionar:

1. **Actualice OpenClaw**:
   - Si puede ejecutar desde el código fuente, haga pull de `main` y reinicie el gateway.
   - De lo contrario, espere a la próxima versión que incluya el limpiador de esquemas.
2. Evite palabras clave no compatibles como `anyOf/oneOf/allOf`, `patternProperties`,
   `additionalProperties`, `minLength`, `maxLength`, `format`, etc.
3. Si define herramientas personalizadas, mantenga el esquema de nivel superior como `type: "object"` con
   `properties` y enums simples.

Vea [Tools](/tools) y [TypeBox schemas](/concepts/typebox).

## Problemas específicos de macOS

### La app se cierra al conceder permisos (voz/micrófono)

Si la app desaparece o muestra "Abort trap 6" cuando hace clic en "Permitir" en un aviso de privacidad:

**Solución 1: Restablecer la caché TCC**

```bash
tccutil reset All bot.molt.mac.debug
```

**Solución 2: Forzar un nuevo Bundle ID**
Si el restablecimiento no funciona, cambie el `BUNDLE_ID` en [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) (p. ej., agregue un sufijo `.test`) y reconstruya. Esto obliga a macOS a tratarla como una app nueva.

### Gateway atascado en "Starting..."

La app se conecta a un gateway local en el puerto `18789`. Si se queda atascada:

**Solución 1: Detener el supervisor (preferido)**
Si el gateway está supervisado por launchd, matar el PID solo lo hará reaparecer. Detenga primero el supervisor:

```bash
openclaw gateway status
openclaw gateway stop
# Or: launchctl bootout gui/$UID/bot.molt.gateway (replace with bot.molt.<profile>; legacy com.openclaw.* still works)
```

**Solución 2: El puerto está ocupado (encuentre el oyente)**

```bash
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

Si es un proceso no supervisado, intente primero una detención ordenada y luego escale:

```bash
kill -TERM <PID>
sleep 1
kill -9 <PID> # last resort
```

**Solución 3: Verifique la instalación de la CLI**
Asegúrese de que la CLI global `openclaw` esté instalada y coincida con la versión de la app:

```bash
openclaw --version
npm install -g openclaw@<version>
```

## Modo de depuración

Obtenga registro detallado:

```bash
# Turn on trace logging in config:
#   ${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json} -> { logging: { level: "trace" } }
#
# Then run verbose commands to mirror debug output to stdout:
openclaw gateway --verbose
openclaw channels login --verbose
```

## Ubicaciones de logs

| Log                                         | Ubicación                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logs de archivo del Gateway (estructurados) | `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (o `logging.file`)                                                                                                                                                                                                                                                                              |
| Logs del servicio del Gateway (supervisor)  | macOS: `$OPENCLAW_STATE_DIR/logs/gateway.log` + `gateway.err.log` (predeterminado: `~/.openclaw/logs/...`; los perfiles usan `~/.openclaw-<profile>/logs/...`)<br />Linux: `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`<br />Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST` |
| Archivos de sesión                          | `$OPENCLAW_STATE_DIR/agents/<agentId>/sessions/`                                                                                                                                                                                                                                                                                        |
| Caché de medios                             | `$OPENCLAW_STATE_DIR/media/`                                                                                                                                                                                                                                                                                                            |
| Credenciales                                | `$OPENCLAW_STATE_DIR/credentials/`                                                                                                                                                                                                                                                                                                      |

## Verificación de salud

```bash
# Supervisor + probe target + config paths
openclaw gateway status
# Include system-level scans (legacy/extra services, port listeners)
openclaw gateway status --deep

# Is the gateway reachable?
openclaw health --json
# If it fails, rerun with connection details:
openclaw health --verbose

# Is something listening on the default port?
lsof -nP -iTCP:18789 -sTCP:LISTEN

# Recent activity (RPC log tail)
openclaw logs --follow
# Fallback if RPC is down
tail -20 /tmp/openclaw/openclaw-*.log
```

## Restablecer todo

Opción nuclear:

```bash
openclaw gateway stop
# If you installed a service and want a clean install:
# openclaw gateway uninstall

trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
openclaw channels login         # re-pair WhatsApp
openclaw gateway restart           # or: openclaw gateway
```

⚠️ Esto pierde todas las sesiones y requiere volver a emparejar WhatsApp.

## Obtener ayuda

1. Revise los logs primero: `/tmp/openclaw/` (predeterminado: `openclaw-YYYY-MM-DD.log`, o su `logging.file` configurado)
2. Busque issues existentes en GitHub
3. Abra un issue nuevo con:
   - Versión de OpenClaw
   - Fragmentos de logs relevantes
   - Pasos para reproducir
   - Su configuración (¡redacte secretos!)

---

_"¿Ha probado apagarlo y encenderlo de nuevo?"_ — Toda persona de TI, alguna vez

🦞🔧

### El navegador no inicia (Linux)

Si ve `"Failed to start Chrome CDP on port 18800"`:

**Causa más probable:** Chromium empaquetado como Snap en Ubuntu.

**Solución rápida:** Instale Google Chrome en su lugar:

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
```

Luego configure en la configuración:

```json
{
  "browser": {
    "executablePath": "/usr/bin/google-chrome-stable"
  }
}
```

**Guía completa:** Consulte [browser-linux-troubleshooting](/tools/browser-linux-troubleshooting)
