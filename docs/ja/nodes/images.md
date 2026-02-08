---
summary: "send、Gateway（ゲートウェイ）、および agent の返信における画像およびメディア処理ルール"
read_when:
  - メディアパイプラインまたは添付ファイルを変更する場合
title: "画像およびメディアのサポート"
x-i18n:
  source_path: nodes/images.md
  source_hash: 971aed398ea01078
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:15Z
---

# Image & Media Support — 2025-12-05

WhatsApp チャンネルは **Baileys Web** を介して動作します。本ドキュメントは、send、Gateway（ゲートウェイ）、および agent の返信における現在のメディア処理ルールをまとめたものです。

## 目標

- `openclaw message send --media` を介して、任意のキャプション付きでメディアを送信します。
- Web インボックスからの自動返信で、テキストと並んでメディアを含められるようにします。
- タイプごとの上限を妥当かつ予測可能に保ちます。

## CLI サーフェス

- `openclaw message send --media <path-or-url> [--message <caption>]`
  - `--media` は任意です。メディアのみ送信の場合、キャプションは空でも構いません。
  - `--dry-run` は解決されたペイロードを出力します。`--json` は `{ channel, to, messageId, mediaUrl, caption }` を出力します。

## WhatsApp Web チャンネルの挙動

- 入力: ローカルのファイルパス **または** HTTP(S) URL。
- フロー: Buffer に読み込み、メディア種別を検出し、適切なペイロードを構築します。
  - **画像:** リサイズおよび JPEG への再圧縮（最大辺 2048px）。`agents.defaults.mediaMaxMb`（デフォルト 5 MB）を目標とし、上限は 6 MB です。
  - **音声/ボイス/動画:** 16 MB までパススルーします。音声はボイスノート（`ptt: true`）として送信されます。
  - **ドキュメント:** その他すべて。最大 100 MB。可能な場合はファイル名を保持します。
- WhatsApp の GIF 風再生: `gifPlayback: true`（CLI: `--gif-playback`）を指定した MP4 を送信すると、モバイルクライアントでインラインループ再生されます。
- MIME 検出は、マジックバイト、次にヘッダー、最後にファイル拡張子を優先します。
- キャプションは `--message` または `reply.text` から取得されます。空のキャプションも許可されます。
- ログ: 非 verbose では `↩️`/`✅` を表示します。verbose ではサイズおよびソースのパス/URL が含まれます。

## 自動返信パイプライン

- `getReplyFromConfig` は `{ text?, mediaUrl?, mediaUrls? }` を返します。
- メディアが存在する場合、Web 送信者は `openclaw message send` と同じパイプラインを使用してローカルパスまたは URL を解決します。
- 複数のメディアエントリーが指定された場合は、順次送信されます。

## コマンドへのインバウンドメディア（Pi）

- インバウンドの Web メッセージにメディアが含まれる場合、OpenClaw は一時ファイルにダウンロードし、テンプレート変数を公開します。
  - `{{MediaUrl}}` はインバウンドメディア用の疑似 URL です。
  - `{{MediaPath}}` は、コマンド実行前に書き込まれるローカルの一時パスです。
- セッションごとの Docker サンドボックスが有効な場合、インバウンドメディアはサンドボックスのワークスペースにコピーされ、`MediaPath`/`MediaUrl` は `media/inbound/<filename>` のような相対パスに書き換えられます。
- メディア理解（`tools.media.*` または共有の `tools.media.models` で設定されている場合）はテンプレート適用前に実行され、`Body` に `[Image]`、`[Audio]`、`[Video]` のブロックを挿入できます。
  - 音声は `{{Transcript}}` を設定し、コマンド解析には文字起こしを使用するため、スラッシュコマンドは引き続き機能します。
  - 動画および画像の説明では、コマンド解析のためにキャプションテキストが保持されます。
- デフォルトでは、最初に一致した画像/音声/動画の添付のみが処理されます。複数の添付を処理するには `tools.media.<cap>.attachments` を設定してください。

## 上限およびエラー

**アウトバウンド送信の上限（WhatsApp Web 送信）**

- 画像: 再圧縮後で約 6 MB の上限。
- 音声/ボイス/動画: 16 MB の上限。ドキュメント: 100 MB の上限。
- サイズ超過または読み取り不能なメディア → ログに明確なエラーが出力され、返信はスキップされます。

**メディア理解の上限（文字起こし/説明）**

- 画像のデフォルト: 10 MB（`tools.media.image.maxBytes`）。
- 音声のデフォルト: 20 MB（`tools.media.audio.maxBytes`）。
- 動画のデフォルト: 50 MB（`tools.media.video.maxBytes`）。
- サイズ超過のメディアは理解処理をスキップしますが、返信自体は元の本文のまま送信されます。

## テストに関する注意

- 画像/音声/ドキュメントの送信および返信フローをカバーしてください。
- 画像の再圧縮（サイズ上限）および音声のボイスノートフラグを検証してください。
- 複数メディアの返信が順次送信として展開されることを確認してください。
