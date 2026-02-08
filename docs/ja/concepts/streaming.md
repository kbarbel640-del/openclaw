---
summary: "ストリーミング + チャンク化の挙動（ブロック返信、下書きストリーミング、制限）"
read_when:
  - チャンネル上でストリーミングやチャンク化がどのように動作するかを説明する場合
  - ブロックストリーミングやチャンネルのチャンク化の挙動を変更する場合
  - 重複/早すぎるブロック返信や下書きストリーミングをデバッグする場合
title: "ストリーミングとチャンク化"
x-i18n:
  source_path: concepts/streaming.md
  source_hash: f014eb1898c4351b
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:09:34Z
---

# ストリーミング + チャンク化

OpenClaw には 2 つの別々の「ストリーミング」レイヤーがあります。

- **ブロックストリーミング（チャンネル）:** アシスタントが書き進めるのに合わせて、完成した **ブロック** を送出します。これらは通常のチャンネルメッセージです（トークンのデルタではありません）。
- **トークン風ストリーミング（Telegram のみ）:** 生成中に部分テキストで **下書きバブル** を更新し、最後に最終メッセージが送信されます。

現時点では、外部チャンネルメッセージへの **本当のトークンストリーミングはありません**。Telegram の下書きストリーミングが唯一の部分ストリーミングの面です。

## ブロックストリーミング（チャンネルメッセージ）

ブロックストリーミングは、利用可能になったアシスタント出力を粗いチャンクで送信します。

```
Model output
  └─ text_delta/events
       ├─ (blockStreamingBreak=text_end)
       │    └─ chunker emits blocks as buffer grows
       └─ (blockStreamingBreak=message_end)
            └─ chunker flushes at message_end
                   └─ channel send (block replies)
```

凡例:

- `text_delta/events`: モデルのストリームイベント（非ストリーミングモデルでは疎になる場合があります）。
- `chunker`: 最小/最大の境界 + 改行優先度を適用する `EmbeddedBlockChunker`。
- `channel send`: 実際の送信メッセージ（ブロック返信）。

**制御:**

- `agents.defaults.blockStreamingDefault`: `"on"`/`"off"`（デフォルトはオフ）。
- チャンネルの上書き: `*.blockStreaming`（およびアカウントごとのバリアント）により、チャンネルごとに `"on"`/`"off"` を強制します。
- `agents.defaults.blockStreamingBreak`: `"text_end"` または `"message_end"`。
- `agents.defaults.blockStreamingChunk`: `{ minChars, maxChars, breakPreference? }`。
- `agents.defaults.blockStreamingCoalesce`: `{ minChars?, maxChars?, idleMs? }`（送信前にストリームされたブロックをマージします）。
- チャンネルのハード上限: `*.textChunkLimit`（例: `channels.whatsapp.textChunkLimit`）。
- チャンネルのチャンクモード: `*.chunkMode`（デフォルトは `length`、`newline` は長さによるチャンク化の前に空行（段落境界）で分割します）。
- Discord のソフト上限: `channels.discord.maxLinesPerMessage`（デフォルト 17）は UI のクリッピングを避けるために縦に長い返信を分割します。

**境界のセマンティクス:**

- `text_end`: チャンカーが出力し次第ブロックをストリームし、各 `text_end` でフラッシュします。
- `message_end`: アシスタントメッセージが完了するまで待ち、その後バッファされた出力をフラッシュします。

`message_end` でも、バッファされたテキストが `maxChars` を超える場合はチャンカーを使用するため、最後に複数チャンクを送出できます。

## チャンク化アルゴリズム（下限/上限）

ブロックのチャンク化は `EmbeddedBlockChunker` により実装されています。

- **下限:** バッファが `minChars` 以上になるまで送出しません（強制の場合を除く）。
- **上限:** `maxChars` より前での分割を優先します。強制の場合は `maxChars` で分割します。
- **改行優先度:** `paragraph` → `newline` → `sentence` → `whitespace` → ハード改行。
- **コードフェンス:** フェンス内では決して分割しません。`maxChars` で強制された場合、Markdown の正当性を保つためにフェンスを閉じて再度開きます。

