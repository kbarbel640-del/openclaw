---
summary: "Corrija problemas de inicializacao do CDP do Chrome/Brave/Edge/Chromium para o controle de navegador do OpenClaw no Linux"
read_when: "O controle de navegador falha no Linux, especialmente com o Chromium snap"
title: "Solucao de problemas do navegador"
x-i18n:
  source_path: tools/browser-linux-troubleshooting.md
  source_hash: bac2301022511a0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:33Z
---

# Solucao de problemas do navegador (Linux)

## Problema: "Failed to start Chrome CDP on port 18800"

O servidor de controle de navegador do OpenClaw falha ao iniciar Chrome/Brave/Edge/Chromium com o erro:

```
{"error":"Error: Failed to start Chrome CDP on port 18800 for profile \"openclaw\"."}
```

### Causa raiz

No Ubuntu (e em muitas distros Linux), a instalacao padrao do Chromium e um **pacote snap**. O confinamento do AppArmor do snap interfere na forma como o OpenClaw inicia e monitora o processo do navegador.

O comando `apt install chromium` instala um pacote stub que redireciona para o snap:

```
Note, selecting 'chromium-browser' instead of 'chromium'
chromium-browser is already the newest version (2:1snap1-0ubuntu2).
```

Este NAO e um navegador real — e apenas um wrapper.

### Solucao 1: Instalar o Google Chrome (Recomendado)

Instale o pacote oficial do Google Chrome `.deb`, que nao e isolado por snap:

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt --fix-broken install -y  # if there are dependency errors
```

Em seguida, atualize sua configuracao do OpenClaw (`~/.openclaw/openclaw.json`):

```json
{
  "browser": {
    "enabled": true,
    "executablePath": "/usr/bin/google-chrome-stable",
    "headless": true,
    "noSandbox": true
  }
}
```

### Solucao 2: Usar o Chromium snap com o modo somente-anexar

Se voce precisar usar o Chromium snap, configure o OpenClaw para se anexar a um navegador iniciado manualmente:

1. Atualize a configuracao:

```json
{
  "browser": {
    "enabled": true,
    "attachOnly": true,
    "headless": true,
    "noSandbox": true
  }
}
```

2. Inicie o Chromium manualmente:

```bash
chromium-browser --headless --no-sandbox --disable-gpu \
  --remote-debugging-port=18800 \
  --user-data-dir=$HOME/.openclaw/browser/openclaw/user-data \
  about:blank &
```

3. Opcionalmente, crie um servico systemd de usuario para iniciar automaticamente o Chrome:

```ini
# ~/.config/systemd/user/openclaw-browser.service
[Unit]
Description=OpenClaw Browser (Chrome CDP)
After=network.target

[Service]
ExecStart=/snap/bin/chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=18800 --user-data-dir=%h/.openclaw/browser/openclaw/user-data about:blank
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Habilite com: `systemctl --user enable --now openclaw-browser.service`

### Verificando se o navegador funciona

Verifique o status:

```bash
curl -s http://127.0.0.1:18791/ | jq '{running, pid, chosenBrowser}'
```

Teste a navegacao:

```bash
curl -s -X POST http://127.0.0.1:18791/start
curl -s http://127.0.0.1:18791/tabs
```

### Referencia de configuracao

| Option                   | Description                                                                           | Default                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `browser.enabled`        | Habilitar controle de navegador                                                       | `true`                                                                            |
| `browser.executablePath` | Caminho para um binario de navegador baseado em Chromium (Chrome/Brave/Edge/Chromium) | detectado automaticamente (prefere o navegador padrao quando baseado em Chromium) |
| `browser.headless`       | Executar sem GUI                                                                      | `false`                                                                           |
| `browser.noSandbox`      | Adicionar a flag `--no-sandbox` (necessaria para algumas configuracoes Linux)         | `false`                                                                           |
| `browser.attachOnly`     | Nao iniciar o navegador, apenas anexar a um existente                                 | `false`                                                                           |
| `browser.cdpPort`        | Porta do Chrome DevTools Protocol                                                     | `18800`                                                                           |

### Problema: "Chrome extension relay is running, but no tab is connected"

Voce esta usando o perfil `chrome` (extension relay). Ele espera que a extensao de navegador do OpenClaw esteja anexada a uma aba ativa.

Opcoes de correcao:

1. **Use o navegador gerenciado:** `openclaw browser start --browser-profile openclaw`
   (ou defina `browser.defaultProfile: "openclaw"`).
2. **Use o extension relay:** instale a extensao, abra uma aba e clique no icone da extensao do OpenClaw para anexar.

Observacoes:

- O perfil `chrome` usa o **navegador Chromium padrao do sistema** quando possivel.
- Perfis locais `openclaw` atribuem automaticamente `cdpPort`/`cdpUrl`; defina-os apenas para CDP remoto.
