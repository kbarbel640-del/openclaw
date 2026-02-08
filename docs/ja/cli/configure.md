---
summary: "CLI リファレンス：`openclaw configure`（対話式の設定プロンプト）"
read_when:
  - 対話式に認証情報、デバイス、またはエージェントのデフォルトを調整したい場合
title: "configure"
x-i18n:
  source_path: cli/configure.md
  source_hash: 9cb2bb5237b02b3a
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:53:00Z
---

# `openclaw configure`

認証情報、デバイス、およびエージェントのデフォルトを設定するための対話式プロンプトです。

注：**Model** セクションには、`agents.defaults.models` の許可リスト（`/model` とモデルピッカーに表示されるもの）のマルチセレクトが含まれるようになりました。

ヒント：サブコマンドなしで `openclaw config` を実行すると、同じウィザードが開きます。非対話式の編集には `openclaw config get|set|unset` を使用してください。

関連：

- Gateway（ゲートウェイ）の設定リファレンス：[Configuration](/gateway/configuration)
- 設定用 CLI：[Config](/cli/config)

注記：

- Gateway（ゲートウェイ）を実行する場所を選択すると、常に `gateway.mode` が更新されます。それだけが必要な場合は、他のセクションを操作せずに「Continue」を選択できます。
- チャンネル指向のサービス（Slack/Discord/Matrix/Microsoft Teams）では、セットアップ中にチャンネル/ルームの許可リストの入力が求められます。名前または ID を入力でき、可能な場合はウィザードが名前を ID に解決します。

## 例

```bash
openclaw configure
openclaw configure --section models --section channels
```
