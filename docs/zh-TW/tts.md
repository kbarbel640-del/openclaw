---
summary: 「用於外送回覆的文字轉語音（TTS）」
read_when:
  - 啟用回覆的文字轉語音
  - 設定 TTS 提供者或限制
  - 使用 /tts 指令
title: 「文字轉語音」
x-i18n:
  source_path: tts.md
  source_hash: 070ff0cc8592f64c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:21Z
---

# 文字轉語音（TTS）

OpenClaw 可以使用 ElevenLabs、OpenAI 或 Edge TTS，將外送回覆轉換為音訊。
凡是 OpenClaw 能傳送音訊的地方都可使用；在 Telegram 會顯示為圓形的語音訊息泡泡。

## 支援的服務

- **ElevenLabs**（主要或備援提供者）
- **OpenAI**（主要或備援提供者；也用於摘要）
- **Edge TTS**（主要或備援提供者；使用 `node-edge-tts`，在沒有 API 金鑰時為預設）

### Edge TTS 說明

Edge TTS 透過 `node-edge-tts` 函式庫使用 Microsoft Edge 的線上神經 TTS 服務。這是一項託管服務（非本機），使用 Microsoft 的端點，且不需要 API 金鑰。`node-edge-tts` 提供語音設定選項與輸出格式，但並非所有選項都受 Edge 服務支援。 citeturn2search0

由於 Edge TTS 是沒有公開 SLA 或配額的公共網路服務，請將其視為盡力而為。若需要保證的限制與支援，請使用 OpenAI 或 ElevenLabs。Microsoft 的 Speech REST API 文件指出每次請求的音訊上限為 10 分鐘；Edge TTS 未公布限制，請假設為相同或更低。 citeturn0search3

## 選用金鑰

如果要使用 OpenAI 或 ElevenLabs：

- `ELEVENLABS_API_KEY`（或 `XI_API_KEY`）
- `OPENAI_API_KEY`

Edge TTS **不**需要 API 金鑰。若找不到任何 API 金鑰，OpenClaw 會預設使用 Edge TTS（除非透過 `messages.tts.edge.enabled=false` 停用）。

若設定了多個提供者，會先使用所選提供者，其餘作為備援。
自動摘要會使用已設定的 `summaryModel`（或 `agents.defaults.model.primary`），因此若啟用摘要，該提供者也必須完成驗證。

## 服務連結

