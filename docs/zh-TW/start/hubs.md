---
summary: "連結至所有 OpenClaw 文件的中樞"
read_when:
  - 你想要一份完整的文件地圖
title: "文件中樞"
x-i18n:
  source_path: start/hubs.md
  source_hash: a2e3aa07d6c8c2dc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:47Z
---

# 文件中樞

<Note>
如果你是 OpenClaw 的新手，請先從 [入門指南](/start/getting-started) 開始。
</Note>

使用這些中樞來探索每一個頁面，包括左側導覽列中未顯示的深入解析與參考文件。

## 從這裡開始

- [索引](/)
- [入門指南](/start/getting-started)
- [快速開始](/start/quickstart)
- [入門引導](/start/onboarding)
- [精靈](/start/wizard)
- [設定](/start/setup)
- [儀表板（本機 Gateway 閘道器）](http://127.0.0.1:18789/)
- [說明](/help)
- [文件目錄](/start/docs-directory)
- [設定](/gateway/configuration)
- [設定範例](/gateway/configuration-examples)
- [OpenClaw 助理](/start/openclaw)
- [展示](/start/showcase)
- [背景故事](/start/lore)

## 安裝 + 更新

- [Docker](/install/docker)
- [Nix](/install/nix)
- [更新 / 回滾](/install/updating)
- [Bun 工作流程（實驗性）](/install/bun)

## 核心概念

- [架構](/concepts/architecture)
- [功能](/concepts/features)
- [網路中樞](/network)
- [代理程式執行環境](/concepts/agent)
- [代理程式工作區](/concepts/agent-workspace)
- [記憶體](/concepts/memory)
- [代理程式迴圈](/concepts/agent-loop)
- [串流 + 分塊](/concepts/streaming)
- [多代理程式路由](/concepts/multi-agent)
- [壓縮整理](/concepts/compaction)
- [工作階段](/concepts/session)
- [工作階段（別名）](/concepts/sessions)
- [工作階段修剪](/concepts/session-pruning)
- [工作階段工具](/concepts/session-tool)
- [佇列](/concepts/queue)
- [斜線指令](/tools/slash-commands)
- [RPC 介接器](/reference/rpc)
- [TypeBox 綱要](/concepts/typebox)
- [時區處理](/concepts/timezone)
- [在線狀態](/concepts/presence)
- [裝置探索 + 傳輸協定](/gateway/discovery)
- [Bonjour](/gateway/bonjour)
- [頻道路由](/concepts/channel-routing)
- [群組](/concepts/groups)
- [群組訊息](/concepts/group-messages)
- [模型容錯移轉](/concepts/model-failover)
- [OAuth](/concepts/oauth)

## 提供者 + 入口

- [聊天頻道中樞](/channels)
- [模型提供者中樞](/providers/models)
- [WhatsApp](/channels/whatsapp)
- [Telegram](/channels/telegram)
- [Telegram（grammY 筆記）](/channels/grammy)
- [Slack](/channels/slack)
- [Discord](/channels/discord)
- [Mattermost](/channels/mattermost)（外掛）
- [Signal](/channels/signal)
- [BlueBubbles（iMessage）](/channels/bluebubbles)
- [iMessage（舊版）](/channels/imessage)
- [位置解析](/channels/location)
- [WebChat](/web/webchat)
- [Webhooks](/automation/webhook)
- [Gmail Pub/Sub](/automation/gmail-pubsub)

## Gateway 閘道器 + 營運

- [Gateway 閘道器操作手冊](/gateway)
- [網路模型](/gateway/network-model)
- [Gateway 閘道器配對](/gateway/pairing)
- [Gateway 閘道器鎖定](/gateway/gateway-lock)
- [背景程序](/gateway/background-process)
- [健康狀態](/gateway/health)
- [心跳](/gateway/heartbeat)
- [Doctor](/gateway/doctor)
- [記錄](/gateway/logging)
- [沙箱隔離](/gateway/sandboxing)
- [儀表板](/web/dashboard)
- [控制 UI](/web/control-ui)
- [遠端存取](/gateway/remote)
- [遠端 Gateway 閘道器 README](/gateway/remote-gateway-readme)
- [Tailscale](/gateway/tailscale)
- [安全性](/gateway/security)
- [疑難排解](/gateway/troubleshooting)

## 工具 + 自動化

- [工具介面](/tools)
- [OpenProse](/prose)
- [CLI 參考](/cli)
- [Exec 工具](/tools/exec)
- [提高權限模式](/tools/elevated)
- [Cron 工作](/automation/cron-jobs)
- [Cron 與 Heartbeat 比較](/automation/cron-vs-heartbeat)
- [思考 + 詳細輸出](/tools/thinking)
- [模型](/concepts/models)
- [子代理程式](/tools/subagents)
- [Agent send CLI](/tools/agent-send)
- [終端機 UI](/tui)
- [瀏覽器控制](/tools/browser)
- [瀏覽器（Linux 疑難排解）](/tools/browser-linux-troubleshooting)
- [投票](/automation/poll)

## 節點、媒體、語音

- [節點總覽](/nodes)
- [相機](/nodes/camera)
- [圖片](/nodes/images)
- [音訊](/nodes/audio)
- [位置指令](/nodes/location-command)
- [語音喚醒](/nodes/voicewake)
- [對話模式](/nodes/talk)

## 平台

- [平台總覽](/platforms)
- [macOS](/platforms/macos)
- [iOS](/platforms/ios)
- [Android](/platforms/android)
- [Windows（WSL2）](/platforms/windows)
- [Linux](/platforms/linux)
- [Web 介面](/web)

## macOS 配套應用程式（進階）

- [macOS 開發設定](/platforms/mac/dev-setup)
- [macOS 選單列](/platforms/mac/menu-bar)
- [macOS 語音喚醒](/platforms/mac/voicewake)
- [macOS 語音覆蓋層](/platforms/mac/voice-overlay)
- [macOS WebChat](/platforms/mac/webchat)
- [macOS Canvas](/platforms/mac/canvas)
- [macOS 子程序](/platforms/mac/child-process)
- [macOS 健康狀態](/platforms/mac/health)
- [macOS 圖示](/platforms/mac/icon)
- [macOS 記錄](/platforms/mac/logging)
- [macOS 權限](/platforms/mac/permissions)
- [macOS 遠端](/platforms/mac/remote)
- [macOS 簽署](/platforms/mac/signing)
- [macOS 發佈](/platforms/mac/release)
- [macOS Gateway 閘道器（launchd）](/platforms/mac/bundled-gateway)
- [macOS XPC](/platforms/mac/xpc)
- [macOS Skills](/platforms/mac/skills)
- [macOS Peekaboo](/platforms/mac/peekaboo)

## 工作區 + 範本

- [Skills](/tools/skills)
- [ClawHub](/tools/clawhub)
- [Skills 設定](/tools/skills-config)
- [預設 AGENTS](/reference/AGENTS.default)
- [範本：AGENTS](/reference/templates/AGENTS)
- [範本：BOOTSTRAP](/reference/templates/BOOTSTRAP)
- [範本：HEARTBEAT](/reference/templates/HEARTBEAT)
- [範本：IDENTITY](/reference/templates/IDENTITY)
- [範本：SOUL](/reference/templates/SOUL)
- [範本：TOOLS](/reference/templates/TOOLS)
- [範本：USER](/reference/templates/USER)

## 實驗（探索性）

- [入門引導設定通訊協定](/experiments/onboarding-config-protocol)
- [Cron 強化筆記](/experiments/plans/cron-add-hardening)
- [群組政策強化筆記](/experiments/plans/group-policy-hardening)
- [研究：記憶體](/experiments/research/memory)
- [模型設定探索](/experiments/proposals/model-config)

## 專案

- [致謝](/reference/credits)

## 測試 + 發佈

- [測試](/reference/test)
- [發佈檢查清單](/reference/RELEASING)
- [裝置模型](/reference/device-models)
