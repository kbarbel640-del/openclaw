---
summary: "Lógica de status da barra de menu e o que é exibido aos usuarios"
read_when:
  - Ajustando a UI do menu do mac ou a logica de status
title: "Barra de Menu"
x-i18n:
  source_path: platforms/mac/menu-bar.md
  source_hash: 8eb73c0e671a76aa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:57Z
---

# Logica de Status da Barra de Menu

## O que é mostrado

- Exibimos o estado atual de trabalho do agente no ícone da barra de menu e na primeira linha de status do menu.
- O status de saúde fica oculto enquanto o trabalho está ativo; ele retorna quando todas as sessões estão ociosas.
- O bloco “Nodes” no menu lista apenas **dispositivos** (nós pareados via `node.list`), não entradas de cliente/presença.
- Uma seção “Usage” aparece sob Context quando snapshots de uso do provedor estão disponíveis.

## Modelo de estado

- Sessões: eventos chegam com `runId` (por execução) mais `sessionKey` no payload. A sessão “principal” é a chave `main`; se ausente, usamos como fallback a sessão atualizada mais recentemente.
- Prioridade: a principal sempre vence. Se a principal estiver ativa, seu estado é exibido imediatamente. Se a principal estiver ociosa, a sessão não‑principal mais recentemente ativa é exibida. Não alternamos no meio da atividade; só trocamos quando a sessão atual fica ociosa ou a principal se torna ativa.
- Tipos de atividade:
  - `job`: execução de comando de alto nível (`state: started|streaming|done|error`).
  - `tool`: `phase: start|result` com `toolName` e `meta/args`.

## Enum IconState (Swift)

- `idle`
- `workingMain(ActivityKind)`
- `workingOther(ActivityKind)`
- `overridden(ActivityKind)` (override de debug)

### ActivityKind → glifo

- `exec` → 💻
- `read` → 📄
- `write` → ✍️
- `edit` → 📝
- `attach` → 📎
- default → 🛠️

### Mapeamento visual

- `idle`: criaturinha normal.
- `workingMain`: badge com glifo, tonalidade completa, animação de “trabalho” nas pernas.
- `workingOther`: badge com glifo, tonalidade atenuada, sem correria.
- `overridden`: usa o glifo/tonalidade escolhidos independentemente da atividade.

## Texto da linha de status (menu)

- Enquanto o trabalho está ativo: `<Session role> · <activity label>`
  - Exemplos: `Main · exec: pnpm test`, `Other · read: apps/macos/Sources/OpenClaw/AppState.swift`.
- Quando ocioso: retorna ao resumo de saúde.

## Ingestão de eventos

- Fonte: eventos `agent` do canal de controle (`ControlChannel.handleAgentEvent`).
- Campos analisados:
  - `stream: "job"` com `data.state` para início/parada.
  - `stream: "tool"` com `data.phase`, `name`, `meta`/`args` opcionais.
- Rótulos:
  - `exec`: primeira linha de `args.command`.
  - `read`/`write`: caminho encurtado.
  - `edit`: caminho mais tipo de mudança inferido a partir de `meta`/contagens de diff.
  - fallback: nome da ferramenta.

## Override de debug

- Configurações ▸ Debug ▸ seletor “Icon override”:
  - `System (auto)` (padrão)
  - `Working: main` (por tipo de ferramenta)
  - `Working: other` (por tipo de ferramenta)
  - `Idle`
- Armazenado via `@AppStorage("iconOverride")`; mapeado para `IconState.overridden`.

## Checklist de testes

- Dispare um job da sessão principal: verifique se o ícone muda imediatamente e a linha de status mostra o rótulo da principal.
- Dispare um job de sessão não‑principal enquanto a principal estiver ociosa: ícone/status mostram a não‑principal; permanecem estáveis até concluir.
- Inicie a principal enquanto outra estiver ativa: o ícone muda para a principal instantaneamente.
- Rajadas rápidas de ferramentas: garanta que o badge não pisque (graça de TTL nos resultados de ferramentas).
- A linha de saúde reaparece quando todas as sessões ficam ociosas.
