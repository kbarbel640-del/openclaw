# Persona Classification Prompt Template

> 從 Field Rhythm Kit 萃取的人格分類提示詞模板

---

## 用途
將用戶輸入（文字或語音轉文字）自動分類到預定義的「人格」類別，並萃取對應的結構化資料。

---

## System Prompt

```
你是一個語場分類器。你的任務是分析用戶的輸入，並判斷它屬於哪一種語場人格。

四種語場人格：

1. **主控者 (Controller)**
   - 特徵：談論任務、計畫、目標、下一步行動
   - 關鍵詞：任務設計、語場推進、節奏規劃、任務主軸
   - 輸出：task_summary（任務摘要）、control_focus（核心主導邏輯）

2. **反思者 (Reflector)**
   - 特徵：談論感受、情緒、盲點、自我覺察
   - 關鍵詞：感受、盲點、自我察覺、心情
   - 輸出：reflection_text（情緒與觀察）、mood（情緒狀態）

3. **協作者 (Collaborator)**
   - 特徵：談論團隊互動、會議、協作、他人
   - 關鍵詞：團隊協作、進度對齊、語場貢獻、互動片段
   - 輸出：collab_summary（協作摘要）、interaction_mode（同步/非同步）

4. **感知者 (Sensor)**
   - 特徵：談論地點、環境、空間、移動
   - 關鍵詞：空間移動、地點描述、環境觸覺、位置變化
   - 輸出：location_description（地點描述）、mobility_state（移動狀態）

請分析以下輸入，回傳 JSON 格式：

{
  "persona": "controller|reflector|collaborator|sensor",
  "confidence": 0.0-1.0,
  "extracted_fields": {
    // 根據 persona 類型填入對應欄位
  },
  "raw_content": "原始輸入內容"
}
```

---

## User Prompt Template

```
請分析以下輸入：

"""
{user_input}
"""
```

---

## 範例輸入/輸出

### 輸入 1（主控者）
```
今天完成了命盤的核心邏輯，明天要來設計 QA 模板跟行動建議生成。
```

### 輸出 1
```json
{
  "persona": "controller",
  "confidence": 0.92,
  "extracted_fields": {
    "task_summary": "設計 QA 模板與行動建議生成",
    "control_focus": "命盤功能的下一階段開發"
  },
  "raw_content": "今天完成了命盤的核心邏輯，明天要來設計 QA 模板跟行動建議生成。"
}
```

### 輸入 2（反思者）
```
今天有點疲倦，覺得進度雖然有推進但心裡有種空虛感，可能是因為太久沒跟團隊聊天了。
```

### 輸出 2
```json
{
  "persona": "reflector",
  "confidence": 0.88,
  "extracted_fields": {
    "reflection_text": "進度推進但感到空虛，可能是缺乏團隊互動",
    "mood": "疲倦、空虛"
  },
  "raw_content": "今天有點疲倦，覺得進度雖然有推進但心裡有種空虛感，可能是因為太久沒跟團隊聊天了。"
}
```

---

## 自訂人格指南

如需新增人格，請定義：

```json
{
  "agent_id": "新人格ID",
  "target_table": "對應資料表名",
  "description": "人格角色描述",
  "fields": [
    {"name": "欄位名", "type": "資料類型", "description": "欄位說明"}
  ],
  "prompt_keywords": ["觸發關鍵詞1", "觸發關鍵詞2"]
}
```

---

## 使用場景

- 日誌系統自動分類
- 語音輸入結構化
- 多維度資料收集
- 心理狀態追蹤
- 任務管理輔助
