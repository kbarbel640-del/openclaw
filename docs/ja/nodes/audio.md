---
summary: 「受信した音声／ボイスノートがダウンロード、文字起こしされ、返信に注入されるまでの仕組み」
read_when:
  - 音声の文字起こしやメディア処理を変更する場合
title: 「オーディオとボイスノート」
x-i18n:
  source_path: nodes/audio.md
  source_hash: b926c47989ab0d1e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:09Z
---

# オーディオ／ボイスノート — 2026-01-17

## 動作する機能

- **メディア理解（音声）**：音声理解が有効（または自動検出）な場合、OpenClaw は次を実行します。
  1. 最初の音声添付（ローカルパスまたは URL）を特定し、必要に応じてダウンロードします。
  2. 各モデルエントリへ送信する前に `maxBytes` を適用します。
  3. 順序どおりに最初の対象モデルエントリ（プロバイダーまたは CLI）を実行します。
  4. 失敗またはスキップ（サイズ／タイムアウト）した場合、次のエントリを試行します。
  5. 成功時、`Body` を `[Audio]` ブロックに置き換え、`{{Transcript}}` を設定します。
- **コマンド解析**：文字起こしが成功すると、スラッシュコマンドが引き続き動作するよう、`CommandBody`／`RawBody` にトランスクリプトが設定されます。
- **詳細ログ**：`--verbose` において、文字起こしの実行と本文の置換が記録されます。

## 自動検出（デフォルト）

**モデルを設定していない** かつ `tools.media.audio.enabled` が `false` に **設定されていない** 場合、
OpenClaw は次の順序で自動検出し、最初に動作した選択肢で停止します。

1. **ローカル CLI**（インストール済みの場合）
   - `sherpa-onnx-offline`（エンコーダ／デコーダ／ジョイナー／トークンを含む `SHERPA_ONNX_MODEL_DIR` が必要）
   - `whisper-cli`（`whisper-cpp` 由来；`WHISPER_CPP_MODEL` または同梱の tiny モデルを使用）
   - `whisper`（Python CLI；モデルを自動ダウンロード）
2. **Gemini CLI**（`gemini`）を `read_many_files` で使用
3. **プロバイダーキー**（OpenAI → Groq → Deepgram → Google）

自動検出を無効にするには `tools.media.audio.enabled: false` を設定してください。  
カスタマイズするには `tools.media.audio.models` を設定します。  
注記：バイナリ検出は macOS／Linux／Windows でベストエフォートです。CLI が `PATH` 上にあること（`~` を展開します）を確認するか、完全なコマンドパスを指定した明示的な CLI モデルを設定してください。

## 設定例

### プロバイダー + CLI フォールバック（OpenAI + Whisper CLI）

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        maxBytes: 20971520,
        models: [
          { provider: "openai", model: "gpt-4o-mini-transcribe" },
          {
            type: "cli",
            command: "whisper",
            args: ["--model", "base", "{{MediaPath}}"],
            timeoutSeconds: 45,
          },
        ],
      },
    },
  },
}
```

### スコープ制御付きプロバイダーのみ

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        scope: {
          default: "allow",
          rules: [{ action: "deny", match: { chatType: "group" } }],
        },
        models: [{ provider: "openai", model: "gpt-4o-mini-transcribe" }],
      },
    },
  },
}
```

### プロバイダーのみ（Deepgram）

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

## 注意点と制限

- プロバイダー認証は標準のモデル認証順（認証プロファイル、環境変数、`models.providers.*.apiKey`）に従います。
- `provider: "deepgram"` が使用される場合、Deepgram は `DEEPGRAM_API_KEY` を取得します。
- Deepgram の設定詳細：［Deepgram（音声文字起こし）］(/providers/deepgram)。
- 音声プロバイダーは `tools.media.audio` により `baseUrl`、`headers`、`providerOptions` を上書きできます。
- 既定のサイズ上限は 20MB（`tools.media.audio.maxBytes`）です。上限超過の音声は当該モデルではスキップされ、次のエントリが試行されます。
- 音声の既定の `maxChars` は **未設定**（全文トランスクリプト）です。出力を短縮するには `tools.media.audio.maxChars` またはエントリごとの `maxChars` を設定してください。
- OpenAI の自動既定は `gpt-4o-mini-transcribe` です。高精度にするには `model: "gpt-4o-transcribe"` を設定してください。
- 複数のボイスノートを処理するには `tools.media.audio.attachments` を使用します（`mode: "all"` + `maxAttachments`）。
- トランスクリプトはテンプレートから `{{Transcript}}` として利用できます。
- CLI の stdout は 5MB に制限されます。CLI の出力は簡潔に保ってください。

## 注意事項（Gotchas）

- スコープ規則は「最初に一致したものが優先」です。`chatType` は `direct`、`group`、または `room` に正規化されます。
- CLI は終了コード 0 で終了し、プレーンテキストを出力してください。JSON は `jq -r .text` により整形が必要です。
- 返信キューのブロックを避けるため、タイムアウト（`timeoutSeconds`、既定 60 秒）は適切に設定してください。
