---
summary: "Fluxo de integracao inicial na primeira execucao do OpenClaw (app macOS)"
read_when:
  - Projetando o assistente de integracao inicial do macOS
  - Implementando autenticacao ou configuracao de identidade
title: "Integracao Inicial (App macOS)"
sidebarTitle: "Onboarding: macOS App"
x-i18n:
  source_path: start/onboarding.md
  source_hash: 45f912067527158f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:25Z
---

# Integracao Inicial (App macOS)

Este documento descreve o fluxo **atual** de integracao inicial na primeira execucao. O objetivo e uma experiencia suave no “dia 0”: escolher onde o Gateway roda, conectar a autenticacao, executar o assistente e deixar o agente se inicializar sozinho.

<Steps>
<Step title="Aprovar aviso do macOS">
<Frame>
<img src="/assets/macos-onboarding/01-macos-warning.jpeg" alt="" />
</Frame>
</Step>
<Step title="Aprovar busca por redes locais">
<Frame>
<img src="/assets/macos-onboarding/02-local-networks.jpeg" alt="" />
</Frame>
</Step>
<Step title="Boas-vindas e aviso de seguranca">
<Frame caption="Leia o aviso de seguranca exibido e decida de acordo">
<img src="/assets/macos-onboarding/03-security-notice.png" alt="" />
</Frame>
</Step>
<Step title="Local vs Remoto">
<Frame>
<img src="/assets/macos-onboarding/04-choose-gateway.png" alt="" />
</Frame>

Onde o **Gateway** roda?

- **Este Mac (Apenas local):** a integracao inicial pode executar fluxos OAuth e gravar credenciais localmente.
- **Remoto (via SSH/Tailnet):** a integracao inicial **nao** executa OAuth localmente;
  as credenciais devem existir no host do gateway.
- **Configurar depois:** pular a configuracao e deixar o app nao configurado.

<Tip>
**Dica de autenticacao do Gateway:**
- O assistente agora gera um **token** mesmo para loopback, portanto clientes WS locais devem se autenticar.
- Se voce desativar a autenticacao, qualquer processo local pode se conectar; use isso apenas em maquinas totalmente confiaveis.
- Use um **token** para acesso em varias maquinas ou binds que nao sejam loopback.
</Tip>
</Step>
<Step title="Permissoes">
<Frame caption="Escolha quais permissoes voce deseja conceder ao OpenClaw">
<img src="/assets/macos-onboarding/05-permissions.png" alt="" />
</Frame>

A integracao inicial solicita permissoes TCC necessarias para:

- Automacao (AppleScript)
- Notificacoes
- Acessibilidade
- Gravacao de Tela
- Microfone
- Reconhecimento de Fala
- Camera
- Localizacao

</Step>
<Step title="CLI">
  <Info>Esta etapa e opcional</Info>
  O app pode instalar a CLI global `openclaw` via npm/pnpm para que fluxos de trabalho no terminal
  e tarefas do launchd funcionem imediatamente.
</Step>
<Step title="Chat de Integracao Inicial (sessao dedicada)">
  Apos a configuracao, o app abre uma sessao de chat dedicada a integracao inicial para que o agente possa
  se apresentar e orientar os proximos passos. Isso mantem a orientacao da primeira execucao separada
  da sua conversa normal. Veja [Bootstrapping](/start/bootstrapping) para
  o que acontece no host do gateway durante a primeira execucao do agente.
</Step>
</Steps>
