---
summary: "OpenClaw を完全にアンインストールします（CLI、サービス、状態、ワークスペース）"
read_when:
  - マシンから OpenClaw を削除したい場合
  - アンインストール後も Gateway（ゲートウェイ）サービスが実行され続けている場合
title: "アンインストール"
x-i18n:
  source_path: install/uninstall.md
  source_hash: 6673a755c5e1f90a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:03Z
---

# アンインストール

2 つの方法があります。

- **簡単な方法**：`openclaw` がまだインストールされている場合。
- **手動でのサービス削除**：CLI は削除されているが、サービスがまだ実行中の場合。

## 簡単な方法（CLI がまだインストールされている）

推奨：内蔵アンインストーラーを使用します。

```bash
openclaw uninstall
```

非対話モード（自動化 / npx）：

```bash
openclaw uninstall --all --yes --non-interactive
npx -y openclaw uninstall --all --yes --non-interactive
```

手動手順（結果は同じ）：

1. Gateway（ゲートウェイ）サービスを停止します。

```bash
openclaw gateway stop
```

2. Gateway（ゲートウェイ）サービスをアンインストールします（launchd / systemd / schtasks）。

```bash
openclaw gateway uninstall
```

3. 状態 + 設定を削除します。

```bash
rm -rf "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
```

`OPENCLAW_CONFIG_PATH` を状態ディレクトリの外にあるカスタム場所に設定している場合は、そのファイルも削除してください。

4. ワークスペースを削除します（任意。エージェントファイルを削除します）。

```bash
rm -rf ~/.openclaw/workspace
```

5. CLI のインストールを削除します（使用した方法を選択してください）。

```bash
npm rm -g openclaw
pnpm remove -g openclaw
bun remove -g openclaw
```

6. macOS アプリをインストールしている場合：

```bash
rm -rf /Applications/OpenClaw.app
```

注意事項：

- プロファイル（`--profile` / `OPENCLAW_PROFILE`）を使用している場合は、各状態ディレクトリごとに手順 3 を繰り返してください（デフォルトは `~/.openclaw-<profile>` です）。
- リモートモードでは、状態ディレクトリは **Gateway（ゲートウェイ）ホスト** 上に存在するため、手順 1〜4 もそこで実行してください。

## 手動でのサービス削除（CLI がインストールされていない）

CLI が見つからない（`openclaw` が存在しない）が、Gateway（ゲートウェイ）サービスが実行され続けている場合に使用してください。

### macOS（launchd）

デフォルトのラベルは `bot.molt.gateway`（または `bot.molt.<profile>`。レガシーの `com.openclaw.*` が残っている場合もあります）です。

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

プロファイルを使用している場合は、ラベルと plist 名を `bot.molt.<profile>` に置き換えてください。存在する場合は、レガシーの `com.openclaw.*` plist も削除してください。

### Linux（systemd ユーザーユニット）

デフォルトのユニット名は `openclaw-gateway.service`（または `openclaw-gateway-<profile>.service`）です。

```bash
systemctl --user disable --now openclaw-gateway.service
rm -f ~/.config/systemd/user/openclaw-gateway.service
systemctl --user daemon-reload
```

### Windows（スケジュールされたタスク）

デフォルトのタスク名は `OpenClaw Gateway`（または `OpenClaw Gateway (<profile>)`）です。
タスクスクリプトは状態ディレクトリ配下にあります。

```powershell
schtasks /Delete /F /TN "OpenClaw Gateway"
Remove-Item -Force "$env:USERPROFILE\.openclaw\gateway.cmd"
```

プロファイルを使用している場合は、対応するタスク名と `~\.openclaw-<profile>\gateway.cmd` を削除してください。

## 通常インストールとソースチェックアウトの違い

### 通常インストール（install.sh / npm / pnpm / bun）

`https://openclaw.ai/install.sh` または `install.ps1` を使用した場合、CLI は `npm install -g openclaw@latest` によってインストールされています。
`npm rm -g openclaw`（または、その方法でインストールした場合は `pnpm remove -g` / `bun remove -g`）で削除してください。

### ソースチェックアウト（git clone）

リポジトリのチェックアウトから実行している場合（`git clone` + `openclaw ...` / `bun run openclaw ...`）：

1. リポジトリを削除する **前に** Gateway（ゲートウェイ）サービスをアンインストールします（上記の簡単な方法、または手動でのサービス削除を使用してください）。
2. リポジトリディレクトリを削除します。
3. 上記の手順に従って、状態 + ワークスペースを削除します。
