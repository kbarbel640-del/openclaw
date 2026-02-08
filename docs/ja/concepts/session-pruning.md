---
summary: "セッションプルーニング: コンテキスト肥大化を抑えるためのツール結果トリミング"
read_when:
  - ツール出力による LLM コンテキストの増加を抑えたい場合
  - agents.defaults.contextPruning を調整している場合
x-i18n:
  source_path: concepts/session-pruning.md
  source_hash: 9b0aa2d1abea7050
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:08:07Z
---

# セッションプルーニング

セッションプルーニングは、各 LLM 呼び出しの直前に、インメモリコンテキストから**古いツール結果**をトリミングします。オンディスクのセッション履歴（`*.jsonl`）を書き換えることは**ありません**。

## 実行されるタイミング

- `mode: "cache-ttl"` が有効で、セッションの最後の Anthropic 呼び出しが `ttl` より古い場合。
- そのリクエストでモデルに送信されるメッセージにのみ影響します。
- Anthropic API 呼び出し（および OpenRouter の Anthropic モデル）でのみ有効です。
- 最良の結果を得るには、`ttl` をモデルの `cacheControlTtl` に合わせてください。
- プルーニング後は TTL ウィンドウがリセットされ、後続のリクエストは `ttl` が再び期限切れになるまでキャッシュを維持します。

## スマートデフォルト（Anthropic）

- **OAuth または setup-token** プロファイル: `cache-ttl` プルーニングを有効化し、ハートビートを `1h` に設定します。
- **API key** プロファイル: `cache-ttl` プルーニングを有効化し、ハートビートを `30m` に設定し、Anthropic モデルではデフォルトの `cacheControlTtl` を `1h` にします。
- これらの値のいずれかを明示的に設定した場合、OpenClaw はそれらを**上書きしません**。

## 改善される点（コスト + キャッシュ挙動）

- **なぜプルーニングするのか:** Anthropic のプロンプトキャッシュは TTL 内でのみ適用されます。セッションが TTL を超えてアイドルになると、次のリクエストでは、先にトリミングしない限りフルプロンプトを再キャッシュします。
- **何が安くなるのか:** プルーニングにより、TTL 期限切れ後の最初のリクエストにおける **cacheWrite** サイズが削減されます。
- **なぜ TTL リセットが重要なのか:** プルーニングが実行されるとキャッシュウィンドウがリセットされるため、フォローアップのリクエストはフル履歴を再キャッシュするのではなく、新しくキャッシュされたプロンプトを再利用できます。
- **やらないこと:** プルーニングはトークンを追加したり、コストを「二重」にしたりしません。TTL 期限切れ後の最初のリクエストでキャッシュされる内容が変わるだけです。

## プルーニングできるもの

- `toolResult` メッセージのみ。
- ユーザー + アシスタントのメッセージは**決して**変更されません。
- 直近の `keepLastAssistants` 件のアシスタントメッセージは保護されます。そのカットオフ以降のツール結果はプルーニングされません。
- カットオフを確立するのに十分なアシスタントメッセージがない場合、プルーニングはスキップされます。
- **画像ブロック**を含むツール結果はスキップされます（トリミング/クリアされません）。

## コンテキストウィンドウの推定

プルーニングは推定コンテキストウィンドウ（chars ≈ tokens × 4）を使用します。ベースウィンドウは次の順序で解決されます:

1. `models.providers.*.models[].contextWindow` のオーバーライド。
2. モデル定義の `contextWindow`（モデルレジストリから）。
3. デフォルトの `200000` トークン。

`agents.defaults.contextTokens` が設定されている場合、解決されたウィンドウに対する上限（min）として扱われます。

## モード

### cache-ttl

- 最後の Anthropic 呼び出しが `ttl` より古い場合にのみプルーニングが実行されます（デフォルトは `5m`）。
- 実行されるとき: 以前と同じソフトトリム + ハードクリアの挙動です。

## ソフトとハードのプルーニング

- **ソフトトリム**: サイズ超過のツール結果にのみ適用されます。
  - 先頭 + 末尾を保持し、`...` を挿入し、元のサイズを示す注記を付加します。
  - 画像ブロックを含む結果はスキップします。
- **ハードクリア**: ツール結果全体を `hardClear.placeholder` に置き換えます。

## ツールの選択

- `tools.allow` / `tools.deny` は `*` ワイルドカードをサポートします。
- Deny が優先されます。
- マッチングは大文字小文字を区別しません。
- allow リストが空 => すべてのツールが許可されます。

## 他の制限との相互作用

- 組み込みツールはすでに自身の出力を切り詰めます。セッションプルーニングは追加のレイヤーであり、長時間のチャットでツール出力がモデルコンテキスト内に過剰に蓄積されることを防ぎます。
- コンパクションは別物です: コンパクションは要約して永続化し、プルーニングはリクエストごとに一時的です。[/concepts/compaction](/concepts/compaction) を参照してください。

## デフォルト（有効時）

- `ttl`: `"5m"`
- `keepLastAssistants`: `3`
- `softTrimRatio`: `0.3`
- `hardClearRatio`: `0.5`
- `minPrunableToolChars`: `50000`
- `softTrim`: `{ maxChars: 4000, headChars: 1500, tailChars: 1500 }`
- `hardClear`: `{ enabled: true, placeholder: "[Old tool result content cleared]" }`

## 例

デフォルト（オフ）:

```json5
{
  agent: {
    contextPruning: { mode: "off" },
  },
}
```

TTL 対応プルーニングを有効化:

```json5
{
  agent: {
    contextPruning: { mode: "cache-ttl", ttl: "5m" },
  },
}
```

特定のツールにプルーニングを制限:

```json5
{
  agent: {
    contextPruning: {
      mode: "cache-ttl",
      tools: { allow: ["exec", "read"], deny: ["*image*"] },
    },
  },
}
```

設定リファレンスを参照: [Gateway Configuration](/gateway/configuration)
