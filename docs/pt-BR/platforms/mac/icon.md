---
summary: "Estados e animacoes do icone da barra de menus do OpenClaw no macOS"
read_when:
  - Alterar o comportamento do icone da barra de menus
title: "Icone da Barra de Menus"
x-i18n:
  source_path: platforms/mac/icon.md
  source_hash: a67a6e6bbdc2b611
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:57Z
---

# Estados do Icone da Barra de Menus

Autor: steipete · Atualizado: 2025-12-06 · Escopo: app macOS (`apps/macos`)

- **Idle:** Animacao normal do icone (piscar, ocasional balanco).
- **Paused:** O item de status usa `appearsDisabled`; sem movimento.
- **Voice trigger (orelhas grandes):** O detector de ativacao por voz chama `AppState.triggerVoiceEars(ttl: nil)` quando a palavra de ativacao e ouvida, mantendo `earBoostActive=true` enquanto a fala e capturada. As orelhas aumentam de escala (1,9x), ganham furos circulares para melhor legibilidade e, em seguida, caem via `stopVoiceEars()` apos 1s de silencio. Disparado apenas a partir do pipeline de voz dentro do app.
- **Working (agent running):** `AppState.isWorking=true` conduz uma micro-animacao de “corrida de cauda/pernas”: balanco de pernas mais rapido e leve deslocamento enquanto o trabalho esta em andamento. Atualmente alternado em execucoes do agente WebChat; adicione a mesma alternancia em outras tarefas longas quando voce conecta-las.

Pontos de integracao

- Ativacao por voz: chamadas de runtime/tester chamam `AppState.triggerVoiceEars(ttl: nil)` no gatilho e `stopVoiceEars()` apos 1s de silencio para corresponder a janela de captura.
- Atividade do agente: defina `AppStateStore.shared.setWorking(true/false)` em torno dos periodos de trabalho (ja feito na chamada do agente WebChat). Mantenha os periodos curtos e redefina em blocos `defer` para evitar animacoes presas.

Formas e tamanhos

- Icone base desenhado em `CritterIconRenderer.makeIcon(blink:legWiggle:earWiggle:earScale:earHoles:)`.
- A escala das orelhas tem padrao `1.0`; o reforco de voz define `earScale=1.9` e alterna `earHoles=true` sem alterar o quadro geral (imagem template de 18×18 pt renderizada em um backing store Retina de 36×36 px).
- A corrida usa balanco de pernas ate ~1,0 com um pequeno deslocamento horizontal; e aditiva a qualquer balanco idle existente.

Observacoes comportamentais

- Nao ha alternancia externa via CLI/broker para orelhas/trabalho; mantenha isso interno aos proprios sinais do app para evitar batimentos acidentais.
- Mantenha TTLs curtos (&lt;10s) para que o icone retorne rapidamente ao baseline se um trabalho travar.
