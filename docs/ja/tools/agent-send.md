---
summary: "ダイレクトな `openclaw agent` CLI 実行（任意で配信）"
read_when:
  - agent CLI エントリポイントの追加または変更を行うとき
title: "エージェント送信"
x-i18n:
  source_path: tools/agent-send.md
  source_hash: a84d6a304333eebe
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:11:02Z
---

# `openclaw agent`（ダイレクトなエージェント実行）

`openclaw agent` は、受信チャットメッセージを必要とせずに 1 回のエージェントターンを実行します。
デフォルトでは **Gateway（ゲートウェイ）を経由**します。現在のマシン上の組み込み
ランタイムを強制するには `--local` を追加します。

## 動作

- 必須: `--message <text>`
- セッション選択:
  - `--to <dest>` はセッションキーを導出します（グループ/チャンネル宛ては分離を維持し、ダイレクトチャットは `main` に集約されます）、**または**
  - `--session-id <id>` は id により既存セッションを再利用します、**または**
  - `--agent <id>` は設定済みのエージェントを直接ターゲットにします（そのエージェントの `main` セッションキーを使用します）
- 通常の受信返信と同じ組み込みエージェントランタイムを実行します。
- thinking/verbose フラグはセッションストアに永続化されます。
- 出力:
  - デフォルト: 返信テキスト（+ `MEDIA:<url>` 行）を表示します
  - `--json`: 構造化されたペイロード + メタデータを表示します
- `--deliver` + `--channel` により、チャンネルへの任意の配信が可能です（ターゲット形式は `openclaw message --target` と一致します）。
- `--reply-channel`/`--reply-to`/`--reply-account` を使用して、セッションを変更せずに配信を上書きします。

Gateway（ゲートウェイ）に到達できない場合、CLI は組み込みのローカル実行に **フォールバック**します。

## 例

```bash
openclaw agent --to +15555550123 --message "status update"
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --to +15555550123 --message "Trace logs" --verbose on --json
openclaw agent --to +15555550123 --message "Summon reply" --deliver
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```

## フラグ

- `--local`: ローカルで実行します（シェル内のモデルプロバイダー API キーが必要です）
- `--deliver`: 選択したチャンネルに返信を送信します
- `--channel`: 配信チャンネル（`whatsapp|telegram|discord|googlechat|slack|signal|imessage`、デフォルト: `whatsapp`）
- `--reply-to`: 配信ターゲットの上書き
- `--reply-channel`: 配信チャンネルの上書き
- `--reply-account`: 配信アカウント id の上書き
- `--thinking <off|minimal|low|medium|high|xhigh>`: thinking レベルを永続化します（GPT-5.2 + Codex モデルのみ）
- `--verbose <on|full|off>`: verbose レベルを永続化します
- `--timeout <seconds>`: エージェントのタイムアウトを上書きします
- `--json`: 構造化 JSON を出力します
