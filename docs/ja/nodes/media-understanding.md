---
summary: "プロバイダー + CLI フォールバックによる受信画像 / 音声 / 動画の理解（任意）"
read_when:
  - メディア理解の設計またはリファクタリングを行うとき
  - 受信音声 / 動画 / 画像の前処理を調整するとき
title: "メディア理解"
x-i18n:
  source_path: nodes/media-understanding.md
  source_hash: 4b275b152060eae3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:26Z
---

# メディア理解（受信）— 2026-01-17

OpenClaw は、返信パイプラインが実行される前に **受信メディア（画像 / 音声 / 動画）を要約** できます。ローカルツールやプロバイダーキーが利用可能かどうかを自動検出し、無効化やカスタマイズも可能です。理解機能がオフの場合でも、モデルは従来どおり元のファイル / URL を受け取ります。

## 目標

- 任意: 受信メディアを短いテキストに事前要約し、ルーティングの高速化とコマンド解析の精度向上を図る。
- 元のメディア配信をモデルに常に保持する。
- **プロバイダー API** と **CLI フォールバック** の両方をサポートする。
- エラー / サイズ / タイムアウト時に備え、順序付きフォールバックを持つ複数モデルを許可する。

## 高レベルの動作

1. 受信添付ファイルを収集する（`MediaPaths`、`MediaUrls`、`MediaTypes`）。
2. 有効化された各機能（画像 / 音声 / 動画）について、ポリシーに従って添付ファイルを選択する（デフォルト: **最初**）。
3. 条件を満たす最初のモデルエントリ（サイズ + 機能 + 認証）を選択する。
4. モデルが失敗した場合やメディアが大きすぎる場合は、**次のエントリにフォールバック** する。
5. 成功時:
   - `Body` は `[Image]`、`[Audio]`、または `[Video]` ブロックになる。
   - 音声は `{{Transcript}}` を設定する。コマンド解析では、存在する場合はキャプションテキストを使用し、なければトランスクリプトを使用する。
   - キャプションはブロック内に `User text:` として保持される。

理解に失敗した場合、または無効化されている場合でも、**返信フローは継続** し、元の本文 + 添付ファイルが使用されます。

## 設定概要

`tools.media` は **共有モデル** と機能ごとの上書きをサポートします。

- `tools.media.models`: 共有モデルリスト（ゲートには `capabilities` を使用）。
- `tools.media.image` / `tools.media.audio` / `tools.media.video`:
  - デフォルト（`prompt`、`maxChars`、`maxBytes`、`timeoutSeconds`、`language`）
  - プロバイダー上書き（`baseUrl`、`headers`、`providerOptions`）
  - `tools.media.audio.providerOptions.deepgram` 経由の Deepgram 音声オプション
  - 任意の **機能別 `models` リスト**（共有モデルより優先）
  - `attachments` ポリシー（`mode`、`maxAttachments`、`prefer`）
  - `scope`（チャンネル / chatType / セッションキーによる任意のゲーティング）
- `tools.media.concurrency`: 機能の最大同時実行数（デフォルト **2**）。

```json5
{
  tools: {
    media: {
      models: [
        /* shared list */
      ],
      image: {
        /* optional overrides */
      },
      audio: {
        /* optional overrides */
      },
      video: {
        /* optional overrides */
      },
    },
  },
}
```

### モデルエントリ

各 `models[]` エントリは **プロバイダー** または **CLI** にできます。

```json5
{
  type: "provider", // default if omitted
  provider: "openai",
  model: "gpt-5.2",
  prompt: "Describe the image in <= 500 chars.",
  maxChars: 500,
  maxBytes: 10485760,
  timeoutSeconds: 60,
  capabilities: ["image"], // optional, used for multi‑modal entries
  profile: "vision-profile",
  preferredProfile: "vision-fallback",
}
```

```json5
{
  type: "cli",
  command: "gemini",
  args: [
    "-m",
    "gemini-3-flash",
    "--allowed-tools",
    "read_file",
    "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
  ],
  maxChars: 500,
  maxBytes: 52428800,
  timeoutSeconds: 120,
  capabilities: ["video", "image"],
}
```

