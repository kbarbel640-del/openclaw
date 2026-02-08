---
summary: "メッセージフロー、セッション、キューイング、推論の可視性"
read_when:
  - 受信メッセージがどのように返信になるかを説明する場合
  - セッション、キューイングモード、またはストリーミング挙動を明確化する場合
  - 推論の可視性と利用上の影響を文書化する場合
title: "メッセージ"
x-i18n:
  source_path: concepts/messages.md
  source_hash: 32a1b0c50616c550
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:04:58Z
---

# メッセージ

このページでは、OpenClaw が受信メッセージ、セッション、キューイング、
ストリーミング、推論の可視性をどのように扱うかを関連付けて説明します。

## メッセージフロー（概要）

```
Inbound message
  -> routing/bindings -> session key
  -> queue (if a run is active)
  -> agent run (streaming + tools)
  -> outbound replies (channel limits + chunking)
```

主要な調整項目は設定にあります。

- プレフィックス、キューイング、グループ挙動については `messages.*` です。
- ブロックストリーミングとチャンク分割のデフォルトについては `agents.defaults.*` です。
- 上限やストリーミング切り替えのためのチャンネル上書き（`channels.whatsapp.*`、`channels.telegram.*` など）です。

完全なスキーマについては、[Configuration](/gateway/configuration) を参照してください。

## 受信の重複排除

チャンネルは再接続後に同じメッセージを再配信することがあります。OpenClaw は
チャンネル/アカウント/ピア/セッション/メッセージ ID をキーにした短命キャッシュを保持し、重複配信が別のエージェント実行をトリガーしないようにします。

## 受信のデバウンス

**同一送信者** からの連続する高速メッセージは、`messages.inbound` によって 1 回の
エージェントターンにバッチ化できます。デバウンスはチャンネル + 会話ごとにスコープされ、
返信のスレッド化/ID には最新メッセージを使用します。

設定（グローバルデフォルト + チャンネルごとの上書き）:

```json5
{
  messages: {
    inbound: {
      debounceMs: 2000,
      byChannel: {
        whatsapp: 5000,
        slack: 1500,
        discord: 1500,
      },
    },
  },
}
```

注記:

- デバウンスは **テキストのみ** のメッセージに適用されます。メディア/添付は即時にフラッシュされます。
- コントロールコマンドはデバウンスをバイパスし、単独のまま維持されます。

## セッションとデバイス

セッションはクライアントではなく Gateway（ゲートウェイ） によって所有されます。

- ダイレクトチャットはエージェントのメインセッションキーに集約されます。
- グループ/チャンネルは独自のセッションキーを取得します。
- セッションストアとトランスクリプトは Gateway（ゲートウェイ） ホスト上に存在します。

複数のデバイス/チャンネルが同じセッションにマップされる場合がありますが、履歴はすべてのクライアントへ完全には同期されません。推奨: コンテキストの分岐を避けるため、長い会話には 1 つの主要デバイスを使用してください。Control UI と TUI は常に Gateway（ゲートウェイ） 側のセッショントランスクリプトを表示するため、これらが信頼できる情報源です。

詳細: [Session management](/concepts/session)。

## 受信ボディと履歴コンテキスト

OpenClaw は **プロンプトボディ** と **コマンドボディ** を分離します。

- `Body`: エージェントに送るプロンプトテキストです。チャンネルのエンベロープや
  任意の履歴ラッパーを含む場合があります。
- `CommandBody`: ディレクティブ/コマンド解析のための生のユーザーテキストです。
- `RawBody`: `CommandBody` のレガシー別名です（互換性のために保持）。

チャンネルが履歴を供給する場合、共有ラッパーを使用します。

- `[Chat messages since your last reply - for context]`
- `[Current message - respond to this]`

**非ダイレクトチャット**（グループ/チャンネル/ルーム）では、**現在のメッセージボディ** に
送信者ラベルがプレフィックスとして付与されます（履歴エントリで使用されるものと同じスタイル）。これにより、リアルタイムとキュー/履歴メッセージがエージェントプロンプト内で一貫します。

履歴バッファは **ペンディングのみ** です。つまり、実行をトリガーしなかったグループメッセージ（例えばメンションゲートされたメッセージ）を含み、セッショントランスクリプトに既にあるメッセージは **除外** します。

ディレクティブの除去は **現在のメッセージ** セクションにのみ適用されるため、履歴はそのまま保たれます。履歴をラップするチャンネルは `CommandBody`（または
`RawBody`）を元のメッセージテキストに設定し、`Body` は結合されたプロンプトとして維持してください。
履歴バッファは `messages.groupChat.historyLimit`（グローバル
デフォルト）および `channels.slack.historyLimit` や
`channels.telegram.accounts.<id>.historyLimit` のようなチャンネル上書きで設定できます（無効化するには `0` を設定します）。

## キューイングとフォローアップ

実行がすでにアクティブな場合、受信メッセージはキューに入れられるか、現在の実行へ誘導されるか、フォローアップターンのために収集されます。

- `messages.queue`（および `messages.queue.byChannel`）で設定します。
- モード: `interrupt`、`steer`、`followup`、`collect`、およびバックログのバリアントです。

詳細: [Queueing](/concepts/queue)。

## ストリーミング、チャンク分割、バッチング

ブロックストリーミングは、モデルがテキストブロックを生成するのに合わせて部分的な返信を送信します。
チャンク分割はチャンネルのテキスト上限を尊重し、フェンス付きコードを分割しないようにします。

主要設定:

- `agents.defaults.blockStreamingDefault`（`on|off`、デフォルトはオフ）
- `agents.defaults.blockStreamingBreak`（`text_end|message_end`）
- `agents.defaults.blockStreamingChunk`（`minChars|maxChars|breakPreference`）
- `agents.defaults.blockStreamingCoalesce`（アイドルベースのバッチング）
- `agents.defaults.humanDelay`（ブロック返信間の人間らしい間）
- チャンネル上書き: `*.blockStreaming` および `*.blockStreamingCoalesce`（Telegram 以外のチャンネルでは明示的な `*.blockStreaming: true` が必要です）

詳細: [Streaming + chunking](/concepts/streaming)。

## 推論の可視性とトークン

OpenClaw はモデルの推論を表示/非表示にできます。

- `/reasoning on|off|stream` が可視性を制御します。
- 推論コンテンツは、モデルが生成した場合、トークン使用量に依然としてカウントされます。
- Telegram は下書きバブルへの推論ストリームをサポートします。

詳細: [Thinking + reasoning directives](/tools/thinking) と [Token use](/token-use)。

## プレフィックス、スレッド化、返信

送信メッセージの整形は `messages` に集約されています。

- `messages.responsePrefix`、`channels.<channel>.responsePrefix`、および `channels.<channel>.accounts.<id>.responsePrefix`（送信プレフィックスのカスケード）に加え、`channels.whatsapp.messagePrefix`（WhatsApp 受信プレフィックス）です。
- `replyToMode` とチャンネルごとのデフォルトによる返信スレッド化です。

詳細: [Configuration](/gateway/configuration#messages) および各チャンネルのドキュメントを参照してください。
