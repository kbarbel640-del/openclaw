# 思考凍結調查報告 (Thought Freeze Investigation)

**日期**：2026-02-06
**事件**：無極在對話中途停止回應 30 分鐘
**狀態**：已記錄，待下次發生時進一步調查

---

## 問題命名：「思考凍結」(Thought Freeze)

**定義**：Bot 在處理過程中卡住，新訊息排隊但永不處理，直到外部干預（容器重啟）。

**與「失憶性昏迷」的區別**：

- 失憶性昏迷：忘記發生了什麼
- 思考凍結：記得，但思考過程卡住了

---

## 事件時間線

```
09:28:59 UTC — 無極生成「多信箱檢查系統成功上線」報告並發送
09:40:41 UTC — 杜甫提供更多密碼
09:42:09 UTC — 無極回報「5 信箱系統運作成功」
09:42:58.429 UTC — 無極說「現在讓我更新多信箱系統的記憶文件」(toolCall)
09:42:58.581 UTC — Tool result: "Successfully replaced text..." ✅

【這裡開始凍結 — 30 分鐘無任何記錄】

09:45:xx UTC — 杜甫問「為何中斷了」← 沒有 log，訊息被 queue
10:12:57 UTC — 杜甫問「為何不回覆?」← 這時才有新 log
10:14:05 UTC — 無極恢復回應（困惑狀態）
```

---

## 技術發現

### 1. Session JSONL 證據

最後兩條記錄的 parentId 鏈：

```
eaef9250 (09:42:58.581) — toolResult: "Successfully replaced text..."
    ↓
db14b0bc (10:12:57.604) — user: "為何不回覆？" (parentId = eaef9250)
```

**結論**：Tool result 返回後，系統準備下一輪 API 呼叫，但呼叫從未完成/返回。

### 2. 現有 Stuck 檢測機制

位置：`src/logging/diagnostic.ts:346`

```typescript
// 每 30 秒執行一次
if (state.state === "processing" && ageMs > 120_000) {  // 2 分鐘
  logSessionStuck({...});  // 只記錄，不恢復！
}
```

**問題**：檢測到 stuck 但只是 log，沒有恢復動作。

### 3. 現有超時機制

位置：`src/agents/timeout.ts`

```typescript
const DEFAULT_AGENT_TIMEOUT_SECONDS = 600; // 10 分鐘
```

**問題**：這次卡了 30 分鐘，超時為何沒觸發？

---

## 開放問題（下次調查方向）

### Q1: 超時為何沒生效？

可能原因：

- [ ] 超時只套用在「整個 run」開始時，不是每次 API 呼叫
- [ ] Tool result 後的下一輪呼叫可能沒有帶超時
- [ ] 超時觸發了但沒有正確處理
- [ ] DeepSeek API 有自己的超時問題

**調查入口**：

- `src/agents/pi-embedded-runner/run/attempt.ts` - 查看 timeout 設置位置
- `streamSimple` 呼叫 - 是否有獨立超時

### Q2: Stuck Session 該如何恢復？

選項：

- [ ] 自動 abort stuck session（風險：可能打斷正常長操作）
- [ ] 強制釋放 session，讓新訊息可以處理
- [ ] 保留 session 但允許新訊息開新 session

### Q3: 新訊息排隊機制

當 session 處於 "processing" 時：

- 新訊息會被 queue
- Queue 沒有超時
- 如果 session 永不完成，queue 永不處理

**調查入口**：

- `src/auto-reply/reply/queue/enqueue.ts`
- Session state management

---

## 復現條件（推測）

1. Session 使用 DeepSeek API（較不穩定？）
2. 長時間對話，token 數接近上限（57k tokens）
3. 連續多次 tool use 後
4. 可能與網路狀況有關

---

## 相關檔案

| 檔案                                           | 用途                   |
| ---------------------------------------------- | ---------------------- |
| `src/logging/diagnostic.ts`                    | Stuck 檢測（line 346） |
| `src/agents/timeout.ts`                        | 預設超時設定           |
| `src/agents/pi-embedded-runner/run.ts`         | 主要執行迴圈           |
| `src/agents/pi-embedded-runner/run/attempt.ts` | 單次嘗試邏輯           |
| `src/infra/diagnostic-events.ts`               | 診斷事件定義           |

---

## 下次發生時的檢查清單

1. [ ] 立即檢查 docker logs 中的 `session.stuck` 警告
2. [ ] 檢查 session jsonl 最後幾條記錄
3. [ ] 確認最後一條是 toolResult 還是 assistant message
4. [ ] 記錄當時的 token 數
5. [ ] 記錄使用的 provider/model
6. [ ] 檢查網路狀況

---

_這份報告讓下次發生類似問題時有調查起點。_
