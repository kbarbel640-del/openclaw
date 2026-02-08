---
summary: "OpenClaw 的 VPS 主機託管中樞（Oracle/Fly/Hetzner/GCP/exe.dev）"
read_when:
  - 你想在雲端執行 Gateway
  - 你需要一份 VPS／主機託管指南的快速總覽
title: "VPS 主機託管"
x-i18n:
  source_path: vps.md
  source_hash: 38e3e254853e5839
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:05Z
---

# VPS 主機託管

此中樞連結至支援的 VPS／主機託管指南，並在高層次說明雲端部署的運作方式。

## 選擇提供者

- **Railway**（一鍵 + 瀏覽器設定）：[Railway](/install/railway)
- **Northflank**（一鍵 + 瀏覽器設定）：[Northflank](/install/northflank)
- **Oracle Cloud（Always Free）**：[Oracle](/platforms/oracle) — 每月 $0（Always Free，ARM；容量／註冊可能較為挑剔）
- **Fly.io**：[Fly.io](/install/fly)
- **Hetzner（Docker）**：[Hetzner](/install/hetzner)
- **GCP（Compute Engine）**：[GCP](/install/gcp)
- **exe.dev**（VM + HTTPS 代理）：[exe.dev](/install/exe-dev)
- **AWS（EC2／Lightsail／免費方案）**：同樣表現良好。影片指南：
  https://x.com/techfrenAJ/status/2014934471095812547

## 雲端設定如何運作

- **Gateway 在 VPS 上執行**，並擁有狀態 + 工作區。
- 你可透過 **Control UI** 或 **Tailscale／SSH** 從你的筆電／手機連線。
- 將 VPS 視為事實來源，並**備份**狀態 + 工作區。
- 安全預設：讓 Gateway 保持在 loopback，並透過 SSH 通道或 Tailscale Serve 存取。
  若綁定至 `lan`/`tailnet`，請要求 `gateway.auth.token` 或 `gateway.auth.password`。

遠端存取：[Gateway remote](/gateway/remote)  
平台中樞：[Platforms](/platforms)

## 使用 VPS 搭配節點

你可以將 Gateway 保留在雲端，並在本機裝置（Mac／iOS／Android／headless）上配對 **節點**。
節點提供本機螢幕／相機／畫布，以及 `system.run` 能力，而 Gateway 仍留在雲端。

文件：[Nodes](/nodes)，[Nodes CLI](/cli/nodes)
