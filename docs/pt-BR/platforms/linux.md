---
summary: "Suporte a Linux + status do aplicativo complementar"
read_when:
  - Procurando o status do aplicativo complementar para Linux
  - Planejando cobertura de plataformas ou contribuicoes
title: "Aplicativo Linux"
x-i18n:
  source_path: platforms/linux.md
  source_hash: 93b8250cd1267004
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:49Z
---

# Aplicativo Linux

O Gateway tem suporte completo no Linux. **Node e o runtime recomendado**.
Bun nao e recomendado para o Gateway (bugs com WhatsApp/Telegram).

Aplicativos complementares nativos para Linux estao planejados. Contribuicoes sao bem-vindas se voce quiser ajudar a criar um.

## Caminho rapido para iniciantes (VPS)

1. Instale Node 22+
2. `npm i -g openclaw@latest`
3. `openclaw onboard --install-daemon`
4. Do seu laptop: `ssh -N -L 18789:127.0.0.1:18789 <user>@<host>`
5. Abra `http://127.0.0.1:18789/` e cole seu token

Guia VPS passo a passo: [exe.dev](/install/exe-dev)

## Instalacao

- [Primeiros Passos](/start/getting-started)
- [Instalacao e atualizacoes](/install/updating)
- Fluxos opcionais: [Bun (experimental)](/install/bun), [Nix](/install/nix), [Docker](/install/docker)

## Gateway

- [Runbook do Gateway](/gateway)
- [Configuracao](/gateway/configuration)

## Instalacao do servico Gateway (CLI)

Use um destes:

```
openclaw onboard --install-daemon
```

Ou:

```
openclaw gateway install
```

Ou:

```
openclaw configure
```

Selecione **Gateway service** quando solicitado.

Reparar/migrar:

```
openclaw doctor
```

## Controle do sistema (unidade de usuario systemd)

O OpenClaw instala um servico systemd de **usuario** por padrao. Use um servico de **sistema**
para servidores compartilhados ou sempre ativos. O exemplo completo da unidade e as orientacoes
estao no [runbook do Gateway](/gateway).

Configuracao minima:

Crie `~/.config/systemd/user/openclaw-gateway[-<profile>].service`:

```
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Ative-o:

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```
