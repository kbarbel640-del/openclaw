---
title: "Fluxo de Desenvolvimento do Pi"
x-i18n:
  source_path: pi-dev.md
  source_hash: 65bd0580dd03df05
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:50Z
---

# Fluxo de Desenvolvimento do Pi

Este guia resume um fluxo de trabalho sensato para trabalhar na integração do Pi no OpenClaw.

## Verificação de Tipos e Linting

- Verificar tipos e build: `pnpm build`
- Lint: `pnpm lint`
- Verificação de formatação: `pnpm format`
- Gate completo antes de enviar: `pnpm lint && pnpm build && pnpm test`

## Executando Testes do Pi

Use o script dedicado para o conjunto de testes de integração do Pi:

```bash
scripts/pi/run-tests.sh
```

Para incluir o teste ao vivo que exercita o comportamento real do provedor:

```bash
scripts/pi/run-tests.sh --live
```

O script executa todos os testes unitários relacionados ao Pi por meio destes globs:

- `src/agents/pi-*.test.ts`
- `src/agents/pi-embedded-*.test.ts`
- `src/agents/pi-tools*.test.ts`
- `src/agents/pi-settings.test.ts`
- `src/agents/pi-tool-definition-adapter.test.ts`
- `src/agents/pi-extensions/*.test.ts`

## Testes Manuais

Fluxo recomendado:

- Execute o Gateway em modo de desenvolvimento:
  - `pnpm gateway:dev`
- Acione o agente diretamente:
  - `pnpm openclaw agent --message "Hello" --thinking low`
- Use o TUI para depuração interativa:
  - `pnpm tui`

Para o comportamento de chamadas de ferramentas, faça um prompt para uma ação `read` ou `exec` para que voce possa ver o streaming de ferramentas e o tratamento de payloads.

## Redefinicao Completa

O estado fica no diretorio de estado do OpenClaw. O padrao é `~/.openclaw`. Se `OPENCLAW_STATE_DIR` estiver definido, use esse diretorio em vez disso.

Para redefinir tudo:

- `openclaw.json` para configuracao
- `credentials/` para perfis de autenticacao e tokens
- `agents/<agentId>/sessions/` para o historico de sessoes do agente
- `agents/<agentId>/sessions.json` para o indice de sessoes
- `sessions/` se caminhos legados existirem
- `workspace/` se voce quiser um workspace em branco

Se voce quiser apenas redefinir sessoes, exclua `agents/<agentId>/sessions/` e `agents/<agentId>/sessions.json` para esse agente. Mantenha `credentials/` se voce nao quiser reautenticar.

## Referencias

- https://docs.openclaw.ai/testing
- https://docs.openclaw.ai/start/getting-started
