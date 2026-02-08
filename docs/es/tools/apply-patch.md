---
summary: "Aplique parches de varios archivos con la herramienta apply_patch"
read_when:
  - Necesita ediciones estructuradas de archivos en varios archivos
  - Desea documentar o depurar ediciones basadas en parches
title: "Herramienta apply_patch"
x-i18n:
  source_path: tools/apply-patch.md
  source_hash: 8cec2b4ee3afa910
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:03Z
---

# herramienta apply_patch

Aplique cambios en archivos utilizando un formato de parche estructurado. Esto es ideal para ediciones de varios archivos
o de varios hunks donde una sola llamada `edit` sería frágil.

La herramienta acepta una sola cadena `input` que envuelve una o más operaciones de archivo:

```
*** Begin Patch
*** Add File: path/to/file.txt
+line 1
+line 2
*** Update File: src/app.ts
@@
-old line
+new line
*** Delete File: obsolete.txt
*** End Patch
```

## Parametros

- `input` (requerido): Contenido completo del parche, incluidos `*** Begin Patch` y `*** End Patch`.

## Notas

- Las rutas se resuelven en relación con la raíz del espacio de trabajo.
- Use `*** Move to:` dentro de un hunk `*** Update File:` para renombrar archivos.
- `*** End of File` marca una inserción solo de EOF cuando es necesario.
- Experimental y deshabilitado de forma predeterminada. Habilite con `tools.exec.applyPatch.enabled`.
- Solo OpenAI (incluido OpenAI Codex). Opcionalmente limite por modelo mediante
  `tools.exec.applyPatch.allowModels`.
- La configuracion solo se encuentra bajo `tools.exec`.

## Ejemplo

```json
{
  "tool": "apply_patch",
  "input": "*** Begin Patch\n*** Update File: src/index.ts\n@@\n-const foo = 1\n+const foo = 2\n*** End Patch"
}
```
