# 紫微家族專案合併計劃

**分析日期**：2025-01-28
**分析師**：Subagent

---

## 📊 專案概覽

| 專案 | GitHub Repo | 大小 | 最後 Commit | 用途 |
|------|-------------|------|-------------|------|
| ziwei-astrology-system | ThinkerCafe-tw/ziwei-astrology-system | 1.3M | 初始提交 | 始祖版本 |
| minli_demo_only | tangcruz/minli_demo_only | 29M | initialize project | Cruz 個人開發版 |
| minli_demo2_cruz | ThinkerCafe-tw/minli_demo2_cruz | 12M | 修改 flex summary | 微服務版 |
| minli_demo2_cruz-1 | ThinkerCafe-tw/minli_demo2_cruz | 12M | flexmsg remove footer | ⚠️ 重複 clone |
| mingli-backend | ThinkerCafe-tw/mingli-backend | 91M | PR #5 merge | 正式後端服務 |

---

## 🔍 詳細差異分析

### 1. minli_demo2_cruz vs minli_demo2_cruz-1

**結論：100% 重複，只是同一 repo 的兩個 clone**

差異：
- 只有 `ziwei_astrology_service/app.py` 有一些 footer UI 代碼被註釋掉
- 都指向同一個 GitHub repo
- cruz-1 比 cruz 多一個 commit

**建議**：**直接刪除 minli_demo2_cruz-1**

---

### 2. ziwei-astrology-system（始祖）

**獨特內容**：
- `.env` 環境變數檔案
- 最原始的純 Python 實現

**缺少**（其他專案有）：
- Dockerfile
- API 文檔（API_ENDPOINTS.md 等）
- 進階星曜計算（hour_stars.py, month_stars.py）
- LINE Flex Message 格式化（flex_formatter.py）
- 農曆轉換（lunar_calendar.py）
- chart_calculator.py

**核心 Python 文件**：
```
app.py                 347 行
birthdata.py           
body_cause_palace.py
five_element_chart.py
main_stars.py
palace_manager.py
palace_stems.py
stems_branches.py
year_stars.py
ziwei_report_generator.py
```

---

### 3. minli_demo_only（Cruz 個人版）

**獨特內容**：
- `Dockerfile`（Docker 部署）
- `chart_calculator.py`（圖表計算器）
- `flex_formatter.py`（LINE Flex Message）
- `fortune_periods.py`（運勢週期）
- `hour_stars.py`（時辰星曜）
- `lunar_calendar.py`（農曆轉換）
- `month_stars.py`（月份星曜）
- `transformation_stars.py`（化星）
- 完整測試套件（test_*.py 多個）
- `API_ENDPOINTS.md`, `API_OPTIMIZATION_SUMMARY.md`
- `YEAR_STARS_VALIDATION_REPORT.md`

**相對於始祖的進化**：
- app.py：347 → 257 行（重構精簡）
- 新增模組化計算

**注意**：這是 Cruz 個人 repo（tangcruz/），不在 ThinkerCafe-tw 組織下

---

### 4. minli_demo2_cruz（微服務版）

**架構**：雙服務 Docker Compose
```
├── ziwei_astrology_service/    # 紫微計算服務
├── semantic_api_service/        # 語義 API 服務
├── docker-compose.yml
├── Makefile
└── weaviate                     # 向量資料庫
```

