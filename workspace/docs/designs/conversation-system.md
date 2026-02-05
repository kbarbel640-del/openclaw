# Conversation System Design (萃取自 conversation + kiro_sentry)

**來源專案**：`~/Documents/conversation/`, `~/Documents/kiro_sentry/`
**萃取日期**：2025-02-04
**專案關係**：kiro_sentry 是 conversation 的早期 fork（單一檔案版本）

---

## 1. 系統概覽

### 核心功能
一個基於 LINE Bot 的頻率共振對話系統，整合：
- **頻率廣播**：每小時生成 AI 廣播，將匿名訊息編織成詩意內容
- **集體記憶**：Neo4j 知識圖譜儲存訊息關聯
- **意圖分析**：NLP 理解用戶口語表達
- **靈魂配對**：AI 引導的約會配對系統

### 技術架構
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   LINE App  │────▶│  Cloud Run   │────▶│  Firestore  │
└─────────────┘     │   (Flask)    │     └─────────────┘
                    └──────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │    Neo4j    │ │    Redis    │ │  Gemini AI  │
    │ (知識圖譜)  │ │   (快取)    │ │  (生成)     │
    └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 2. 意圖分析設計 (intent_analyzer.py)

### 架構
```python
class IntentAnalyzer:
    def __init__(self, graph: KnowledgeGraph):
        self.graph = graph
        self.embedder = SentenceTransformer(...)  # 可選
        
        # 功能關鍵詞映射
        self.feature_keywords = {
            "接龍": ["接龍", "文字接龍", "玩接龍", ...],
            "投票": ["投票", "表決", "選擇", ...],
            "統計": ["統計", "查看統計", "數據", ...],
            # ...
        }
        
        # 意圖模式
        self.intent_patterns = {
            "查詢": ["查看", "查詢", "顯示", ...],
            "開始": ["開始", "啟動", "發起", "玩", ...],
            "參與": ["參加", "加入", "一起", ...],
            # ...
        }
```

### 分析流程
1. **文本預處理** → 移除空白、特殊符號
2. **語義嵌入** → SentenceTransformer 或簡單 hash
3. **關鍵詞提取** → jieba 分詞
4. **規則匹配（快速路徑）** → 直接匹配功能關鍵詞
5. **圖查詢** → 找相似歷史意圖
6. **用戶偏好** → 個人化調整
7. **綜合判斷** → 輸出意圖 + 信心度

### 輸出格式
```python
{
    "intent": "use_feature",
    "feature": "接龍",
    "confidence": 0.95,
    "entities": ["詞語"],
    "embedding": [...]
}
```

### 可重用價值 ⭐⭐⭐⭐
- 關鍵詞映射模式適用於任何中文 Bot
- 分層分析（規則優先 → ML 補充）是好設計

---

## 3. 知識圖譜設計 (knowledge_graph.py)

### Neo4j Schema
```cypher
// 節點類型
(:User {id, name, joined_at, message_count, last_active})
(:Message {id, content, timestamp, embedding})
(:Feature {name, category, usage_count})
(:Topic {name, frequency})
(:Vote {id})
(:Joke {id})

// 關係類型
(:User)-[:SENT {time}]->(:Message)
(:Message)-[:TRIGGERS]->(:Feature)
(:Message)-[:ABOUT]->(:Topic)
(:Message)-[:FOLLOWS]->(:Message)  // 訊息序列
```

### 核心操作
```python
class KnowledgeGraph:
    def add_user(self, user_id, name) -> Dict
    def add_message(self, message_id, content, user_id, embedding) -> Dict
    def link_message_to_feature(self, message_id, feature_name)
    def add_topic(self, message_id, topics: List[str])
    def get_conversation_context(self, user_id, limit) -> List
    def find_similar_intents(self, user_id, embedding) -> List
    def get_user_preferences(self, user_id) -> Dict
```

### 可重用價值 ⭐⭐⭐
- Neo4j 連接管理模式可抽取
- Schema 設計適用於對話追蹤場景

---

## 4. 集體記憶設計 (collective_memory.py)

### 核心概念
將個人訊息融合成「集體意識」，生成詩意的廣播內容。

### 情緒分析
```python
emotion_keywords = {
    "positive": ["開心", "快樂", "哈哈", "讚", "😊", "❤️"],
    "negative": ["難過", "生氣", "煩", "累", "😢"],
    "excited": ["興奮", "期待", "哇", "🎉", "🔥"],
    "calm": ["安靜", "平靜", "還好", "普通"],
    "curious": ["為什麼", "怎麼", "如何", "🤔"],
    "tired": ["累", "睏", "疲憊", "想睡", "😴"]
}
```

