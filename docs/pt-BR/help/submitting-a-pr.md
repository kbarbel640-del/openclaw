---
summary: "Como enviar um PR de alto sinal"
title: "Enviando um PR"
x-i18n:
  source_path: help/submitting-a-pr.md
  source_hash: 277b0f51b948d1a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:16Z
---

Bons PRs são fáceis de revisar: os revisores devem entender rapidamente a intenção, verificar o comportamento e integrar as mudanças com segurança. Este guia aborda envios concisos e de alto sinal para revisão humana e por LLM.

## O que faz um bom PR

- [ ] Explique o problema, por que ele importa e a mudança.
- [ ] Mantenha as mudanças focadas. Evite refatorações amplas.
- [ ] Resuma mudanças visíveis ao usuário/de configuracao/de padrões.
- [ ] Liste a cobertura de testes, testes ignorados e os motivos.
- [ ] Adicione evidências: logs, capturas de tela ou gravações (UI/UX).
- [ ] Palavra-código: coloque “lobster-biscuit” na descrição do PR se você leu este guia.
- [ ] Execute/corrija os comandos `pnpm` relevantes antes de criar o PR.
- [ ] Pesquise no codebase e no GitHub por funcionalidades/issues/correções relacionadas.
- [ ] Baseie afirmações em evidências ou observação.
- [ ] Bom título: verbo + escopo + resultado (ex.: `Docs: add PR and issue templates`).

Seja conciso; revisão concisa > gramática. Omita quaisquer seções não aplicáveis.

### Comandos de validação de base (execute/corrija falhas para sua mudança)

- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm test`
- Mudanças de protocolo: `pnpm protocol:check`

## Divulgação progressiva

- Topo: resumo/intenção
- Em seguida: mudanças/riscos
- Em seguida: teste/verificação
- Por último: implementação/evidências

## Tipos comuns de PR: especificidades

- [ ] Correção: Adicione repro, causa raiz, verificação.
- [ ] Recurso: Adicione casos de uso, comportamento/demos/capturas de tela (UI).
- [ ] Refatoração: Declare "sem mudança de comportamento", liste o que foi movido/simplificado.
- [ ] Tarefa: Declare o motivo (ex.: tempo de build, CI, dependências).
- [ ] Docs: Contexto antes/depois, link da página atualizada, execute `pnpm format`.
- [ ] Teste: Qual lacuna é coberta; como evita regressões.
- [ ] Desempenho: Adicione métricas antes/depois e como foram medidas.
- [ ] UX/UI: Capturas de tela/vídeo, observe impacto em acessibilidade.
- [ ] Infra/Build: Ambientes/validação.
- [ ] Segurança: Resuma risco, repro, verificação, sem dados sensíveis. Afirmações fundamentadas apenas.

## Checklist

- [ ] Problema/intenção claros
- [ ] Escopo focado
- [ ] Lista de mudanças de comportamento
- [ ] Lista e resultado dos testes
- [ ] Passos de teste manual (quando aplicável)
- [ ] Sem segredos/dados privados
- [ ] Baseado em evidências

## Template geral de PR

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

## Templates por tipo de PR (substitua pelo seu tipo)

### Correção

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

### Recurso

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

### Refatoração

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

### Tarefa/Manutenção

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

### Docs

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

### Teste

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

### Desempenho

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

### Infra/Build

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

### Segurança

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
