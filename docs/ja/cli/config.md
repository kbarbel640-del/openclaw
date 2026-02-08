---
summary: "`openclaw config` の CLI リファレンス（パスで設定値を get/set/unset）"
read_when:
  - 対話なしで設定を読み取りまたは編集したい場合
title: "config"
x-i18n:
  source_path: cli/config.md
  source_hash: d60a35f5330f22bc
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:52:44Z
---

# `openclaw config`

設定ヘルパー: パスで値を get/set/unset します。サブコマンドなしで実行すると設定ウィザード（`openclaw configure` と同じ）を開きます。

## 例

```bash
openclaw config get browser.executablePath
openclaw config set browser.executablePath "/usr/bin/google-chrome"
openclaw config set agents.defaults.heartbeat.every "2h"
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
openclaw config unset tools.web.search.apiKey
```

## パス

パスはドット表記またはブラケット表記を使用します。

```bash
openclaw config get agents.defaults.workspace
openclaw config get agents.list[0].id
```

エージェントリストのインデックスを使用して、特定のエージェントを対象にします。

```bash
openclaw config get agents.list
openclaw config set agents.list[1].tools.exec.node "node-id-or-name"
```

## 値

可能な場合、値は JSON5 として解析されます。それ以外の場合は文字列として扱われます。JSON5 解析を必須にするには `--json` を使用します。

```bash
openclaw config set agents.defaults.heartbeat.every "0m"
openclaw config set gateway.port 19001 --json
openclaw config set channels.whatsapp.groups '["*"]' --json
```

編集後は Gateway（ゲートウェイ）を再起動してください。
