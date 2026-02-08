---
summary: "Como executar testes localmente (vitest) e quando usar modos forcar/cobertura"
read_when:
  - Executando ou corrigindo testes
title: "Testes"
x-i18n:
  source_path: reference/test.md
  source_hash: be7b751fb81c8c94
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:21Z
---

# Testes

- Kit completo de testes (suites, live, Docker): [Testing](/testing)

- `pnpm test:force`: Encerra qualquer processo de gateway remanescente que esteja ocupando a porta de controle padrão e, em seguida, executa o conjunto completo do Vitest com uma porta de gateway isolada para que os testes de servidor não colidam com uma instancia em execucao. Use isso quando uma execucao anterior do gateway deixou a porta 18789 ocupada.
- `pnpm test:coverage`: Executa o Vitest com cobertura V8. Os limites globais sao 70% para linhas/branches/funcoes/estatisticas. A cobertura exclui entrypoints com forte integracao (wiring de CLI, bridges gateway/telegram, servidor estatico do webchat) para manter o alvo focado em logica testavel por testes unitarios.
- `pnpm test:e2e`: Executa testes de fumaca end-to-end do gateway (pareamento WS/HTTP/node com multiplas instancias).
- `pnpm test:live`: Executa testes live de provedores (minimax/zai). Requer chaves de API e `LIVE=1` (ou `*_LIVE_TEST=1` especifico do provedor) para remover o skip.

## Benchmark de latencia de modelo (chaves locais)

Script: [`scripts/bench-model.ts`](https://github.com/openclaw/openclaw/blob/main/scripts/bench-model.ts)

Uso:

- `source ~/.profile && pnpm tsx scripts/bench-model.ts --runs 10`
- Env opcional: `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, `ANTHROPIC_API_KEY`
- Prompt padrao: “Responda com uma unica palavra: ok. Sem pontuacao ou texto extra.”

Ultima execucao (2025-12-31, 20 execucoes):

- minimax mediana 1279ms (min 1114, max 2431)
- opus mediana 2454ms (min 1224, max 3170)

## Integracao Inicial E2E (Docker)

Docker e opcional; isso e necessario apenas para testes de fumaca de integracao inicial em container.

Fluxo completo de cold-start em um container Linux limpo:

```bash
scripts/e2e/onboard-docker.sh
```

Este script conduz o assistente interativo via um pseudo-tty, verifica arquivos de configuracao/workspace/sessao e, em seguida, inicia o gateway e executa `openclaw health`.

## Fumaca de importacao por QR (Docker)

Garante que `qrcode-terminal` carrega sob Node 22+ no Docker:

```bash
pnpm test:docker:qr
```
