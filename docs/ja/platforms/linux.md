---
summary: "Linux のサポートおよびコンパニオンアプリの状況"
read_when:
  - Linux のコンパニオンアプリの状況を確認したい場合
  - プラットフォーム対応範囲やコントリビューションを計画している場合
title: "Linux アプリ"
x-i18n:
  source_path: platforms/linux.md
  source_hash: 93b8250cd1267004
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:17Z
---

# Linux アプリ

Gateway（ゲートウェイ）は Linux で完全にサポートされています。**推奨ランタイムは Node です**。
Bun は Gateway（ゲートウェイ）では推奨されません（WhatsApp / Telegram のバグがあるため）。

ネイティブの Linux コンパニオンアプリは計画中です。開発に参加したい場合は、コントリビューションを歓迎します。

## 初心者向けクイックパス（VPS）

1. Node 22+ をインストールします
2. `npm i -g openclaw@latest`
3. `openclaw onboard --install-daemon`
4. ノートパソコンから: `ssh -N -L 18789:127.0.0.1:18789 <user>@<host>`
5. `http://127.0.0.1:18789/` を開き、トークンを貼り付けます

VPS 向けのステップバイステップガイド: [exe.dev](/install/exe-dev)

## インストール

- [Getting Started](/start/getting-started)
- [Install & updates](/install/updating)
- オプションのフロー: [Bun（実験的）](/install/bun), [Nix](/install/nix), [Docker](/install/docker)

## Gateway

- [Gateway runbook](/gateway)
- [Configuration](/gateway/configuration)

## Gateway サービスのインストール（CLI）

次のいずれかを使用します:

```
openclaw onboard --install-daemon
```

または:

```
openclaw gateway install
```

または:

```
openclaw configure
```

プロンプトが表示されたら **Gateway service** を選択します。

修復 / 移行:

```
openclaw doctor
```

## システム制御（systemd ユーザーユニット）

OpenClaw は、デフォルトで systemd の **ユーザー** サービスをインストールします。共有サーバーや常時稼働のサーバーでは、**システム**
サービスを使用してください。完全なユニットの例とガイダンスは
[Gateway runbook](/gateway) にあります。

最小構成:

`~/.config/systemd/user/openclaw-gateway[-<profile>].service` を作成します:

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

有効化します:

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```
