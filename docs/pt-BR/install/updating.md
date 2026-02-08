---
summary: "Atualizando o OpenClaw com segurança (instalação global ou a partir do código-fonte), além de estratégia de rollback"
read_when:
  - Atualizando o OpenClaw
  - Algo quebra após uma atualização
title: "Atualizando"
x-i18n:
  source_path: install/updating.md
  source_hash: 38cccac0839f0f22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:48Z
---

# Atualizando

O OpenClaw está evoluindo rapidamente (pré “1.0”). Trate atualizações como infraestrutura em produção: atualizar → rodar verificações → reiniciar (ou usar `openclaw update`, que reinicia) → verificar.

## Recomendado: reexecutar o instalador do site (upgrade no local)

O caminho de atualização **preferido** é reexecutar o instalador do site. Ele
detecta instalações existentes, atualiza no local e executa `openclaw doctor` quando
necessário.

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Notas:

- Adicione `--no-onboard` se você não quiser que o assistente de integracao inicial rode novamente.
- Para **instalações a partir do código-fonte**, use:
  ```bash
  curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
  ```
  O instalador fará `git pull --rebase` **apenas** se o repositório estiver limpo.
- Para **instalações globais**, o script usa `npm install -g openclaw@latest` por baixo dos panos.
- Nota de legado: `clawdbot` permanece disponível como um shim de compatibilidade.

## Antes de atualizar

- Saiba como você instalou: **global** (npm/pnpm) vs **a partir do código-fonte** (git clone).
- Saiba como seu Gateway está rodando: **terminal em primeiro plano** vs **serviço supervisionado** (launchd/systemd).
- Faça um snapshot do seu ajuste fino:
  - Config: `~/.openclaw/openclaw.json`
  - Credenciais: `~/.openclaw/credentials/`
  - Workspace: `~/.openclaw/workspace`

## Atualizar (instalação global)

Instalação global (escolha uma):

```bash
npm i -g openclaw@latest
```

```bash
pnpm add -g openclaw@latest
```

**Não** recomendamos Bun para o runtime do Gateway (bugs no WhatsApp/Telegram).

Para trocar canais de atualização (instalações via git + npm):

```bash
openclaw update --channel beta
openclaw update --channel dev
openclaw update --channel stable
```

Use `--tag <dist-tag|version>` para instalar uma tag/versão específica.

Veja [Canais de desenvolvimento](/install/development-channels) para a semântica dos canais e notas de lançamento.

Nota: em instalações via npm, o gateway registra uma dica de atualização na inicialização (verifica a tag do canal atual). Desative via `update.checkOnStart: false`.

Em seguida:

```bash
openclaw doctor
openclaw gateway restart
openclaw health
```

Notas:

- Se o seu Gateway roda como serviço, `openclaw gateway restart` é preferível a matar PIDs.
- Se você está fixado em uma versão específica, veja “Rollback / fixação” abaixo.

## Atualizar (`openclaw update`)

Para **instalações a partir do código-fonte** (git checkout), prefira:

```bash
openclaw update
```

Ele executa um fluxo de atualização relativamente seguro:

- Requer uma árvore de trabalho limpa.
- Troca para o canal selecionado (tag ou branch).
- Faz fetch + rebase contra o upstream configurado (canal dev).
- Instala dependências, compila, compila a Control UI e executa `openclaw doctor`.
- Reinicia o gateway por padrão (use `--no-restart` para pular).

Se você instalou via **npm/pnpm** (sem metadados git), `openclaw update` tentará atualizar via seu gerenciador de pacotes. Se não conseguir detectar a instalação, use “Atualizar (instalação global)” em vez disso.

## Atualizar (Control UI / RPC)

A Control UI tem **Atualizar & Reiniciar** (RPC: `update.run`). Ela:

1. Executa o mesmo fluxo de atualização a partir do código-fonte que `openclaw update` (apenas git checkout).
2. Escreve um sentinela de reinício com um relatório estruturado (cauda de stdout/stderr).
3. Reinicia o gateway e faz ping da última sessao ativa com o relatório.

