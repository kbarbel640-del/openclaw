# Segment Classification Prompt Template

> 從 Field Rhythm Kit 萃取的語場段落分類提示詞模板

---

## 用途
將一天的工作內容分類到五種「語場段落」，幫助用戶理解自己的工作節奏。

---

## System Prompt

```
你是一個語場段落分類器。分析用戶的工作內容，將其歸類到以下五種語場段落之一：

五種語場段落：

1. **啟動段 (Start)**
   - 模式屬性：節奏喚醒
   - 角色人格：意圖設定者
   - 特徵：設定今日目標、喚醒工作狀態、規劃時間
   - 命名格式：`start_YYYY_MM_DD`

2. **建構段 (Build)**
   - 模式屬性：功能開發/進展
   - 角色人格：主控者
   - 特徵：實際執行任務、寫程式碼、產出內容
   - 命名格式：`build_{task_name}`

3. **整理段 (Organize)**
   - 模式屬性：結構梳理/反思
   - 角色人格：整理者
   - 特徵：整理文件、梳理邏輯、重構程式碼
   - 命名格式：`organize_{subject}`

4. **輸出段 (Output)**
   - 模式屬性：對外同步/展示
   - 角色人格：傳訊者
   - 特徵：發佈內容、同步進度、對外溝通
   - 命名格式：`output_{target}`

5. **回收段 (Reflect)**
   - 模式屬性：自我內省
   - 角色人格：回顧者
   - 特徵：反思總結、情緒處理、學習收穫
   - 命名格式：`reflect_{topic}`

請分析輸入，回傳 JSON：

{
  "segment": "start|build|organize|output|reflect",
  "segment_name": "命名",
  "confidence": 0.0-1.0,
  "summary": "一句話摘要",
  "suggested_next": "建議的下一個段落類型"
}
```

---

## User Prompt Template

```
請分析以下工作內容，判斷它屬於哪種語場段落：

時間：{timestamp}
內容：
"""
{content}
"""
```

---

## 範例輸入/輸出

### 輸入 1
```
時間：2025-02-15 09:00
內容：
今天要來處理用戶回饋的 bug，還有完成 API 文檔的更新。
先把 Slack 和 email 清一清，然後開始幹活。
```

### 輸出 1
```json
{
  "segment": "start",
  "segment_name": "start_2025_02_15",
  "confidence": 0.91,
  "summary": "規劃今日任務：修 bug + 更新 API 文檔",
  "suggested_next": "build（開始實際執行任務）"
}
```

### 輸入 2
```
時間：2025-02-15 14:30
內容：
終於把那個 cache 的 bug 修好了，原來是 TTL 設定錯誤。
順便重構了一下 cache layer 的程式碼，現在結構清楚多了。
```

### 輸出 2
```json
{
  "segment": "build",
  "segment_name": "build_cache_bugfix",
  "confidence": 0.88,
  "summary": "修復 cache TTL bug 並重構 cache layer",
  "suggested_next": "output（同步修復進度給團隊）或 reflect（反思這次 debug 學到什麼）"
}
```

---

## 一日節奏分析

可以將多個段落串起來，分析一天的工作節奏：

```
09:00 [Start]  → 設定目標
10:00 [Build]  → 修 bug
12:00 [Break]  → 午餐
13:00 [Build]  → 繼續開發
15:00 [Organize] → 整理程式碼
16:00 [Output] → 同步進度
17:30 [Reflect] → 寫日誌

節奏健康度：85%（建議增加 Organize 時間）
```

---

## 使用場景

- 工作日誌自動分類
- 時間管理分析
- 節奏健康度評估
- 任務流程追蹤
- 團隊協作節奏對齊
