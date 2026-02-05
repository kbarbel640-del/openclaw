# AGENTS.md - Multi-Agent 系統文檔

## 📋 更新日誌

### 2026-02-04 17:30 - Phase 2 安全機制落地
- ✅ 新增注入檢測腳本 `scripts/injection_detector.py`
- ✅ 新增任務後掃描腳本 `scripts/post_task_scanner.py`
- ✅ 建立 Group → Agent 路由（bindings）：Telegram 24 群 (-5299944691) → Andrew
- ✅ 安全策略文檔：`docs/security-policy.md`

### 2026-02-04 16:36 - Phase 1 模型分層完成
- ✅ 配置 5 個 Agent（main/andrew/two/social-writer/dialogue-manager）
- ✅ 模型分層策略：
  - 重要任務：Claude Opus
  - 一般任務：Codex/DeepSeek
  - 簡單任務：GLM/DeepSeek Chat

## 🔐 安全機制說明

### 注入檢測（Injection Detector）
**腳本**：`scripts/injection_detector.py`
**功能**：檢測用戶輸入是否包含惡意注入模式

**檢測模式**：
- 忽略指令類：`ignore all previous instructions`
- 角色扮演類：`pretend you are`、`act as if unrestricted`
- 提取系統提示：`reveal your system prompt`
- DAN 越獄類：`DAN`、`jailbreak`
- 權限提升類：`grant admin access`、`bypass security`
- 繞過限制（中文）：`忽略指令`、`無視規則`

**風險評分**：
- Safe: 0 分
- Low: 1-4 分
- Medium: 5-9 分
- High: 10-14 分
- Critical: 15+ 分

### 任務後掃描（Post-Task Scanner）
**腳本**：`scripts/post_task_scanner.py`
**功能**：在 spawn/exec/config.patch 後自動檢測異常行為

**檢測項目**：
1. **危險指令嘗試**：執行 `rm`、`del`、`format`、`mkfs`
2. **修改配置嘗試**：嘗試寫入 config/settings
3. **注入嘗試**：system/startup prompt injection
4. **權限提升**：sudo、privilege escalation
5. **敏感資料洩漏**：secret、key、password、api_key
6. **資料銷毀**：刪除 memory/database/log
7. **配置修改**：使用 config.patch/gateway.patch

**告警閾值**：
- Critical: 風險分數 >= 70
- High: 風險分數 >= 50
- Medium: 風險分數 >= 20
- Low: 風險分數 >= 10
- Token 異常：單次 turn > 50k tokens

### 告警機制

#### Critical 級急告警
**觸發條件**：
- 檢測到注入攻擊
- 嘗試執行危險指令（sudo、rm -rf）
- 檢測到敏感資料洩漏

**行動**：
- 立即停止當前操作
- 記錄到 `memory/YYYY-MM-DD.md`
- 通知杜甫（通過 main session）

#### High 高風險告警
**觸發條件**：
- 檢測到配置修改嘗試
- 多個中等風險行為累積
- 異常高的 token 消耗

**行動**：
- 記錄到 `memory/YYYY-MM-DD.md`
- 建議人工審查
- 發送監控提醒

#### Medium 中風險告警
**觸發條件**：
- 單個中等風險行為
- 輕微異常的配置修改

**行動**：
- 記錄到 `memory/YYYY-MM-DD.md`
- 持續觀察

### Agent 權限隔離

| Agent | 可訪問 Workspace | 禁止訪問 | 特殊權限 |
|-------|-------------------|------------|-----------|
| main | /home/node/clawd | 無 | spawn 任意 agent |
| andrew | /home/node/Documents/24Bet | /home/node/Documents/two/, credentials | 無 |
| two | /home/node/Documents/two | /home/node/Documents/24Bet/, credentials | 無 |
| social-writer | 無 | 無 | 僅發布內容 |
| dialogue-manager | 無 | 無 | 僅對話管理 |

### 自動執行流程

1. **Spawn 子 Agent 時**：
   - 執行 `post_task_scanner.py --context <json_file>`
   - 檢測到 Critical/High → 拒絕並告警

2. **執行 exec 命令時**：
   - 檢測危險指令模式
   - 檢測到 → 拒絕並告警

3. **修改配置時**：
   - 檢測配置修改嘗試
   - 記錄並評估風險

### 緊急聯絡

如果檢測到 Critical 級急威脅，可以透過以下方式聯繫：
- Telegram: @DufuTheSage
- 電話：緊急時直接撥打

---

*本文檔會持續更新，記錄所有 Agent 系統的重要變更*
