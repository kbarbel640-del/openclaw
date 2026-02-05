# Threads 短影片生成 Skill

## 概述
全自動生成 Threads/Reels/Shorts 短影片，從一句話到成品。

## 使用方式

**輸入**：一句話或一段文字
**輸出**：9:16 豎版短影片（mp4）

```
用戶：「聖誕節一個人過也沒缺什麼，那不是寂寞，是自由」
→ 我自動：重寫 hook → TTS → 音頻處理 → 視覺生成 → BGM 混音 → 輸出
```

## 流水線步驟

### 1. 內容重寫
- 分析原文，提取核心觀點
- 重寫成爆款結構：`對立/懸念 → 轉折 → 金句 → (CTA)`
- 控制在 5-7 句，總長 10-15 秒

### 2. TTS 生成
- 使用 OpenAI TTS（Nova 聲音）
- 加自然停頓（句號後長停頓，逗號後短停頓）

### 3. 音頻後處理
```bash
ffmpeg -i voice.mp3 -af "aecho=0.8:0.7:40:0.3,loudnorm=I=-16:TP=-1.5:LRA=11" voice_processed.mp3
```

### 4. BGM 混音
- 使用 Pixabay 免費 lo-fi 音樂
- BGM 音量 15%，人聲 100%
```bash
ffmpeg -i voice.mp3 -i bgm.mp3 -filter_complex "[1:a]volume=0.15[bgm];[0:a][bgm]amix=inputs=2:duration=first" mixed.mp3
```

### 5. 視覺生成
- ImageMagick 生成字幕圖片
- ffmpeg zoompan 做緩慢縮放動畫
- 淡入淡出效果

### 6. 合成輸出
- 1080x1920（9:16）
- H.264 + AAC
- 目標大小 < 5MB

## 檔案結構

```
skills/threads-video/
├── SKILL.md           # 本文件
├── generate.sh        # 主生成腳本
├── assets/
│   └── bgm.mp3        # 預設 BGM
└── output/            # 輸出目錄
```

## 品質標準（V3 基準）

| 項目 | 標準 |
|------|------|
| Hook | 必須有對立或懸念 |
| 節奏 | 自然停頓，重點句放慢 |
| 視覺 | 緩慢 zoom + 淡入淡出 |
| 音頻 | 人聲處理 + BGM |
| 時長 | 10-15 秒 |

## 待優化（Week 2-4）

- [ ] 文字動畫（打字機效果）
- [ ] 背景質感（漸變/粒子）
- [ ] ElevenLabs 聲音克隆
- [ ] 關鍵詞高亮
- [ ] CTA 結尾
- [ ] 跨平台自動發布

## 版本歷史

- V1 (2026-02-03): 基礎版，30分 → 技術驗證
- V2 (2026-02-03): 加淡入淡出、重點放大，50分
- V3 (2026-02-03): 加 hook、音頻處理、BGM、zoom 動畫，70分
