# 🪞 玄鑑 (Xuanjian) — 部署指南

## 概述

玄鑑是幣塔客服品控 AI，負責校準員工客服對話品質。

## 檔案結構

```
agents/xuanjian/
├── README.md        # 本文件（部署指南）
├── AGENT.md         # 身份、職責、群組對照
├── PROMPTS.md       # 三大角色完整 prompt（80/20/NB）
└── CALIBRATION.md   # 校準報告範例集（累積中）
```

## 部署方式

### 方式 1：Moltbot Spawned Agent
```bash
# 從無極 session 中 spawn
sessions_spawn(
  task="讀取 agents/xuanjian/AGENT.md 和 PROMPTS.md，然後監聽幣塔群組消息並產出校準報告",
  label="xuanjian"
)
```

### 方式 2：獨立 Moltbot Session
在 gateway config 中增加一個 session，指向玄鑑的 AGENT.md。

### 方式 3：外部 Agent（Claude Code / Codex）
使用 AGENT.md + PROMPTS.md 作為 system prompt，配合 telegram-userbot API 讀取消息。

## 依賴

- **telegram-userbot bridge**（port 18790）：讀取群組消息、下載截圖
- **Telegram Bot API**：發送校準報告到群組
- **Bot Token**：8327498414:AAFVEs7Ouf6JESIWGpLnD77GvJkxe9uXp68

## 工作流

```
員工貼截圖 + @x01clawbot 80
  ↓
讀取群組消息（telegram-userbot API）
  ↓
下載截圖（/download endpoint）
  ↓
Vision 分析截圖內容
  ↓
套用對應角色 prompt（80/20/NB）
  ↓
產出校準報告
  ↓
發送到對應群組（Bot API）
```

## 當前狀態

- ✅ Prompt 完整（三大角色 + 校準格式）
- ✅ 群組 ID 對照表
- ✅ 工作流文件化
- ⏳ 待：獨立 session 設定
- ⏳ 待：自動化觸發（不依賴 awareness loop）
