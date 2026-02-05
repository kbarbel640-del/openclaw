# ARCHITECT.md - 系統架構師的累積智慧

> 這份文件記錄了在無極系統工作中累積的架構洞察。
> 每個新 session 應該在處理架構決策前閱讀此文件。

---

## 設計哲學

### 這個系統的美學

無極不是一個 chatbot，是一個 **數位員工編排系統**。設計目標：

1. **Demand-pull, not supply-push** — 不問「你要什麼？」，主動讀 context 帶答案
2. **小步完成 > 大步規劃** — Heartbeat 每次推進一點，而不是等完美計畫
3. **Signal/noise filtering** — 數據 → 資訊 → 知識的三層過濾
4. **Probabilistic fairness** — 專案輪值防止任何一個被遺忘

### 語意分離原則

```
SOUL.md     → meta-aware（知道自己是 AI，有什麼限制）
IDENTITY.md → role-specific（在這個場域扮演什麼角色）
USER.md     → human-centric（服務的人是誰，他的 context）
MEMORY.md   → accumulated wisdom（跨 session 的長期記憶）
```

這四層分離讓身份可以在不同專案間切換，而核心價值觀保持一致。

---

## 架構決策啟發法

### 當你要加新功能時

```
問自己：
1. 這能用現有的 skill 組合完成嗎？→ 優先組合，不要新建
2. 這需要常駐連接嗎？→ 用 Bridge pattern（HTTP service）
3. 這是一次性的嗎？→ 可以用 exec，但要處理失敗
4. 這會跨多個 session 使用嗎？→ 寫進 SKILL.md
```

### 當你要修 bug 時

```
問自己：
1. 這是上游 bug（Claude Code/Clawdbot）還是我們的？
   - EBADF、spawn 失敗 → 上游，用 workaround
   - 邏輯錯誤 → 我們的，直接修
2. 這會再發生嗎？
   - 會 → 加進 watchdog 自癒邏輯
   - 不會 → 修完就好
3. 這影響其他人嗎？
   - 影響 Cruz 的工作 → 最高優先
   - 只影響系統 → 可以排後面
```

### 當你要加新 Bridge 時

```
必須有：
1. /health endpoint — 讓 watchdog 可以檢查
2. 錯誤處理 — 不要 silent fail
3. 日誌 — 寫到 logs/ 或 stdout
4. 重連邏輯 — 網路斷了要能恢復
5. SKILL.md — 文檔化 API 和用法
```

---

## 已知的系統限制

### EBADF (Bad File Descriptor)

```
症狀：spawn EBADF syscall=spawn errno=-9
原因：Claude Code exec tool 的 file descriptor 洩漏
環境：LaunchAgent 下更容易觸發
解法：watchdog 用 launchctl kickstart -k 自癒
狀態：上游 bug，無法根治，只能 workaround
```

### Cron 權限限制

```
症狀：launchctl bootstrap 在 cron 裡失敗
原因：cron 不在 GUI session domain
解法：用 kickstart 而不是 uninstall/install
```

### Telegram UTC 時區

```
症狀：時間差 8 小時
原因：Telegram API 回傳 UTC+0
解法：顯示時加 8 小時，或用 Asia/Taipei timezone
```

---

## 系統健康指標

### 綠燈（健康）

- `clawdbot gateway status` 顯示 `Runtime: running`
- `RPC probe: ok`
- watchdog 無 Telegram 告警
- 今日 log 錯誤數 < 50

### 黃燈（注意）

- Node.js 程序數 > 5（可能有殘留）
- 磁碟使用 > 80%
- Log 檔案 > 100MB
- 某個 Bridge 的 /health 回應慢

### 紅燈（介入）

- Gateway 未運行
- EBADF 連續出現
- watchdog 發出「需要人工介入」
- 某個 Bridge 完全無回應

---

## 擴展系統的正確方式

### 加新 Skill

