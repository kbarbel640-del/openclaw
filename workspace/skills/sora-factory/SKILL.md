---
name: sora-factory
emoji: 🎬
description: Sora 影片工廠 — 從故事到完整影片的一鍵生成系統。將劇本拆成鏡頭、批次排隊 Sora 生成、品控連貫性、自動拼接。觸發詞：Sora 影片、生成影片、AI 短片、影片工廠、批次生成。
requires:
  bins: ["python3", "ffmpeg"]
  browser: true
---

# Sora 影片工廠

將「一個故事」變成「一支完整影片」的自動化系統。

## 核心問題

Sora 每次生成獨立片段，沒有「前一幕記憶」：
- 角色長相每次重抽
- 場景細節不連貫
- 單獨片段無法組成故事

## 解決方案：四層架構

```
┌─────────────────────────────────────────┐
│ Layer 1: 劇本解析 (Story Parser)        │
│   故事 → 鏡頭列表 + 視覺錨點            │
├─────────────────────────────────────────┤
│ Layer 2: Prompt 工程 (Prompt Engine)    │
│   鏡頭 + 錨點 → Sora 最佳化 prompt      │
├─────────────────────────────────────────┤
│ Layer 3: 批次排隊 (Batch Queue)         │
│   3 並行 × N 輪 → 自動輪詢 → 下載       │
├─────────────────────────────────────────┤
│ Layer 4: 品控拼接 (QC & Assembly)       │
│   連貫性檢查 → 重生成 → ffmpeg 拼接     │
└─────────────────────────────────────────┘
```

## 使用流程

### Step 1: 定義故事

```yaml
# 專案配置 (project.yaml)
project:
  name: "職場復仇"
  duration: 30  # 秒
  style: "cinematic, dramatic lighting, 4K"
  
characters:
  protagonist:
    name: "小明"
    appearance: "30歲亞洲男性，短髮，戴黑框眼鏡，穿深藍色襯衫"
    trait: "沉穩內斂，眼神銳利"
  antagonist:
    name: "王總"
    appearance: "50歲中年男性，禿頂，穿灰色西裝，紅色領帶"
    trait: "傲慢，愛翹腳"

scenes:
  office:
    description: "現代開放式辦公室，落地窗，城市天際線背景"
    lighting: "日光從右側灑入"
    
shots:
  - id: 1
    scene: office
    characters: [protagonist, antagonist]
    action: "王總站在小明桌前，輕蔑地笑著說話，小明低頭看螢幕"
    duration: 8
    camera: "中景，緩慢推進"
    emotion: "壓抑、屈辱"
    
  - id: 2
    scene: office
    characters: [protagonist]
    action: "小明手指懸在 Enter 鍵上方，特寫眼神從屈辱變堅定"
    duration: 5
    camera: "特寫臉部，然後切到手指"
    emotion: "轉折、決心"
    
  - id: 3
    scene: office
    characters: [protagonist, antagonist]
    action: "全公司電腦同時彈出視窗，王總臉色從困惑變驚恐"
    duration: 7
    camera: "快剪：螢幕特寫 → 同事反應 → 王總表情"
    emotion: "爽感、高潮"
```

### Step 2: 生成 Prompts

執行 `scripts/story_to_prompts.py project.yaml`

輸出：
```
shots/shot_001.txt - Sora prompt for shot 1
shots/shot_002.txt - Sora prompt for shot 2
shots/shot_003.txt - Sora prompt for shot 3
```

### Step 3: 批次提交 Sora

執行 `scripts/sora_batch_submit.py shots/`

- 每次最多 3 個並行
- 自動輪詢狀態
- 完成自動下載到 `output/raw/`

**自動模式（CDP）**

```
python3 scripts/sora_batch_submit.py shots/ \\
  --auto --auto-download \\
  --config assets/sora_browser_config.yaml
```

需要調整 `assets/sora_browser_config.yaml` 的 selector 與 JS，
且 Chrome 必須開啟 CDP（預設 `http://127.0.0.1:9222`）。

