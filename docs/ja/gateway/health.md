---
summary: "チャンネル接続性のヘルスチェック手順"
read_when:
  - WhatsApp チャンネルのヘルス診断時
title: "ヘルスチェック"
x-i18n:
  source_path: gateway/health.md
  source_hash: 74f242e98244c135
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:41Z
---

# ヘルスチェック（CLI）

推測に頼らずにチャンネルの接続性を検証するための簡易ガイドです。

## クイックチェック

- `openclaw status` — ローカル要約：Gateway（ゲートウェイ）の到達性／モード、更新のヒント、リンク済みチャンネルの認証経過時間、セッション + 最近のアクティビティ。
- `openclaw status --all` — 完全なローカル診断（読み取り専用、カラー表示、デバッグ用にそのまま貼り付け可能）。
- `openclaw status --deep` — 実行中の Gateway（ゲートウェイ）もプローブします（対応している場合はチャンネルごとのプローブ）。
- `openclaw health --json` — 実行中の Gateway（ゲートウェイ）に完全なヘルススナップショットを要求します（WS のみ；Baileys ソケットへの直接接続はありません）。
- WhatsApp／WebChat で `/status` を単独メッセージとして送信すると、エージェントを起動せずにステータス応答を取得できます。
- ログ：`/tmp/openclaw/openclaw-*.log` を tail し、`web-heartbeat`、`web-reconnect`、`web-auto-reply`、`web-inbound` でフィルタリングします。

## 詳細診断

- ディスク上の認証情報：`ls -l ~/.openclaw/credentials/whatsapp/<accountId>/creds.json`（mtime は最近である必要があります）。
- セッションストア：`ls -l ~/.openclaw/agents/<agentId>/sessions/sessions.json`（パスは設定で上書き可能）。件数と最近の受信者は `status` により表示されます。
- 再リンクフロー：ステータスコード 409–515、またはログに `loggedOut` が表示された場合は `openclaw channels logout && openclaw channels login --verbose` を実行します。（注：QR ログインフローは、ペアリング後にステータス 515 の場合は 1 回だけ自動再起動します。）

## 問題が発生した場合

- `logged out` またはステータス 409–515 → `openclaw channels logout` で再リンクし、その後 `openclaw channels login` を実行します。
- Gateway（ゲートウェイ）に到達できない → 起動します：`openclaw gateway --port 18789`（ポートが使用中の場合は `--force` を使用します）。
- 受信メッセージがない → リンク済みの電話がオンラインであること、送信者が許可されていること（`channels.whatsapp.allowFrom`）を確認します。グループチャットの場合は、許可リスト + メンションのルールが一致していること（`channels.whatsapp.groups`、`agents.list[].groupChat.mentionPatterns`）を確認してください。

## 専用の「health」コマンド

`openclaw health --json` は、実行中の Gateway（ゲートウェイ）にヘルススナップショットを要求します（CLI からチャンネルソケットへの直接接続は行いません）。利用可能な場合は、リンク済みの認証情報／認証経過時間、チャンネルごとのプローブ要約、セッションストアの要約、プローブ所要時間を報告します。Gateway（ゲートウェイ）に到達できない場合、またはプローブが失敗／タイムアウトした場合は非ゼロで終了します。デフォルトの 10 秒を上書きするには `--timeout <ms>` を使用してください。
