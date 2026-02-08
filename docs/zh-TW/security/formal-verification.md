---
title: 形式化驗證（安全模型）
summary: 針對 OpenClaw 最高風險路徑的機器檢查安全模型。
permalink: /security/formal-verification/
x-i18n:
  source_path: security/formal-verification.md
  source_hash: 8dff6ea41a37fb6b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:49Z
---

# 形式化驗證（安全模型）

本頁追蹤 OpenClaw 的 **形式化安全模型**（目前為 TLA+/TLC；視需求增加）。

> 注意：部分較舊的連結可能仍指向先前的專案名稱。

**目標（北極星）：** 在明確假設下，提供一個經機器檢查的論證，證明 OpenClaw 會強制其
預期的安全政策（授權、工作階段隔離、工具管控，以及
錯誤設定安全性）。

**這是什麼（目前）：** 一個可執行、以攻擊者為驅動的 **安全回歸測試套件**：

- 每一項主張都有一個可執行的模型檢查，涵蓋有限的狀態空間。
- 許多主張都搭配一個 **負向模型**，可針對真實的錯誤類型產生反例軌跡。

**這不是什麼（尚未）：** 這不是「OpenClaw 在所有面向都安全」的證明，也不是完整 TypeScript 實作正確性的證明。

## 模型存放位置

模型維護於獨立的儲存庫：[vignesh07/openclaw-formal-models](https://github.com/vignesh07/openclaw-formal-models)。

## 重要注意事項

- 這些是 **模型**，不是完整的 TypeScript 實作。模型與程式碼之間可能產生偏移。
- 結果受 TLC 探索之狀態空間所限；「綠燈」不代表在模型假設與界限之外仍具安全性。
- 部分主張依賴明確的環境假設（例如：正確部署、正確的設定輸入）。

## 重現結果

目前，需在本機複製模型儲存庫並執行 TLC（見下）。未來的迭代可能提供：

- 由 CI 執行的模型與公開成品（反例軌跡、執行記錄）
- 為小型、有界檢查提供的託管「執行此模型」工作流程

開始入門：

```bash
git clone https://github.com/vignesh07/openclaw-formal-models
cd openclaw-formal-models

# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned `tla2tools.jar` (TLA+ tools) and provides `bin/tlc` + Make targets.

make <target>
```

### Gateway 曝露與開放 Gateway 設定錯誤

**主張：** 在未驗證的情況下，繫結至 loopback 之外可能導致遠端入侵或增加曝露面；權杖／密碼可阻擋未授權攻擊者（依模型假設）。

- 綠燈執行：
  - `make gateway-exposure-v2`
  - `make gateway-exposure-v2-protected`
- 紅燈（預期）：
  - `make gateway-exposure-v2-negative`

另請參見模型儲存庫中的：`docs/gateway-exposure-matrix.md`。

### Nodes.run 管線（最高風險能力）

**主張：** `nodes.run` 需要（a）節點指令允許清單與宣告的指令，且（b）在設定時需即時核准；核准在模型中以權杖化以防止重放。

- 綠燈執行：
  - `make nodes-pipeline`
  - `make approvals-token`
- 紅燈（預期）：
  - `make nodes-pipeline-negative`
  - `make approvals-token-negative`

### 配對儲存（私訊 管控）

**主張：** 配對請求遵守 TTL 與待處理請求上限。

- 綠燈執行：
  - `make pairing`
  - `make pairing-cap`
- 紅燈（預期）：
  - `make pairing-negative`
  - `make pairing-cap-negative`

### 入口管控（提及 + 控制指令繞過）

**主張：** 在需要提及的群組情境中，未授權的「控制指令」無法繞過提及管控。

- 綠燈：
  - `make ingress-gating`
- 紅燈（預期）：
  - `make ingress-gating-negative`

### 路由／工作階段金鑰隔離

**主張：** 來自不同對等方的私訊不會合併為同一個工作階段，除非明確連結／設定。

- 綠燈：
  - `make routing-isolation`
- 紅燈（預期）：
  - `make routing-isolation-negative`

## v1++：額外的有界模型（併發、重試、軌跡正確性）

這些是後續模型，用於強化對真實世界失敗模式（非原子更新、重試，以及訊息扇出）的擬真度。

### 配對儲存併發／冪等性

**主張：** 配對儲存即使在交錯執行下，也應強制 `MaxPending` 與冪等性（亦即「檢查後寫入」必須是原子或加鎖；重新整理不應建立重複項目）。

其意涵為：

- 在併發請求下，單一頻道不可超過 `MaxPending`。
- 對相同 `(channel, sender)` 的重複請求／重新整理，不應建立重複的即時待處理列。

- 綠燈執行：
  - `make pairing-race`（原子／加鎖的上限檢查）
  - `make pairing-idempotency`
  - `make pairing-refresh`
  - `make pairing-refresh-race`
- 紅燈（預期）：
  - `make pairing-race-negative`（非原子的開始／提交上限競態）
  - `make pairing-idempotency-negative`
  - `make pairing-refresh-negative`
  - `make pairing-refresh-race-negative`

### 入口軌跡關聯／冪等性

**主張：** 擷取流程應在扇出時保留軌跡關聯，並在提供者重試下保持冪等。

其意涵為：

- 當一個外部事件變成多個內部訊息時，每個部分都保留相同的軌跡／事件身分。
- 重試不會導致重複處理。
- 若缺少提供者事件 ID，去重會退回到安全的鍵（例如：軌跡 ID），以避免丟棄不同事件。

- 綠燈：
  - `make ingress-trace`
  - `make ingress-trace2`
  - `make ingress-idempotency`
  - `make ingress-dedupe-fallback`
- 紅燈（預期）：
  - `make ingress-trace-negative`
  - `make ingress-trace2-negative`
  - `make ingress-idempotency-negative`
  - `make ingress-dedupe-fallback-negative`

### 路由 dmScope 優先序 + identityLinks

**主張：** 路由必須預設維持私訊工作階段隔離，且僅在明確設定時才合併工作階段（頻道優先序 + 身分連結）。

其意涵為：

- 頻道專屬的 dmScope 覆寫必須優先於全域預設。
- identityLinks 僅應在明確連結的群組內合併，而非跨越不相關的對等方。

- 綠燈：
  - `make routing-precedence`
  - `make routing-identitylinks`
- 紅燈（預期）：
  - `make routing-precedence-negative`
  - `make routing-identitylinks-negative`
