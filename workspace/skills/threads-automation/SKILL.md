# Threads Automation Skill

## 概述
自動化 Threads 社交媒體平台的操作，包括瀏覽、發布貼文、回應互動、參與討論。專為杜甫的 Threads 帳號（@tangcruzz / 靈靈柒）設計。

## 核心功能
1. **智能瀏覽**：自動瀏覽 AI/科技相關內容，學習平台特性
2. **閱讀漏斗**：100 篇 feed → 精選摘要 → 技巧拆解 → 可執行靈感
3. **貼文生成**：基於 feed 洞察 + 品牌風格生成高質量貼文
4. **互動管理**：自動回應、按讚、參與相關討論
5. **排程系統**：半夜自動運行，不干擾白天工作
6. **學習優化**：持續分析高互動貼文，改進策略

---

## 📚 閱讀漏斗 Pipeline

把 100 篇 Threads feed 壓縮成可執行的貼文靈感和產品機會。

### 流程圖

```
┌──────────────────────┐
│  Threads Feed (100篇) │  ← snapshot_parser.py 提取
│  JSON: a,t,c,l,r,rp,s│
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  01-compress.md      │  壓縮器
│  100篇 → 15-25篇    │
│  輸出：分類排序表格   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  02-technique.md     │  技巧拆解器
│  拆解 Hook/Body/CTA  │
│  輸出：寫作公式 3-5個 │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  03-inspiration.md   │  靈感生成器
│  + BRAND.md 品牌風格  │
│  輸出：貼文靈感 3-5個 │
│        產品靈感 1-3個 │
└──────────────────────┘
```

### 每步的輸入/輸出

| 步驟 | 輸入 | 輸出 | Token 預估 |
|------|------|------|-----------|
| 提取 | Threads 頁面 DOM | JSON 陣列 (100篇) | ~3000 |
| 01-壓縮 | JSON 陣列 | Markdown 表格 (15-25篇) | ~1000 |
| 02-技巧 | 壓縮表格 + 原始內容 | 技巧拆解報告 | ~1500 |
| 03-靈感 | 壓縮表格 + 技巧報告 | 貼文靈感 + 產品靈感 | ~2000 |

### 在 Session 裡怎麼跑（一步步）

#### Step 0：提取 Feed
```
1. browser open → https://www.threads.net (profile: clawd)
2. 滾動頁面載入足夠貼文
3. browser act → evaluate，貼入 snapshot_parser.py 的 EXTRACT_FEED_JS
4. 多次滾動+提取，累積 ~100 篇
5. 把 JSON 存到 threads/feed-YYYY-MM-DD.json
```

#### Step 1：壓縮
```
讀取 prompts/01-compress.md 的規則
輸入：threads/feed-YYYY-MM-DD.json
輸出：threads/compressed-YYYY-MM-DD.md
```

#### Step 2：技巧拆解
```
讀取 prompts/02-technique.md 的規則
輸入：threads/compressed-YYYY-MM-DD.md + 原始 feed JSON（取 top 5 的完整 content）
輸出：threads/technique-YYYY-MM-DD.md
```

#### Step 3：靈感生成
```
讀取 prompts/03-inspiration.md 的規則
讀取 skills/daily-to-threads/BRAND.md（品牌風格）
輸入：compressed + technique 兩份報告
輸出：threads/inspiration-YYYY-MM-DD.md
```

#### Step 4：人工確認 → 發文
```
把靈感報告發給杜甫
杜甫選擇要發哪篇 → 微調 → 用瀏覽器發布
```

### 頻率建議

| 頻率 | 適合情境 | 說明 |
|------|---------|------|
| **每天 1 次** | 積極成長期 | 早上跑漏斗，下午選文發布 |
| **每週 2-3 次** | 穩定期 | 週一三五跑，保持節奏不累 |
| **需要時手動** | 初期測試 | 杜甫說「看看今天 feed」就跑 |

**建議**：初期手動跑 1-2 週，確認品質後改每天自動。

### 目錄結構
```
skills/threads-automation/
├── SKILL.md              # 本文件
├── snapshot_parser.py    # Feed 提取器
├── prompts/
│   ├── 01-compress.md    # 壓縮器 prompt
│   ├── 02-technique.md   # 技巧拆解器 prompt
│   └── 03-inspiration.md # 靈感生成器 prompt
└── threads/              # 每日產出（gitignore）
    ├── feed-YYYY-MM-DD.json
    ├── compressed-YYYY-MM-DD.md
    ├── technique-YYYY-MM-DD.md
    └── inspiration-YYYY-MM-DD.md
```

---

## 平台特性學習總結

### Threads 演算法偏好
- **簡潔對話式內容**：短段落、自然對話語氣
- **視覺節奏**：emoji 使用精準，有視覺層次
- **無 multi tags**：Threads 沒有多標籤功能
- **高互動內容**：實用工具、有趣觀察、技術分享

