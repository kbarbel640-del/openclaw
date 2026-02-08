---
summary: "來自聊天頻道的傳入位置解析（Telegram + WhatsApp）與情境欄位"
read_when:
  - 新增或修改頻道位置解析
  - 在代理程式提示或工具中使用位置情境欄位
title: "頻道位置解析"
x-i18n:
  source_path: channels/location.md
  source_hash: 5602ef105c3da7e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:17Z
---

# 頻道位置解析

OpenClaw 會將聊天頻道中分享的位置正規化為：

- 附加到傳入內容主體的人類可讀文字，以及
- 自動回覆情境酬載中的結構化欄位。

目前支援：

- **Telegram**（位置釘選 + 場所 + 即時位置）
- **WhatsApp**（locationMessage + liveLocationMessage）
- **Matrix**（`m.location` 與 `geo_uri`）

## 文字格式

位置會以不含括號的友善行文字呈現：

- 釘選：
  - `📍 48.858844, 2.294351 ±12m`
- 已命名地點：
  - `📍 Eiffel Tower — Champ de Mars, Paris (48.858844, 2.294351 ±12m)`
- 即時分享：
  - `🛰 Live location: 48.858844, 2.294351 ±12m`

如果頻道包含說明／註解，會附加在下一行：

```
📍 48.858844, 2.294351 ±12m
Meet here
```

## 情境欄位

當存在位置時，以下欄位會加入至 `ctx`：

- `LocationLat`（number）
- `LocationLon`（number）
- `LocationAccuracy`（number，公尺；選用）
- `LocationName`（string；選用）
- `LocationAddress`（string；選用）
- `LocationSource`（`pin | place | live`）
- `LocationIsLive`（boolean）

## 頻道備註

- **Telegram**：場所會對應至 `LocationName/LocationAddress`；即時位置使用 `live_period`。
- **WhatsApp**：`locationMessage.comment` 與 `liveLocationMessage.caption` 會作為說明行附加。
- **Matrix**：`geo_uri` 會解析為釘選位置；高度會被忽略，且 `LocationIsLive` 一律為 false。
