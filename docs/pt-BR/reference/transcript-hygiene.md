---
summary: "Referencia: regras de sanitizacao e reparo de transcricoes especificas por provedor"
read_when:
  - Voce esta depurando rejeicoes de requisicoes de provedores ligadas ao formato da transcricao
  - Voce esta alterando a sanitizacao de transcricoes ou a logica de reparo de chamadas de ferramentas
  - Voce esta investigando incompatibilidades de id de chamadas de ferramentas entre provedores
title: "Higiene de Transcricoes"
x-i18n:
  source_path: reference/transcript-hygiene.md
  source_hash: 43ed460827d514a8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:29Z
---

# Higiene de Transcricoes (Correcoes por Provedor)

Este documento descreve **correcoes especificas por provedor** aplicadas a transcricoes antes de uma execucao
(construcao do contexto do modelo). Essas sao **ajustes em memoria** usados para atender a requisitos
rigidos dos provedores. Essas etapas de higiene **nao** reescrevem a transcricao JSONL armazenada
em disco; no entanto, uma etapa separada de reparo de arquivo de sessao pode reescrever arquivos JSONL
malformados removendo linhas invalidas antes que a sessao seja carregada. Quando ocorre um reparo,
o arquivo original e salvo como backup junto ao arquivo de sessao.

O escopo inclui:

- Sanitizacao de id de chamadas de ferramentas
- Validacao de entrada de chamadas de ferramentas
- Reparo de pareamento de resultados de ferramentas
- Validacao / ordenacao de turnos
- Limpeza de assinaturas de pensamento
- Sanitizacao de payloads de imagem

Se voce precisar de detalhes sobre armazenamento de transcricoes, veja:

- [/reference/session-management-compaction](/reference/session-management-compaction)

---

## Onde isso roda

Toda a higiene de transcricoes e centralizada no runner incorporado:

- Selecao de politica: `src/agents/transcript-policy.ts`
- Aplicacao de sanitizacao/reparo: `sanitizeSessionHistory` em `src/agents/pi-embedded-runner/google.ts`

A politica usa `provider`, `modelApi` e `modelId` para decidir o que aplicar.

Separadamente da higiene de transcricoes, os arquivos de sessao sao reparados (se necessario) antes do carregamento:

- `repairSessionFileIfNeeded` em `src/agents/session-file-repair.ts`
- Chamado a partir de `run/attempt.ts` e `compact.ts` (runner incorporado)

---

## Regra global: sanitizacao de imagens

Os payloads de imagem sao sempre sanitizados para evitar rejeicao pelo provedor devido a limites
de tamanho (reduzir escala/recomprimir imagens base64 superdimensionadas).

Implementacao:

- `sanitizeSessionMessagesImages` em `src/agents/pi-embedded-helpers/images.ts`
- `sanitizeContentBlocksImages` em `src/agents/tool-images.ts`

---

## Regra global: chamadas de ferramentas malformadas

Blocos de chamadas de ferramentas do assistente que estao faltando tanto `input` quanto `arguments` sao removidos
antes que o contexto do modelo seja construido. Isso evita rejeicoes do provedor causadas por chamadas
de ferramentas parcialmente persistidas (por exemplo, apos uma falha de limite de taxa).

Implementacao:

- `sanitizeToolCallInputs` em `src/agents/session-transcript-repair.ts`
- Aplicado em `sanitizeSessionHistory` em `src/agents/pi-embedded-runner/google.ts`

---

## Matriz de provedores (comportamento atual)

**OpenAI / OpenAI Codex**

- Apenas sanitizacao de imagens.
- Ao alternar o modelo para OpenAI Responses/Codex, remover assinaturas de raciocinio orfas (itens de raciocinio independentes sem um bloco de conteudo subsequente).
- Nenhuma sanitizacao de id de chamadas de ferramentas.
- Nenhum reparo de pareamento de resultados de ferramentas.
- Nenhuma validacao ou reordenacao de turnos.
- Nenhum resultado de ferramenta sintetico.
- Nenhuma remocao de assinaturas de pensamento.

**Google (Generative AI / Gemini CLI / Antigravity)**

- Sanitizacao de id de chamadas de ferramentas: alfanumerico estrito.
- Reparo de pareamento de resultados de ferramentas e resultados de ferramentas sinteticos.
- Validacao de turnos (alternancia de turnos no estilo Gemini).
- Correcao de ordenacao de turnos do Google (prefixar um pequeno bootstrap de usuario se o historico comecar com o assistente).
- Antigravity Claude: normalizar assinaturas de pensamento; remover blocos de pensamento sem assinatura.

**Anthropic / Minimax (compativel com Anthropic)**

- Reparo de pareamento de resultados de ferramentas e resultados de ferramentas sinteticos.
- Validacao de turnos (mesclar turnos consecutivos do usuario para satisfazer alternancia estrita).

**Mistral (incluindo deteccao baseada em id de modelo)**

- Sanitizacao de id de chamadas de ferramentas: strict9 (alfanumerico com comprimento 9).

**OpenRouter Gemini**

- Limpeza de assinaturas de pensamento: remover valores `thought_signature` que nao sao base64 (manter base64).

**Todo o resto**

- Apenas sanitizacao de imagens.

---

## Comportamento historico (antes de 2026.1.22)

Antes da versao 2026.1.22, o OpenClaw aplicava multiplas camadas de higiene de transcricoes:

- Uma **extensao de sanitizacao de transcricoes** era executada em toda construcao de contexto e podia:
  - Reparar o pareamento de uso/resultado de ferramentas.
  - Sanitizar ids de chamadas de ferramentas (incluindo um modo nao estrito que preservava `_`/`-`).
- O runner tambem realizava sanitizacao especifica por provedor, o que duplicava trabalho.
- Mutacoes adicionais ocorriam fora da politica de provedor, incluindo:
  - Remocao de tags `<final>` do texto do assistente antes da persistencia.
  - Remocao de turnos vazios de erro do assistente.
  - Corte de conteudo do assistente apos chamadas de ferramentas.

Essa complexidade causou regressoes entre provedores (notavelmente o pareamento `openai-responses`
`call_id|fc_id`). A limpeza de 2026.1.22 removeu a extensao, centralizou a logica
no runner e tornou o OpenAI **no-touch** alem da sanitizacao de imagens.