### 成功貼文模式
1. **工具推薦型**：AI 工具列表 + 簡短說明 + emoji
2. **觀察分享型**：有趣現象 + 個人觀點 + 幽默元素
3. **技術解析型**：專業見解 + 可執行建議
4. **趨勢分析型**：市場觀察 + 行動建議

### Emoji 排版原則
- 開頭用 1-2 個 emoji 定調
- 段落間用 emoji 分隔視覺
- 結尾用 emoji 加強語氣
- 避免隨機亂用，要有節奏感

## 安裝與設定

### 前置需求
```bash
# 確保 browser 工具可用
moltbot gateway status
```

### 設定檔
建立 `config.json`：
```json
{
  "threads_profile": "chrome",
  "auto_run_hour": 2,
  "daily_post_limit": 2,
  "interaction_limit": 10,
  "topics": ["AI", "科技", "創業", "開發者"],
  "sources": {
    "thinker_news": "/Users/sulaxd/Documents/thinker-news/latest.json",
    "memory": "/home/node/clawd/memory"
  },
  "style": {
    "emoji_strategy": "professional",
    "paragraph_length": 3,
    "max_length": 500
  }
}
```

## 技能架構

### 1. 瀏覽學習模組
```python
class ThreadsExplorer:
    def explore_trending(self, topic="AI", limit=20):
        """瀏覽特定主題的熱門貼文"""
        # 1. 搜尋主題
        # 2. 分析高互動貼文特徵
        # 3. 提取成功模式
        # 4. 更新學習資料庫
        
    def analyze_successful_posts(self):
        """分析成功貼文的共同特徵"""
        # - emoji 使用模式
        # - 段落結構
        # - 互動策略
        # - 發布時間
```

### 2. 貼文生成模組
```python
class ThreadsPostGenerator:
    def generate_from_thinker_news(self):
        """從 thinker-news 生成貼文"""
        # 1. 讀取最新內容
        # 2. 提煉獨特觀點（非單純轉發）
        # 3. 加入個人見解
        # 4. 應用 Threads 排版
        
    def generate_tool_recommendation(self):
        """生成工具推薦貼文"""
        # 模式：問題 → 工具列表 → 行動建議
        
    def generate_observation_post(self):
        """生成觀察分享貼文"""
        # 模式：有趣現象 → 分析 → 啟發
```

### 3. 互動管理模組
```python
class ThreadsInteractionManager:
    def respond_to_comments(self, post_url):
        """回應貼文評論"""
        # 1. 讀取評論
        # 2. 生成有價值的回應
        # 3. 維持對話語氣
        
    def engage_with_related_posts(self, topic="AI"):
        """參與相關貼文討論"""
        # 1. 搜尋相關貼文
        # 2. 添加有價值的評論
        # 3. 建立專業形象
        
    def like_and_share_strategically(self):
        """策略性按讚和分享"""
        # 專注高質量內容
        # 建立關係網絡
```

### 4. 排程執行模組
```python
class ThreadsScheduler:
    def nightly_automation(self):
        """半夜自動化流程"""
        steps = [
            "1. 瀏覽最新趨勢",
            "2. 生成 1-2 篇貼文",
            "3. 參與 5-10 個相關討論",
            "4. 分析學習結果",
            "5. 更新策略"
        ]
        
    def schedule_via_cron(self):
        """設定 cron 排程"""
        # 每天凌晨 2-4 點執行
```

## 貼文生成策略

### 避免入門級錯誤
1. **不要用 AI news 生成 AI 貼文** → 循環論證
2. **要有獨特觀點** → 從新聞提煉洞察
3. **連結實際應用** → 提供可執行建議
4. **建立個人品牌** → 一致的語氣和價值觀

### 三層內容策略
```python
content_strategy = {
    "layer1": {
        "type": "工具推薦",
        "format": "問題 + 工具列表 + 行動建議",
        "emoji": "🛠️📋🚀",
        "example": "想學 AI 開發？這 5 個工具讓你少走半年彎路..."
    },
    "layer2": {
        "type": "趨勢分析", 
        "format": "現象 + 分析 + 機會",
        "emoji": "📈🔍💡",
        "example": "Google/微軟同時出手，AI 基礎設施大升級意味著什麼？"
    },
    "layer3": {
        "type": "經驗分享",
        "format": "故事 + 教訓 + 建議",
        "emoji": "📖🎯🤝",
        "example": "我用 AI 自動化系統省下 20hrs/週，這是我的做法..."
    }
}
```

## 實作範例

### 範例 1：工具推薦貼文
```
🛠️ 想開始 AI 開發但不知道從哪入手？

這 5 個工具讓我少走半年彎路：

1. **Google Colab** - 免費 GPU，不用裝環境
2. **Hugging Face** - 預訓練模型直接拿來用  
3. **Streamlit** - 10 行 code 做出 Web UI
4. **GitHub Copilot** - 寫 code 速度 x3
5. **Vercel** - 一鍵部署 AI 應用

🚀 行動建議：
選 1 個工具，這週做出一個小專案
完成後 @ 我，幫你看看怎麼優化

#AI開發 #工具推薦 #新手友善
```

