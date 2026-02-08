---
summary: "Talk モード： ElevenLabs TTS を用いた連続音声会話"
read_when:
  - macOS / iOS / Android で Talk モードを実装する場合
  - 音声 / TTS / 割り込み動作を変更する場合
title: "Talk モード"
x-i18n:
  source_path: nodes/talk.md
  source_hash: ecbc3701c9e95029
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:15Z
---

# Talk モード

Talk モードは、連続した音声会話ループです。

1. 音声をリッスン
2. 文字起こしをモデルに送信（メインセッション、 chat.send）
3. 応答を待機
4. ElevenLabs 経由で発話（ストリーミング再生）

## 挙動（macOS）

- Talk モードが有効な間は **常時表示オーバーレイ**。
- **Listening → Thinking → Speaking** のフェーズ遷移。
- **短いポーズ**（無音ウィンドウ）で、現在の文字起こしが送信されます。
- 返信は **WebChat に書き込まれます**（入力時と同じ）。
- **発話による割り込み**（デフォルトでオン）：アシスタントが話している最中にユーザーが話し始めた場合、再生を停止し、次のプロンプト用に割り込みタイムスタンプを記録します。

## 返信内の音声ディレクティブ

アシスタントは、音声を制御するために **単一の JSON 行** を返信の先頭に付与できます。

```json
{ "voice": "<voice-id>", "once": true }
```

ルール：

- 最初の空でない行のみが対象です。
- 不明なキーは無視されます。
- `once: true` は現在の返信にのみ適用されます。
- `once` がない場合、音声は Talk モードの新しいデフォルトになります。
- JSON 行は TTS 再生前に削除されます。

サポートされるキー：

- `voice` / `voice_id` / `voiceId`
- `model` / `model_id` / `modelId`
- `speed`, `rate`（WPM）, `stability`, `similarity`, `style`, `speakerBoost`
- `seed`, `normalize`, `lang`, `output_format`, `latency_tier`
- `once`

## 設定（`~/.openclaw/openclaw.json`）

```json5
{
  talk: {
    voiceId: "elevenlabs_voice_id",
    modelId: "eleven_v3",
    outputFormat: "mp3_44100_128",
    apiKey: "elevenlabs_api_key",
    interruptOnSpeech: true,
  },
}
```

デフォルト：

- `interruptOnSpeech`: true
- `voiceId`: `ELEVENLABS_VOICE_ID` / `SAG_VOICE_ID` にフォールバック（API キーが利用可能な場合は最初の ElevenLabs 音声）
- `modelId`: 未設定時は `eleven_v3` がデフォルト
- `apiKey`: `ELEVENLABS_API_KEY` にフォールバック（利用可能な場合は Gateway（ゲートウェイ）シェルプロファイル）
- `outputFormat`: macOS / iOS では `pcm_44100`、 Android では `pcm_24000` がデフォルト（MP3 ストリーミングを強制するには `mp3_*` を設定）

## macOS UI

- メニューバー切り替え： **Talk**
- 設定タブ： **Talk モード** グループ（音声 ID + 割り込みトグル）
- オーバーレイ：
  - **Listening**：マイクレベルに応じてクラウドがパルス表示
  - **Thinking**：沈み込むアニメーション
  - **Speaking**：放射状のリング
  - クラウドをクリック：発話を停止
  - X をクリック： Talk モードを終了

## 注記

- 音声およびマイクの権限が必要です。
- セッションキー `main` に対して `chat.send` を使用します。
- TTS は ElevenLabs のストリーミング API を `ELEVENLABS_API_KEY` とともに使用し、 macOS / iOS / Android では低レイテンシのためにインクリメンタル再生を行います。
- `eleven_v3` 用の `stability` は `0.0`、 `0.5`、または `1.0` に検証されます。その他のモデルは `0..1` を受け付けます。
- `latency_tier` は、設定時に `0..4` に検証されます。
- Android は、低レイテンシ AudioTrack ストリーミングのために `pcm_16000`、 `pcm_22050`、 `pcm_24000`、および `pcm_44100` の出力形式をサポートします。
