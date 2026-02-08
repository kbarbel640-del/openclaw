---
summary: "Modo de exec elevado e diretivas /elevated"
read_when:
  - Ajustando padroes do modo elevado, allowlists ou comportamento de comandos com barra
title: "Modo Elevado"
x-i18n:
  source_path: tools/elevated.md
  source_hash: 83767a0160930402
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:39Z
---

# Modo Elevado (/diretivas /elevated)

## O que ele faz

- `/elevated on` executa no host do gateway e mantem aprovacoes de exec (o mesmo que `/elevated ask`).
- `/elevated full` executa no host do gateway **e** aprova automaticamente exec (ignora aprovacoes de exec).
- `/elevated ask` executa no host do gateway, mas mantem aprovacoes de exec (o mesmo que `/elevated on`).
- `on`/`ask` **nao** forcam `exec.security=full`; a politica de seguranca/ask configurada ainda se aplica.
- So altera o comportamento quando o agente esta **em sandbox** (caso contrario, exec ja executa no host).
- Formas de diretiva: `/elevated on|off|ask|full`, `/elev on|off|ask|full`.
- Apenas `on|off|ask|full` sao aceitos; qualquer outra coisa retorna uma dica e nao muda o estado.

## O que ele controla (e o que nao)

- **Portoes de disponibilidade**: `tools.elevated` e a linha de base global. `agents.list[].tools.elevated` pode restringir ainda mais o elevado por agente (ambos devem permitir).
- **Estado por sessao**: `/elevated on|off|ask|full` define o nivel elevado para a chave de sessao atual.
- **Diretiva inline**: `/elevated on|ask|full` dentro de uma mensagem se aplica apenas a essa mensagem.
- **Grupos**: Em chats de grupo, diretivas elevadas so sao honradas quando o agente e mencionado. Mensagens apenas de comando que ignoram requisitos de mencao sao tratadas como mencionadas.
- **Execucao no host**: elevado forca `exec` no host do gateway; `full` tambem define `security=full`.
- **Aprovacoes**: `full` ignora aprovacoes de exec; `on`/`ask` as respeitam quando regras de allowlist/ask exigem.
- **Agentes fora de sandbox**: sem efeito para localizacao; apenas afeta gating, logs e status.
- **A politica de ferramentas ainda se aplica**: se `exec` for negado pela politica de ferramentas, o elevado nao pode ser usado.
- **Separado de `/exec`**: `/exec` ajusta padroes por sessao para remetentes autorizados e nao requer elevado.

## Ordem de resolucao

1. Diretiva inline na mensagem (aplica-se apenas a essa mensagem).
2. Substituicao de sessao (definida ao enviar uma mensagem apenas com a diretiva).
3. Padrao global (`agents.defaults.elevatedDefault` na configuracao).

## Definindo um padrao de sessao

- Envie uma mensagem que seja **apenas** a diretiva (espacos em branco sao permitidos), por exemplo, `/elevated full`.
- Uma resposta de confirmacao e enviada (`Elevated mode set to full...` / `Elevated mode disabled.`).
- Se o acesso elevado estiver desativado ou o remetente nao estiver na allowlist aprovada, a diretiva responde com um erro acionavel e nao altera o estado da sessao.
- Envie `/elevated` (ou `/elevated:`) sem argumento para ver o nivel elevado atual.

## Disponibilidade + allowlists

- Portao de recurso: `tools.elevated.enabled` (o padrao pode estar desligado via configuracao mesmo que o codigo suporte).
- Allowlist de remetentes: `tools.elevated.allowFrom` com allowlists por provedor (por exemplo, `discord`, `whatsapp`).
- Portao por agente: `agents.list[].tools.elevated.enabled` (opcional; so pode restringir ainda mais).
- Allowlist por agente: `agents.list[].tools.elevated.allowFrom` (opcional; quando definida, o remetente deve corresponder **tanto** a allowlists globais quanto por agente).
- Fallback do Discord: se `tools.elevated.allowFrom.discord` for omitido, a lista `channels.discord.dm.allowFrom` e usada como fallback. Defina `tools.elevated.allowFrom.discord` (mesmo `[]`) para substituir. Allowlists por agente **nao** usam o fallback.
- Todos os portoes devem passar; caso contrario, o elevado e tratado como indisponivel.

## Logs + status

- Chamadas de exec elevadas sao registradas no nivel info.
- O status da sessao inclui o modo elevado (por exemplo, `elevated=ask`, `elevated=full`).