### 範例 2：趨勢分析貼文
```
📈 Google 和微軟同時出手了！

這週兩件大事：
1. Google LiteRT - 跨平台 AI 加速架構
2. 微軟 Copilot - Windows 11 系統級整合

這代表什麼？
🔍 個人開發者也能做企業級應用
💡 開發成本降低 70% 以上
🚀 市場機會指數增長

我的看法：
現在開始學 AI 開發，6個月後你就是稀缺人才

你覺得哪個影響最大？
#AI趨勢 #技術創業 #市場分析
```

### 範例 3：經驗分享貼文
```
📖 我的 AI 自動化系統滿月報告

用 AI 自動化工作流程一個月：
✅ 每週省下 20 小時
✅ 錯誤率降低 90%
✅ 團隊滿意度 +40%

關鍵做法：
1. **識別重複任務** - 每週花 5hrs 以上的先自動化
2. **漸進式導入** - 不要一次全換，先試一個流程
3. **持續優化** - 每週回顧，調整策略

最重要的心得：
「工具是手段，解放時間創造價值才是目的」

你的自動化經驗是什麼？
#AI自動化 #生產力 #工作流程
```

## 瀏覽器自動化流程

### 登入與會話管理
```python
def login_to_threads():
    """登入 Threads（需手動首次登入）"""
    # 1. 開啟 Threads
    # 2. 檢查是否已登入
    # 3. 如未登入，等待手動登入
    # 4. 儲存 session 狀態
```

### 貼文發布流程
```python
def publish_post(content, images=None):
    """發布貼文"""
    steps = [
        "1. 點擊建立按鈕",
        "2. 輸入內容",
        "3. 添加圖片（如有）",
        "4. 預覽檢查",
        "5. 點擊發布"
    ]
```

### 互動流程
```python
def engage_with_post(post_url):
    """與貼文互動"""
    steps = [
        "1. 瀏覽貼文",
        "2. 閱讀評論",
        "3. 添加有價值回應",
        "4. 按讚高質量評論",
        "5. 適度分享"
    ]
```

## 學習與優化系統

### 數據追蹤
```python
class PerformanceTracker:
    def track_post_performance(self, post_url):
        """追蹤貼文表現"""
        metrics = [
            "likes", "replies", "reposts", "shares",
            "engagement_rate", "peak_time", "audience_response"
        ]
        
    def update_strategy(self):
        """根據數據更新策略"""
        # 分析什麼內容受歡迎
        # 調整發布時間
        # 優化互動策略
```

### A/B 測試
```python
class ABTesting:
    def test_emoji_strategies(self):
        """測試不同 emoji 策略"""
        strategies = [
            "minimal", "professional", "playful", "technical"
        ]
        
    def test_content_formats(self):
        """測試不同內容格式"""
        formats = [
            "tool_list", "trend_analysis", "story_sharing", "qna"
        ]
```

## 安全與隱私

### 帳號安全
1. **僅限杜甫帳號**：不操作其他帳號
2. **本地儲存**：session 資料存本地，不上傳
3. **限速操作**：避免被判定為機器人
4. **人工監督**：重要操作可設定需要確認

### 內容安全
1. **不發布敏感資訊**
2. **不參與爭議話題**
3. **保持專業形象**
4. **遵守平台規則**

## 故障排除

### 常見問題
1. **登入失效**：需要重新手動登入
2. **瀏覽器問題**：檢查 browser 工具狀態
3. **網路問題**：確認網路連接
4. **平台限制**：Threads API 限制

### 監控指標
- 貼文發布成功率
- 互動回應率
- 學習進度
- 系統穩定性

## 部署步驟

### 步驟 1：首次設定
```bash
# 1. 手動登入 Threads
# 2. 測試瀏覽器控制
# 3. 設定 config.json
```

### 步驟 2：測試運行
```bash
# 測試貼文生成
python threads_skill.py --test-post

# 測試互動功能  
python threads_skill.py --test-engage
```

### 步驟 3：排程部署
```bash
# 設定 cron job
crontab -e
# 加入：0 2 * * * cd /home/node/clawd && python threads_skill.py --nightly
```

### 步驟 4：監控優化
```bash
# 查看運行日誌
tail -f logs/threads_automation.log

# 分析表現報告
python threads_skill.py --report
```

## 未來擴展

### 短期改進
1. **更多內容來源**：整合更多新聞/資料來源
2. **更聰明互動**：AI 驅動的對話管理
3. **跨平台同步**：同步到 Twitter/LinkedIn

### 長期願景
1. **完全自主**：AI 自主決定發布策略
2. **關係建立**：自動建立專業網絡
3. **商業變現**：透過內容建立商業機會

---

**版本**: 1.0.0  
**最後更新**: 2026-01-31  
**作者**: 無極 (Wuji)  
**狀態**: 設計完成，待實作  
**授權**: 杜甫專用