---
summary: "Como o app do macOS relata estados de saude do gateway/Baileys"
read_when:
  - Depuracao dos indicadores de saude do app para macOS
title: "Verificacoes de Saude"
x-i18n:
  source_path: platforms/mac/health.md
  source_hash: 0560e96501ddf53a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:52Z
---

# Verificacoes de Saude no macOS

Como ver se o canal vinculado esta saudavel a partir do app da barra de menu.

## Barra de menu

- O ponto de status agora reflete a saude do Baileys:
  - Verde: vinculado + socket aberto recentemente.
  - Laranja: conectando/tentando novamente.
  - Vermelho: desconectado ou falha na sondagem.
- A linha secundaria mostra "vinculado · auth 12m" ou exibe o motivo da falha.
- O item de menu "Executar Verificacao de Saude" aciona uma sondagem sob demanda.

## Configuracoes

- A aba Geral ganha um cartao de Saude mostrando: idade da auth vinculada, caminho/contagem do session-store, hora da ultima verificacao, ultimo erro/codigo de status e botoes para Executar Verificacao de Saude / Revelar Logs.
- Usa um snapshot em cache para que a UI carregue instantaneamente e tenha fallback gracioso quando offline.
- **Aba Canais** expõe status do canal + controles para WhatsApp/Telegram (QR de login, logout, sondagem, ultima desconexao/erro).

## Como a sondagem funciona

- O app executa `openclaw health --json` via `ShellExecutor` a cada ~60s e sob demanda. A sondagem carrega as credenciais e relata o status sem enviar mensagens.
- Armazena em cache o ultimo snapshot valido e o ultimo erro separadamente para evitar cintilacao; mostra o timestamp de cada um.

## Em caso de duvida

- Voce ainda pode usar o fluxo de CLI em [Saude do Gateway](/gateway/health) (`openclaw status`, `openclaw status --deep`, `openclaw health --json`) e acompanhar `/tmp/openclaw/openclaw-*.log` para `web-heartbeat` / `web-reconnect`.
