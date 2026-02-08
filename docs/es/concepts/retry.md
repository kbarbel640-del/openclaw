---
summary: "Politica de reintentos para llamadas salientes a proveedores"
read_when:
  - Actualizar el comportamiento o los valores predeterminados de reintentos del proveedor
  - Depurar errores de envio del proveedor o limites de tasa
title: "Politica de Reintentos"
x-i18n:
  source_path: concepts/retry.md
  source_hash: 55bb261ff567f46c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:30Z
---

# Politica de reintentos

## Objetivos

- Reintentar por solicitud HTTP, no por flujo de varios pasos.
- Preservar el orden reintentando solo el paso actual.
- Evitar duplicar operaciones no idempotentes.

## Valores predeterminados

- Intentos: 3
- Limite maximo de retraso: 30000 ms
- Jitter: 0.1 (10 por ciento)
- Valores predeterminados del proveedor:
  - Retraso minimo de Telegram: 400 ms
  - Retraso minimo de Discord: 500 ms

## Comportamiento

### Discord

- Reintenta solo en errores de limite de tasa (HTTP 429).
- Usa `retry_after` cuando esta disponible; de lo contrario, retroceso exponencial.

### Telegram

- Reintenta en errores transitorios (429, tiempo de espera, conexion/restablecida/cerrada, temporalmente no disponible).
- Usa `retry_after` cuando esta disponible; de lo contrario, retroceso exponencial.
- Los errores de analisis de Markdown no se reintentan; se vuelven a enviar como texto plano.

## Configuracion

Configure la politica de reintentos por proveedor en `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    telegram: {
      retry: {
        attempts: 3,
        minDelayMs: 400,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
    discord: {
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

## Notas

- Los reintentos se aplican por solicitud (envio de mensajes, carga de medios, reaccion, encuesta, sticker).
- Los flujos compuestos no reintentan los pasos completados.
