---
summary: "`openclaw agents`（一覧/追加/削除/アイデンティティ設定）の CLI リファレンス"
read_when:
  - 複数の分離されたエージェント（ワークスペース + ルーティング + 認証）が必要な場合
title: "エージェント"
x-i18n:
  source_path: cli/agents.md
  source_hash: 30556d81636a9ad8
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:51:55Z
---

# `openclaw agents`

分離されたエージェント（ワークスペース + 認証 + ルーティング）を管理します。

関連:

- マルチエージェントルーティング: [Multi-Agent Routing](/concepts/multi-agent)
- エージェントワークスペース: [Agent workspace](/concepts/agent-workspace)

## 例

```bash
openclaw agents list
openclaw agents add work --workspace ~/.openclaw/workspace-work
openclaw agents set-identity --workspace ~/.openclaw/workspace --from-identity
openclaw agents set-identity --agent main --avatar avatars/openclaw.png
openclaw agents delete work
```

## アイデンティティファイル

各エージェントワークスペースには、ワークスペースルートに `IDENTITY.md` を含めることができます:

- パス例: `~/.openclaw/workspace/IDENTITY.md`
- `set-identity --from-identity` は、ワークスペースルート（または明示的な `--identity-file`）から読み取ります

アバターのパスは、ワークスペースルートからの相対パスとして解決されます。

## アイデンティティの設定

`set-identity` は、`agents.list[].identity` に以下のフィールドを書き込みます:

- `name`
- `theme`
- `emoji`
- `avatar`（ワークスペース相対パス、http(s) URL、または data URI）

`IDENTITY.md` から読み込みます:

```bash
openclaw agents set-identity --workspace ~/.openclaw/workspace --from-identity
```

フィールドを明示的に上書きします:

```bash
openclaw agents set-identity --agent main --name "OpenClaw" --emoji "🦞" --avatar avatars/openclaw.png
```

設定サンプル:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "OpenClaw",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/openclaw.png",
        },
      },
    ],
  },
}
```
