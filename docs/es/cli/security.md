---
summary: "Referencia del CLI para `openclaw security` (auditar y corregir errores comunes de seguridad)"
read_when:
  - Desea ejecutar una auditoría de seguridad rápida sobre la configuracion/el estado
  - Desea aplicar sugerencias de “correccion” seguras (chmod, ajustar valores predeterminados)
title: "seguridad"
x-i18n:
  source_path: cli/security.md
  source_hash: 96542b4784e53933
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:21Z
---

# `openclaw security`

Herramientas de seguridad (auditoría + correcciones opcionales).

Relacionado:

- Guía de seguridad: [Security](/gateway/security)

## Auditoría

```bash
openclaw security audit
openclaw security audit --deep
openclaw security audit --fix
```

La auditoría advierte cuando varios remitentes de Mensajes directos comparten la sesión principal y recomienda el **modo seguro de Mensajes directos**: `session.dmScope="per-channel-peer"` (o `per-account-channel-peer` para canales de múltiples cuentas) para bandejas de entrada compartidas.
También advierte cuando se usan modelos pequeños (`<=300B`) sin sandboxing y con herramientas web/del navegador habilitadas.
