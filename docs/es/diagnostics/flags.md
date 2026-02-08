---
summary: "Flags de diagnostico para registros de depuracion dirigidos"
read_when:
  - Necesita registros de depuracion dirigidos sin elevar los niveles de registro globales
  - Necesita capturar registros especificos de subsistemas para soporte
title: "Flags de Diagnostico"
x-i18n:
  source_path: diagnostics/flags.md
  source_hash: daf0eca0e6bd1cbc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:43Z
---

# Flags de Diagnostico

Los flags de diagnostico le permiten habilitar registros de depuracion dirigidos sin activar el registro detallado en todo el sistema. Los flags son de activacion voluntaria y no tienen efecto a menos que un subsistema los verifique.

## Como funciona

- Los flags son cadenas (no distinguen mayusculas y minusculas).
- Puede habilitar flags en la configuracion o mediante una anulacion por variable de entorno.
- Se admiten comodines:
  - `telegram.*` coincide con `telegram.http`
  - `*` habilita todos los flags

## Habilitar via configuracion

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

Multiples flags:

```json
{
  "diagnostics": {
    "flags": ["telegram.http", "gateway.*"]
  }
}
```

Reinicie el Gateway despues de cambiar los flags.

## Anulacion por variable de entorno (uso puntual)

```bash
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

Deshabilitar todos los flags:

```bash
OPENCLAW_DIAGNOSTICS=0
```

## Donde van los registros

Los flags emiten registros en el archivo estandar de diagnostico. De forma predeterminada:

```
/tmp/openclaw/openclaw-YYYY-MM-DD.log
```

Si configura `logging.file`, se usara esa ruta en su lugar. Los registros son JSONL (un objeto JSON por linea). La redaccion sigue aplicandose segun `logging.redactSensitive`.

## Extraer registros

Elija el archivo de registro mas reciente:

```bash
ls -t /tmp/openclaw/openclaw-*.log | head -n 1
```

Filtrar para diagnosticos HTTP de Telegram:

```bash
rg "telegram http error" /tmp/openclaw/openclaw-*.log
```

O hacer tail mientras reproduce el problema:

```bash
tail -f /tmp/openclaw/openclaw-$(date +%F).log | rg "telegram http error"
```

Para Gateways remotos, tambien puede usar `openclaw logs --follow` (vea [/cli/logs](/cli/logs)).

## Notas

- Si `logging.level` esta configurado a un valor mas alto que `warn`, estos registros pueden suprimirse. El valor predeterminado `info` es adecuado.
- Es seguro dejar los flags habilitados; solo afectan el volumen de registros del subsistema especifico.
- Use [/logging](/logging) para cambiar destinos de registro, niveles y redaccion.
