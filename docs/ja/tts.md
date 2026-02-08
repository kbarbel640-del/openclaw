---
summary: "送信返信向けのテキスト読み上げ（TTS）"
read_when:
  - 返信のテキスト読み上げを有効にする場合
  - TTS プロバイダーや制限を設定する場合
  - /tts コマンドを使用する場合
title: "テキスト読み上げ"
x-i18n:
  source_path: tts.md
  source_hash: 070ff0cc8592f64c
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:13:19Z
---

# テキスト読み上げ（TTS）

OpenClaw は、ElevenLabs、OpenAI、または Edge TTS を使用して、送信する返信を音声に変換できます。
OpenClaw が音声を送信できる場所ならどこでも動作します。Telegram では丸いボイスノートのバブルになります。

## サポートされるサービス

- **ElevenLabs**（プライマリまたはフォールバックのプロバイダー）
- **OpenAI**（プライマリまたはフォールバックのプロバイダー。要約にも使用されます）
- **Edge TTS**（プライマリまたはフォールバックのプロバイダー。`node-edge-tts` を使用。API キーがない場合のデフォルト）

### Edge TTS の注意事項

Edge TTS は、`node-edge-tts`
ライブラリを介して Microsoft Edge のオンライン ニューラル TTS サービスを使用します。これはホスト型サービス（ローカルではありません）であり、Microsoft のエンドポイントを使用し、API キーは不要です。`node-edge-tts` は音声設定オプションと出力形式を公開しますが、すべてのオプションが Edge サービスでサポートされているわけではありません。 citeturn2search0

Edge TTS は公開 Web サービスであり、公開された SLA やクォータがないため、ベストエフォートとして扱ってください。保証された上限やサポートが必要な場合は、OpenAI または ElevenLabs を使用してください。Microsoft の Speech REST API では、1 リクエストあたり 10 分の音声制限が文書化されています。Edge TTS は制限を公開していないため、同等またはそれ以下の制限を想定してください。 citeturn0search3

## オプションのキー

OpenAI または ElevenLabs を使いたい場合:

- `ELEVENLABS_API_KEY`（または `XI_API_KEY`）
- `OPENAI_API_KEY`

Edge TTS は API キーを **必要としません**。API キーが見つからない場合、OpenClaw は Edge TTS をデフォルトにします（`messages.tts.edge.enabled=false` により無効化されていない場合）。

複数のプロバイダーが設定されている場合、選択されたプロバイダーが最初に使用され、他はフォールバックの選択肢になります。
自動要約は設定された `summaryModel`（または `agents.defaults.model.primary`）を使用するため、要約を有効にする場合はそのプロバイダーも認証されている必要があります。

## サービスリンク