CLI テンプレートでは、次も使用できます。

- `{{MediaDir}}`（メディアファイルを含むディレクトリ）
- `{{OutputDir}}`（この実行用に作成されるスクラッチディレクトリ）
- `{{OutputBase}}`（拡張子なしのスクラッチファイルのベースパス）

## デフォルトと制限

推奨デフォルト:

- `maxChars`: 画像 / 動画で **500**（短く、コマンド向け）
- `maxChars`: 音声では **未設定**（制限を設定しない限り全文トランスクリプト）
- `maxBytes`:
  - 画像: **10MB**
  - 音声: **20MB**
  - 動画: **50MB**

ルール:

- メディアが `maxBytes` を超える場合、そのモデルはスキップされ、**次のモデルが試行** されます。
- モデルの返却が `maxChars` を超える場合、出力はトリミングされます。
- `prompt` のデフォルトは「Describe the {media}.」に `maxChars` のガイダンスを加えたものです（画像 / 動画のみ）。
- `<capability>.enabled: true` が有効でモデルが設定されていない場合、OpenClaw は、そのプロバイダーが機能をサポートしていれば **アクティブな返信モデル** を試みます。

### メディア理解の自動検出（デフォルト）

`tools.media.<capability>.enabled` が `false` に設定されておらず、モデルを設定していない場合、OpenClaw は次の順序で自動検出し、**最初に動作したオプションで停止** します。

1. **ローカル CLI**（音声のみ。インストールされている場合）
   - `sherpa-onnx-offline`（エンコーダ / デコーダ / ジョイナー / トークンを含む `SHERPA_ONNX_MODEL_DIR` が必要）
   - `whisper-cli`（`whisper-cpp`。`WHISPER_CPP_MODEL` または同梱の tiny モデルを使用）
   - `whisper`（Python CLI。モデルは自動ダウンロード）
2. **Gemini CLI**（`gemini`）を `read_many_files` で使用
3. **プロバイダーキー**
   - 音声: OpenAI → Groq → Deepgram → Google
   - 画像: OpenAI → Anthropic → Google → MiniMax
   - 動画: Google

自動検出を無効化するには、次を設定します。

```json5
{
  tools: {
    media: {
      audio: {
        enabled: false,
      },
    },
  },
}
```

注: バイナリ検出は macOS / Linux / Windows 全体でベストエフォートです。CLI が `PATH` 上にあること（`~` を展開します）を確認するか、完全なコマンドパスを指定した明示的な CLI モデルを設定してください。

## 機能（任意）

`capabilities` を設定すると、そのエントリは指定されたメディアタイプでのみ実行されます。共有リストの場合、OpenClaw はデフォルトを推測できます。

- `openai`、`anthropic`、`minimax`: **画像**
- `google`（Gemini API）: **画像 + 音声 + 動画**
- `groq`: **音声**
- `deepgram`: **音声**

CLI エントリでは、予期しないマッチを避けるため **`capabilities` を明示的に設定** してください。`capabilities` を省略した場合、そのエントリは配置されたリストに対して有効になります。

## プロバイダー対応マトリクス（OpenClaw 連携）

| 機能 | プロバイダー連携                                   | 注記                                                          |
| ---- | -------------------------------------------------- | ------------------------------------------------------------- |
| 画像 | OpenAI / Anthropic / Google / `pi-ai` 経由のその他 | レジストリ内の画像対応モデルはすべて使用可能です。            |
| 音声 | OpenAI, Groq, Deepgram, Google                     | プロバイダーによる文字起こし（Whisper / Deepgram / Gemini）。 |
| 動画 | Google（Gemini API）                               | プロバイダーによる動画理解。                                  |

## 推奨プロバイダー

**画像**

- 画像をサポートしている場合は、アクティブなモデルを優先してください。
- 良いデフォルト: `openai/gpt-5.2`、`anthropic/claude-opus-4-6`、`google/gemini-3-pro-preview`。

**音声**

