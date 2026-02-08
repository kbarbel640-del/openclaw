---
summary: "Etapas de verificacao de saude para conectividade de canais"
read_when:
  - Diagnostico da saude do canal WhatsApp
title: "Verificacoes de Saude"
x-i18n:
  source_path: gateway/health.md
  source_hash: 74f242e98244c135
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:15Z
---

# Verificacoes de Saude (CLI)

Guia curto para verificar a conectividade dos canais sem adivinhacao.

## Verificacoes rapidas

- `openclaw status` — resumo local: alcançabilidade/modo do gateway, dica de atualizacao, idade da autenticacao do canal vinculado, sessoes + atividade recente.
- `openclaw status --all` — diagnostico local completo (somente leitura, com cores, seguro para colar em depuracao).
- `openclaw status --deep` — tambem testa o Gateway em execucao (testes por canal quando suportado).
- `openclaw health --json` — solicita ao Gateway em execucao um snapshot completo de saude (somente WS; sem socket direto do Baileys).
- Envie `/status` como uma mensagem independente no WhatsApp/WebChat para obter uma resposta de status sem invocar o agente.
- Logs: tail `/tmp/openclaw/openclaw-*.log` e filtre por `web-heartbeat`, `web-reconnect`, `web-auto-reply`, `web-inbound`.

## Diagnosticos aprofundados

- Credenciais em disco: `ls -l ~/.openclaw/credentials/whatsapp/<accountId>/creds.json` (o mtime deve ser recente).
- Armazenamento de sessao: `ls -l ~/.openclaw/agents/<agentId>/sessions/sessions.json` (o caminho pode ser sobrescrito na configuracao). A contagem e os destinatarios recentes sao exibidos via `status`.
- Fluxo de revinculacao: `openclaw channels logout && openclaw channels login --verbose` quando codigos de status 409–515 ou `loggedOut` aparecem nos logs. (Observacao: o fluxo de login por QR reinicia automaticamente uma vez para o status 515 apos o pareamento.)

## Quando algo falha

- `logged out` ou status 409–515 → revincule com `openclaw channels logout` e depois `openclaw channels login`.
- Gateway inalcançavel → inicie-o: `openclaw gateway --port 18789` (use `--force` se a porta estiver ocupada).
- Nenhuma mensagem de entrada → confirme que o telefone vinculado esta online e que o remetente esta permitido (`channels.whatsapp.allowFrom`); para chats em grupo, garanta que as regras de allowlist + mencao correspondam (`channels.whatsapp.groups`, `agents.list[].groupChat.mentionPatterns`).

## Comando dedicado de "health"

`openclaw health --json` solicita ao Gateway em execucao seu snapshot de saude (sem sockets diretos de canal a partir da CLI). Ele reporta credenciais vinculadas/idade da autenticacao quando disponivel, resumos de testes por canal, resumo do armazenamento de sessao e a duracao do teste. Ele encerra com codigo diferente de zero se o Gateway estiver inalcançavel ou se o teste falhar/estourar o tempo limite. Use `--timeout <ms>` para sobrescrever o padrao de 10s.
