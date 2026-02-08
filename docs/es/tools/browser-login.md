---
summary: "Inicios de sesión manuales para automatización del navegador + publicación en X/Twitter"
read_when:
  - Necesita iniciar sesión en sitios para la automatización del navegador
  - Quiere publicar actualizaciones en X/Twitter
title: "Inicio de sesión del navegador"
x-i18n:
  source_path: tools/browser-login.md
  source_hash: 8ceea2d5258836e3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:06Z
---

# Inicio de sesión del navegador + publicación en X/Twitter

## Inicio de sesión manual (recomendado)

Cuando un sitio requiere inicio de sesión, **inicie sesión manualmente** en el perfil del navegador **host** (el navegador de OpenClaw).

**No** le dé sus credenciales al modelo. Los inicios de sesión automatizados suelen activar defensas anti‑bot y pueden bloquear la cuenta.

Volver a la documentación principal del navegador: [Browser](/tools/browser).

## ¿Qué perfil de Chrome se utiliza?

OpenClaw controla un **perfil dedicado de Chrome** (llamado `openclaw`, interfaz con tinte naranja). Esto es independiente de su perfil de navegador diario.

Dos formas sencillas de acceder:

1. **Pídale al agente que abra el navegador** y luego inicie sesión usted mismo.
2. **Ábralo vía CLI**:

```bash
openclaw browser start
openclaw browser open https://x.com
```

Si tiene múltiples perfiles, pase `--browser-profile <name>` (el valor predeterminado es `openclaw`).

## X/Twitter: flujo recomendado

- **Leer/buscar/hilos:** use la Skill de CLI **bird** (sin navegador, estable).
  - Repo: https://github.com/steipete/bird
- **Publicar actualizaciones:** use el navegador **host** (inicio de sesión manual).

## Sandboxing + acceso al navegador host

Las sesiones de navegador **Sandboxed** son **más propensas** a activar la detección de bots. Para X/Twitter (y otros sitios estrictos), prefiera el navegador **host**.

Si el agente está en sandbox, la herramienta del navegador usa el sandbox de forma predeterminada. Para permitir el control del host:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

Luego apunte al navegador host:

```bash
openclaw browser open https://x.com --browser-profile openclaw --target host
```

O deshabilite el sandboxing para el agente que publica actualizaciones.
