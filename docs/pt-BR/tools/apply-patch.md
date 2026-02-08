---
summary: "Aplique patches de varios arquivos com a ferramenta apply_patch"
read_when:
  - Voce precisa de edicoes estruturadas de arquivos em varios arquivos
  - Voce quer documentar ou depurar edicoes baseadas em patch
title: "Ferramenta apply_patch"
x-i18n:
  source_path: tools/apply-patch.md
  source_hash: 8cec2b4ee3afa910
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:28Z
---

# ferramenta apply_patch

Aplique alteracoes em arquivos usando um formato de patch estruturado. Isso e ideal para edicoes de varios arquivos
ou de varios hunks, onde uma unica chamada `edit` seria fragil.

A ferramenta aceita uma unica string `input` que envolve uma ou mais operacoes de arquivo:

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

- `input` (obrigatorio): Conteudo completo do patch, incluindo `*** Begin Patch` e `*** End Patch`.

## Notas

- Os caminhos sao resolvidos em relacao a raiz do workspace.
- Use `*** Move to:` dentro de um hunk `*** Update File:` para renomear arquivos.
- `*** End of File` marca uma insercao apenas de EOF quando necessario.
- Experimental e desativado por padrao. Ative com `tools.exec.applyPatch.enabled`.
- Exclusivo da OpenAI (incluindo OpenAI Codex). Opcionalmente controle por modelo via
  `tools.exec.applyPatch.allowModels`.
- A configuracao fica apenas em `tools.exec`.

## Exemplo

```json
{
  "tool": "apply_patch",
  "input": "*** Begin Patch\n*** Update File: src/index.ts\n@@\n-const foo = 1\n+const foo = 2\n*** End Patch"
}
```