- [OpenAI Text-to-Speech 指南](https://platform.openai.com/docs/guides/text-to-speech)
- [OpenAI Audio API 參考](https://platform.openai.com/docs/api-reference/audio)
- [ElevenLabs 文字轉語音](https://elevenlabs.io/docs/api-reference/text-to-speech)
- [ElevenLabs 驗證](https://elevenlabs.io/docs/api-reference/authentication)
- [node-edge-tts](https://github.com/SchneeHertz/node-edge-tts)
- [Microsoft Speech 輸出格式](https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech#audio-outputs)

## 預設是否啟用？

否。自動 TTS 預設為 **關閉**。請在設定中使用 `messages.tts.auto` 啟用，或在每個工作階段使用 `/tts always`（別名：`/tts on`）。

一旦啟用 TTS，Edge TTS **預設即為啟用**，且在沒有 OpenAI 或 ElevenLabs API 金鑰時會自動使用。

## 設定

TTS 設定位於 `openclaw.json` 中的 `messages.tts`。
完整結構請見 [Gateway configuration](/gateway/configuration)。

### 最小設定（啟用 + 提供者）

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

### OpenAI 為主要、ElevenLabs 為備援

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

### Edge TTS 為主要（無 API 金鑰）

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

### 停用 Edge TTS

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

### 自訂限制 + 偏好設定路徑

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

### 僅在收到語音訊息後才以音訊回覆

```json5
{
  messages: {
    tts: {
      auto: "inbound",
    },
  },
}
```

### 停用長回覆的自動摘要

```json5
{
  messages: {
    tts: {
      auto: "always",
    },
  },
}
```

接著執行：

```
/tts summary off
```

### 欄位說明

- `auto`：自動 TTS 模式（`off`、`always`、`inbound`、`tagged`）。
  - `inbound` 僅在收到語音訊息後才傳送音訊。
  - `tagged` 僅在回覆包含 `[[tts]]` 標籤時才傳送音訊。
- `enabled`：舊版開關（doctor 會將其遷移至 `auto`）。
- `mode`：`"final"`（預設）或 `"all"`（包含工具／區塊回覆）。
- `provider`：`"elevenlabs"`、`"openai"` 或 `"edge"`（自動備援）。
- 若 `provider` **未設定**，OpenClaw 會優先選擇 `openai`（若有金鑰），其次 `elevenlabs`（若有金鑰），否則使用 `edge`。
- `summaryModel`：自動摘要的可選低成本模型；預設為 `agents.defaults.model.primary`。
  - 接受 `provider/model` 或已設定的模型別名。
- `modelOverrides`：允許模型輸出 TTS 指令（預設開啟）。
- `maxTextLength`：TTS 輸入的硬上限（字元）。超過時 `/tts audio` 會失敗。
- `timeoutMs`：請求逾時（毫秒）。
- `prefsPath`：覆寫本機偏好設定 JSON 路徑（提供者／限制／摘要）。
- `apiKey` 的值會回退到環境變數（`ELEVENLABS_API_KEY`/`XI_API_KEY`、`OPENAI_API_KEY`）。
- `elevenlabs.baseUrl`：覆寫 ElevenLabs API 基底 URL。
- `elevenlabs.voiceSettings`：
  - `stability`、`similarityBoost`、`style`：`0..1`
  - `useSpeakerBoost`：`true|false`
  - `speed`：`0.5..2.0`（1.0 = 正常）
- `elevenlabs.applyTextNormalization`：`auto|on|off`
- `elevenlabs.languageCode`：2 位字母 ISO 639-1（例如 `en`、`de`）
- `elevenlabs.seed`：整數 `0..4294967295`（盡力而為的決定性）
- `edge.enabled`：允許使用 Edge TTS（預設 `true`；無 API 金鑰）。
- `edge.voice`：Edge 神經語音名稱（例如 `en-US-MichelleNeural`）。
- `edge.lang`：語言代碼（例如 `en-US`）。
- `edge.outputFormat`：Edge 輸出格式（例如 `audio-24khz-48kbitrate-mono-mp3`）。
  - 有效值請見 Microsoft Speech 輸出格式；並非所有格式都受 Edge 支援。
- `edge.rate` / `edge.pitch` / `edge.volume`：百分比字串（例如 `+10%`、`-5%`）。
- `edge.saveSubtitles`：在音訊檔旁寫入 JSON 字幕。
- `edge.proxy`：Edge TTS 請求的 Proxy URL。
- `edge.timeoutMs`：請求逾時覆寫（毫秒）。

## 模型驅動的覆寫（預設開啟）

預設情況下，模型 **可以** 為單一回覆輸出 TTS 指令。
當 `messages.tts.auto` 為 `tagged` 時，必須有這些指令才會觸發音訊。

啟用後，模型可輸出 `[[tts:...]]` 指令來覆寫單一回覆的語音，
並可選擇加入 `[[tts:text]]...[[/tts:text]]` 區塊，提供僅應出現在音訊中的表現標籤（如笑聲、歌唱提示等）。

回覆負載範例：

```
Here you go.

[[tts:provider=elevenlabs voiceId=pMsXgVXv3BLzUgSXRplE model=eleven_v3 speed=1.1]]
[[tts:text]](laughs) Read the song once more.[[/tts:text]]
```

可用的指令鍵（啟用時）：

- `provider`（`openai` | `elevenlabs` | `edge`）
- `voice`（OpenAI 語音）或 `voiceId`（ElevenLabs）
- `model`（OpenAI TTS 模型或 ElevenLabs 模型 id）
- `stability`、`similarityBoost`、`style`、`speed`、`useSpeakerBoost`
- `applyTextNormalization`（`auto|on|off`）
- `languageCode`（ISO 639-1）
- `seed`

停用所有模型覆寫：

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

選用允許清單（在保留標籤啟用的同時停用特定覆寫）：

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

## 每位使用者的偏好設定

斜線指令會將本機覆寫寫入 `prefsPath`（預設：
`~/.openclaw/settings/tts.json`，可用 `OPENCLAW_TTS_PREFS` 或
`messages.tts.prefsPath` 覆寫）。

儲存的欄位：

- `enabled`
- `provider`
- `maxLength`（摘要門檻；預設 1500 字元）
- `summarize`（預設 `true`）

這些會覆寫該主機的 `messages.tts.*`。

## 輸出格式（固定）

- **Telegram**：Opus 語音訊息（來自 ElevenLabs 的 `opus_48000_64`，來自 OpenAI 的 `opus`）。
  - 48kHz / 64kbps 是良好的語音訊息折衷，且為圓形泡泡所需。
- **其他頻道**：MP3（來自 ElevenLabs 的 `mp3_44100_128`，來自 OpenAI 的 `mp3`）。
  - 44.1kHz / 128kbps 是語音清晰度的預設平衡。
- **Edge TTS**：使用 `edge.outputFormat`（預設 `audio-24khz-48kbitrate-mono-mp3`）。
  - `node-edge-tts` 接受 `outputFormat`，但 Edge 服務並非提供所有格式。 citeturn2search0
  - 輸出格式值遵循 Microsoft Speech 輸出格式（包含 Ogg/WebM Opus）。 citeturn1search0
  - Telegram `sendVoice` 接受 OGG/MP3/M4A；若需要保證的 Opus 語音訊息，請使用 OpenAI／ElevenLabs。 citeturn1search1
  - 若設定的 Edge 輸出格式失敗，OpenClaw 會改以 MP3 重試。

OpenAI／ElevenLabs 的格式為固定；Telegram 為語音訊息體驗預期 Opus。

## 自動 TTS 行為

啟用後，OpenClaw 會：

- 若回覆已包含媒體或 `MEDIA:` 指令，則略過 TTS。
- 略過非常短的回覆（< 10 字元）。
- 在啟用時，使用 `agents.defaults.model.primary`（或 `summaryModel`）對長回覆進行摘要。
- 將產生的音訊附加到回覆中。

若回覆超過 `maxLength` 且摘要關閉（或摘要模型沒有 API 金鑰），
則會略過音訊並傳送一般文字回覆。

## 流程圖

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

## 斜線指令用法

只有一個指令：`/tts`。
啟用細節請見 [Slash commands](/tools/slash-commands)。

Discord 注意事項：`/tts` 是 Discord 內建指令，因此 OpenClaw 會在該處註冊
`/voice` 作為原生命令。文字 `/tts ...` 仍可使用。

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

備註：

- 指令需要已授權的傳送者（仍適用允許清單／擁有者規則）。
- 必須啟用 `commands.text` 或原生命令註冊。
- `off|always|inbound|tagged` 為每個工作階段的切換（`/tts on` 是 `/tts always` 的別名）。
- `limit` 與 `summary` 會儲存在本機偏好設定，而非主要設定。
- `/tts audio` 會產生一次性的音訊回覆（不會切換 TTS 開啟）。

## 代理程式工具

`tts` 工具會將文字轉為語音，並回傳 `MEDIA:` 路徑。當結果相容於 Telegram 時，工具會包含 `[[audio_as_voice]]`，以便 Telegram 傳送語音泡泡。

## Gateway RPC

Gateway 方法：

- `tts.status`
- `tts.enable`
- `tts.disable`
- `tts.convert`
- `tts.setProvider`
- `tts.providers`
