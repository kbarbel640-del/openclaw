---
summary: "Serve/Funnel de Tailscale integrado para el panel del Gateway"
read_when:
  - Exponer la UI de control del Gateway fuera de localhost
  - Automatizar el acceso al panel del tailnet o público
title: "Tailscale"
x-i18n:
  source_path: gateway/tailscale.md
  source_hash: c900c70a9301f290
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:05Z
---

# Tailscale (panel del Gateway)

OpenClaw puede auto-configurar **Serve** (tailnet) o **Funnel** (público) de Tailscale para el
panel del Gateway y el puerto WebSocket. Esto mantiene el Gateway vinculado al loopback mientras
Tailscale proporciona HTTPS, enrutamiento y (para Serve) encabezados de identidad.

## Modos

- `serve`: Serve solo para tailnet mediante `tailscale serve`. El Gateway permanece en `127.0.0.1`.
- `funnel`: HTTPS público mediante `tailscale funnel`. OpenClaw requiere una contraseña compartida.
- `off`: Predeterminado (sin automatización de Tailscale).

## Autenticación

Configure `gateway.auth.mode` para controlar el saludo inicial:

- `token` (predeterminado cuando `OPENCLAW_GATEWAY_TOKEN` está configurado)
- `password` (secreto compartido mediante `OPENCLAW_GATEWAY_PASSWORD` o configuración)

Cuando `tailscale.mode = "serve"` y `gateway.auth.allowTailscale` es `true`,
las solicitudes proxy válidas de Serve pueden autenticarse mediante encabezados de identidad de Tailscale
(`tailscale-user-login`) sin proporcionar un token/contraseña. OpenClaw verifica
la identidad resolviendo la dirección `x-forwarded-for` mediante el daemon local de Tailscale
(`tailscale whois`) y comparándola con el encabezado antes de aceptarla.
OpenClaw solo trata una solicitud como Serve cuando llega desde loopback con
los encabezados `x-forwarded-for`, `x-forwarded-proto` y `x-forwarded-host`
de Tailscale.
Para exigir credenciales explícitas, configure `gateway.auth.allowTailscale: false` o
fuerce `gateway.auth.mode: "password"`.

## Ejemplos de configuración

### Solo tailnet (Serve)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

Abra: `https://<magicdns>/` (o su `gateway.controlUi.basePath` configurado)

### Solo tailnet (vincular a IP de Tailnet)

Use esto cuando quiera que el Gateway escuche directamente en la IP de Tailnet (sin Serve/Funnel).

```json5
{
  gateway: {
    bind: "tailnet",
    auth: { mode: "token", token: "your-token" },
  },
}
```

Conéctese desde otro dispositivo del Tailnet:

- UI de control: `http://<tailscale-ip>:18789/`
- WebSocket: `ws://<tailscale-ip>:18789`

Nota: loopback (`http://127.0.0.1:18789`) **no** funcionará en este modo.

### Internet público (Funnel + contraseña compartida)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password", password: "replace-me" },
  },
}
```

Prefiera `OPENCLAW_GATEWAY_PASSWORD` en lugar de guardar una contraseña en disco.

## Ejemplos de CLI

```bash
openclaw gateway --tailscale serve
openclaw gateway --tailscale funnel --auth password
```

## Notas

- Serve/Funnel de Tailscale requiere que el CLI `tailscale` esté instalado y con sesión iniciada.
- `tailscale.mode: "funnel"` se niega a iniciar a menos que el modo de autenticación sea `password` para evitar exposición pública.
- Configure `gateway.tailscale.resetOnExit` si desea que OpenClaw deshaga la configuración de `tailscale serve`
  o `tailscale funnel` al apagarse.
- `gateway.bind: "tailnet"` es una vinculación directa a Tailnet (sin HTTPS, sin Serve/Funnel).
- `gateway.bind: "auto"` prefiere loopback; use `tailnet` si desea solo Tailnet.
- Serve/Funnel solo exponen la **UI de control del Gateway + WS**. Los nodos se conectan
  mediante el mismo endpoint WS del Gateway, por lo que Serve puede funcionar para el acceso de nodos.

## Control del navegador (Gateway remoto + navegador local)

Si ejecuta el Gateway en una máquina pero desea controlar un navegador en otra,
ejecute un **host de nodo** en la máquina del navegador y mantenga ambos en el mismo tailnet.
El Gateway enviará por proxy las acciones del navegador al nodo; no se necesita un servidor de control separado ni una URL de Serve.

Evite Funnel para el control del navegador; trate el emparejamiento de nodos como acceso de operador.

## Requisitos previos y límites de Tailscale

- Serve requiere HTTPS habilitado para su tailnet; el CLI lo solicita si falta.
- Serve inyecta encabezados de identidad de Tailscale; Funnel no.
- Funnel requiere Tailscale v1.38.3+, MagicDNS, HTTPS habilitado y un atributo de nodo funnel.
- Funnel solo admite los puertos `443`, `8443` y `10000` sobre TLS.
- Funnel en macOS requiere la variante de la app de Tailscale de código abierto.

## Más información

- Descripción general de Tailscale Serve: https://tailscale.com/kb/1312/serve
- Comando `tailscale serve`: https://tailscale.com/kb/1242/tailscale-serve
- Descripción general de Tailscale Funnel: https://tailscale.com/kb/1223/tailscale-funnel
- Comando `tailscale funnel`: https://tailscale.com/kb/1311/tailscale-funnel
