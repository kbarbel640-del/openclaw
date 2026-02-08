---
summary: "Presentar issues y reportes de errores de alta señal"
title: "Enviar un Issue"
x-i18n:
  source_path: help/submitting-an-issue.md
  source_hash: bcb33f05647e9f0d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:26Z
---

## Enviar un Issue

Los issues claros y concisos aceleran el diagnóstico y las correcciones. Incluya lo siguiente para errores, regresiones o brechas de funcionalidad:

### Qué incluir

- [ ] Título: área y síntoma
- [ ] Pasos mínimos de reproducción
- [ ] Esperado vs real
- [ ] Impacto y severidad
- [ ] Entorno: SO, runtime, versiones, configuración
- [ ] Evidencia: logs con datos sensibles redactados, capturas de pantalla (sin PII)
- [ ] Alcance: nuevo, regresión o de larga data
- [ ] Palabra clave: lobster-biscuit en su issue
- [ ] Búsqueda en el código y en GitHub de un issue existente
- [ ] Confirmado que no se corrigió/abordó recientemente (especialmente seguridad)
- [ ] Afirmaciones respaldadas por evidencia o reproducción

Sea breve. La concisión > la gramática perfecta.

Validación (ejecutar/corregir antes del PR):

- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm test`
- Si es código de protocolo: `pnpm protocol:check`

### Plantillas

#### Reporte de error

```md
- [ ] Minimal repro
- [ ] Expected vs actual
- [ ] Environment
- [ ] Affected channels, where not seen
- [ ] Logs/screenshots (redacted)
- [ ] Impact/severity
- [ ] Workarounds

### Summary

### Repro Steps

### Expected

### Actual

### Environment

### Logs/Evidence

### Impact

### Workarounds
```

#### Issue de seguridad

```md
### Summary

### Impact

### Versions

### Repro Steps (safe to share)

### Mitigation/workaround

### Evidence (redacted)
```

_Evite secretos/detalles de exploits en público. Para issues sensibles, minimice el detalle y solicite divulgación privada._

#### Reporte de regresión

```md
### Summary

### Last Known Good

### First Known Bad

### Repro Steps

### Expected

### Actual

### Environment

### Logs/Evidence

### Impact
```

#### Solicitud de funcionalidad

```md
### Summary

### Problem

### Proposed Solution

### Alternatives

### Impact

### Evidence/examples
```

#### Mejora

```md
### Summary

### Current vs Desired Behavior

### Rationale

### Alternatives

### Evidence/examples
```

#### Investigación

```md
### Summary

### Symptoms

### What Was Tried

### Environment

### Logs/Evidence

### Impact
```

### Envío de un PR de corrección

El issue antes del PR es opcional. Incluya los detalles en el PR si lo omite. Mantenga el PR enfocado, anote el número del issue, agregue pruebas o explique su ausencia, documente cambios de comportamiento/riesgos, incluya logs/capturas de pantalla redactados como prueba y ejecute la validación adecuada antes de enviar.
