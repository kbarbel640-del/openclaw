---
summary: "疑難排解中樞：症狀 → 檢查 → 修復"
read_when:
  - 你看到錯誤並想要修復路徑
  - 安裝程式顯示「成功」，但 CLI 無法運作
title: "疑難排解"
x-i18n:
  source_path: help/troubleshooting.md
  source_hash: 00ba2a20732fa22c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:34Z
---

# 疑難排解

## 最初的 60 秒

依序執行以下項目：

```bash
openclaw status
openclaw status --all
openclaw gateway probe
openclaw logs --follow
openclaw doctor
```

如果 Gateway 閘道器 可連線，進行深度探測：

```bash
openclaw status --deep
```

## 常見「它壞了」的情況

### `openclaw: command not found`

幾乎總是 Node/npm PATH 的問題。從這裡開始：

- [安裝（Node/npm PATH 健全性檢查）](/install#nodejs--npm-path-sanity)

### 安裝程式失敗（或你需要完整記錄）

以詳細模式重新執行安裝程式，以查看完整追蹤與 npm 輸出：

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --verbose
```

對於 beta 安裝：

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --beta --verbose
```

你也可以設定 `OPENCLAW_VERBOSE=1` 來取代旗標。

### Gateway 閘道器 顯示「unauthorized」、無法連線，或持續重新連線

- [Gateway 疑難排解](/gateway/troubleshooting)
- [Gateway 驗證](/gateway/authentication)

### Control UI 在 HTTP 上失敗（需要裝置身分）

- [Gateway 疑難排解](/gateway/troubleshooting)
- [Control UI](/web/control-ui#insecure-http)

### `docs.openclaw.ai` 顯示 SSL 錯誤（Comcast/Xfinity）

部分 Comcast/Xfinity 連線會透過 Xfinity Advanced Security 封鎖 `docs.openclaw.ai`。
停用 Advanced Security，或將 `docs.openclaw.ai` 加入允許清單後再重試。

- Xfinity Advanced Security 說明： https://www.xfinity.com/support/articles/using-xfinity-xfi-advanced-security
- 快速健全性檢查：嘗試行動熱點或 VPN，以確認是否為 ISP 層級的過濾

### 服務顯示正在執行，但 RPC 探測失敗

- [Gateway 疑難排解](/gateway/troubleshooting)
- [背景程序／服務](/gateway/background-process)

### 模型／驗證失敗（速率限制、計費、「所有模型都失敗」）

- [模型](/cli/models)
- [OAuth／驗證概念](/concepts/oauth)

### `/model` 顯示 `model not allowed`

這通常表示 `agents.defaults.models` 被設定為允許清單。當它為非空時，
只能選擇那些提供者／模型金鑰。

- 檢查允許清單： `openclaw config get agents.defaults.models`
- 新增你要的模型（或清空允許清單），然後重試 `/model`
- 使用 `/models` 瀏覽允許的提供者／模型

### 提交問題時

貼上安全報告：

```bash
openclaw status --all
```

如果可以，請包含來自 `openclaw logs --follow` 的相關記錄尾端。
