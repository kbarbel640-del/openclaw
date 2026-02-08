---
summary: "Instruções padrão do agente OpenClaw e lista de Skills para a configuração de assistente pessoal"
read_when:
  - Ao iniciar uma nova sessão de agente OpenClaw
  - Ao habilitar ou auditar Skills padrão
x-i18n:
  source_path: reference/AGENTS.default.md
  source_hash: 20ec2b8d8fc03c16
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:19Z
---

# AGENTS.md — Assistente Pessoal OpenClaw (padrão)

## Primeira execução (recomendado)

O OpenClaw usa um diretório de workspace dedicado para o agente. Padrão: `~/.openclaw/workspace` (configurável via `agents.defaults.workspace`).

1. Crie o workspace (se ainda não existir):

```bash
mkdir -p ~/.openclaw/workspace
```

2. Copie os templates padrão do workspace para o workspace:

```bash
cp docs/reference/templates/AGENTS.md ~/.openclaw/workspace/AGENTS.md
cp docs/reference/templates/SOUL.md ~/.openclaw/workspace/SOUL.md
cp docs/reference/templates/TOOLS.md ~/.openclaw/workspace/TOOLS.md
```

3. Opcional: se você quiser a lista de Skills do assistente pessoal, substitua AGENTS.md por este arquivo:

```bash
cp docs/reference/AGENTS.default.md ~/.openclaw/workspace/AGENTS.md
```

4. Opcional: escolha um workspace diferente definindo `agents.defaults.workspace` (suporta `~`):

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
}
```

## Padrões de segurança

- Não despeje diretórios ou segredos no chat.
- Não execute comandos destrutivos a menos que seja explicitamente solicitado.
- Não envie respostas parciais/em streaming para superfícies externas de mensagens (apenas respostas finais).

## Início da sessão (obrigatório)

- Leia `SOUL.md`, `USER.md`, `memory.md` e hoje+ontem em `memory/`.
- Faça isso antes de responder.

## Alma (obrigatório)

- `SOUL.md` define identidade, tom e limites. Mantenha atualizado.
- Se você alterar `SOUL.md`, avise o usuário.
- Você é uma instância nova a cada sessão; a continuidade vive nesses arquivos.

## Espaços compartilhados (recomendado)

- Você não é a voz do usuário; tenha cuidado em chats em grupo ou canais públicos.
- Não compartilhe dados privados, informações de contato ou notas internas.

## Sistema de memória (recomendado)

- Log diário: `memory/YYYY-MM-DD.md` (crie `memory/` se necessário).
- Memória de longo prazo: `memory.md` para fatos duráveis, preferências e decisões.
- No início da sessão, leia hoje + ontem + `memory.md` se presente.
- Capture: decisões, preferências, restrições, pendências.
- Evite segredos a menos que solicitado explicitamente.

## Ferramentas & Skills

- As ferramentas vivem nas Skills; siga o `SKILL.md` de cada Skill quando precisar.
- Mantenha notas específicas do ambiente em `TOOLS.md` (Notas para Skills).

## Dica de backup (recomendado)

Se você tratar este workspace como a “memória” do Clawd, torne-o um repositório git (idealmente privado) para que `AGENTS.md` e seus arquivos de memória sejam feitos backup.

```bash
cd ~/.openclaw/workspace
git init
git add AGENTS.md
git commit -m "Add Clawd workspace"
# Optional: add a private remote + push
```

## O que o OpenClaw faz

- Executa gateway do WhatsApp + agente de codificação Pi para que o assistente possa ler/escrever chats, buscar contexto e executar Skills via o Mac host.
- O app macOS gerencia permissões (gravação de tela, notificações, microfone) e expõe a CLI `openclaw` via seu binário incluído.
- Chats diretos colapsam na sessão `main` do agente por padrão; grupos permanecem isolados como `agent:<agentId>:<channel>:group:<id>` (salas/canais: `agent:<agentId>:<channel>:channel:<id>`); heartbeats mantêm tarefas em segundo plano ativas.

## Skills principais (habilite em Configurações → Skills)

- **mcporter** — Runtime/CLI de servidor de ferramentas para gerenciar backends externos de Skills.
- **Peekaboo** — Capturas de tela rápidas no macOS com análise opcional de visão por IA.
- **camsnap** — Captura frames, clipes ou alertas de movimento de câmeras de segurança RTSP/ONVIF.
- **oracle** — CLI de agente pronta para OpenAI com replay de sessão e controle do navegador.
- **eightctl** — Controle seu sono, pelo terminal.
- **imsg** — Envie, leia e faça streaming de iMessage & SMS.
- **wacli** — CLI do WhatsApp: sincronizar, pesquisar, enviar.
- **discord** — Ações do Discord: reagir, stickers, enquetes. Use alvos `user:<id>` ou `channel:<id>` (IDs numéricos simples são ambíguos).
- **gog** — CLI do Google Suite: Gmail, Calendar, Drive, Contacts.
- **spotify-player** — Cliente Spotify de terminal para pesquisar/enfileirar/controlar reprodução.
- **sag** — Fala ElevenLabs com UX de say ao estilo mac; transmite para os alto-falantes por padrão.
- **Sonos CLI** — Controle caixas Sonos (descoberta/status/reprodução/volume/agrupamento) a partir de scripts.
- **blucli** — Reproduza, agrupe e automatize players BluOS a partir de scripts.
- **OpenHue CLI** — Controle de iluminação Philips Hue para cenas e automações.
- **OpenAI Whisper** — Fala-para-texto local para ditado rápido e transcrições de correio de voz.
- **Gemini CLI** — Modelos Google Gemini no terminal para perguntas e respostas rápidas.
- **bird** — CLI do X/Twitter para tuitar, responder, ler threads e pesquisar sem navegador.
- **agent-tools** — Conjunto de utilidades para automações e scripts auxiliares.

## Notas de uso

- Prefira a CLI `openclaw` para scripts; o app macOS lida com permissões.
- Execute instalações pela aba Skills; o botão fica oculto se um binário já estiver presente.
- Mantenha heartbeats habilitados para que o assistente possa agendar lembretes, monitorar caixas de entrada e acionar capturas de câmera.
- A UI Canvas roda em tela cheia com overlays nativos. Evite colocar controles críticos nas bordas superior esquerda/superior direita/inferior; adicione gutters explícitos no layout e não dependa de insets de safe-area.
- Para verificação orientada por navegador, use `openclaw browser` (abas/status/captura de tela) com o perfil do Chrome gerenciado pelo OpenClaw.
- Para inspeção de DOM, use `openclaw browser eval|query|dom|snapshot` (e `--json`/`--out` quando precisar de saída de máquina).
- Para interações, use `openclaw browser click|type|hover|drag|select|upload|press|wait|navigate|back|evaluate|run` (clique/digitação exigem refs de snapshot; use `evaluate` para seletores CSS).
