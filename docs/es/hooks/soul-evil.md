---
summary: "Hook SOUL Evil (intercambia SOUL.md con SOUL_EVIL.md)"
read_when:
  - Quiere habilitar o ajustar el hook SOUL Evil
  - Quiere una ventana de purga o un intercambio de persona por probabilidad aleatoria
title: "Hook SOUL Evil"
x-i18n:
  source_path: hooks/soul-evil.md
  source_hash: cc32c1e207f2b692
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:01Z
---

# Hook SOUL Evil

El hook SOUL Evil intercambia el contenido **inyectado** `SOUL.md` con `SOUL_EVIL.md` durante
una ventana de purga o por probabilidad aleatoria. **No** modifica archivos en disco.

## Como funciona

Cuando `agent:bootstrap` se ejecuta, el hook puede reemplazar el contenido `SOUL.md` en memoria
antes de que se ensamble el prompt del sistema. Si `SOUL_EVIL.md` falta o esta vacio,
OpenClaw registra una advertencia y mantiene el `SOUL.md` normal.

Las ejecuciones de sub-agentes **no** incluyen `SOUL.md` en sus archivos de arranque, por lo que este hook
no tiene efecto en los sub-agentes.

## Habilitar

```bash
openclaw hooks enable soul-evil
```

Luego configure:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "soul-evil": {
          "enabled": true,
          "file": "SOUL_EVIL.md",
          "chance": 0.1,
          "purge": { "at": "21:00", "duration": "15m" }
        }
      }
    }
  }
}
```

Cree `SOUL_EVIL.md` en la raiz del espacio de trabajo del agente (junto a `SOUL.md`).

## Opciones

- `file` (string): nombre alternativo del archivo SOUL (predeterminado: `SOUL_EVIL.md`)
- `chance` (numero 0–1): probabilidad aleatoria por ejecucion de usar `SOUL_EVIL.md`
- `purge.at` (HH:mm): inicio diario de la purga (reloj de 24 horas)
- `purge.duration` (duracion): longitud de la ventana (p. ej., `30s`, `10m`, `1h`)

**Precedencia:** la ventana de purga prevalece sobre la probabilidad.

**Zona horaria:** usa `agents.defaults.userTimezone` cuando esta configurado; de lo contrario, la zona horaria del host.

## Notas

- No se escriben ni modifican archivos en disco.
- Si `SOUL.md` no esta en la lista de arranque, el hook no hace nada.

## Ver tambien

- [Hooks](/hooks)
