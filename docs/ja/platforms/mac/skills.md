---
summary: "macOS の Skills 設定 UI と Gateway（ゲートウェイ）連携のステータス"
read_when:
  - macOS の Skills 設定 UI を更新する場合
  - Skills のゲーティングやインストール動作を変更する場合
title: "Skills"
x-i18n:
  source_path: platforms/mac/skills.md
  source_hash: ecd5286bbe49eed8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:26Z
---

# Skills（macOS）

macOS アプリは Gateway（ゲートウェイ）を介して OpenClaw の Skills を表示します。ローカルで Skills を解析することはありません。

## データソース

- `skills.status`（Gateway（ゲートウェイ））は、すべての Skills に加えて、適格性および不足している要件
  （バンドルされた Skills に対する allowlist ブロックを含む）を返します。
- 要件は、各 `SKILL.md` 内の `metadata.openclaw.requires` から導出されます。

## インストール操作

- `metadata.openclaw.install` はインストールオプション（brew / node / go / uv）を定義します。
- アプリは `skills.install` を呼び出して、Gateway（ゲートウェイ）ホスト上でインストーラーを実行します。
- 複数のインストーラーが提供されている場合、Gateway（ゲートウェイ）は 1 つの推奨インストーラーのみを提示します
  （利用可能な場合は brew、そうでない場合は `skills.install` の node マネージャー、デフォルトは npm）。

## 環境変数 / API キー

- アプリはキーを `~/.openclaw/openclaw.json` の `skills.entries.<skillKey>` 配下に保存します。
- `skills.update` は `enabled`、`apiKey`、および `env` をパッチします。

## リモートモード

- インストールおよび設定の更新は、ローカルの Mac ではなく Gateway（ゲートウェイ）ホスト上で行われます。
