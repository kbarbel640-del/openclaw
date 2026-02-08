---
summary: "Cómo enviar un PR de alta señal"
title: "Envío de un PR"
x-i18n:
  source_path: help/submitting-a-pr.md
  source_hash: 277b0f51b948d1a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:29Z
---

Los buenos PR son fáciles de revisar: las personas revisoras deben entender rápidamente la intención, verificar el comportamiento y integrar los cambios de forma segura. Esta guía cubre envíos concisos y de alta señal para revisión humana y por LLM.

## Qué hace que un PR sea bueno

- [ ] Explique el problema, por qué importa y el cambio.
- [ ] Mantenga los cambios enfocados. Evite refactorizaciones amplias.
- [ ] Resuma los cambios visibles para el usuario/de configuración/por defecto.
- [ ] Enumere la cobertura de pruebas, omisiones y razones.
- [ ] Agregue evidencia: registros, capturas de pantalla o grabaciones (UI/UX).
- [ ] Palabra clave: ponga “lobster-biscuit” en la descripción del PR si leyó esta guía.
- [ ] Ejecute/corrija los comandos relevantes de `pnpm` antes de crear el PR.
- [ ] Busque en la base de código y en GitHub funcionalidad/problemas/arreglos relacionados.
- [ ] Base las afirmaciones en evidencia u observación.
- [ ] Buen título: verbo + alcance + resultado (p. ej., `Docs: add PR and issue templates`).

Sea conciso; revisión concisa > gramática. Omita cualquier sección no aplicable.

### Comandos base de validación (ejecute/corrija fallos para su cambio)

- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm test`
- Cambios de protocolo: `pnpm protocol:check`

## Divulgación progresiva

- Arriba: resumen/intención
- Luego: cambios/riesgos
- Luego: pruebas/verificación
- Al final: implementación/evidencia

## Tipos comunes de PR: detalles específicos

- [ ] Corrección: Agregue repro, causa raíz y verificación.
- [ ] Funcionalidad: Agregue casos de uso, comportamiento/demos/capturas (UI).
- [ ] Refactorización: Indique "sin cambio de comportamiento", enumere qué se movió/simplificó.
- [ ] Tarea: Indique el porqué (p. ej., tiempo de compilación, CI, dependencias).
- [ ] Documentación: Contexto antes/después, enlace a la página actualizada, ejecute `pnpm format`.
- [ ] Pruebas: Qué brecha se cubre; cómo previene regresiones.
- [ ] Rendimiento: Agregue métricas antes/después y cómo se midieron.
- [ ] UX/UI: Capturas/video, note el impacto en accesibilidad.
- [ ] Infraestructura/Build: Entornos/validación.
- [ ] Seguridad: Resuma el riesgo, repro, verificación; sin datos sensibles. Afirmaciones fundamentadas únicamente.

## Lista de verificación

- [ ] Problema/intención claros
- [ ] Alcance enfocado
- [ ] Lista de cambios de comportamiento
- [ ] Lista y resultado de pruebas
- [ ] Pasos de prueba manual (cuando aplique)
- [ ] Sin secretos/datos privados
- [ ] Basado en evidencia

## Plantilla general de PR

```md
#### Summary

#### Behavior Changes

#### Codebase and GitHub Search

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort (self-reported):
- Agent notes (optional, cite evidence):
```

## Plantillas por tipo de PR (reemplace con su tipo)

### Corrección

```md
#### Summary

#### Repro Steps

#### Root Cause

#### Behavior Changes

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Funcionalidad

```md
#### Summary

#### Use Cases

#### Behavior Changes

#### Existing Functionality Check

- [ ] I searched the codebase for existing functionality.
      Searches performed (1-3 bullets):
  -
  -

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Refactorización

```md
#### Summary

#### Scope

#### No Behavior Change Statement

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Tarea/Mantenimiento

```md
#### Summary

#### Why This Matters

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Documentación

```md
#### Summary

#### Pages Updated

#### Before/After

#### Formatting

pnpm format

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Pruebas

```md
#### Summary

#### Gap Covered

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Rendimiento

```md
#### Summary

#### Baseline

#### After

#### Measurement Method

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### UX/UI

```md
#### Summary

#### Screenshots or Video

#### Accessibility Impact

#### Tests

#### Manual Testing

### Prerequisites

-

### Steps

1.
2. **Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Infraestructura/Build

```md
#### Summary

#### Environments Affected

#### Validation Steps

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Seguridad

```md
#### Summary

#### Risk Summary

#### Repro Steps

#### Mitigation or Fix

#### Verification

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```
