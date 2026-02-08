---
summary: "CLI リファレンス：`openclaw setup`（設定 + ワークスペースの初期化）"
read_when:
  - 完全なオンボーディングウィザードを使用せずに初回セットアップを行う場合
  - デフォルトのワークスペースパスを設定したい場合
title: "setup"
x-i18n:
  source_path: cli/setup.md
  source_hash: 7f3fc8b246924edf
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:58:38Z
---

# `openclaw setup`

`~/.openclaw/openclaw.json` とエージェントのワークスペースを初期化します。

関連:

- はじめに: [Getting started](/start/getting-started)
- ウィザード: [Onboarding](/start/onboarding)

## 例

```bash
openclaw setup
openclaw setup --workspace ~/.openclaw/workspace
```

setup を介してウィザードを実行するには:

```bash
openclaw setup --wizard
```
