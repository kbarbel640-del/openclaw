---
summary: 「網路中樞：Gateway 閘道器介面、配對、探索與安全性」
read_when:
  - 你需要網路架構 + 安全性總覽
  - 你正在除錯本機與 tailnet 存取或配對問題
  - 你想要權威的網路文件清單
title: 「網路」
x-i18n:
  source_path: network.md
  source_hash: 0fe4e7dbc8ddea31
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:44Z
---

# 網路中樞

此中樞連結核心文件，說明 OpenClaw 如何在 localhost、LAN 與 tailnet 之間
連線、配對並保護裝置。

## 核心模型

- [Gateway 架構](/concepts/architecture)
- [Gateway 通訊協定](/gateway/protocol)
- [Gateway 操作手冊](/gateway)
- [Web 介面 + 綁定模式](/web)

## 配對 + 身分識別

- [配對總覽（私訊 + 節點）](/start/pairing)
- [Gateway 擁有的節點配對](/gateway/pairing)
- [裝置 CLI（配對 + 權杖輪替）](/cli/devices)
- [配對 CLI（私訊核准）](/cli/pairing)

本機信任：

- 本機連線（loopback 或 Gateway 主機自身的 tailnet 位址）可以
  自動核准配對，以保持同一主機的 UX 流暢。
- 非本機的 tailnet／LAN 用戶端仍需要明確的配對核准。

## 裝置探索 + 傳輸協定

- [裝置探索與傳輸協定](/gateway/discovery)
- [Bonjour / mDNS](/gateway/bonjour)
- [遠端存取（SSH）](/gateway/remote)
- [Tailscale](/gateway/tailscale)

## 節點 + 傳輸協定

- [節點總覽](/nodes)
- [橋接通訊協定（舊版節點）](/gateway/bridge-protocol)
- [節點操作手冊：iOS](/platforms/ios)
- [節點操作手冊：Android](/platforms/android)

## 安全性

- [安全性總覽](/gateway/security)
- [Gateway 設定參考](/gateway/configuration)
- [疑難排解](/gateway/troubleshooting)
- [Doctor](/gateway/doctor)
