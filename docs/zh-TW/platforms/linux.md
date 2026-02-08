---
summary: 「Linux 支援 + 配套應用程式狀態」
read_when:
  - 尋找 Linux 配套應用程式狀態
  - 規劃平台涵蓋或貢獻
title: 「Linux 應用程式」
x-i18n:
  source_path: platforms/linux.md
  source_hash: 93b8250cd1267004
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:58Z
---

# Linux 應用程式

Gateway 閘道器在 Linux 上獲得完整支援。**Node 是建議的執行環境**。
不建議在 Gateway 閘道器 上使用 Bun（WhatsApp／Telegram 的錯誤）。

原生的 Linux 配套應用程式已在規劃中。若你想協助開發，歡迎貢獻。

## 新手快速路徑（VPS）

1. 安裝 Node 22+
2. `npm i -g openclaw@latest`
3. `openclaw onboard --install-daemon`
4. 從你的筆電：`ssh -N -L 18789:127.0.0.1:18789 <user>@<host>`
5. 開啟 `http://127.0.0.1:18789/` 並貼上你的權杖

逐步的 VPS 指南：[exe.dev](/install/exe-dev)

## 安裝

- [入門指南](/start/getting-started)
- [安裝與更新](/install/updating)
- 選用流程：[Bun（實驗性）](/install/bun)、[Nix](/install/nix)、[Docker](/install/docker)

## Gateway 閘道器

- [Gateway 閘道器 操作手冊](/gateway)
- [設定](/gateway/configuration)

## Gateway 閘道器 服務安裝（CLI）

使用以下其中一種：

```
openclaw onboard --install-daemon
```

或：

```
openclaw gateway install
```

或：

```
openclaw configure
```

在提示時選擇 **Gateway service**。

修復／遷移：

```
openclaw doctor
```

## 系統控制（systemd 使用者單元）

OpenClaw 預設會安裝 systemd **使用者** 服務。對於共用或需長時間運作的伺服器，請使用 **系統** 服務。完整的單元範例與說明請參閱 [Gateway 閘道器 操作手冊](/gateway)。

最小設定：

建立 `~/.config/systemd/user/openclaw-gateway[-<profile>].service`：

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

啟用它：

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```