- `openai/gpt-4o-mini-transcribe`、`groq/whisper-large-v3-turbo`、または `deepgram/nova-3`。
- CLI フォールバック: `whisper-cli`（whisper-cpp）または `whisper`。
- Deepgram 設定: [Deepgram（音声文字起こし）](/providers/deepgram)。

**動画**

- `google/gemini-3-flash-preview`（高速）、`google/gemini-3-pro-preview`（高機能）。
- CLI フォールバック: `gemini` CLI（動画 / 音声で `read_file` をサポート）。

## 添付ファイルポリシー

機能ごとの `attachments` により、処理される添付ファイルを制御します。

- `mode`: `first`（デフォルト）または `all`
- `maxAttachments`: 処理数の上限（デフォルト **1**）
- `prefer`: `first`、`last`、`path`、`url`

`mode: "all"` の場合、出力は `[Image 1/2]`、`[Audio 2/2]` などとしてラベル付けされます。

## 設定例

### 1) 共有モデルリスト + 上書き

```json5
{
  tools: {
    media: {
      models: [
        { provider: "openai", model: "gpt-5.2", capabilities: ["image"] },
        {
          provider: "google",
          model: "gemini-3-flash-preview",
          capabilities: ["image", "audio", "video"],
        },
        {
          type: "cli",
          command: "gemini",
          args: [
            "-m",
            "gemini-3-flash",
            "--allowed-tools",
            "read_file",
            "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
          ],
          capabilities: ["image", "video"],
        },
      ],
      audio: {
        attachments: { mode: "all", maxAttachments: 2 },
      },
      video: {
        maxChars: 500,
      },
    },
  },
}
```

### 2) 音声 + 動画のみ（画像オフ）

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [
          { provider: "openai", model: "gpt-4o-mini-transcribe" },
          {
            type: "cli",
            command: "whisper",
            args: ["--model", "base", "{{MediaPath}}"],
          },
        ],
      },
      video: {
        enabled: true,
        maxChars: 500,
        models: [
          { provider: "google", model: "gemini-3-flash-preview" },
          {
            type: "cli",
            command: "gemini",
            args: [
              "-m",
              "gemini-3-flash",
              "--allowed-tools",
              "read_file",
              "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
            ],
          },
        ],
      },
    },
  },
}
```

### 3) 任意の画像理解

```json5
{
  tools: {
    media: {
      image: {
        enabled: true,
        maxBytes: 10485760,
        maxChars: 500,
        models: [
          { provider: "openai", model: "gpt-5.2" },
          { provider: "anthropic", model: "claude-opus-4-6" },
          {
            type: "cli",
            command: "gemini",
            args: [
              "-m",
              "gemini-3-flash",
              "--allowed-tools",
              "read_file",
              "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
            ],
          },
        ],
      },
    },
  },
}
```

### 4) マルチモーダル単一エントリ（明示的な機能指定）

```json5
{
  tools: {
    media: {
      image: {
        models: [
          {
            provider: "google",
            model: "gemini-3-pro-preview",
            capabilities: ["image", "video", "audio"],
          },
        ],
      },
      audio: {
        models: [
          {
            provider: "google",
            model: "gemini-3-pro-preview",
            capabilities: ["image", "video", "audio"],
          },
        ],
      },
      video: {
        models: [
          {
            provider: "google",
            model: "gemini-3-pro-preview",
            capabilities: ["image", "video", "audio"],
          },
        ],
      },
    },
  },
}
```

## ステータス出力

メディア理解が実行されると、`/status` に短いサマリー行が含まれます。

```
📎 Media: image ok (openai/gpt-5.2) · audio skipped (maxBytes)
```

ここには、機能ごとの結果と、該当する場合は選択されたプロバイダー / モデルが表示されます。

## 注意事項

- 理解は **ベストエフォート** です。エラーが返信をブロックすることはありません。
- 理解が無効化されている場合でも、添付ファイルはモデルに渡されます。
- `scope` を使用して、理解が実行される場所を制限できます（例: ダイレクトメッセージのみ）。

## 関連ドキュメント

- [Configuration](/gateway/configuration)
- [Image & Media Support](/nodes/images)
