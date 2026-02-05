# Clawdbot File Descriptor Leak Bug Report

## 問題描述
Node.js gateway 進程（PID 20413）累積了 13,400+ 個打開的檔案描述符，主要是 Python venv 的 `.pyc` 檔案。這些 fd 在 spawn 子進程時被繼承，但從未關閉，最終導致 `EBADF` 錯誤。

## 根本原因
在 `dist/node-host/runner.js` 第 210-215 行：

```javascript
const child = spawn(argv[0], argv.slice(1), {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
});
```

**缺少 fd 關閉機制**。Node.js 預設會讓子進程繼承所有打開的 fd（除了 stdio）。

### 影響範圍
- `dist/node-host/runner.js` - runCommand() 函數
- `dist/process/spawn-utils.js` - spawnWithFallback() 函數
- `dist/agents/bash-tools.exec.js` - 所有使用 spawn 的地方

## 解決方案

### 選項 A：Node.js 原生支持（推薦，Node.js 20.5.0+）

在 spawn options 中加入 `closeOnExec`:

```javascript
const child = spawn(argv[0], argv.slice(1), {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    closeOnExec: true,  // ✅ 新增：自動設置 O_CLOEXEC
});
```

### 選項 B：明確設置 stdio（兼容舊版 Node.js）

```javascript
const child = spawn(argv[0], argv.slice(1), {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: false,  // 確保不分離
    serialization: 'advanced', // 防止 fd 傳遞
});
```

### 選項 C：Workaround（限制 fd 數量）

在 gateway 啟動前設置 ulimit：

```bash
ulimit -n 4096
exec /opt/homebrew/bin/clawdbot gateway
```

## 需要修改的檔案

1. `src/node-host/runner.ts` - runCommand() 函數
2. `src/process/spawn-utils.ts` - spawnAndWaitForSpawn() 函數  
3. `src/agents/bash-tools.exec.ts` - runExecProcess() 函數
4. 所有其他使用 child_process.spawn() 的地方

## 驗證方法

修復後，執行：

```bash
# 找到 gateway 進程
pgrep -f clawdbot | head -1

# 檢查 fd 數量（應該 < 200）
lsof -p <PID> | wc -l

# 檢查是否有大量 REG 類型 fd
lsof -p <PID> | awk '{print $5}' | sort | uniq -c | sort -rn
```

正常情況應該：
- 總 fd < 200
- REG 類型 fd < 50

## 參考資料
- Node.js spawn options: https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
- POSIX O_CLOEXEC: https://man7.org/linux/man-pages/man2/open.2.html

## 影響版本
- clawdbot 2026.1.24-3（當前版本）
- 可能影響所有使用 spawn 的版本

---

**診斷日期**: 2026-01-29  
**報告人**: sulaxd  
**優先級**: High（會導致系統不可用）