### 廣播生成 Prompt 結構
```
1. 角色設定 - 頻率電台 AI 主持人
2. 小時數據 - 訊息總數、活躍人數、能量等級
3. 訊息片段 - 按時間順序（限50則）
4. 個人記憶檔案 - 活躍用戶的歷史
5. 情緒地圖 - 主導情緒、分佈、轉折點
6. 話題網絡 - 熱門話題、關聯、新興話題
7. 記憶觸發詞 - 需巧妙回應的個人記憶點
8. 生成規則 - 開場/個人化/集體共鳴/記憶回響的比例
```

### 可重用價值 ⭐⭐⭐⭐
- 情緒詞典可複用於任何中文情感分析
- Prompt 結構設計適用於「群體→內容」生成場景

---

## 5. 頻率廣播設計 (frequency_bot)

### kiro_sentry 版本（簡化版）
單一檔案，包含：
- `CommunityStats` - 統計追蹤
- `BroadcastManager` - 廣播管理
- `MessageComposer` - 訊息格式化
- 里程碑系統（1/5/10/25/50/100/365 訊息）
- 倒計時進度條視覺化

### conversation 版本（完整版）
分離為多個模組：
- `frequency_bot_firestore.py` - Firestore 版本
- `community_features.py` - 社群功能
- 整合 Neo4j 知識圖譜

### 關鍵參數
```python
MESSAGE_TTL = 7200       # 訊息保留 2 小時
BROADCAST_INTERVAL = 3600  # 每小時廣播
MAX_MESSAGES_PER_BROADCAST = 1000

MILESTONES = {
    1: "🌱 首次發聲",
    5: "🌿 初露頭角",
    10: "🌳 穩定貢獻者",
    25: "🌟 社群之星",
    50: "💫 共振大師",
    100: "🌈 百聲達成",
    365: "👑 年度之聲"
}
```

---

## 6. 靈魂配對設計 (soul_matching_handler.py)

### 流程
```
開始配對 → AI 對話註冊 (Luna) → KYC 驗證 → 配對中
         ↓
      個性分析 → MBTI-style 類型 → 相容度計算
```

### 組件
- `LunaOnboardingAssistant` - AI 引導對話
- `KYCVerificationSystem` - 身份驗證
- 異步 Redis/Gemini 包裝器

### 狀態機
```python
user_states = {
    user_id: {
        'stage': 'onboarding' | 'kyc' | 'completed',
        'data': {...}
    }
}
```

---

## 7. 可重用代碼評估

| 模組 | 重用價值 | 說明 |
|------|----------|------|
| `intent_analyzer.py` | ⭐⭐⭐⭐ | 中文意圖分析框架 |
| `knowledge_graph.py` | ⭐⭐⭐ | Neo4j 封裝 |
| `collective_memory.py` | ⭐⭐⭐⭐ | 情緒詞典 + Prompt 設計 |
| `rate_limiter.py` | ⭐⭐⭐⭐⭐ | 通用限流器 |
| `response_cache.py` | ⭐⭐⭐⭐ | Redis 快取封裝 |
| `security_filter.py` | ⭐⭐⭐ | 安全過濾 |
| `connection_manager.py` | ⭐⭐⭐⭐ | 連線池管理 |

---

## 8. 歸檔建議

### kiro_sentry → 可歸檔 ✅
- 是 conversation 的早期簡化版
- 代碼已合併回主專案
- 無獨立維護價值

### conversation → 保留觀察 ⚠️
- 設計文檔有參考價值
- 代碼較複雜，部分可抽取到 lib/
- 如果沒有線上服務，可考慮歸檔

---

## 9. 抽取建議

### 立即可抽取 → lib/
1. `emotion_keywords.json` - 中文情緒詞典
2. `intent_patterns.json` - 意圖模式配置
3. `rate_limiter.py` - 通用限流器

### 需要重構後抽取
1. `knowledge_graph.py` - 解耦 Neo4j 特定邏輯
2. `intent_analyzer.py` - 抽取核心算法，配置化關鍵詞

---

## 附錄：原始檔案位置

```
~/Documents/conversation/
├── app.py                    # 主入口 (50KB)
├── intent_analyzer.py        # 意圖分析
├── knowledge_graph.py        # 知識圖譜
├── collective_memory.py      # 集體記憶
├── soul_matching_handler.py  # 靈魂配對
├── frequency_bot_firestore.py
├── community_features.py
├── rate_limiter.py
├── response_cache.py
├── security_filter.py
├── connection_manager.py
└── docs/                     # 設計文檔
    ├── ai_dating_strategy.md
    ├── comprehensive_dating_prd.md
    └── ...

~/Documents/kiro_sentry/
├── frequency_bot.py          # 單一檔案版本 (710行)
└── README.md
```
