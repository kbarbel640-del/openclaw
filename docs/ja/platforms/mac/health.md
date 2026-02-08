---
summary: "macOS アプリが Gateway（ゲートウェイ）/ Baileys のヘルス状態をどのように報告するか"
read_when:
  - macOS アプリのヘルスインジケーターをデバッグする場合
title: "ヘルスチェック"
x-i18n:
  source_path: platforms/mac/health.md
  source_hash: 0560e96501ddf53a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:20Z
---

# macOS におけるヘルスチェック

メニューバーアプリから、リンクされたチャンネルが正常かどうかを確認する方法です。

## メニューバー

- ステータスドットが Baileys のヘルス状態を反映します。
  - 緑: リンク済み + 最近ソケットがオープンされました。
  - オレンジ: 接続中 / 再試行中。
  - 赤: ログアウト済み、またはプローブに失敗しました。
- セカンダリ行には「linked · auth 12m」と表示されるか、失敗理由が表示されます。
- 「Run Health Check」メニュー項目で、オンデマンドのプローブを実行します。

## 設定

- 一般タブに、次を表示するヘルスカードが追加されます。リンクされた認証の経過時間、セッションストアのパス / 件数、最終チェック時刻、最後のエラー / ステータスコード、そして「Run Health Check」/「Reveal Logs」ボタン。
- キャッシュされたスナップショットを使用するため、UI は即座に読み込まれ、オフライン時も段階的にフォールバックします。
- **チャンネルタブ** では、WhatsApp / Telegram のチャンネル状態とコントロール（ログイン QR、ログアウト、プローブ、最後の切断 / エラー）が表示されます。

## プローブの仕組み

- アプリは約 60 秒ごとおよびオンデマンドで、`ShellExecutor` を介して `openclaw health --json` を実行します。プローブは認証情報を読み込み、メッセージを送信せずにステータスを報告します。
- ちらつきを防ぐため、最後に正常だったスナップショットと最後のエラーを別々にキャッシュし、それぞれのタイムスタンプを表示します。

## 判断に迷った場合

- [Gateway health](/gateway/health) の CLI フロー（`openclaw status`、`openclaw status --deep`、`openclaw health --json`）を引き続き使用でき、`web-heartbeat` / `web-reconnect` のために `/tmp/openclaw/openclaw-*.log` を tail できます。