`maxChars` はチャンネルの `textChunkLimit` にクランプされるため、チャンネルごとの上限を超えることはできません。

## 結合（ストリームされたブロックのマージ）

ブロックストリーミングが有効な場合、OpenClaw は送信前に連続するブロックチャンクを **マージ** できます。これにより、進捗出力を保ちつつ「1 行スパム」を減らします。

- 結合は **アイドルの空白時間**（`idleMs`）を待ってからフラッシュします。
- バッファは `maxChars` により上限が設定され、これを超えるとフラッシュします。
- `minChars` は、十分なテキストが蓄積するまで小さな断片の送信を防ぎます（最終フラッシュでは残りのテキストが常に送信されます）。
- 結合子は `blockStreamingChunk.breakPreference` から導出されます
  （`paragraph` → `\n\n`、`newline` → `\n`、`sentence` → 半角スペース）。
- チャンネルの上書きは `*.blockStreamingCoalesce`（アカウントごとの設定を含む）で利用できます。
- デフォルトの結合 `minChars` は、上書きされない限り Signal/Slack/Discord では 1500 に引き上げられます。

## ブロック間の人間らしいペーシング

ブロックストリーミングが有効な場合、ブロック返信間（最初のブロックの後）に **ランダム化された一時停止** を追加できます。これにより、複数バブルの応答がより自然に感じられます。

- 設定: `agents.defaults.humanDelay`（`agents.list[].humanDelay` によりエージェントごとに上書き）。
- モード: `off`（デフォルト）、`natural`（800–2500ms）、`custom`（`minMs`/`maxMs`）。
- 適用対象は **ブロック返信** のみで、最終返信やツール要約には適用されません。

## 「チャンクをストリームする」または「すべてをストリームする」

これは次の対応関係になります。

- **チャンクをストリームする:** `blockStreamingDefault: "on"` + `blockStreamingBreak: "text_end"`（進行に合わせて送出）。Telegram 以外のチャンネルでは `*.blockStreaming: true` も必要です。
- **最後にすべてをストリームする:** `blockStreamingBreak: "message_end"`（一度だけフラッシュ。ただし非常に長い場合は複数チャンクになる可能性があります）。
- **ブロックストリーミングなし:** `blockStreamingDefault: "off"`（最終返信のみ）。

**チャンネルに関する注意:** Telegram 以外のチャンネルでは、`*.blockStreaming` が明示的に `true` に設定されない限り、ブロックストリーミングは **オフ** です。Telegram はブロック返信なしで下書きをストリーム（`channels.telegram.streamMode`）できます。

設定場所の注意: `blockStreaming*` のデフォルトはルート設定ではなく
`agents.defaults` 配下にあります。

## Telegram の下書きストリーミング（トークン風）

下書きストリーミングがあるチャンネルは Telegram のみです。

- **トピック付きのプライベートチャット** で Bot API の `sendMessageDraft` を使用します。
- `channels.telegram.streamMode: "partial" | "block" | "off"`。
  - `partial`: 最新のストリームテキストで下書きを更新します。
  - `block`: チャンク化されたブロックで下書きを更新します（同じチャンカーのルール）。
  - `off`: 下書きストリーミングなし。
- 下書きチャンク設定（`streamMode: "block"` のみ）: `channels.telegram.draftChunk`（デフォルト: `minChars: 200`、`maxChars: 800`）。
- 下書きストリーミングはブロックストリーミングとは別です。ブロック返信はデフォルトでオフであり、Telegram 以外のチャンネルでは `*.blockStreaming: true` によってのみ有効化されます。
- 最終返信は通常のメッセージです。
- `/reasoning stream` は推論を下書きバブルに書き込みます（Telegram のみ）。

下書きストリーミングが有効な場合、OpenClaw は二重ストリーミングを避けるため、その返信ではブロックストリーミングを無効化します。

```
Telegram (private + topics)
  └─ sendMessageDraft (draft bubble)
       ├─ streamMode=partial → update latest text
       └─ streamMode=block   → chunker updates draft
  └─ final reply → normal message
```

凡例:

- `sendMessageDraft`: Telegram の下書きバブル（実際のメッセージではありません）。
- `final reply`: 通常の Telegram メッセージ送信。
