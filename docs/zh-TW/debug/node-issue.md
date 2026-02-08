---
summary: Node + tsx「__name is not a function」當機的說明與因應作法
read_when:
  - 偵錯僅限 Node 的開發腳本或 watch 模式失敗
  - 調查 OpenClaw 中的 tsx / esbuild 載入器當機
title: "Node + tsx 當機"
x-i18n:
  source_path: debug/node-issue.md
  source_hash: f9e9bd2281508337
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:14Z
---

# Node + tsx "\_\_name is not a function" 當機

## 摘要

透過 Node 執行 OpenClaw 並啟用 `tsx` 時，啟動即失敗，錯誤為：

```
[openclaw] Failed to start CLI: TypeError: __name is not a function
    at createSubsystemLogger (.../src/logging/subsystem.ts:203:25)
    at .../src/agents/auth-profiles/constants.ts:25:20
```

此問題發生於將開發腳本從 Bun 切換為 `tsx` 之後（提交 `2871657e`，2026-01-06）。相同的執行路徑在 Bun 下可正常運作。

## 環境

- Node：v25.x（於 v25.3.0 觀察到）
- tsx：4.21.0
- OS：macOS（在可執行 Node 25 的其他平台上也可能可重現）

## 重現方式（僅 Node）

```bash
# in repo root
node --version
pnpm install
node --import tsx src/entry.ts status
```

## 儲存庫中的最小重現

```bash
node --import tsx scripts/repro/tsx-name-repro.ts
```

## Node 版本檢查

- Node 25.3.0：失敗
- Node 22.22.0（Homebrew `node@22`）：失敗
- Node 24：此處尚未安裝；需要驗證

## 備註／假設

- `tsx` 使用 esbuild 轉換 TS/ESM。esbuild 的 `keepNames` 會產生 `__name` 輔助函式，並以 `__name(...)` 包裝函式定義。
- 當機顯示 `__name` 在執行期存在但不是函式，這表示在 Node 25 的載入器路徑中，該模組的輔助函式遺失或被覆寫。
- 在其他 esbuild 使用者中，當輔助函式遺失或被重寫時，也曾回報過類似的 `__name` 輔助函式問題。

## 退化歷史

- `2871657e`（2026-01-06）：為了讓 Bun 成為可選項，腳本從 Bun 改為 tsx。
- 在此之前（Bun 路徑），`openclaw status` 與 `gateway:watch` 均可運作。

## 因應作法

- 開發腳本使用 Bun（目前的暫時性回退）。
- 使用 Node + tsc watch，然後執行編譯後的輸出：
  ```bash
  pnpm exec tsc --watch --preserveWatchOutput
  node --watch openclaw.mjs status
  ```
- 本地確認：`pnpm exec tsc -p tsconfig.json` + `node openclaw.mjs status` 在 Node 25 上可運作。
- 若可行，停用 TS 載入器中的 esbuild keepNames（可避免插入 `__name` 輔助函式）；tsx 目前未提供此選項。
- 以 `tsx` 測試 Node LTS（22／24），確認是否為 Node 25 專屬問題。

## 參考

- https://opennext.js.org/cloudflare/howtos/keep_names
- https://esbuild.github.io/api/#keep-names
- https://github.com/evanw/esbuild/issues/1031

## 下一步

- 在 Node 22／24 上重現，以確認是否為 Node 25 的回歸問題。
- 測試 `tsx` nightly，或在存在已知回歸時固定至較早版本。
- 若在 Node LTS 上可重現，請附上 `__name` 的堆疊追蹤，向上游提交最小重現。
