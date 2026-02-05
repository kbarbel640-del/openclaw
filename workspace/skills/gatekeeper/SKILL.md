# Gatekeeper Skill

ThinkerCafe 守門人性格測評系統 — 用深度心理情境題篩選出「真正想成長的人」

## 概述

這是一套 24 題的情境式性格測評，設計目標是：
1. **篩選門檻**：讓不認真的人自然放棄
2. **建立期待**：讓完成的人感到被重視
3. **性格洞察**：四維度人格分析（行動/連結/創意/分析）

## 題庫結構

- **8 個情境主題**，每個主題 3 題
- **總計 24 題**，默認隨機抽 3 組（9 題）
- **4 種性格類型**：A=行動者、B=連結者、C=創意者、D=分析者

### 情境主題

| ID | 主題 | 探索面向 |
|:--:|------|----------|
| 1 | 自我懷疑與內在批評 | 面對冒牌者症候群的反應 |
| 2 | 緊繃過後的你 | 高壓後的恢復模式 |
| 3 | 對某人深深失望 | 處理人際失望的方式 |
| 4 | 決策壓力 | 面對重大選擇的決策風格 |
| 5 | 被誤解與孤獨 | 在孤獨中的自處方式 |
| 6 | 失控感與控制 | 面對無法控制狀況的反應 |
| 7 | 看到他人成功 | 與他人比較時的內在運作 |
| 8 | 未竟夢想 | 面對放棄的夢想的態度 |

## 使用方式

### 1. CLI 使用

```bash
# 隨機抽 3 組題目（9 題）互動測驗
python3 scripts/assess.py

# 完整測驗（24 題）
python3 scripts/assess.py --full

# 指定題組
python3 scripts/assess.py --set 1,3,5

# 直接計算答案結果
python3 scripts/assess.py --answers AABCDDABC

# JSON 格式輸出（供程式整合）
python3 scripts/assess.py --answers AABCDDABC --json

# 輸出 bot 格式題目（Telegram/LINE 友好）
python3 scripts/assess.py --set 1 --format-bot
```

### 2. Bot 整合流程

#### 發送測驗
```python
import subprocess
import json

# 取得隨機 3 組題目（bot 格式）
result = subprocess.run(
    ["python3", "scripts/assess.py", "--format-bot"],
    capture_output=True, text=True
)
questions = result.stdout
# 發送 questions 給用戶
```

#### 收到答案後計算結果
```python
# 用戶回覆答案字串，如 "AABCDDABC"
user_answers = "AABCDDABC"

result = subprocess.run(
    ["python3", "scripts/assess.py", "--answers", user_answers, "--json"],
    capture_output=True, text=True
)
analysis = json.loads(result.stdout)

# analysis 結構:
# {
#   "answers": "AABCDDABC",
#   "scores": {"A": 3, "B": 2, "C": 2, "D": 2},
#   "primary_type": "A",
#   "type_name": "行動者",
#   "description": "..."
# }
```

### 3. 無極直接使用

收到用戶想做測驗的請求時：

1. **發送題目**：用 `--format-bot --set X,Y,Z` 產生題目
2. **等待回覆**：用戶回覆 9 個字母（如 AABCDDABC）
3. **計算結果**：用 `--answers` 計算結果
4. **發送報告**：格式化後發送

## 四種性格類型

| 類型 | 代號 | 特徵 | 優勢 |
|------|:----:|------|------|
| 行動者 | A | 先做再說，行動導向 | 執行力強、不怕失敗 |
| 連結者 | B | 重視關係，溝通導向 | 同理心強、善於建立信任 |
| 創意者 | C | 內在導向，直覺敏銳 | 創造力豐富、能看見可能性 |
| 分析者 | D | 邏輯導向，系統思考 | 思維縝密、善於規劃 |

## 檔案結構

```
gatekeeper/
├── SKILL.md           # 本文件
├── questions.json     # 完整題庫（8 組 24 題）
└── scripts/
    └── assess.py      # 評估腳本
```

## 設計原則

1. **情境優先**：每組題目先引導用戶進入情境，再提問
2. **直覺作答**：強調沒有對錯，鼓勵真實回應
3. **漸進深度**：三題分別問「第一反應」「內在信念」「過去經驗」
4. **正向框架**：所有選項都是正向的，沒有「壞選項」

## 數據來源

題庫從 Notion 頁面 `1e3d872b-594c-8132-99ba-fc3bb01ac1a9` 抓取，經過結構化處理存入 `questions.json`。

## TODO

- [ ] 增加副類型分析（主類型 + 副類型組合）
- [ ] 增加類型相容性分析
- [ ] 增加成長建議內容
- [ ] 串接 LINE/Telegram 自動流程
