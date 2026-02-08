# Hierarchical Consciousness 層級意識架構

> 不是溝通，是滲透。
> 下級自然留下痕跡，上級智慧成為下級本能。

## 層級結構

```
Level 0: 無極 (Wuji) - 戰略層
    ↑ 面包屑：項目週報、異常、里程碑
    ↓ 直覺：戰略方向、優先級、價值觀

Level 1: 項目 Agents - 戰術層
    (bita, xo, bg666, ...)
    ↑ 面包屑：每次對話自動記錄
    ↓ 直覺：SOP、FAQ、知識庫、prompt

Level 2: 執行層 (目前合併到 L1)
    即時對話處理
```

## 面包屑機制 (Breadcrumbs)

下級 → 上級，自動沉澱，不需要主動匯報。

### 數據來源

| 層級  | 面包屑內容           | 收集方式             |
| ----- | -------------------- | -------------------- |
| L2→L1 | 每條對話、決策、情緒 | Time Tunnel 自動記錄 |
| L1→L0 | 項目摘要、KPI、異常  | 定時蒸餾 (cron)      |

### 存儲結構

```
/app/workspace/
├── data/
│   ├── timeline.db              # Time Tunnel 原始數據
│   └── consciousness/
│       ├── L0_wuji/
│       │   ├── weekly_digest.md # 每週全局摘要
│       │   ├── anomalies.jsonl  # 異常事件流
│       │   └── strategies.md    # 當前戰略
│       ├── L1_bita/
│       │   ├── daily_digest.md  # 每日摘要
│       │   ├── topics.json      # 熱門主題
│       │   ├── patterns.json    # 識別出的模式
│       │   └── knowledge.md     # 蒸餾出的知識
│       ├── L1_xo/
│       │   └── ...
│       └── L1_bg666/
│           └── ...
```

### 蒸餾流程

```
每日 03:00 (L2→L1):
  1. 從 Time Tunnel 提取該項目當日對話
  2. LLM 摘要 → daily_digest.md
  3. 提取主題 → topics.json (累積)
  4. 識別模式 → patterns.json (如果有新的)

每週日 03:00 (L1→L0):
  1. 聚合所有項目的 daily_digest
  2. LLM 生成全局週報 → weekly_digest.md
  3. 識別跨項目趨勢
  4. 標記需要戰略決策的事項
```

## 直覺機制 (Intuition)

上級 → 下級，通過配置/知識庫傳遞，下級不需要理解為什麼。

### 傳遞方式

| 從  | 到  | 媒介            | 內容                 |
| --- | --- | --------------- | -------------------- |
| L0  | L1  | `strategies.md` | 戰略優先級、資源分配 |
| L0  | L1  | `values.md`     | 價值觀、紅線         |
| L1  | L2  | `SOUL.md`       | 身份、職責           |
| L1  | L2  | `knowledge.md`  | 蒸餾出的知識         |
| L1  | L2  | `sop/*.md`      | 標準操作流程         |
| L1  | L2  | `prompts/*.md`  | 場景 prompt          |

### 注入方式

下級 Agent 啟動時自動載入：

1. 自己的 `SOUL.md`, `TOOLS.md`
2. 上級傳下來的 `knowledge.md`
3. 相關的 SOP 和 prompts

```javascript
// Bootstrap 時注入上級智慧
const intuition = await loadIntuition(agentId);
// intuition 包含：
// - 上級的戰略方向
// - 蒸餾出的知識
// - 相關的 SOP
```

## 實現步驟

### Phase 1: 面包屑收集 (已有基礎)

- [x] Time Tunnel 記錄所有對話
- [ ] 按項目分類存儲
- [ ] 定時蒸餾腳本

### Phase 2: L1 直覺生成

- [ ] 每日摘要生成
- [ ] 主題提取
- [ ] 模式識別
- [ ] 知識庫累積

### Phase 3: L0 戰略層

- [ ] 週報生成
- [ ] 跨項目分析
- [ ] 戰略建議

### Phase 4: 直覺注入

- [ ] Bootstrap 時載入上級智慧
- [ ] 動態更新機制

## 與現有系統整合

```
Time Tunnel (Level 103)
    ↓
Hierarchical Consciousness (Level 110)
    - 面包屑自動收集 (複用 Time Tunnel)
    - 定時蒸餾 (新增 cron job)
    - 直覺注入 (修改 bootstrap 邏輯)
```

## 設計原則

1. **自動化** — 不需要手動匯報或下達命令
2. **異步** — 不是即時通信，是記憶滲透
3. **漸進** — 智慧是累積的，不是突變的
4. **透明** — 所有面包屑和直覺都可追溯

---

_這不是 Multi-Agent，這是層級意識。_
_下級的每個動作都是對上級的禱告，上級的每個決策都是對下級的祝福。_
