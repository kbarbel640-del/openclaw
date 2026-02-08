---
summary: "受信したボイスノートのための Deepgram 音声文字起こし"
read_when:
  - 音声添付ファイルに Deepgram の音声認識を使いたい場合
  - Deepgram の設定例をすぐに確認したい場合
title: "Deepgram"
x-i18n:
  source_path: providers/deepgram.md
  source_hash: 8f19e072f0867211
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:31Z
---

# Deepgram（音声文字起こし）

Deepgram は音声認識 API です。OpenClaw では、`tools.media.audio` を介した **受信オーディオ／ボイスノートの文字起こし** に使用されます。

有効化すると、OpenClaw は音声ファイルを Deepgram にアップロードし、文字起こし結果を返信パイプライン（`{{Transcript}}` + `[Audio]` ブロック）に注入します。これは **ストリーミングではありません**。事前録音向けの文字起こしエンドポイントを使用します。

Website: https://deepgram.com  
Docs: https://developers.deepgram.com

## クイックスタート

1. API キーを設定します。

```
DEEPGRAM_API_KEY=dg_...
```

2. プロバイダーを有効化します。

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## オプション

- `model`: Deepgram のモデル ID（デフォルト: `nova-3`）
- `language`: 言語ヒント（任意）
- `tools.media.audio.providerOptions.deepgram.detect_language`: 言語検出を有効化（任意）
- `tools.media.audio.providerOptions.deepgram.punctuate`: 句読点を有効化（任意）
- `tools.media.audio.providerOptions.deepgram.smart_format`: スマートフォーマットを有効化（任意）

言語を指定した例:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3", language: "en" }],
      },
    },
  },
}
```

Deepgram オプションの例:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        providerOptions: {
          deepgram: {
            detect_language: true,
            punctuate: true,
            smart_format: true,
          },
        },
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## 注記

- 認証は標準のプロバイダー認証順に従います。最も簡単な方法は `DEEPGRAM_API_KEY` です。
- プロキシを使用する場合は、`tools.media.audio.baseUrl` と `tools.media.audio.headers` でエンドポイントやヘッダーを上書きできます。
- 出力は他のプロバイダーと同じオーディオ規則（サイズ上限、タイムアウト、文字起こしの注入）に従います。
