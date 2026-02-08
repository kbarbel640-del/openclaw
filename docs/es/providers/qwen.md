---
summary: "Use OAuth de Qwen (nivel gratuito) en OpenClaw"
read_when:
  - Quiere usar Qwen con OpenClaw
  - Quiere acceso OAuth de nivel gratuito a Qwen Coder
title: "Qwen"
x-i18n:
  source_path: providers/qwen.md
  source_hash: 88b88e224e2fecbb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:41Z
---

# Qwen

Qwen ofrece un flujo OAuth de nivel gratuito para los modelos Qwen Coder y Qwen Vision
(2.000 solicitudes/día, sujeto a los límites de tasa de Qwen).

## Habilitar el plugin

```bash
openclaw plugins enable qwen-portal-auth
```

Reinicie el Gateway después de habilitarlo.

## Autenticarse

```bash
openclaw models auth login --provider qwen-portal --set-default
```

Esto ejecuta el flujo OAuth de código de dispositivo de Qwen y escribe una entrada de proveedor en su
`models.json` (más un alias `qwen` para cambiar rápidamente).

## IDs de modelos

- `qwen-portal/coder-model`
- `qwen-portal/vision-model`

Cambie de modelo con:

```bash
openclaw models set qwen-portal/coder-model
```

## Reutilizar el inicio de sesión de Qwen Code CLI

Si ya inició sesión con Qwen Code CLI, OpenClaw sincronizará las credenciales
desde `~/.qwen/oauth_creds.json` cuando cargue el almacén de autenticación. Aún necesita una
entrada `models.providers.qwen-portal` (use el comando de inicio de sesión anterior para crear una).

## Notas

- Los tokens se actualizan automáticamente; vuelva a ejecutar el comando de inicio de sesión si la actualización falla o se revoca el acceso.
- URL base predeterminada: `https://portal.qwen.ai/v1` (anule con
  `models.providers.qwen-portal.baseUrl` si Qwen proporciona un endpoint diferente).
- Consulte [Proveedores de modelos](/concepts/model-providers) para conocer las reglas a nivel de proveedor.
