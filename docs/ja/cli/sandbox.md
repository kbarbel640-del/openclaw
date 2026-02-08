---
title: サンドボックス CLI
summary: "サンドボックスコンテナを管理し、有効なサンドボックスポリシーを検査します"
read_when: "サンドボックスコンテナを管理している、またはサンドボックス/ツールポリシーの挙動をデバッグしている場合。"
status: active
x-i18n:
  source_path: cli/sandbox.md
  source_hash: 6e1186f26c77e188
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:58:37Z
---

# サンドボックス CLI

分離されたエージェント実行のための、Docker ベースのサンドボックスコンテナを管理します。

## 概要

OpenClaw は、セキュリティのためにエージェントを分離された Docker コンテナで実行できます。`sandbox` コマンドは、特に更新や設定変更の後に、これらのコンテナを管理するのに役立ちます。

## コマンド

### `openclaw sandbox explain`

**有効な** サンドボックスのモード/スコープ/ワークスペースアクセス、サンドボックスツールポリシー、および昇格ゲート（fix-it の設定キーパス付き）を検査します。

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

### `openclaw sandbox list`

ステータスと設定を含めて、すべてのサンドボックスコンテナを一覧表示します。

```bash
openclaw sandbox list
openclaw sandbox list --browser  # List only browser containers
openclaw sandbox list --json     # JSON output
```

**出力に含まれるもの:**

- コンテナ名とステータス（実行中/停止）
- Docker イメージと、設定と一致しているかどうか
- 経過時間（作成からの時間）
- アイドル時間（最終使用からの時間）
- 関連付けられたセッション/エージェント

### `openclaw sandbox recreate`

更新されたイメージ/設定での再作成を強制するために、サンドボックスコンテナを削除します。

```bash
openclaw sandbox recreate --all                # Recreate all containers
openclaw sandbox recreate --session main       # Specific session
openclaw sandbox recreate --agent mybot        # Specific agent
openclaw sandbox recreate --browser            # Only browser containers
openclaw sandbox recreate --all --force        # Skip confirmation
```

**オプション:**

- `--all`: すべてのサンドボックスコンテナを再作成します
- `--session <key>`: 特定のセッションのコンテナを再作成します
- `--agent <id>`: 特定のエージェントのコンテナを再作成します
- `--browser`: ブラウザコンテナのみを再作成します
- `--force`: 確認プロンプトをスキップします

**重要:** コンテナは、次回エージェントが使用される際に自動的に再作成されます。

## ユースケース

### Docker イメージを更新した後

```bash
# Pull new image
docker pull openclaw-sandbox:latest
docker tag openclaw-sandbox:latest openclaw-sandbox:bookworm-slim

# Update config to use new image
# Edit config: agents.defaults.sandbox.docker.image (or agents.list[].sandbox.docker.image)

# Recreate containers
openclaw sandbox recreate --all
```

### サンドボックス設定を変更した後

```bash
# Edit config: agents.defaults.sandbox.* (or agents.list[].sandbox.*)

# Recreate to apply new config
openclaw sandbox recreate --all
```

### setupCommand を変更した後

```bash
openclaw sandbox recreate --all
# or just one agent:
openclaw sandbox recreate --agent family
```

### 特定のエージェントのみの場合

```bash
# Update only one agent's containers
openclaw sandbox recreate --agent alfred
```

## なぜこれが必要ですか？

**問題:** サンドボックスの Docker イメージまたは設定を更新した場合:

- 既存のコンテナは古い設定のまま実行を続けます
- コンテナは非アクティブが 24 時間続いた後にのみ整理されます
- 定期的に使用されるエージェントは古いコンテナを無期限に動かし続けます

**解決策:** `openclaw sandbox recreate` を使用して古いコンテナの削除を強制します。次に必要になったとき、現在の設定で自動的に再作成されます。

ヒント: 手動の `docker rm` よりも `openclaw sandbox recreate` を優先してください。これは Gateway（ゲートウェイ）のコンテナ命名を使用し、スコープ/セッションキーが変更された際の不一致を回避します。

## 設定

サンドボックス設定は、`agents.defaults.sandbox` の下の `~/.openclaw/openclaw.json` にあります（エージェントごとの上書きは `agents.list[].sandbox` に入ります）:

```jsonc
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "all", // off, non-main, all
        "scope": "agent", // session, agent, shared
        "docker": {
          "image": "openclaw-sandbox:bookworm-slim",
          "containerPrefix": "openclaw-sbx-",
          // ... more Docker options
        },
        "prune": {
          "idleHours": 24, // Auto-prune after 24h idle
          "maxAgeDays": 7, // Auto-prune after 7 days
        },
      },
    },
  },
}
```

## 関連項目

- [サンドボックスのドキュメント](/gateway/sandboxing)
- [エージェント設定](/concepts/agent-workspace)
- [Doctor コマンド](/gateway/doctor) - サンドボックスのセットアップを確認します
