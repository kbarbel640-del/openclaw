---
summary: "OpenClaw.app をリモート Gateway（ゲートウェイ）に接続するための SSH トンネル設定"
read_when: "SSH 経由で macOS アプリをリモート Gateway（ゲートウェイ）に接続する場合"
title: "リモート Gateway（ゲートウェイ）のセットアップ"
x-i18n:
  source_path: gateway/remote-gateway-readme.md
  source_hash: b1ae266a7cb4911b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:42Z
---

# リモート Gateway（ゲートウェイ）で OpenClaw.app を実行する

OpenClaw.app は、リモート Gateway（ゲートウェイ）に接続するために SSH トンネリングを使用します。このガイドでは、その設定方法を説明します。

## 概要

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Machine                          │
│                                                              │
│  OpenClaw.app ──► ws://127.0.0.1:18789 (local port)           │
│                     │                                        │
│                     ▼                                        │
│  SSH Tunnel ────────────────────────────────────────────────│
│                     │                                        │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                         Remote Machine                        │
│                                                              │
│  Gateway WebSocket ──► ws://127.0.0.1:18789 ──►              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## クイックスタート

### 手順 1: SSH 設定を追加する

`~/.ssh/config` を編集し、次を追加します。

```ssh
Host remote-gateway
    HostName <REMOTE_IP>          # e.g., 172.27.187.184
    User <REMOTE_USER>            # e.g., jefferson
    LocalForward 18789 127.0.0.1:18789
    IdentityFile ~/.ssh/id_rsa
```

`<REMOTE_IP>` と `<REMOTE_USER>` をご自身の値に置き換えてください。

### 手順 2: SSH キーをコピーする

公開鍵をリモートマシンにコピーします（パスワードは一度入力します）。

```bash
ssh-copy-id -i ~/.ssh/id_rsa <REMOTE_USER>@<REMOTE_IP>
```

### 手順 3: Gateway（ゲートウェイ）トークンを設定する

```bash
launchctl setenv OPENCLAW_GATEWAY_TOKEN "<your-token>"
```

### 手順 4: SSH トンネルを起動する

```bash
ssh -N remote-gateway &
```

### 手順 5: OpenClaw.app を再起動する

```bash
# Quit OpenClaw.app (⌘Q), then reopen:
open /path/to/OpenClaw.app
```

これで、アプリは SSH トンネルを通じてリモート Gateway（ゲートウェイ）に接続します。

---

## ログイン時にトンネルを自動起動する

ログイン時に SSH トンネルを自動的に起動するには、Launch Agent を作成します。

### PLIST ファイルを作成する

これを `~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist` として保存します。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>bot.molt.ssh-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-N</string>
        <string>remote-gateway</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

### Launch Agent を読み込む

```bash
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist
```

これにより、トンネルは次の動作を行います。

- ログイン時に自動的に起動する
- クラッシュした場合に再起動する
- バックグラウンドで実行され続ける

レガシー注記: 既存の `com.openclaw.ssh-tunnel` LaunchAgent があれば削除してください。

---

## トラブルシューティング

**トンネルが実行中か確認する:**

```bash
ps aux | grep "ssh -N remote-gateway" | grep -v grep
lsof -i :18789
```

**トンネルを再起動する:**

```bash
launchctl kickstart -k gui/$UID/bot.molt.ssh-tunnel
```

**トンネルを停止する:**

```bash
launchctl bootout gui/$UID/bot.molt.ssh-tunnel
```

---

## 仕組み

| コンポーネント                       | 役割                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `LocalForward 18789 127.0.0.1:18789` | ローカルポート 18789 をリモートポート 18789 に転送します                    |
| `ssh -N`                             | リモートコマンドを実行せずに SSH を使用します（ポートフォワーディングのみ） |
| `KeepAlive`                          | クラッシュ時にトンネルを自動的に再起動します                                |
| `RunAtLoad`                          | エージェントの読み込み時にトンネルを起動します                              |

OpenClaw.app は、クライアントマシン上の `ws://127.0.0.1:18789` に接続します。SSH トンネルは、その接続を、Gateway（ゲートウェイ）が稼働しているリモートマシンのポート 18789 に転送します。
