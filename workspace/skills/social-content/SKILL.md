# Social Content Skill

跨平台內容發布與追蹤系統。

## 平台清單

| 平台 | 帳號 | 內容類型 | 自動化狀態 |
|------|------|----------|------------|
| Threads | @tangcruzz | 短文 | ✅ 瀏覽器 |
| Facebook | ? | 貼文/限動 | 🔄 待設定 |
| LinkedIn | ? | 專業文章 | 🔄 待設定 |
| Instagram | ? | 貼文/限動/Reels | 🔄 待設定 |

## 內容矩陣 DB

### 命名規則

```
content/
├── YYYY-MM/                    # 按月份
│   ├── MMDD-HH-[slug].md      # 按日期+代號
│   └── ...
└── content-log.md              # 發布總表
```

**slug 命名**：
- 用內容關鍵字，不是流水號
- 例：`0127-23-clawdbot-risk.md`
- 例：`0127-22-line-clawdbot-howto.md`

### 單篇內容格式

```markdown
# [標題]

**發布時間**：YYYY-MM-DD HH:MM
**平台**：Threads / FB / LinkedIn / IG
**類型**：觀點 / 教學 / 日常 / 靈靈柒

---

[內容本文]

---

## 發布紀錄

| 平台 | 時間 | 連結 | 數據 |
|------|------|------|------|
| Threads | 23:56 | [link] | 1 回覆 |
| FB | - | - | - |

## 備註
- 靈感來源：
- 標籤：
- 改進：
```

### 總表 (content-log.md)

```markdown
| 日期 | slug | 標題 | Threads | FB | LinkedIn | IG |
|------|------|------|---------|----|---------|----|
| 01-27 | clawdbot-risk | Clawdbot 風險 | ✅ | - | - | - |
| 01-27 | line-howto | LINE 串接 | ✅ | - | - | - |
```

## 平台差異

| 平台 | 長度 | 格式 | 最佳時間 |
|------|------|------|----------|
| Threads | <300字 | 短句分行 | 晚上 |
| Facebook | 彈性 | 可長可短 | ? |
| LinkedIn | 專業 | 段落式 | 工作日 |
| IG 貼文 | 圖+文 | 視覺優先 | ? |
| IG 限動 | 15秒 | 即時感 | 隨時 |

## 內容複用流程

```
原始內容
    ↓
調整格式 → Threads（短句）
    ↓
調整格式 → FB（可加長）
    ↓
調整格式 → LinkedIn（專業化）
    ↓
配圖 → IG
```

## 自動化狀態

### Threads ✅
- 瀏覽器自動化（clawd profile）
- 已登入 @tangcruzz

### Facebook 🔄
- 需要：登入狀態保存
- 方式：瀏覽器自動化 / Meta API？

### LinkedIn 🔄
- 需要：登入狀態保存
- 方式：瀏覽器自動化

### Instagram 🔄
- 需要：登入狀態保存
- 方式：瀏覽器自動化 / Meta API？
- 限動需要特殊處理

## 下一步

1. [ ] 確認各平台帳號
2. [ ] 手動登入保存狀態
3. [ ] 測試發布流程
4. [ ] 建立內容目錄結構
