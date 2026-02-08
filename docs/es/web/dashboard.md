---
summary: "Acceso y autenticación del panel del Gateway (UI de Control)"
read_when:
  - Cambio de autenticación del panel o modos de exposición
title: "Panel"
x-i18n:
  source_path: web/dashboard.md
  source_hash: 852e359885574fa3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:17Z
---

# Panel (UI de Control)

El panel del Gateway es la UI de Control en el navegador servida en `/` de forma predeterminada
(se puede sobrescribir con `gateway.controlUi.basePath`).

Apertura rápida (Gateway local):

- http://127.0.0.1:18789/ (o http://localhost:18789/)

Referencias clave:

- [UI de Control](/web/control-ui) para uso y capacidades de la UI.
- [Tailscale](/gateway/tailscale) para automatización de Serve/Funnel.
- [Superficies web](/web) para modos de enlace y notas de seguridad.

La autenticación se aplica en el handshake de WebSocket mediante `connect.params.auth`
(token o contraseña). Consulte `gateway.auth` en [Configuración del Gateway](/gateway/configuration).

Nota de seguridad: la UI de Control es una **superficie de administración** (chat, configuración, aprobaciones de exec).
No la exponga públicamente. La UI almacena el token en `localStorage` después de la primera carga.
Prefiera localhost, Tailscale Serve o un túnel SSH.

## Ruta rápida (recomendada)

- Después de la incorporación, la CLI abre automáticamente el panel e imprime un enlace limpio (sin token).
- Reabrir en cualquier momento: `openclaw dashboard` (copia el enlace, abre el navegador si es posible y muestra una pista de SSH si no hay interfaz).
- Si la UI solicita autenticación, pegue el token desde `gateway.auth.token` (o `OPENCLAW_GATEWAY_TOKEN`) en la configuración de la UI de Control.

## Conceptos básicos del token (local vs remoto)

- **Localhost**: abra `http://127.0.0.1:18789/`.
- **Origen del token**: `gateway.auth.token` (o `OPENCLAW_GATEWAY_TOKEN`); la UI almacena una copia en localStorage después de conectarse.
- **No localhost**: use Tailscale Serve (sin token si `gateway.auth.allowTailscale: true`), enlace al tailnet con un token o un túnel SSH. Consulte [Superficies web](/web).

## Si ve “unauthorized” / 1008

- Asegúrese de que el gateway sea accesible (local: `openclaw status`; remoto: túnel SSH `ssh -N -L 18789:127.0.0.1:18789 user@host` y luego abra `http://127.0.0.1:18789/`).
- Recupere el token desde el host del gateway: `openclaw config get gateway.auth.token` (o genere uno: `openclaw doctor --generate-gateway-token`).
- En la configuración del panel, pegue el token en el campo de autenticación y luego conéctese.