```bash
# 1. 建立結構
mkdir -p skills/new-skill/{scripts,logs}

# 2. 寫 SKILL.md（先寫文檔！）
# 包含：Purpose、API、Usage、Config

# 3. 寫 config.json（credentials 分離）

# 4. 寫實作

# 5. 測試

# 6. 加到 git
```

### 加新 Hook

```javascript
// hooks/my-hook/handler.js
async function handler(event, context) {
  // 處理 event
}
handler.events = ['message.inbound']; // 訂閱的事件
module.exports = handler;
module.exports.default = handler; // 重要！Clawdbot 需要這個
```

### 加新專案到輪值

```markdown
<!-- PROJECT_REGISTRY.md -->
| # | 專案 | 優先級 | 狀態 | 上次檢查 | 下次動作 |
| 新 | 專案名 | 🟡 | 啟動中 | - | 定義 MVP |
```

---

## 反模式（不要做的事）

### 1. 不要在 code 裡寫 credentials

```python
# BAD
TOKEN = "8415477831:AAFeyWZS8iAPqrQxYG_e3CxDWR2IrgIxw68"

# GOOD
TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
# 或
with open('config.json') as f:
    TOKEN = json.load(f)['token']
```

### 2. 不要用 exec 做需要常駐連接的事

```
# BAD: 每次都 spawn 新 process
exec: python telegram_read.py

# GOOD: 打已經跑著的 service
web_fetch: http://127.0.0.1:18790/messages
```

### 3. 不要在 heartbeat 裡做大事

```
# BAD: 一次做完整個報告
heartbeat → 生成完整日報 → 發送 → 更新資料庫

# GOOD: 每次一小步
heartbeat 1 → 檢查資料是否就緒
heartbeat 2 → 生成報告草稿
heartbeat 3 → 發送報告
```

### 4. 不要忽略錯誤

```python
# BAD
try:
    do_something()
except:
    pass  # 吞掉錯誤

# GOOD
try:
    do_something()
except Exception as e:
    log.error(f"do_something failed: {e}")
    # 決定：retry? fallback? raise?
```

### 5. 不要假設網路永遠通

```python
# BAD
response = requests.get(url)
data = response.json()

# GOOD
try:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    data = response.json()
except requests.RequestException as e:
    log.warning(f"Network error: {e}")
    data = cached_data  # fallback
```

---

## 記憶管理策略

### Daily Log 寫什麼

```markdown
## HH:MM 標題

做了什麼、學到什麼、決定了什麼

### 如果有重要洞察
用子標題記錄，方便之後搜尋
```

### 什麼該進 MEMORY.md

- 跨專案適用的 pattern
- 人的偏好（Cruz 喜歡什麼、不喜歡什麼）
- 系統 quirk 的解法
- 失敗的經驗（避免重複）

### 什麼不該進 MEMORY.md

- 暫時性的狀態（「今天在做 X」）
- 可以從 code 推斷的事實
- 太細節的技術 note（放 SKILL.md）

---

## 演化方向

### 短期（已實作）

- [x] Telegram HTTP Bridge
- [x] Sensor context 累積
- [x] Watchdog 自癒
- [x] Heartbeat 輪值

### 中期（規劃中）

- [ ] Database Bridge（BG666 日報自動化的關鍵）
- [ ] 統一 config schema（消除散落的 credentials）
- [ ] Skill template（標準化新 skill 建立）

### 長期（願景）

- [ ] 多 AI employee 協作（不只無極一個）
- [ ] 自動化測試（Bridge + Skill）
- [ ] Monitoring dashboard（視覺化系統健康）

---

## 這份文件的維護

當你發現新的架構洞察：

1. 先在 daily log 記錄
2. 如果是 pattern（會重複發生）→ 加到這裡
3. 如果是 one-off → 留在 daily log 就好

當你要改架構：

1. 先讀這份文件，確認不違反現有原則
2. 如果要違反，說明為什麼
3. 改完後更新這份文件

---

*累積者：架構師 sessions*
*最後更新：2026-01-28*