**獨特內容 - ziwei_astrology_service/**：
- 完整紫微計算邏輯
- `create_schema.py`（資料庫 schema）
- `delete_old.py`
- `data/`（16 個資料檔）
- `doc/`（文檔）
- `analysis/`（分析模組）

**獨特內容 - semantic_api_service/**：
- `vector_hub.py`（向量操作）
- `semantic_expand.py`（語義擴展）
- `context_hub.py`、`prompt_hub.py`
- `train_semantic_match.py`（語義匹配訓練）
- `weaviate_data/`（向量資料）
- `eng.traineddata`（5.2M，OCR 模型）
- `WEAVIATE_MANUAL_TEST.md`
- `VIGOR_CREDENTIALS.md`

**價值**：完整的微服務架構，包含向量搜索能力

---

### 5. mingli-backend（正式後端）

**獨特內容**：
- `.github/workflows/deploy.yaml`（GCP App Engine CI/CD）
- `.gcloudignore`
- `config/intent_recognition_config.json`
- `dialogues/`（6 個場景對話）：
  - career_scenario_1.md, career_scenario_2.md
  - finance_scenario_1.md, finance_scenario_2.md
  - relationship_scenario_1.md, relationship_scenario_2.md
- `docs/`：
  - INTENT_RECOGNITION_PLAN.md
  - RAG_PGVECTOR_PLAN.md
  - ziwei_benchmark_1976_06_20.md
- `prompts/`（4 個 prompt 模板）：
  - career_template.md
  - finance_template.md
  - general_template.md
  - relationship_template.md
- `intent_recognition.py`
- `test_intent_recognition.py`
- `cloud-sql-proxy`（34M，GCP 連接器）

**部署架構**：
- GCP App Engine
- Cloud SQL (PostgreSQL)
- pgvector（向量資料庫）
- dev/main 分支自動部署

**價值**：正式的生產環境後端，有完整 CI/CD

---

## 📋 相同文件清單

以下文件在多個專案中**完全相同或高度相似**：

| 文件 | ziwei | demo_only | demo2_cruz | backend |
|------|-------|-----------|------------|---------|
| birthdata.py | ✅ | ✅ | ✅ | ✅ |
| body_cause_palace.py | ✅ | ✅ | ✅ | ✅ |
| stems_branches.py | ✅ | ✅ | ✅ | ✅ |
| palace_stems.py | ✅ | ✅ | ✅ | ✅ |
| comprehensive_test.py | ✅ | ✅ | ✅ | ✅ |
| downloaded_report.md | ✅ | ✅ | ✅ | ✅ |
| main_stars.py | ✅ | ✅ | ✅ | ✅ |
| five_element_chart.py | ✅ | ≈ | ≈ | ≈ |
| hour_stars.py | - | ✅ | ✅ | ✅ |
| lunar_calendar.py | - | ✅ | ✅ | ✅ |
| month_stars.py | - | ✅ | ✅ | ✅ |
| year_stars.py | ✅ | ✅ | ✅ | ✅ |

---

## 🎯 合併建議

### 方案 A：保守合併（推薦）

1. **刪除** `minli_demo2_cruz-1/`（100% 重複）

2. **保留** `mingli-backend/` 作為**正式後端服務**
   - 這是團隊開發的正式 repo
   - 有 CI/CD、PR 流程
   - 不要動它

3. **歸檔** `ziwei-astrology-system/`
   - 移到 `~/Documents/_archive/ziwei-astrology-system-original/`
   - 保留作為歷史參考
   - 已被後續版本完全取代

4. **合併** `minli_demo_only/` → `minli_demo2_cruz/`
   - minli_demo_only 有較完整的計算模組
   - minli_demo2_cruz 有微服務架構
   - 合併後作為**開發/實驗版**

5. **最終保留**：
   - `mingli-backend/` - 正式後端
   - `minli_demo2_cruz/` - 開發版（含微服務架構）
   - `_archive/ziwei-astrology-system-original/` - 歷史參考

### 方案 B：激進合併

1. **刪除** `minli_demo2_cruz-1/`
2. **刪除** `minli_demo_only/`（先確認獨特內容已萃取）
3. **歸檔** `ziwei-astrology-system/`
4. **歸檔** `minli_demo2_cruz/`（微服務架構萃取到 backend）
5. **保留** 只有 `mingli-backend/`

⚠️ 風險：可能丟失 minli_demo2_cruz 的 semantic_api_service

---

## 🔧 執行步驟（方案 A）

### Step 1: 刪除重複
```bash
# 確認是重複 clone
diff -rq ~/Documents/minli_demo2_cruz ~/Documents/minli_demo2_cruz-1 --exclude=".git"

# 刪除
rm -rf ~/Documents/minli_demo2_cruz-1
```

### Step 2: 歸檔始祖
```bash
mkdir -p ~/Documents/_archive
mv ~/Documents/ziwei-astrology-system ~/Documents/_archive/ziwei-astrology-system-original
```

### Step 3: 萃取 minli_demo_only 獨特內容到 minli_demo2_cruz
需要手動比對並合併：
- Dockerfile
- 測試文件（test_*.py）
- 文檔（*.md）

### Step 4: 確認 mingli-backend 不需要從其他專案同步
- 檢查 mingli-backend 是否缺少必要的計算模組
- 如有需要，從 minli_demo_only 複製

---

## ⚠️ 注意事項

1. **minli_demo_only 是 Cruz 個人 repo**
   - 不在 ThinkerCafe-tw 組織下
   - 合併前需確認所有權/許可

2. **mingli-backend 的 secrets**
   - GitHub secrets 包含 GCP credentials
   - 不要在本地洩漏

3. **minli_demo2_cruz 的 semantic_api_service**
   - 包含 Weaviate 向量搜索
   - 如果 backend 需要這個功能，需要另外規劃整合

4. **cloud-sql-proxy (34M)**
   - 只在 mingli-backend 有
   - 是 GCP 連接必需品，不能刪除

---

## 📈 預計節省空間

| 操作 | 節省 |
|------|------|
| 刪除 minli_demo2_cruz-1 | 12M |
| 歸檔 ziwei-astrology-system | 0（移動不刪除）|
| **總計** | **~12M** |

如果採用方案 B（刪除 demo_only）：額外節省 29M

---

## ✅ 待確認事項

請杜甫確認：

1. [ ] minli_demo_only 要保留還是歸檔？（是 Cruz 個人 repo）
2. [ ] minli_demo2_cruz 的微服務架構還需要嗎？
3. [ ] mingli-backend 是否為唯一正式後端？
4. [ ] 歸檔目錄放 `~/Documents/_archive/` 可以嗎？

---

**報告完成。等待杜甫確認後再執行合併操作。**
