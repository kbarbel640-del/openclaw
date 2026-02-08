---
summary: "Solucionar problemas de programacion y entrega de cron y heartbeat"
read_when:
  - Cron no se ejecuto
  - Cron se ejecuto pero no se entrego ningun mensaje
  - Heartbeat parece silencioso o se omite
title: "Solucion de problemas de automatizacion"
x-i18n:
  source_path: automation/troubleshooting.md
  source_hash: 10eca4a59119910f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:22Z
---

# Solucion de problemas de automatizacion

Use esta pagina para problemas del programador y de entrega (`cron` + `heartbeat`).

## Escalera de comandos

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

Luego ejecute las comprobaciones de automatizacion:

```bash
openclaw cron status
openclaw cron list
openclaw system heartbeat last
```

## Cron no se ejecuta

```bash
openclaw cron status
openclaw cron list
openclaw cron runs --id <jobId> --limit 20
openclaw logs --follow
```

Un buen resultado se ve asi:

- `cron status` informa habilitado y un `nextWakeAtMs` futuro.
- El trabajo esta habilitado y tiene una programacion/zona horaria validas.
- `cron runs` muestra `ok` o un motivo de omision explicito.

Firmas comunes:

- `cron: scheduler disabled; jobs will not run automatically` → cron deshabilitado en la configuracion/variables de entorno.
- `cron: timer tick failed` → el tick del programador fallo; inspeccione el contexto de la pila/registros circundantes.
- `reason: not-due` en la salida de ejecucion → la ejecucion manual se llamo sin `--force` y el trabajo aun no vence.

## Cron se ejecuto pero no hubo entrega

```bash
openclaw cron runs --id <jobId> --limit 20
openclaw cron list
openclaw channels status --probe
openclaw logs --follow
```

Un buen resultado se ve asi:

- El estado de la ejecucion es `ok`.
- El modo/objetivo de entrega estan configurados para trabajos aislados.
- La sonda del canal informa que el canal de destino esta conectado.

Firmas comunes:

- La ejecucion tuvo exito pero el modo de entrega es `none` → no se espera ningun mensaje externo.
- Objetivo de entrega ausente/invalido (`channel`/`to`) → la ejecucion puede tener exito internamente pero omitir la salida.
- Errores de autenticacion del canal (`unauthorized`, `missing_scope`, `Forbidden`) → la entrega esta bloqueada por credenciales/permisos del canal.

## Heartbeat suprimido u omitido

```bash
openclaw system heartbeat last
openclaw logs --follow
openclaw config get agents.defaults.heartbeat
openclaw channels status --probe
```

Un buen resultado se ve asi:

- Heartbeat habilitado con un intervalo distinto de cero.
- El ultimo resultado de heartbeat es `ran` (o se entiende el motivo de omision).

Firmas comunes:

- `heartbeat skipped` con `reason=quiet-hours` → fuera de `activeHours`.
- `requests-in-flight` → el carril principal esta ocupado; heartbeat diferido.
- `empty-heartbeat-file` → `HEARTBEAT.md` existe pero no tiene contenido accionable.
- `alerts-disabled` → la configuracion de visibilidad suprime los mensajes de heartbeat salientes.

## Consideraciones sobre zona horaria y activeHours

```bash
openclaw config get agents.defaults.heartbeat.activeHours
openclaw config get agents.defaults.heartbeat.activeHours.timezone
openclaw config get agents.defaults.userTimezone || echo "agents.defaults.userTimezone not set"
openclaw cron list
openclaw logs --follow
```

Reglas rapidas:

- `Config path not found: agents.defaults.userTimezone` significa que la clave no esta configurada; heartbeat recurre a la zona horaria del host (o `activeHours.timezone` si esta configurado).
- Cron sin `--tz` usa la zona horaria del host del gateway.
- Heartbeat `activeHours` usa la resolucion de zona horaria configurada (`user`, `local` o una tz IANA explicita).
- Las marcas de tiempo ISO sin zona horaria se tratan como UTC para las programaciones de cron `at`.

Firmas comunes:

- Los trabajos se ejecutan a una hora de reloj incorrecta despues de cambios en la zona horaria del host.
- Heartbeat siempre se omite durante su horario diurno porque `activeHours.timezone` es incorrecto.

Relacionado:

- [/automation/cron-jobs](/automation/cron-jobs)
- [/gateway/heartbeat](/gateway/heartbeat)
- [/automation/cron-vs-heartbeat](/automation/cron-vs-heartbeat)
- [/concepts/timezone](/concepts/timezone)