Se o rebase falhar, o gateway aborta e reinicia sem aplicar a atualização.

## Atualizar (a partir do código-fonte)

A partir do checkout do repositório:

Preferido:

```bash
openclaw update
```

Manual (equivalente-ish):

```bash
git pull
pnpm install
pnpm build
pnpm ui:build # auto-installs UI deps on first run
openclaw doctor
openclaw health
```

Notas:

- `pnpm build` importa quando você executa o binário empacotado `openclaw` ([`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs)) ou usa Node para executar `dist/`.
- Se você executa a partir de um checkout do repositório sem uma instalação global, use `pnpm openclaw ...` para comandos de CLI.
- Se você executa diretamente a partir de TypeScript (`pnpm openclaw ...`), uma recompilação geralmente é desnecessária, mas **migrações de config ainda se aplicam** → execute o doctor.
- Alternar entre instalações globais e via git é fácil: instale a outra variante e, em seguida, execute `openclaw doctor` para que o entrypoint do serviço do gateway seja reescrito para a instalação atual.

## Sempre Execute: `openclaw doctor`

Doctor é o comando de “atualização segura”. Ele é intencionalmente sem graça: reparar + migrar + avisar.

Nota: se você estiver em uma **instalação a partir do código-fonte** (git checkout), `openclaw doctor` oferecerá executar `openclaw update` primeiro.

Coisas típicas que ele faz:

- Migrar chaves de config obsoletas / locais legados de arquivos de config.
- Auditar políticas de Mensagem direta e alertar sobre configurações “abertas” arriscadas.
- Verificar a saúde do Gateway e pode oferecer reiniciar.
- Detectar e migrar serviços antigos do gateway (launchd/systemd; schtasks legados) para os serviços atuais do OpenClaw.
- No Linux, garantir o lingering de usuário do systemd (para que o Gateway sobreviva ao logout).

Detalhes: [Doctor](/gateway/doctor)

## Iniciar / parar / reiniciar o Gateway

CLI (funciona independentemente do SO):

```bash
openclaw gateway status
openclaw gateway stop
openclaw gateway restart
openclaw gateway --port 18789
openclaw logs --follow
```

Se você estiver supervisionado:

- macOS launchd (LaunchAgent empacotado no app): `launchctl kickstart -k gui/$UID/bot.molt.gateway` (use `bot.molt.<profile>`; o legado `com.openclaw.*` ainda funciona)
- Linux systemd user service: `systemctl --user restart openclaw-gateway[-<profile>].service`
- Windows (WSL2): `systemctl --user restart openclaw-gateway[-<profile>].service`
  - `launchctl`/`systemctl` só funcionam se o serviço estiver instalado; caso contrário, execute `openclaw gateway install`.

Runbook + rótulos exatos de serviço: [Runbook do Gateway](/gateway)

## Rollback / fixação (quando algo quebra)

### Fixar (instalação global)

Instale uma versão conhecida e estável (substitua `<version>` pela última que funcionou):

```bash
npm i -g openclaw@<version>
```

```bash
pnpm add -g openclaw@<version>
```

Dica: para ver a versão publicada atual, execute `npm view openclaw version`.

Depois reinicie + execute o doctor novamente:

```bash
openclaw doctor
openclaw gateway restart
```

### Fixar (código-fonte) por data

Escolha um commit por data (exemplo: “estado da main em 2026-01-01”):

```bash
git fetch origin
git checkout "$(git rev-list -n 1 --before=\"2026-01-01\" origin/main)"
```

Depois reinstale as dependências + reinicie:

```bash
pnpm install
pnpm build
openclaw gateway restart
```

Se você quiser voltar para a mais recente depois:

```bash
git checkout main
git pull
```

## Se você estiver travado

- Execute `openclaw doctor` novamente e leia a saída com atenção (ela frequentemente diz qual é a correção).
- Confira: [Solucao de problemas](/gateway/troubleshooting)
- Pergunte no Discord: https://discord.gg/clawd