**API 模式（OpenAI Sora）**

```
python3 scripts/sora_batch_submit.py shots/ --api
```

前置：
- 設定 `OPENAI_API_KEY`
- 安裝 `openai`：`pip install openai`

### Step 4: 品控檢查

執行 `scripts/qc_check.py output/raw/`
（需要人工視覺分析。若只是流程測試可加 `--auto-pass`）

- 抽取關鍵幀
- Vision API 檢查角色連貫性
- 標記需重生成的片段

### Step 5: 拼接輸出

執行 `scripts/assemble.py output/raw/ --output final.mp4`
（建議使用 `output/approved/` 作為輸入；未通過 QC 不建議拼接）

- 依序號拼接
- 加入轉場
- 輸出最終影片

## 視覺錨點策略

### 問題：Sora 每次重抽角色

### 解法：Prompt 錨點強化

```
❌ 錯誤：A man sits at desk
✅ 正確：A 30-year-old East Asian man with short black hair, 
         wearing black-framed glasses and a dark navy blue shirt, 
         sits at a desk. He has sharp, observant eyes. 
         Consistent character design throughout.
```

### 連貫性關鍵詞

在每個 prompt 加入：
- `consistent character design`
- `same person as previous shot`
- `maintaining visual continuity`
- `cinematic continuity`

## 大師級模板（已內建）

- `assets/prompt_template.md`：模板化 prompt 結構  
- `assets/success_library.yaml`：成功錨點詞/色盤庫  

`story_to_prompts.py` 會優先使用模板渲染；若模板不存在才回退原始輸出。

**成功庫自動追加（人工確認後）**

當你人工確認哪些鏡頭成功後，執行：

```
python3 scripts/record_success.py --manifest shots/manifest.yaml --shot-ids 1,3,5
```

或全部追加：

```
python3 scripts/record_success.py --manifest shots/manifest.yaml --all
```

### 場景錨點

固定場景描述詞，避免變化：
```yaml
office_anchor: |
  Modern open-plan office with floor-to-ceiling windows,
  city skyline visible in background,
  natural daylight streaming from the right side,
  minimalist white desks with dual monitors
```

## 批次管理

### 並行限制
Sora 同時最多 3 個生成任務

### 輪詢策略
```
submit 3 → wait 60s → check status
  ├─ all done → download → submit next 3
  ├─ some done → download done → wait
  └─ none done → wait 60s → retry
```

### 失敗處理
- 生成失敗 → 自動重試 1 次
- 連續失敗 → 標記跳過，記錄日誌

## 品控標準

### 連貫性檢查項目

| 項目 | 檢查方式 | 通過標準 |
|------|----------|----------|
| 角色外觀 | Vision API 比對 | 相似度 > 70% |
| 場景一致 | 關鍵元素存在 | 核心元素 ≥ 3/5 |
| 動作銜接 | 前後幀比對 | 無跳躍感 |
| 情緒連貫 | 表情分析 | 符合劇本設定 |

### 重生成觸發

- 角色嚴重不連貫 → 調整 prompt 重生成
- 場景缺失關鍵元素 → 補充 prompt 重生成
- 動作邏輯錯誤 → 重寫動作描述

## 專案結構

```
project-name/
├── project.yaml          # 劇本配置
├── shots/
│   ├── shot_001.txt      # Sora prompts
│   ├── shot_002.txt
│   └── ...
├── output/
│   ├── raw/              # Sora 原始輸出
│   │   ├── shot_001.mp4
│   │   └── ...
│   ├── approved/         # 通過品控
│   └── final.mp4         # 最終輸出
└── logs/
    ├── generation.log    # 生成記錄
    └── qc_report.json    # 品控報告
```

## 腳本清單

| 腳本 | 功能 |
|------|------|
| `story_to_prompts.py` | 劇本 → Sora prompts |
| `sora_batch_submit.py` | 批次提交 + 輪詢 + 下載 |
| `qc_check.py` | 連貫性品控 |
| `assemble.py` | ffmpeg 拼接 |
| `full_pipeline.py` | 一鍵全流程 |

