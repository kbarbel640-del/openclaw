# Video Processor Hook

自動處理超過 5MB 的影片，繞過 Moltbot 的文件大小限制。

## 流程

1. 檢測 Telegram 影片附件
2. 超過 5MB → 用 userbot API 下載
3. ffmpeg 提取關鍵幀（每 2 秒一張）
4. 注入處理結果到 event context
5. Moltbot 收到的是處理過的 metadata，不是原始影片

## 依賴

- `exec-bridge` (port 18793) - 執行 ffmpeg
- `telegram-userbot` (port 18790) - 下載影片
- `ffmpeg` + `ffprobe` - 宿主機需安裝

## Events

- `message.inbound` - 收到訊息時觸發（priority: 100，早於其他 hook）

## 注入欄位

```javascript
event.payload.videoProcessed = {
  originalPath: '/path/to/video.mp4',
  duration: '10.0',
  resolution: '704x1280',
  frameCount: 5,
  framesDir: '/Users/sulaxd/clawd/output/video_*.jpg',
  metadata: { sizeMB: '7.30', processedAt: '...' }
};

event.payload.mediaHint = '[影片已處理: 10秒, 704x1280, 5張關鍵幀已提取到 output/]';
```

## 使用方式

Agent 收到 `mediaHint` 後，可以用 `read` 工具讀取 `output/` 下的關鍵幀進行分析。

## Config

```yaml
hooks:
  video-processor:
    enabled: true
```

## 限制

- 只處理 Telegram 頻道
- 需要 userbot bridge 運行中
- 需要 exec-bridge 運行中