- [OpenAI Text-to-Speech guide](https://platform.openai.com/docs/guides/text-to-speech)
- [OpenAI Audio API reference](https://platform.openai.com/docs/api-reference/audio)
- [ElevenLabs Text to Speech](https://elevenlabs.io/docs/api-reference/text-to-speech)
- [ElevenLabs Authentication](https://elevenlabs.io/docs/api-reference/authentication)
- [node-edge-tts](https://github.com/SchneeHertz/node-edge-tts)
- [Microsoft Speech output formats](https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech#audio-outputs)

## デフォルトで有効ですか？

いいえ。自動 TTS はデフォルトで **オフ** です。設定で
`messages.tts.auto` により有効化するか、セッションごとに `/tts always`（別名: `/tts on`）で有効化してください。

TTS がオンになると、Edge TTS はデフォルトで **有効** になり、OpenAI または ElevenLabs の API キーが利用できない場合に自動的に使用されます。

## 設定

TTS 設定は `openclaw.json` の `messages.tts` 配下にあります。
完全なスキーマは [Gateway configuration](/gateway/configuration) にあります。

### 最小設定（有効化 + プロバイダー）

```json5
{
  messages: {
    tts: {
      auto: "always",
      provider: "elevenlabs",
    },
  },
}
```

### OpenAI をプライマリ、ElevenLabs をフォールバックにする

```json5
{
  messages: {
    tts: {
      auto: "always",
      provider: "openai",
      summaryModel: "openai/gpt-4.1-mini",
      modelOverrides: {
        enabled: true,
      },
      openai: {
        apiKey: "openai_api_key",
        model: "gpt-4o-mini-tts",
        voice: "alloy",
      },
      elevenlabs: {
        apiKey: "elevenlabs_api_key",
        baseUrl: "https://api.elevenlabs.io",
        voiceId: "voice_id",
        modelId: "eleven_multilingual_v2",
        seed: 42,
        applyTextNormalization: "auto",
        languageCode: "en",
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.0,
          useSpeakerBoost: true,
          speed: 1.0,
        },
      },
    },
  },
}
```

### Edge TTS をプライマリ（API キー不要）

```json5
{
  messages: {
    tts: {
      auto: "always",
      provider: "edge",
      edge: {
        enabled: true,
        voice: "en-US-MichelleNeural",
        lang: "en-US",
        outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        rate: "+10%",
        pitch: "-5%",
      },
    },
  },
}
```

### Edge TTS を無効化

```json5
{
  messages: {
    tts: {
      edge: {
        enabled: false,
      },
    },
  },
}
```

### カスタム制限 + prefs パス

```json5
{
  messages: {
    tts: {
      auto: "always",
      maxTextLength: 4000,
      timeoutMs: 30000,
      prefsPath: "~/.openclaw/settings/tts.json",
    },
  },
}
```

### 受信したボイスノートの後にのみ音声で返信する

```json5
{
  messages: {
    tts: {
      auto: "inbound",
    },
  },
}
```

### 長い返信の自動要約を無効化

```json5
{
  messages: {
    tts: {
      auto: "always",
    },
  },
}
```

次を実行します:

```
/tts summary off
```

### フィールドに関する注記

- `auto`: 自動 TTS モード（`off`、`always`、`inbound`、`tagged`）。
  - `inbound` は、受信したボイスノートの後にのみ音声を送信します。
  - `tagged` は、返信に `[[tts]]` タグが含まれる場合にのみ音声を送信します。
- `enabled`: 旧トグル（doctor がこれを `auto` に移行します）。
- `mode`: `"final"`（デフォルト）または `"all"`（ツール/ブロック返信を含みます）。
- `provider`: `"elevenlabs"`、`"openai"`、または `"edge"`（フォールバックは自動です）。
- `provider` が **未設定** の場合、OpenClaw は `openai`（キーがある場合）を優先し、次に `elevenlabs`（キーがある場合）を優先し、それ以外は `edge` を使用します。
- `summaryModel`: 自動要約向けの任意の安価なモデル。デフォルトは `agents.defaults.model.primary` です。
  - `provider/model` または設定済みモデルエイリアスを受け付けます。
- `modelOverrides`: モデルが TTS ディレクティブを出力することを許可します（デフォルトでオン）。
- `maxTextLength`: TTS 入力のハード上限（文字数）。超過すると `/tts audio` は失敗します。
- `timeoutMs`: リクエストタイムアウト（ms）。
- `prefsPath`: ローカル prefs の JSON パス（プロバイダー/制限/要約）を上書きします。
- `apiKey` の値は環境変数（`ELEVENLABS_API_KEY`/`XI_API_KEY`、`OPENAI_API_KEY`）にフォールバックします。
- `elevenlabs.baseUrl`: ElevenLabs の API ベース URL を上書きします。
- `elevenlabs.voiceSettings`:
  - `stability`、`similarityBoost`、`style`: `0..1`
  - `useSpeakerBoost`: `true|false`
  - `speed`: `0.5..2.0`（1.0 = 通常）
- `elevenlabs.applyTextNormalization`: `auto|on|off`
- `elevenlabs.languageCode`: 2 文字の ISO 639-1（例: `en`、`de`）
- `elevenlabs.seed`: 整数の `0..4294967295`（ベストエフォートの決定性）
- `edge.enabled`: Edge TTS の使用を許可します（デフォルト `true`。API キー不要）。
- `edge.voice`: Edge のニューラル音声名（例: `en-US-MichelleNeural`）。
- `edge.lang`: 言語コード（例: `en-US`）。
- `edge.outputFormat`: Edge の出力形式（例: `audio-24khz-48kbitrate-mono-mp3`）。
  - 有効な値については Microsoft Speech output formats を参照してください。すべての形式が Edge でサポートされているわけではありません。
- `edge.rate` / `edge.pitch` / `edge.volume`: パーセント文字列（例: `+10%`、`-5%`）。
- `edge.saveSubtitles`: 音声ファイルと並行して JSON 字幕を書き込みます。
- `edge.proxy`: Edge TTS リクエストのプロキシ URL。
- `edge.timeoutMs`: リクエストタイムアウト上書き（ms）。

## モデル駆動の上書き（デフォルトでオン）

デフォルトでは、モデルは 1 回の返信に対して TTS ディレクティブを出力 **できます**。
`messages.tts.auto` が `tagged` の場合、音声をトリガーするにはこれらのディレクティブが必要です。

有効化されている場合、モデルは 1 回の返信に対して音声を上書きするための `[[tts:...]]` ディレクティブを出力でき、さらに任意で `[[tts:text]]...[[/tts:text]]` ブロックを付けて、音声にのみ含めるべき表現タグ（笑い、歌唱キューなど）を提供できます。

返信ペイロードの例:

```
Here you go.

[[tts:provider=elevenlabs voiceId=pMsXgVXv3BLzUgSXRplE model=eleven_v3 speed=1.1]]
[[tts:text]](laughs) Read the song once more.[[/tts:text]]
```

利用可能なディレクティブキー（有効時）:

- `provider`（`openai` | `elevenlabs` | `edge`）
- `voice`（OpenAI 音声）または `voiceId`（ElevenLabs）
- `model`（OpenAI TTS モデルまたは ElevenLabs のモデル id）
- `stability`、`similarityBoost`、`style`、`speed`、`useSpeakerBoost`
- `applyTextNormalization`（`auto|on|off`）
- `languageCode`（ISO 639-1）
- `seed`

すべてのモデル上書きを無効化:

```json5
{
  messages: {
    tts: {
      modelOverrides: {
        enabled: false,
      },
    },
  },
}
```

任意の許可リスト（タグ有効は維持したまま、特定の上書きを無効化）:

```json5
{
  messages: {
    tts: {
      modelOverrides: {
        enabled: true,
        allowProvider: false,
        allowSeed: false,
      },
    },
  },
}
```

## ユーザーごとの設定

スラッシュコマンドはローカル上書きを `prefsPath`（デフォルト:
`~/.openclaw/settings/tts.json`。`OPENCLAW_TTS_PREFS` または
`messages.tts.prefsPath` で上書き）に書き込みます。

保存されるフィールド:

- `enabled`
- `provider`
- `maxLength`（要約しきい値。デフォルト 1500 文字）
- `summarize`（デフォルト `true`）

これらは、そのホストに対して `messages.tts.*` を上書きします。

## 出力形式（固定）

- **Telegram**: Opus ボイスノート（ElevenLabs は `opus_48000_64`、OpenAI は `opus`）。
  - 48 kHz / 64 kbps は、ボイスノートにおける良いトレードオフであり、丸いバブルに必要です。
- **他のチャンネル**: MP3（ElevenLabs は `mp3_44100_128`、OpenAI は `mp3`）。
  - 44.1 kHz / 128 kbps は、音声明瞭度のバランスとしてデフォルトです。
- **Edge TTS**: `edge.outputFormat`（デフォルト `audio-24khz-48kbitrate-mono-mp3`）を使用します。
  - `node-edge-tts` は `outputFormat` を受け付けますが、すべての形式が Edge サービスから利用できるわけではありません。 citeturn2search0
  - 出力形式の値は Microsoft Speech output formats（Ogg/WebM Opus を含む）に従います。 citeturn1search0
  - Telegram の `sendVoice` は OGG/MP3/M4A を受け付けます。Opus ボイスノートを確実に必要とする場合は、OpenAI/ElevenLabs を使用してください。 citeturn1search1
  - 設定された Edge 出力形式が失敗した場合、OpenClaw は MP3 で再試行します。

OpenAI/ElevenLabs の形式は固定です。Telegram はボイスノート UX のために Opus を想定しています。

## 自動 TTS の挙動

有効化されている場合、OpenClaw は次を行います:

- 返信にすでにメディアまたは `MEDIA:` ディレクティブが含まれている場合は TTS をスキップします。
- 非常に短い返信（< 10 文字）をスキップします。
- 有効化されている場合、`agents.defaults.model.primary`（または `summaryModel`）を使用して長い返信を要約します。
- 生成した音声を返信に添付します。

返信が `maxLength` を超え、要約がオフ（または要約モデル用の API キーがない）場合は、
音声はスキップされ、通常のテキスト返信が送信されます。

## フローダイアグラム

```
Reply -> TTS enabled?
  no  -> send text
  yes -> has media / MEDIA: / short?
          yes -> send text
          no  -> length > limit?
                   no  -> TTS -> attach audio
                   yes -> summary enabled?
                            no  -> send text
                            yes -> summarize (summaryModel or agents.defaults.model.primary)
                                      -> TTS -> attach audio
```

## スラッシュコマンドの使用方法

コマンドは 1 つだけです: `/tts`。
有効化の詳細は [Slash commands](/tools/slash-commands) を参照してください。

Discord の注記: `/tts` は Discord 組み込みのコマンドのため、OpenClaw はそこでネイティブコマンドとして
`/voice` を登録します。テキストの `/tts ...` は引き続き動作します。

```
/tts off
/tts always
/tts inbound
/tts tagged
/tts status
/tts provider openai
/tts limit 2000
/tts summary off
/tts audio Hello from OpenClaw
```

注記:

- コマンドには認可された送信者が必要です（許可リスト/オーナー ルールは引き続き適用されます）。
- `commands.text` またはネイティブコマンド登録が有効である必要があります。
- `off|always|inbound|tagged` はセッションごとのトグルです（`/tts on` は `/tts always` の別名です）。
- `limit` と `summary` はメイン設定ではなくローカル prefs に保存されます。
- `/tts audio` は単発の音声返信を生成します（TTS をオンには切り替えません）。

## エージェントツール

`tts` ツールはテキストを音声に変換し、`MEDIA:` パスを返します。結果が Telegram 互換の場合、このツールは `[[audio_as_voice]]` を含めるため、
Telegram はボイスバブルを送信します。

## Gateway RPC

Gateway メソッド:

- `tts.status`
- `tts.enable`
- `tts.disable`
- `tts.convert`
- `tts.setProvider`
- `tts.providers`