## 快速開始

> ⚠️ **環境提醒**：目前 `sora-factory` 的自動化（CDP/下載）依賴宿主機的 Chrome/CDP 與 Python 套件（如 PyYAML）。
> 若在容器環境缺少 `yaml`，請改在宿主機執行（或補齊依賴）。

```bash
# 一鍵生成（從劇本到影片）
python3 scripts/full_pipeline.py project.yaml

# 或分步執行
python3 scripts/story_to_prompts.py project.yaml
python3 scripts/sora_batch_submit.py shots/
python3 scripts/qc_check.py output/raw/
python3 scripts/assemble.py output/raw/ --output final.mp4
```

### ✅ P0：下載落地閉環（你剛剛卡住的點）

現在 `full_pipeline.py` 也能直接接住下載目錄（不用你手動搬到 raw_dir）：

```bash
python3 scripts/full_pipeline.py project.yaml \
  --download-dir ~/Downloads \
  --since-minutes 180

# 內部會記錄本次執行的 download_start_ts，避免抓到 Downloads 裡其他舊影片

# 或 watch 模式：你一段段點 Download，它會等下載完成再搬運
python3 scripts/full_pipeline.py project.yaml \
  --step 2 \
  --download-dir ~/Downloads \
  --watch-downloads

# 若你下載順序不小心亂了：用互動映射把檔案指定回 shot_001/002/003
python3 scripts/full_pipeline.py project.yaml \
  --step 2 \
  --download-dir ~/Downloads \
  --interactive-map-downloads
```

下載搬運完成後，會在 `<workspace>/logs/downloads_manifest.json` 記錄本次對應（可追溯/可重跑）。

- `--watch-downloads` 模式也會邊搬邊更新 manifest（每搬一段就寫一次）。

### 🤖 B1：自動點 Download（不再手點 3 次）

1) 準備 `urls.json`（Sora drafts URLs）：
```json
{
  "urls": [
    "https://sora.chatgpt.com/d/gen_...",
    "https://sora.chatgpt.com/d/gen_...",
    "https://sora.chatgpt.com/d/gen_..."
  ]
}
```

2) 在 `assets/sora_browser_config.yaml` 填好 `downloads.download_dir`（建議）：
```yaml
downloads:
  download_dir: "/Users/sulaxd/clawd/output/sora_run/raw_downloads"
```

3) 執行自動下載：
```bash
python3 scripts/sora_download_from_urls.py \
  --config assets/sora_browser_config.yaml \
  --urls urls.json
```

接著用我們現成的 `--watch-downloads` 或 `download_watcher.py` 接住下載並落盤 manifest。

### 🔁 Resume（不再依賴 Downloads）

如果你已經有 `<workspace>/logs/downloads_manifest.json`，之後要重跑 QC/拼接可以用：

```bash
python3 scripts/full_pipeline.py project.yaml --resume-from-downloads-manifest
# 或指定 path
python3 scripts/full_pipeline.py project.yaml --resume-from-downloads-manifest /path/to/downloads_manifest.json
```


如果你是用 Sora UI 手動點「Download」，請用 `download_watcher.py` 把下載檔案搬運/改名到專案 raw 目錄：

```bash
# 先在 Sora UI 依序下載 3 個段落
# 然後把 ~/Downloads 最近的 3 個影片搬到 workspace 的 output/raw
python3 scripts/download_watcher.py \
  --download-dir ~/Downloads \
  --output-dir <workspace>/output/raw \
  --count 3
```

（可選）若你要讓 CDP 自動化下載位置可控：在 `assets/sora_browser_config.yaml` 填 `downloads.download_dir`。

## 限制與注意

1. **Sora 生成時間**：每個片段 3-5 分鐘
2. **角色連貫**：即使用錨點，仍可能有差異，需人工最終確認
3. **瀏覽器依賴**：需要 clawd browser profile 登入 sora.com
4. **成本考量**：大量生成消耗 Sora 額度
