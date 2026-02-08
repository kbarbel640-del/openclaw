---
summary: "`openclaw skills`（list/info/check）の CLI リファレンスと、Skills の適格性"
read_when:
  - 利用可能で実行準備が整っている Skills を確認したい場合
  - Skills に必要なバイナリ／環境変数／設定の不足をデバッグしたい場合
title: "skills"
x-i18n:
  source_path: cli/skills.md
  source_hash: 7878442c88a27ec8
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:58:40Z
---

# `openclaw skills`

Skills（同梱 + ワークスペース + 管理されたオーバーライド）を調べ、適格なものと要件不足のものを確認します。

関連:

- Skills システム: [Skills](/tools/skills)
- Skills 設定: [Skills config](/tools/skills-config)
- ClawHub インストール: [ClawHub](/tools/clawhub)

## コマンド

```bash
openclaw skills list
openclaw skills list --eligible
openclaw skills info <name>
openclaw skills check
```
