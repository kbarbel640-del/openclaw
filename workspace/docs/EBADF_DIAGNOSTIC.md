# EBADF 診斷經驗

> spawn EBADF (Bad file descriptor) 錯誤的診斷與修復記錄

---

## 錯誤描述

```
spawn failed (spawn EBADF syscall=spawn errno=-9)
[tools] exec failed: spawn EBADF
```

exec tool 在 spawn 子進程時，使用了已失效的 file descriptor。

---

## 診斷樹

```
重開機後 exec 正常？
├── ✅ 是 → 問題在 runtime 狀態
│   ├── 可能是 SIGUSR1 熱重啟後的殘留 fd
│   ├── 可能是某個長跑的 process 污染了 fd table
│   └── 結論：需要完整 process 重啟，不是 session/gateway 重啟
│
└── ❌ 否 → 問題在持久化層或系統層
    ├── 可能是 clawdbot 安裝損壞
    ├── 可能是 Node.js 版本問題
    ├── 可能是 macOS 系統問題
    └── 結論：需要重裝 clawdbot 或檢查系統
```

---

## 已嘗試的修復（無效）

| 方法 | 命令 | 結果 |
|------|------|------|
| Gateway kickstart | `launchctl kickstart -k gui/501/com.clawdbot.gateway` | ❌ |
| Kill all clawdbot | `pkill -9 -f clawdbot` | ❌ |
| Bootout + Bootstrap | `launchctl bootout` + `bootstrap` | ❌ |
| Kill MCP servers | `pkill -9 -f mcp` | ❌ |
| 新 session | `/new` | ❌ |
| Session restart | `/restart` | ❌ |

---

## 有效的修復

### 1. 完整重開機（最可靠）

```bash
sudo reboot
# 或
# Apple menu → Restart
```

### 2. 預防措施

- 避免使用 SIGUSR1 熱重啟
- 使用 `launchctl kickstart -k` 而不是 `stop + start`
- 安裝 error-recovery hook 做自動偵測

---

## 自癒機制

### Watchdog (crontab 每 10 分鐘)

```bash
# 檢測 EBADF → kickstart
check_ebadf_errors() {
    tail -500 "$LOG_FILE" | grep -c "spawn EBADF"
}
```

### Error-recovery hook (即時)

```javascript
// 監聽 tool.error 事件
// 檢測 EBADF → launchctl kickstart
```

---

## 學到的教訓

1. **Gateway restart ≠ Session reset ≠ exec fix**
   - Gateway 是 process
   - Session 是 gateway 內的 state
   - exec tool 有自己的 fd 狀態

2. **SIGUSR1 熱重啟不乾淨**
   - 不會重新初始化所有模組
   - fd 可能殘留在舊狀態

3. **MCP servers 是獨立 process**
   - 不隨 gateway 重啟
   - 需要單獨管理

4. **開機自啟清單很重要**
   - clawdbot gateway: LaunchAgent ✅
   - telegram bridge: LaunchAgent ✅
   - watchdog: crontab ✅

---

## 相關 Issue

- [moltbot/moltbot#1484](https://github.com/moltbot/moltbot/issues/1484) - spawn EBADF

---

*記錄日期：2026-01-28*
*經歷者：無極 + x01clawbot*
