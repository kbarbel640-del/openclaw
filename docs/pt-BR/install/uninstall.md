---
summary: "Desinstalar o OpenClaw completamente (CLI, servico, estado, workspace)"
read_when:
  - Voce quer remover o OpenClaw de uma maquina
  - O servico do Gateway ainda esta em execucao apos a desinstalacao
title: "Desinstalar"
x-i18n:
  source_path: install/uninstall.md
  source_hash: 6673a755c5e1f90a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:38Z
---

# Desinstalar

Dois caminhos:

- **Caminho facil** se `openclaw` ainda estiver instalado.
- **Remocao manual do servico** se a CLI nao estiver mais instalada, mas o servico ainda estiver em execucao.

## Caminho facil (CLI ainda instalada)

Recomendado: use o desinstalador integrado:

```bash
openclaw uninstall
```

Nao interativo (automacao / npx):

```bash
openclaw uninstall --all --yes --non-interactive
npx -y openclaw uninstall --all --yes --non-interactive
```

Passos manuais (mesmo resultado):

1. Pare o servico do Gateway:

```bash
openclaw gateway stop
```

2. Desinstale o servico do Gateway (launchd/systemd/schtasks):

```bash
openclaw gateway uninstall
```

3. Exclua estado + configuracao:

```bash
rm -rf "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
```

Se voce definiu `OPENCLAW_CONFIG_PATH` para um local personalizado fora do diretorio de estado, exclua esse arquivo tambem.

4. Exclua seu workspace (opcional, remove arquivos do agente):

```bash
rm -rf ~/.openclaw/workspace
```

5. Remova a instalacao da CLI (escolha a que voce usou):

```bash
npm rm -g openclaw
pnpm remove -g openclaw
bun remove -g openclaw
```

6. Se voce instalou o app do macOS:

```bash
rm -rf /Applications/OpenClaw.app
```

Observacoes:

- Se voce usou perfis (`--profile` / `OPENCLAW_PROFILE`), repita o passo 3 para cada diretorio de estado (os padroes sao `~/.openclaw-<profile>`).
- No modo remoto, o diretorio de estado fica no **host do Gateway**, entao execute os passos 1-4 la tambem.

## Remocao manual do servico (CLI nao instalada)

Use isso se o servico do Gateway continuar em execucao, mas `openclaw` estiver ausente.

### macOS (launchd)

O rótulo padrao e `bot.molt.gateway` (ou `bot.molt.<profile>`; o legado `com.openclaw.*` ainda pode existir):

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

Se voce usou um perfil, substitua o rotulo e o nome do plist por `bot.molt.<profile>`. Remova quaisquer plists legados `com.openclaw.*` se existirem.

### Linux (systemd user unit)

O nome padrao da unidade e `openclaw-gateway.service` (ou `openclaw-gateway-<profile>.service`):

```bash
systemctl --user disable --now openclaw-gateway.service
rm -f ~/.config/systemd/user/openclaw-gateway.service
systemctl --user daemon-reload
```

### Windows (Tarefa Agendada)

O nome padrao da tarefa e `OpenClaw Gateway` (ou `OpenClaw Gateway (<profile>)`).
O script da tarefa fica dentro do seu diretorio de estado.

```powershell
schtasks /Delete /F /TN "OpenClaw Gateway"
Remove-Item -Force "$env:USERPROFILE\.openclaw\gateway.cmd"
```

Se voce usou um perfil, exclua o nome da tarefa correspondente e `~\.openclaw-<profile>\gateway.cmd`.

## Instalacao normal vs checkout do codigo-fonte

### Instalacao normal (install.sh / npm / pnpm / bun)

Se voce usou `https://openclaw.ai/install.sh` ou `install.ps1`, a CLI foi instalada com `npm install -g openclaw@latest`.
Remova-a com `npm rm -g openclaw` (ou `pnpm remove -g` / `bun remove -g` se voce instalou dessa forma).

### Checkout do codigo-fonte (git clone)

Se voce executa a partir de um checkout do repositorio (`git clone` + `openclaw ...` / `bun run openclaw ...`):

1. Desinstale o servico do Gateway **antes** de excluir o repositorio (use o caminho facil acima ou a remocao manual do servico).
2. Exclua o diretorio do repositorio.
3. Remova estado + workspace conforme mostrado acima.
