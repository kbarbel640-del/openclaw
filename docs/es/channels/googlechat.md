---
summary: "Estado de soporte de la app de Google Chat, capacidades y configuracion"
read_when:
  - Trabajando en funciones del canal de Google Chat
title: "Google Chat"
x-i18n:
  source_path: channels/googlechat.md
  source_hash: 3b2bb116cdd12614
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:04Z
---

# Google Chat (Chat API)

Estado: listo para Mensajes directos + espacios mediante webhooks de Google Chat API (solo HTTP).

## Inicio rapido (principiante)

1. Cree un proyecto de Google Cloud y habilite la **Google Chat API**.
   - Vaya a: [Credenciales de Google Chat API](https://console.cloud.google.com/apis/api/chat.googleapis.com/credentials)
   - Habilite la API si aún no está habilitada.
2. Cree una **Cuenta de servicio**:
   - Presione **Create Credentials** > **Service Account**.
   - Nómbrela como desee (p. ej., `openclaw-chat`).
   - Deje los permisos en blanco (presione **Continue**).
   - Deje los principales con acceso en blanco (presione **Done**).
3. Cree y descargue la **Clave JSON**:
   - En la lista de cuentas de servicio, haga clic en la que acaba de crear.
   - Vaya a la pestaña **Keys**.
   - Haga clic en **Add Key** > **Create new key**.
   - Seleccione **JSON** y presione **Create**.
4. Guarde el archivo JSON descargado en su host del gateway (p. ej., `~/.openclaw/googlechat-service-account.json`).
5. Cree una app de Google Chat en la [Configuración de Chat de Google Cloud Console](https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat):
   - Complete la **Application info**:
     - **App name**: (p. ej. `OpenClaw`)
     - **Avatar URL**: (p. ej. `https://openclaw.ai/logo.png`)
     - **Description**: (p. ej. `Personal AI Assistant`)
   - Habilite **Interactive features**.
   - En **Functionality**, marque **Join spaces and group conversations**.
   - En **Connection settings**, seleccione **HTTP endpoint URL**.
   - En **Triggers**, seleccione **Use a common HTTP endpoint URL for all triggers** y configúrelo con la URL pública de su gateway seguida de `/googlechat`.
     - _Consejo: Ejecute `openclaw status` para encontrar la URL pública de su gateway._
   - En **Visibility**, marque **Make this Chat app available to specific people and groups in &lt;Your Domain&gt;**.
   - Ingrese su dirección de correo electrónico (p. ej. `user@example.com`) en el cuadro de texto.
   - Haga clic en **Save** en la parte inferior.
6. **Habilite el estado de la app**:
   - Después de guardar, **actualice la página**.
   - Busque la sección **App status** (generalmente cerca de la parte superior o inferior después de guardar).
   - Cambie el estado a **Live - available to users**.
   - Haga clic en **Save** nuevamente.
7. Configure OpenClaw con la ruta de la cuenta de servicio + audiencia del webhook:
   - Env: `GOOGLE_CHAT_SERVICE_ACCOUNT_FILE=/path/to/service-account.json`
   - O config: `channels.googlechat.serviceAccountFile: "/path/to/service-account.json"`.
8. Establezca el tipo + valor de la audiencia del webhook (coincide con la configuración de su app de Chat).
9. Inicie el gateway. Google Chat enviará POST a su ruta de webhook.

## Agregar a Google Chat

Una vez que el gateway esté en ejecución y su correo esté agregado a la lista de visibilidad:

1. Vaya a [Google Chat](https://chat.google.com/).
2. Haga clic en el icono **+** (más) junto a **Direct Messages**.
3. En la barra de búsqueda (donde normalmente agrega personas), escriba el **App name** que configuró en Google Cloud Console.
   - **Nota**: El bot _no_ aparecerá en la lista de exploración del "Marketplace" porque es una app privada. Debe buscarlo por nombre.
4. Seleccione su bot de los resultados.
5. Haga clic en **Add** o **Chat** para iniciar una conversación 1:1.
6. Envíe "Hello" para activar el asistente.

## URL pública (solo webhook)

Los webhooks de Google Chat requieren un endpoint HTTPS público. Por seguridad, **exponga solo la ruta `/googlechat`** a internet. Mantenga el panel de OpenClaw y otros endpoints sensibles en su red privada.

### Opción A: Tailscale Funnel (Recomendado)

Use Tailscale Serve para el panel privado y Funnel para la ruta pública del webhook. Esto mantiene `/` privado mientras expone solo `/googlechat`.

1. **Verifique a qué dirección está vinculado su gateway:**

   ```bash
   ss -tlnp | grep 18789
   ```

   Anote la dirección IP (p. ej., `127.0.0.1`, `0.0.0.0`, o su IP de Tailscale como `100.x.x.x`).

2. **Exponga el panel solo al tailnet (puerto 8443):**

   ```bash
   # If bound to localhost (127.0.0.1 or 0.0.0.0):
   tailscale serve --bg --https 8443 http://127.0.0.1:18789

   # If bound to Tailscale IP only (e.g., 100.106.161.80):
   tailscale serve --bg --https 8443 http://100.106.161.80:18789
   ```

3. **Exponga públicamente solo la ruta del webhook:**

   ```bash
   # If bound to localhost (127.0.0.1 or 0.0.0.0):
   tailscale funnel --bg --set-path /googlechat http://127.0.0.1:18789/googlechat

   # If bound to Tailscale IP only (e.g., 100.106.161.80):
   tailscale funnel --bg --set-path /googlechat http://100.106.161.80:18789/googlechat
   ```

4. **Autorice el nodo para acceso a Funnel:**
   Si se le solicita, visite la URL de autorización que aparece en la salida para habilitar Funnel para este nodo en la política de su tailnet.

5. **Verifique la configuración:**
   ```bash
   tailscale serve status
   tailscale funnel status
   ```

Su URL pública del webhook será:
`https://<node-name>.<tailnet>.ts.net/googlechat`

Su panel privado permanece solo en el tailnet:
`https://<node-name>.<tailnet>.ts.net:8443/`

Use la URL pública (sin `:8443`) en la configuración de la app de Google Chat.

> Nota: Esta configuración persiste entre reinicios. Para eliminarla más adelante, ejecute `tailscale funnel reset` y `tailscale serve reset`.

### Opción B: Proxy inverso (Caddy)

Si utiliza un proxy inverso como Caddy, haga proxy solo de la ruta específica:

```caddy
your-domain.com {
    reverse_proxy /googlechat* localhost:18789
}
```

Con esta configuración, cualquier solicitud a `your-domain.com/` será ignorada o devolverá 404, mientras que `your-domain.com/googlechat` se enruta de forma segura a OpenClaw.

### Opción C: Cloudflare Tunnel

Configure las reglas de ingreso de su túnel para enrutar solo la ruta del webhook:

- **Path**: `/googlechat` -> `http://localhost:18789/googlechat`
- **Default Rule**: HTTP 404 (No encontrado)

## Cómo funciona

1. Google Chat envía POSTs de webhook al gateway. Cada solicitud incluye un encabezado `Authorization: Bearer <token>`.
2. OpenClaw verifica el token contra el `audienceType` + `audience` configurados:
   - `audienceType: "app-url"` → la audiencia es su URL HTTPS del webhook.
   - `audienceType: "project-number"` → la audiencia es el número del proyecto de Cloud.
3. Los mensajes se enrutan por espacio:
   - Los Mensajes directos usan la clave de sesion `agent:<agentId>:googlechat:dm:<spaceId>`.
   - Los espacios usan la clave de sesion `agent:<agentId>:googlechat:group:<spaceId>`.
4. El acceso a Mensajes directos es por emparejamiento de forma predeterminada. Los remitentes desconocidos reciben un código de emparejamiento; apruebe con:
   - `openclaw pairing approve googlechat <code>`
5. Los espacios de grupo requieren @-mención de forma predeterminada. Use `botUser` si la detección de menciones necesita el nombre de usuario de la app.

## Destinos

Use estos identificadores para entrega y listas de permitidos:

- Mensajes directos: `users/<userId>` o `users/<email>` (se aceptan direcciones de correo electrónico).
- Espacios: `spaces/<spaceId>`.

## Aspectos destacados de la configuracion

```json5
{
  channels: {
    googlechat: {
      enabled: true,
      serviceAccountFile: "/path/to/service-account.json",
      audienceType: "app-url",
      audience: "https://gateway.example.com/googlechat",
      webhookPath: "/googlechat",
      botUser: "users/1234567890", // optional; helps mention detection
      dm: {
        policy: "pairing",
        allowFrom: ["users/1234567890", "name@example.com"],
      },
      groupPolicy: "allowlist",
      groups: {
        "spaces/AAAA": {
          allow: true,
          requireMention: true,
          users: ["users/1234567890"],
          systemPrompt: "Short answers only.",
        },
      },
      actions: { reactions: true },
      typingIndicator: "message",
      mediaMaxMb: 20,
    },
  },
}
```

Notas:

- Las credenciales de la cuenta de servicio también pueden pasarse en línea con `serviceAccount` (cadena JSON).
- La ruta predeterminada del webhook es `/googlechat` si `webhookPath` no está configurado.
- Las reacciones están disponibles mediante la herramienta `reactions` y `channels action` cuando `actions.reactions` está habilitado.
- `typingIndicator` admite `none`, `message` (predeterminado) y `reaction` (la reacción requiere OAuth de usuario).
- Los adjuntos se descargan a través de la Chat API y se almacenan en la canalización de medios (tamaño limitado por `mediaMaxMb`).

## Solucion de problemas

### 405 Method Not Allowed

Si Google Cloud Logs Explorer muestra errores como:

```
status code: 405, reason phrase: HTTP error response: HTTP/1.1 405 Method Not Allowed
```

Esto significa que el manejador del webhook no está registrado. Causas comunes:

1. **Canal no configurado**: Falta la sección `channels.googlechat` en su configuracion. Verifique con:

   ```bash
   openclaw config get channels.googlechat
   ```

   Si devuelve "Config path not found", agregue la configuracion (vea [Aspectos destacados de la configuracion](#aspectos-destacados-de-la-configuracion)).

2. **Plugin no habilitado**: Verifique el estado del plugin:

   ```bash
   openclaw plugins list | grep googlechat
   ```

   Si muestra "disabled", agregue `plugins.entries.googlechat.enabled: true` a su configuracion.

3. **Gateway no reiniciado**: Después de agregar la configuracion, reinicie el gateway:
   ```bash
   openclaw gateway restart
   ```

Verifique que el canal esté en ejecución:

```bash
openclaw channels status
# Should show: Google Chat default: enabled, configured, ...
```

### Otros problemas

- Revise `openclaw channels status --probe` para errores de autenticación o configuración de audiencia faltante.
- Si no llegan mensajes, confirme la URL del webhook de la app de Chat + las suscripciones de eventos.
- Si el control por menciones bloquea respuestas, configure `botUser` con el nombre del recurso de usuario de la app y verifique `requireMention`.
- Use `openclaw logs --follow` mientras envía un mensaje de prueba para ver si las solicitudes llegan al gateway.

Documentos relacionados:

- [Configuracion del Gateway](/gateway/configuration)
- [Seguridad](/gateway/security)
- [Reacciones](/tools/reactions)
