---
summary: "如何在本機執行測試（Vitest），以及何時使用強制／覆蓋模式"
read_when:
  - 執行或修復測試時
title: "測試"
x-i18n:
  source_path: reference/test.md
  source_hash: be7b751fb81c8c94
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:38Z
---

# 測試

- 完整測試工具組（測試套件、即時、Docker）：[Testing](/testing)

- `pnpm test:force`：終止任何仍佔用預設控制連接埠的 Gateway 閘道器 行程，然後以隔離的 Gateway 閘道器 連接埠執行完整的 Vitest 測試套件，避免伺服器測試與正在執行的實例發生衝突。當先前的 Gateway 閘道器 執行佔用了 18789 連接埠時使用。
- `pnpm test:coverage`：以 V8 覆蓋率執行 Vitest。全域門檻為行數／分支／函式／敘述各 70%。覆蓋率會排除整合度高的進入點（CLI 連線、gateway/telegram 橋接、webchat 靜態伺服器），以將目標聚焦於可進行單元測試的邏輯。
- `pnpm test:e2e`：執行 Gateway 閘道器 端對端冒煙測試（多實例 WS/HTTP/node 配對）。
- `pnpm test:live`：執行提供者即時測試（minimax/zai）。需要 API 金鑰，並設定 `LIVE=1`（或提供者專用的 `*_LIVE_TEST=1`）才能取消跳過。

## 模型延遲基準測試（本機金鑰）

腳本：[`scripts/bench-model.ts`](https://github.com/openclaw/openclaw/blob/main/scripts/bench-model.ts)

用法：

- `source ~/.profile && pnpm tsx scripts/bench-model.ts --runs 10`
- 選用環境變數：`MINIMAX_API_KEY`、`MINIMAX_BASE_URL`、`MINIMAX_MODEL`、`ANTHROPIC_API_KEY`
- 預設提示：「回覆一個單字：ok。不要標點或額外文字。」

最近一次執行（2025-12-31，20 次）：

- minimax 中位數 1279ms（最小 1114，最大 2431）
- opus 中位數 2454ms（最小 1224，最大 3170）

## 入門引導 E2E（Docker）

Docker 為選用；僅在進行容器化的入門引導冒煙測試時需要。

在乾淨的 Linux 容器中進行完整冷啟動流程：

```bash
scripts/e2e/onboard-docker.sh
```

此腳本透過偽 tty 驅動互動式精靈，驗證設定／工作區／工作階段檔案，接著啟動 Gateway 閘道器 並執行 `openclaw health`。

## QR 匯入冒煙測試（Docker）

確保 `qrcode-terminal` 能在 Docker 的 Node 22+ 下載入：

```bash
pnpm test:docker:qr
```
