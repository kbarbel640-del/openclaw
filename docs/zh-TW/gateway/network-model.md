---
summary: "Gateway、節點與 canvas 主機如何連線。"
read_when:
  - "你想要快速了解 Gateway 的網路模型"
title: "網路模型"
x-i18n:
  source_path: gateway/network-model.md
  source_hash: e3508b884757ef19
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:25Z
---

多數操作會透過 Gateway（`openclaw gateway`）流動；它是一個單一、長時間執行的
程序，負責擁有頻道連線與 WebSocket 控制平面。

## 核心規則

- 建議每個主機只執行一個 Gateway。它是唯一被允許擁有 WhatsApp Web 工作階段的程序。若需救援機器人或嚴格隔離，可在隔離的設定檔與連接埠上執行多個 Gateway。請參閱 [Multiple gateways](/gateway/multiple-gateways)。
- 先使用 loopback：Gateway WS 預設為 `ws://127.0.0.1:18789`。精靈預設會產生 Gateway 權杖，即使是 loopback 也會如此。若要透過 tailnet 存取，請執行 `openclaw gateway --bind tailnet --token ...`，因為非 loopback 綁定需要權杖。
- 節點可依需求透過 LAN、tailnet 或 SSH 連線到 Gateway WS。舊版的 TCP 橋接已被淘汰。
- canvas 主機是一個 HTTP 檔案伺服器，位於 `canvasHost.port`（預設為 `18793`），用於為節點 WebViews 提供 `/__openclaw__/canvas/`。請參閱 [Gateway configuration](/gateway/configuration)（`canvasHost`）。
- 遠端使用通常透過 SSH 通道或 tailnet VPN。請參閱 [Remote access](/gateway/remote) 與 [Discovery](/gateway/discovery)。
