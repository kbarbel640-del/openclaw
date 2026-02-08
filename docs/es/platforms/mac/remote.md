---
summary: "flujo de la app de macOS para controlar un Gateway de OpenClaw remoto por SSH"
read_when:
  - Configuracion o depuracion del control remoto de mac
title: "Control Remoto"
x-i18n:
  source_path: platforms/mac/remote.md
  source_hash: 61b43707250d5515
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:34Z
---

# OpenClaw remoto (macOS ⇄ host remoto)

Este flujo permite que la app de macOS actúe como un control remoto completo para un Gateway de OpenClaw que se ejecuta en otro host (escritorio/servidor). Es la función **Remote over SSH** (ejecución remota) de la app. Todas las funciones—comprobaciones de estado, reenvío de Voice Wake y Web Chat—reutilizan la misma configuracion remota por SSH desde _Settings → General_.

## Modos

- **Local (this Mac)**: Todo se ejecuta en la laptop. No hay SSH.
- **Remote over SSH (predeterminado)**: Los comandos de OpenClaw se ejecutan en el host remoto. La app de mac abre una conexión SSH con `-o BatchMode` más su identidad/llave elegida y un reenvío de puerto local.
- **Remote direct (ws/wss)**: Sin túnel SSH. La app de mac se conecta directamente a la URL del gateway (por ejemplo, vía Tailscale Serve o un proxy inverso HTTPS público).

## Transportes remotos

El modo remoto admite dos transportes:

- **Túnel SSH** (predeterminado): Usa `ssh -N -L ...` para reenviar el puerto del gateway a localhost. El gateway verá la IP del nodo como `127.0.0.1` porque el túnel es loopback.
- **Directo (ws/wss)**: Se conecta directamente a la URL del gateway. El gateway ve la IP real del cliente.

## Requisitos en el host remoto

1. Instale Node + pnpm y construya/instale el CLI de OpenClaw (`pnpm install && pnpm build && pnpm link --global`).
2. Asegúrese de que `openclaw` esté en PATH para shells no interactivos (cree un symlink en `/usr/local/bin` o `/opt/homebrew/bin` si es necesario).
3. Abra SSH con autenticación por llave. Recomendamos IPs de **Tailscale** para alcance estable fuera de la LAN.

## Configuracion de la app de macOS

1. Abra _Settings → General_.
2. En **OpenClaw runs**, elija **Remote over SSH** y configure:
   - **Transport**: **SSH tunnel** o **Direct (ws/wss)**.
   - **SSH target**: `user@host` (opcional `:port`).
     - Si el gateway está en la misma LAN y anuncia Bonjour, selecciónelo de la lista descubierta para autocompletar este campo.
   - **Gateway URL** (solo Direct): `wss://gateway.example.ts.net` (o `ws://...` para local/LAN).
   - **Identity file** (avanzado): ruta a su llave.
   - **Project root** (avanzado): ruta del checkout remoto usada para los comandos.
   - **CLI path** (avanzado): ruta opcional a un entrypoint/binario ejecutable de `openclaw` (se autocompleta cuando se anuncia).
3. Presione **Test remote**. El éxito indica que el `openclaw status --json` remoto se ejecuta correctamente. Los fallos suelen significar problemas de PATH/CLI; el código de salida 127 indica que el CLI no se encuentra remotamente.
4. Las comprobaciones de estado y Web Chat ahora se ejecutarán automáticamente a través de este túnel SSH.

## Web Chat

- **Túnel SSH**: Web Chat se conecta al gateway a través del puerto de control WebSocket reenviado (predeterminado 18789).
- **Direct (ws/wss)**: Web Chat se conecta directamente a la URL del gateway configurada.
- Ya no existe un servidor HTTP separado para WebChat.

## Permisos

- El host remoto necesita las mismas aprobaciones TCC que en local (Automation, Accessibility, Screen Recording, Microphone, Speech Recognition, Notifications). Ejecute la incorporacion en esa máquina para otorgarlos una vez.
- Los nodos anuncian su estado de permisos vía `node.list` / `node.describe` para que los agentes sepan qué está disponible.

## Notas de seguridad

- Prefiera enlaces a loopback en el host remoto y conéctese vía SSH o Tailscale.
- Si enlaza el Gateway a una interfaz que no sea loopback, requiera autenticación por token/contraseña.
- Vea [Security](/gateway/security) y [Tailscale](/gateway/tailscale).

## Flujo de inicio de sesión de WhatsApp (remoto)

- Ejecute `openclaw channels login --verbose` **en el host remoto**. Escanee el QR con WhatsApp en su teléfono.
- Vuelva a ejecutar el inicio de sesión en ese host si la autenticación expira. La comprobación de estado mostrará problemas de enlace.

## Solucion de problemas

- **exit 127 / not found**: `openclaw` no está en PATH para shells sin inicio de sesión. Añádalo a `/etc/paths`, al rc de su shell, o cree un symlink en `/usr/local/bin`/`/opt/homebrew/bin`.
- **Health probe failed**: verifique la conectividad SSH, PATH y que Baileys haya iniciado sesión (`openclaw status --json`).
- **Web Chat atascado**: confirme que el gateway esté ejecutándose en el host remoto y que el puerto reenviado coincida con el puerto WS del gateway; la UI requiere una conexión WS saludable.
- **La IP del nodo muestra 127.0.0.1**: es esperado con el túnel SSH. Cambie **Transport** a **Direct (ws/wss)** si quiere que el gateway vea la IP real del cliente.
- **Voice Wake**: las frases de activación se reenvían automáticamente en modo remoto; no se necesita un reenviador separado.

## Sonidos de notificacion

Elija sonidos por notificación desde scripts con `openclaw` y `node.invoke`, por ejemplo:

```bash
openclaw nodes notify --node <id> --title "Ping" --body "Remote gateway ready" --sound Glass
```

Ya no existe un interruptor global de “sonido predeterminado” en la app; los llamadores eligen un sonido (o ninguno) por solicitud.
