# 🎙️ ThinkerCafe Podcast — 一魚多吃計劃

> 語音錄音 → 多平台內容產線

## 🎯 目標
把杜甫的隨口錄音變成多種內容形式，最大化每段素材的價值。

---

## 📊 產線架構

```
語音錄音（Telegram/手機）
    │
    ▼
① 轉文字（Whisper API）
    │
    ├──▶ ② 文字產線
    │       ├─ 逐字稿整理 → Blog/文章
    │       ├─ 金句提取 → Threads/社群貼文
    │       └─ 摘要 → Newsletter
    │
    └──▶ ③ 音頻產線
            ├─ 切片段（按主題分段）
            ├─ 修音（降噪、音量正規化）
            ├─ 加開場/結尾/配樂
            └─ 合成 → Podcast 上架
```

---

## 🔧 技術能力盤點

| 步驟 | 工具 | 狀態 |
|------|------|------|
| 語音轉文字 | OpenAI Whisper API | ✅ 可用 |
| 文字整理/摘要 | Claude | ✅ 可用 |
| 金句提取 | Claude | ✅ 可用 |
| 音頻切割 | ffmpeg | ✅ 可用 |
| 降噪 | ffmpeg (highpass/lowpass) | ⚠️ 基礎可用 |
| 音量正規化 | ffmpeg (loudnorm) | ✅ 可用 |
| 加配樂/開場 | ffmpeg (amerge/overlay) | ✅ 可用 |
| Podcast 上架 | Spotify/Apple API 或手動 | 📋 待研究 |
| Threads 發文 | 手動（無 API）| ⚠️ 需瀏覽器自動化 |

---

## 📦 素材管理

### 目錄結構
```
~/clawd/podcast/
├── raw/              # 原始錄音
├── transcripts/      # 逐字稿
├── segments/         # 切割後的片段
├── processed/        # 修音後的音頻
├── episodes/         # 合成的完整集數
├── text/             # 文字內容（文章/貼文）
└── metadata.json     # 素材索引
```

### metadata.json 格式
```json
{
  "recordings": [
    {
      "id": "rec_20260201_001",
      "source": "telegram_voice",
      "date": "2026-02-01",
      "duration_sec": 89,
      "raw_path": "raw/voice_2026-02-01_06-12-00.ogg",
      "transcript_path": "transcripts/rec_20260201_001.txt",
      "topics": ["思考者咖啡開場", "與神對話", "一魚多吃概念"],
      "status": "transcribed",
      "outputs": []
    }
  ]
}
```

---

## 🔄 跟進機制

### 1. 自動觸發
- **語音進來** → 自動轉文字 → 存入 `podcast/raw/` + `podcast/transcripts/`
- **每週一心跳** → 檢查未處理的素材，提醒杜甫

### 2. HEARTBEAT 整合
在 HEARTBEAT.md 加入：
```
### Podcast 素材檢查（每週一次）
- 檢查 podcast/raw/ 有無新素材未處理
- 統計：累積幾段、總時長、已產出什麼
- 提醒杜甫下一步
```

### 3. 指令觸發
| 指令 | 功能 |
|------|------|
| `/podcast status` | 素材統計：幾段、總時長、待處理 |
| `/podcast process <id>` | 處理指定錄音（轉文字+整理+切段）|
| `/podcast compile` | 把選定片段合成一集 |

### 4. 專案追蹤
加入 PROJECT_REGISTRY.md，每次心跳輪值時可推進。

---

## 📅 階段規劃

### Phase 1：素材收集 + 自動轉文字（本週）
- [x] Whisper API 轉文字驗證
- [ ] 建立 `podcast/` 目錄結構
- [ ] 第一段素材歸檔（剛才的語音）
- [ ] 把之前錄的幾集開場找回來（問杜甫在哪）
- [ ] HEARTBEAT.md 加入 podcast 檢查

### Phase 2：文字產線（下週）
- [ ] 逐字稿 → 文章整理模板
- [ ] 金句提取 → Threads 發文格式
- [ ] 測試一輪完整流程

### Phase 3：音頻產線（第三週）
- [ ] 設計開場/結尾模板音效
- [ ] ffmpeg 音頻處理 pipeline
- [ ] 合成第一集測試版

### Phase 4：上架 + 自動化（第四週）
- [ ] 選定 Podcast 平台（Spotify for Podcasters / Apple）
- [ ] 上架流程自動化
- [ ] 端到端測試

---

## 💡 杜甫的原始想法（2026-02-01 語音）

> 「思考者咖啡，這裡是跟你聊聊心靈，但更多的是 AI 的心靈咖啡館。」
>
> 錄音可以一魚多吃：轉文字 → 剪片段 → 修聲音 → 重組成 Podcast → 上架 → 經營
>
> 這些都要納入自媒體相關目標。

---

*Last updated: 2026-02-01*
