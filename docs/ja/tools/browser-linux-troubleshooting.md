---
summary: "Linux での OpenClaw ブラウザ制御における Chrome/Brave/Edge/Chromium CDP 起動問題を修正します"
read_when: "Linux でブラウザ制御が失敗する場合（特に snap の Chromium の場合）"
title: "ブラウザのトラブルシューティング"
x-i18n:
  source_path: tools/browser-linux-troubleshooting.md
  source_hash: bac2301022511a0b
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:11:28Z
---

# ブラウザのトラブルシューティング（Linux）

## 問題: 「Failed to start Chrome CDP on port 18800」

OpenClaw のブラウザ制御サーバーが、次のエラーで Chrome/Brave/Edge/Chromium の起動に失敗します。

```
{"error":"Error: Failed to start Chrome CDP on port 18800 for profile \"openclaw\"."}
```

### 根本原因

Ubuntu（および多くの Linux ディストリビューション）では、既定の Chromium インストールは **snap パッケージ**です。Snap の AppArmor による隔離が、OpenClaw がブラウザプロセスを生成・監視する方法に干渉します。

`apt install chromium` コマンドは、snap にリダイレクトするスタブパッケージをインストールします。

```
Note, selecting 'chromium-browser' instead of 'chromium'
chromium-browser is already the newest version (2:1snap1-0ubuntu2).
```

これは実際のブラウザではありません。単なるラッパーです。

### 解決策 1: Google Chrome をインストールする（推奨）

snap によるサンドボックス化がされていない、公式の Google Chrome `.deb` パッケージをインストールします。

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt --fix-broken install -y  # if there are dependency errors
```

次に OpenClaw 設定（`~/.openclaw/openclaw.json`）を更新します。

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

### 解決策 2: Snap の Chromium をアタッチのみモードで使用する

snap の Chromium を使用しなければならない場合は、手動で起動したブラウザにアタッチするよう OpenClaw を設定します。

1. 設定を更新します。

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

2. Chromium を手動で起動します。

```bash
chromium-browser --headless --no-sandbox --disable-gpu \
  --remote-debugging-port=18800 \
  --user-data-dir=$HOME/.openclaw/browser/openclaw/user-data \
  about:blank &
```

3. 必要に応じて、Chrome を自動起動する systemd のユーザーサービスを作成します。

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

次で有効化します: `systemctl --user enable --now openclaw-browser.service`

### ブラウザが動作することの確認

ステータスを確認します。

```bash
curl -s http://127.0.0.1:18791/ | jq '{running, pid, chosenBrowser}'
```

ブラウジングをテストします。

```bash
curl -s -X POST http://127.0.0.1:18791/start
curl -s http://127.0.0.1:18791/tabs
```

### 設定リファレンス

| Option                   | Description                                                          | Default                                             |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------- |
| `browser.enabled`        | ブラウザ制御を有効化します                                           | `true`                                              |
| `browser.executablePath` | Chromium 系ブラウザバイナリ（Chrome/Brave/Edge/Chromium）へのパス    | 自動検出（Chromium 系の場合、既定のブラウザを優先） |
| `browser.headless`       | GUI なしで実行します                                                 | `false`                                             |
| `browser.noSandbox`      | `--no-sandbox` フラグを追加します（一部の Linux セットアップで必要） | `false`                                             |
| `browser.attachOnly`     | ブラウザを起動せず、既存のものにのみアタッチします                   | `false`                                             |
| `browser.cdpPort`        | Chrome DevTools Protocol のポート                                    | `18800`                                             |

### 問題: 「Chrome extension relay is running, but no tab is connected」

`chrome` プロファイル（拡張機能リレー）を使用しています。これは、OpenClaw
ブラウザ拡張機能が稼働中のタブにアタッチされていることを前提としています。

修正オプション:

1. **管理対象ブラウザを使用します:** `openclaw browser start --browser-profile openclaw`
   （または `browser.defaultProfile: "openclaw"` を設定します）。
2. **拡張機能リレーを使用します:** 拡張機能をインストールし、タブを開いて、OpenClaw 拡張機能アイコンをクリックしてアタッチします。

注記:

- `chrome` プロファイルは、可能な場合に **システム既定の Chromium ブラウザ**を使用します。
- ローカルの `openclaw` プロファイルは `cdpPort`/`cdpUrl` を自動割り当てします。これらはリモート CDP の場合にのみ設定してください。
