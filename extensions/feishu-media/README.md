# @openclaw/feishu-media

Feishu 音频语音识别 (STT) 和媒体载荷工具插件。

## Features

| Feature | Description |
|---------|-------------|
| **Feishu native STT** | 使用飞书原生 `speech_to_text` API 将语音消息转为文字。自动管理 tenant access token 缓存和速率限制重试。 |
| **Whisper STT** | 通过远程 HTTP 服务或本地 CLI 调用 OpenAI Whisper 进行语音识别，作为飞书 STT 的备选方案。 |
| **Media payload** | `buildFeishuMediaPayload()` — 构建飞书频道消息的媒体载荷，支持 `Transcript` 字段。 |
| **Media debug** | `createMediaDebugLogger()` — 媒体理解管道调试日志工具。 |

## Configuration

```jsonc
// openclaw.plugin.json configSchema fields
{
  "sttEnabled": true,        // 启用音频 STT
  "sttProvider": "auto",     // "feishu" | "whisper" | "auto"
  "whisperUrl": "",          // Whisper HTTP 服务 URL（可选）
  "whisperScript": "",       // 本地 whisper_stt.py 路径（可选）
  "sttTimeoutMs": 30000      // STT HTTP 请求超时（毫秒）
}
```

## Exported API

### feishu-stt

| Export | Description |
|--------|-------------|
| `resolveFeishuApiBase(domain?)` | 解析飞书/Lark API 基础 URL |
| `getFeishuTenantAccessToken(params)` | 获取（或刷新）tenant access token |
| `recognizeAudioWithFeishuStt(params)` | 飞书原生语音识别，失败时静默降级返回 `undefined` |

### whisper-stt

| Export | Description |
|--------|-------------|
| `recognizeAudioWithWhisper(opts)` | Whisper STT（远程 HTTP 或本地 CLI），失败时静默降级 |

### media-payload

| Export | Description |
|--------|-------------|
| `FeishuMediaInfoExt` | 带 `transcript` 可选字段的媒体信息类型 |
| `FeishuMediaPayload` | 媒体载荷类型（含 `Transcript`） |
| `buildFeishuMediaPayload(mediaList)` | 构建飞书媒体载荷 |

### media-debug

| Export | Description |
|--------|-------------|
| `MediaDebugLogger` | 调试日志器类型 |
| `createMediaDebugLogger(prefix?)` | 创建媒体理解调试日志器 |

## Development

```bash
cd extensions/feishu-media
npm install
npm test
```
