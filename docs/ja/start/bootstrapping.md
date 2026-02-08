---
summary: "エージェントのワークスペースとアイデンティティファイルを初期化するためのブートストラップ手順"
read_when:
  - 最初のエージェント実行時に何が起こるのかを理解したいとき
  - ブートストラップ用ファイルがどこに配置されるかを説明するとき
  - オンボーディング時のアイデンティティ設定をデバッグするとき
title: "エージェントのブートストラップ"
sidebarTitle: "ブートストラップ"
x-i18n:
  source_path: start/bootstrapping.md
  source_hash: 4a08b5102f25c6c4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:53Z
---

# エージェントのブートストラップ

ブートストラップは、エージェントのワークスペースを準備し、
アイデンティティの詳細を収集する **初回実行** 時の儀式です。
オンボーディングの後、エージェントが初めて起動したときに実行されます。

## ブートストラップで行われること

最初のエージェント実行時に、OpenClaw はワークスペース（デフォルトは
`~/.openclaw/workspace`）をブートストラップします。

- `AGENTS.md`、`BOOTSTRAP.md`、`IDENTITY.md`、`USER.md` を生成します。
- 短い Q&A の儀式を実行します（1 回に 1 問）。
- アイデンティティと設定を `IDENTITY.md`、`USER.md`、`SOUL.md` に書き込みます。
- 完了後に `BOOTSTRAP.md` を削除し、1 回のみ実行されるようにします。

## 実行場所

ブートストラップは常に **Gateway（ゲートウェイ）ホスト** 上で実行されます。
macOS アプリがリモートの Gateway に接続している場合、ワークスペースと
ブートストラップ用ファイルはそのリモートマシン上に配置されます。

<Note>
Gateway が別のマシンで動作している場合は、Gateway ホスト上でワークスペース
ファイルを編集してください（例: `user@gateway-host:~/.openclaw/workspace`）。
</Note>

## 関連ドキュメント

- macOS アプリのオンボーディング: [Onboarding](/start/onboarding)
- ワークスペース構成: [Agent workspace](/concepts/agent-workspace)
