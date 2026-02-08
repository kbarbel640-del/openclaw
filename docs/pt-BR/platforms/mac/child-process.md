---
summary: "Ciclo de vida do Gateway no macOS (launchd)"
read_when:
  - Integrando o app do mac com o ciclo de vida do gateway
title: "Ciclo de vida do Gateway"
x-i18n:
  source_path: platforms/mac/child-process.md
  source_hash: 9b910f574b723bc1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:55Z
---

# Ciclo de vida do Gateway no macOS

O app do macOS **gerencia o Gateway via launchd** por padrao e nao inicia
o Gateway como um processo filho. Primeiro, ele tenta se conectar a um
Gateway ja em execucao na porta configurada; se nenhum estiver acessivel,
ele habilita o servico launchd por meio da CLI externa `openclaw`
(sem runtime incorporado). Isso oferece inicializacao automatica confiavel
no login e reinicio em caso de falhas.

O modo de processo filho (Gateway iniciado diretamente pelo app) **nao esta em uso**
atualmente. Se voce precisar de um acoplamento mais estreito com a UI,
execute o Gateway manualmente em um terminal.

## Comportamento padrao (launchd)

- O app instala um LaunchAgent por usuario rotulado como `bot.molt.gateway`
  (ou `bot.molt.<profile>` ao usar `--profile`/`OPENCLAW_PROFILE`; o legado `com.openclaw.*` e suportado).
- Quando o modo Local esta habilitado, o app garante que o LaunchAgent esteja carregado e
  inicia o Gateway se necessario.
- Os logs sao gravados no caminho de log do gateway do launchd (visivel em Configuracoes de Depuracao).

Comandos comuns:

```bash
launchctl kickstart -k gui/$UID/bot.molt.gateway
launchctl bootout gui/$UID/bot.molt.gateway
```

Substitua o rotulo por `bot.molt.<profile>` ao executar um perfil nomeado.

## Builds de desenvolvimento nao assinadas

`scripts/restart-mac.sh --no-sign` e para builds locais rapidas quando voce nao tem
chaves de assinatura. Para evitar que o launchd aponte para um binario de relay nao assinado, ele:

- Grava `~/.openclaw/disable-launchagent`.

Execucoes assinadas de `scripts/restart-mac.sh` removem essa substituicao se o marcador
estiver presente. Para redefinir manualmente:

```bash
rm ~/.openclaw/disable-launchagent
```

## Modo somente de anexo

Para forcar o app do macOS a **nunca instalar ou gerenciar o launchd**, inicie-o com
`--attach-only` (ou `--no-launchd`). Isso define `~/.openclaw/disable-launchagent`,
de modo que o app apenas se anexa a um Gateway ja em execucao. Voce pode alternar o mesmo
comportamento em Configuracoes de Depuracao.

## Modo remoto

O modo remoto nunca inicia um Gateway local. O app usa um tunel SSH para o
host remoto e se conecta por meio desse tunel.

## Por que preferimos o launchd

- Inicializacao automatica no login.
- Semantica integrada de reinicio/KeepAlive.
- Logs e supervisao previsiveis.

Se um verdadeiro modo de processo filho voltar a ser necessario algum dia, ele
devera ser documentado como um modo separado e explicito apenas para desenvolvimento.
