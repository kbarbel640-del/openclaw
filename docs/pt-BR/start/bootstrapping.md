---
summary: "Ritual de bootstrapping do agente que inicializa o workspace e os arquivos de identidade"
read_when:
  - Entender o que acontece na primeira execucao do agente
  - Explicar onde ficam os arquivos de bootstrapping
  - Depurar a configuracao de identidade da integracao inicial
title: "Bootstrapping do Agente"
sidebarTitle: "Bootstrapping"
x-i18n:
  source_path: start/bootstrapping.md
  source_hash: 4a08b5102f25c6c4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:24Z
---

# Bootstrapping do Agente

O bootstrapping e o ritual da **primeira execucao** que prepara o workspace do agente e
coleta detalhes de identidade. Ele acontece apos a integracao inicial, quando o agente inicia
pela primeira vez.

## O que o bootstrapping faz

Na primeira execucao do agente, o OpenClaw inicializa o workspace (padrao
`~/.openclaw/workspace`):

- Inicializa `AGENTS.md`, `BOOTSTRAP.md`, `IDENTITY.md`, `USER.md`.
- Executa um breve ritual de perguntas e respostas (uma pergunta por vez).
- Grava identidade + preferencias em `IDENTITY.md`, `USER.md`, `SOUL.md`.
- Remove `BOOTSTRAP.md` ao finalizar para que execute apenas uma vez.

## Onde ele roda

O bootstrapping sempre roda no **host do Gateway**. Se o app macOS se conectar a
um Gateway remoto, o workspace e os arquivos de bootstrapping ficam nessa
maquina remota.

<Note>
Quando o Gateway roda em outra maquina, edite os arquivos do workspace no host do gateway
(por exemplo, `user@gateway-host:~/.openclaw/workspace`).
</Note>

## Documentos relacionados

- Integracao inicial do app macOS: [Onboarding](/start/onboarding)
- Layout do workspace: [Workspace do agente](/concepts/agent-workspace)
