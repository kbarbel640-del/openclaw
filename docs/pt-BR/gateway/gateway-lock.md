---
summary: "Protecao de singleton do Gateway usando o bind do listener WebSocket"
read_when:
  - Ao executar ou depurar o processo do gateway
  - Ao investigar a aplicacao de instancia unica
title: "Bloqueio do Gateway"
x-i18n:
  source_path: gateway/gateway-lock.md
  source_hash: 15fdfa066d1925da
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:12Z
---

# Bloqueio do Gateway

Ultima atualizacao: 2025-12-11

## Por que

- Garantir que apenas uma instancia do gateway seja executada por porta base no mesmo host; gateways adicionais devem usar perfis isolados e portas unicas.
- Sobreviver a crashes/SIGKILL sem deixar arquivos de lock obsoletos.
- Falhar rapidamente com um erro claro quando a porta de controle ja estiver ocupada.

## Mecanismo

- O gateway faz o bind do listener WebSocket (padrao `ws://127.0.0.1:18789`) imediatamente na inicializacao usando um listener TCP exclusivo.
- Se o bind falhar com `EADDRINUSE`, a inicializacao dispara `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")`.
- O SO libera o listener automaticamente na saida de qualquer processo, incluindo crashes e SIGKILL — nenhum arquivo de lock separado ou etapa de limpeza e necessaria.
- No desligamento, o gateway fecha o servidor WebSocket e o servidor HTTP subjacente para liberar a porta prontamente.

## Superficie de erro

- Se outro processo mantiver a porta, a inicializacao dispara `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")`.
- Outras falhas de bind aparecem como `GatewayLockError("failed to bind gateway socket on ws://127.0.0.1:<port>: …")`.

## Notas operacionais

- Se a porta estiver ocupada por _outro_ processo, o erro e o mesmo; libere a porta ou escolha outra com `openclaw gateway --port <port>`.
- O app do macOS ainda mantem seu proprio guard leve de PID antes de iniciar o gateway; o lock em tempo de execucao e aplicado pelo bind do WebSocket.
