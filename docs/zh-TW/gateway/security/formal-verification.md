---
title: 形式化驗證（安全模型）
summary: 針對 OpenClaw 最高風險路徑的機器檢查安全模型。
permalink: /security/formal-verification/
x-i18n:
  source_path: gateway/security/formal-verification.md
  source_hash: 8dff6ea41a37fb6b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:39Z
---

# 形式化驗證（安全模型）

本頁追蹤 OpenClaw 的**形式化安全模型**（目前使用 TLA+/TLC；視需要再加入更多）。

> 注意：部分較舊的連結可能仍指向先前的專案名稱。

**目標（北極星）：** 在明確假設之下，提供一個經由機器檢查的論證，證明 OpenClaw 會強制執行其預期的安全政策（授權、工作階段隔離、工具閘控，以及錯誤設定安全性）。

**這是什麼（目前）：** 一個可執行、以攻擊者為導向的**安全回歸測試套件**：

- 每一項主張都有一個可執行的模型檢查，涵蓋有限的狀態空間。
- 許多主張都配有一個對應的**負向模型**，可針對實際的錯誤類型產生反例軌跡。

**這不是什麼（目前尚未）：** 並非「OpenClaw 在所有面向上都是安全的」之證明，也不是對完整 TypeScript 實作正確性的證明。

## 模型存放位置

模型維護於獨立的 repo 中：[vignesh07/openclaw-formal-models](https://github.com/vignesh07/openclaw-formal-models)。

## 重要注意事項

- 這些是**模型**，而非完整的 TypeScript 實作。模型與程式碼之間可能產生漂移。
- 結果受限於 TLC 探索的狀態空間；顯示為「綠色」並不代表在模型假設與邊界之外仍具備安全性。
- 部分主張依賴明確的環境假設（例如正確的部署、正確的設定輸入）。

## 重現結果

目前可透過在本機複製模型 repo 並執行 TLC 來重現結果（見下文）。未來的迭代可能提供：

- 由 CI 執行的模型，並提供公開成品（反例軌跡、執行紀錄）
- 一個託管的「執行此模型」工作流程，適用於小型、受限的檢查

入門指南：

```bash
git clone https://github.com/vignesh07/openclaw-formal-models
cd openclaw-formal-models

# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned `tla2tools.jar` (TLA+ tools) and provides `bin/tlc` + Make targets.

make <target>
```

### Gateway 曝露與開放 Gateway 閘道器錯誤設定

**主張：** 在未驗證的情況下綁定至 loopback 以外，可能導致遠端入侵／增加曝露面；依模型假設，權杖／密碼可阻擋未授權的攻擊者。

- 綠色執行結果：
  - `make gateway-exposure-v2`
  - `make gateway-exposure-v2-protected`
- 紅色（符合預期）：
  - `make gateway-exposure-v2-negative`

另請參閱模型 repo 中的：`docs/gateway-exposure-matrix.md`。

### Nodes.run 管線（最高風險能力）

**主張：** `nodes.run` 需要（a）節點指令允許清單加上已宣告的指令，以及（b）在設定時需有即時核准；在模型中，核准會被權杖化以防止重放。

- 綠色執行結果：
  - `make nodes-pipeline`
  - `make approvals-token`
- 紅色（符合預期）：
  - `make nodes-pipeline-negative`
  - `make approvals-token-negative`

### 配對儲存（私訊閘控）

**主張：** 配對請求會遵守 TTL 與待處理請求上限。

- 綠色執行結果：
  - `make pairing`
  - `make pairing-cap`
- 紅色（符合預期）：
  - `make pairing-negative`
  - `make pairing-cap-negative`

### 入口閘控（提及 + 控制指令繞過）

**主張：** 在需要提及的群組情境中，未授權的「控制指令」無法繞過提及閘控。

- 綠色：
  - `make ingress-gating`
- 紅色（符合預期）：
  - `make ingress-gating-negative`

### 路由／工作階段金鑰隔離

**主張：** 來自不同同儕的私訊不會合併成同一個工作階段，除非明確連結／設定。

- 綠色：
  - `make routing-isolation`
- 紅色（符合預期）：
  - `make routing-isolation-negative`

## v1++：額外的受限模型（併發、重試、軌跡正確性）

這些是後續模型，用於在真實世界的失敗模式（非原子更新、重試，以及訊息扇出）周圍提升擬真度。

### 配對儲存併發／冪等性

**主張：** 配對儲存應即使在交錯執行下，也能強制執行 `MaxPending` 與冪等性（亦即「檢查後寫入」必須是原子性／加鎖；重新整理不應建立重複項目）。

其含義為：

- 在併發請求下，單一頻道不可超過 `MaxPending`。
- 對同一個 `(channel, sender)` 的重複請求／重新整理，不應建立重複的即時待處理列。

- 綠色執行結果：
  - `make pairing-race`（原子性／加鎖的上限檢查）
  - `make pairing-idempotency`
  - `make pairing-refresh`
  - `make pairing-refresh-race`
- 紅色（符合預期）：
  - `make pairing-race-negative`（非原子 begin/commit 的上限競態）
  - `make pairing-idempotency-negative`
  - `make pairing-refresh-negative`
  - `make pairing-refresh-race-negative`

### 入口軌跡關聯／冪等性

**主張：** 攝取流程應在扇出時保留軌跡關聯，並在提供者重試下保持冪等。

其含義為：

- 當一個外部事件轉換為多個內部訊息時，每個部分都維持相同的軌跡／事件識別。
- 重試不會導致重複處理。
- 若缺少提供者事件 ID，去重應回退至安全的金鑰（例如軌跡 ID），以避免丟棄不同的事件。

- 綠色：
  - `make ingress-trace`
  - `make ingress-trace2`
  - `make ingress-idempotency`
  - `make ingress-dedupe-fallback`
- 紅色（符合預期）：
  - `make ingress-trace-negative`
  - `make ingress-trace2-negative`
  - `make ingress-idempotency-negative`
  - `make ingress-dedupe-fallback-negative`

### 路由 dmScope 優先順序 + identityLinks

**主張：** 路由必須在預設情況下維持私訊工作階段隔離，且僅在明確設定時才合併工作階段（頻道優先順序 + 身分連結）。

其含義為：

- 頻道層級的 dmScope 覆寫必須優先於全域預設值。
- identityLinks 僅能在明確連結的群組內合併，不得跨越不相關的同儕。

- 綠色：
  - `make routing-precedence`
  - `make routing-identitylinks`
- 紅色（符合預期）：
  - `make routing-precedence-negative`
  - `make routing-identitylinks-negative`
