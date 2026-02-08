---
summary: "CLI から `openclaw approvals`（Gateway（ゲートウェイ）またはノードホストの exec 承認）を参照するためのリファレンスです"
read_when:
  - CLI から exec 承認を編集したい場合
  - Gateway（ゲートウェイ）またはノードホスト上の許可リストを管理する必要がある場合
title: "承認"
x-i18n:
  source_path: cli/approvals.md
  source_hash: 4329cdaaec2c5f5d
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:52:35Z
---

# `openclaw approvals`

**ローカルホスト**、**ゲートウェイホスト**、または **ノードホスト**の exec 承認を管理します。
デフォルトでは、コマンドはディスク上のローカル承認ファイルを対象にします。ゲートウェイを対象にするには `--gateway` を使用し、特定のノードを対象にするには `--node` を使用してください。

関連:

- Exec approvals: [Exec approvals](/tools/exec-approvals)
- Nodes: [Nodes](/nodes)

## 共通コマンド

```bash
openclaw approvals get
openclaw approvals get --node <id|name|ip>
openclaw approvals get --gateway
```

## ファイルから承認を置換する

```bash
openclaw approvals set --file ./exec-approvals.json
openclaw approvals set --node <id|name|ip> --file ./exec-approvals.json
openclaw approvals set --gateway --file ./exec-approvals.json
```

## 許可リストのヘルパー

```bash
openclaw approvals allowlist add "~/Projects/**/bin/rg"
openclaw approvals allowlist add --agent main --node <id|name|ip> "/usr/bin/uptime"
openclaw approvals allowlist add --agent "*" "/usr/bin/uname"

openclaw approvals allowlist remove "~/Projects/**/bin/rg"
```

## 注意事項

- `--node` は、`openclaw nodes`（id、name、ip、または id のプレフィックス）と同じリゾルバーを使用します。
- `--agent` はデフォルトで `"*"` になっており、これはすべてのエージェントに適用されます。
- ノードホストは `system.execApprovals.get/set` をアドバタイズする必要があります（macOS アプリまたはヘッドレスノードホスト）。
- 承認ファイルは、ホストごとに `~/.openclaw/exec-approvals.json` に保存されます。
