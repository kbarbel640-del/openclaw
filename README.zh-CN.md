# 🦞 OpenClaw — 个人 AI 助手

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text-dark.png">
        <img src="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.png" alt="OpenClaw" width="500">
    </picture>
</p>

<p align="center">
  <strong>EXFOLIATE! EXFOLIATE!</strong>
</p>

<p align="center">
  <a href="https://github.com/openclaw/openclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/openclaw/openclaw/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/openclaw/openclaw/releases"><img src="https://img.shields.io/github/v/release/openclaw/openclaw?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | 简体中文
</p>

**OpenClaw** 是一个运行在您自己的设备上的_个人 AI 助手_。
它可以在您常用的渠道（WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, Microsoft Teams, WebChat 等）为您提供解答，还支持多项扩展渠道（如 BlueBubbles, Matrix, Zalo）。它支持在 macOS/iOS/Android 上语音交互，并能渲染受您控制的实时画布（Live Canvas）。网关（Gateway）仅为其控制层 —— 真正的核心产品是助手本身。

如果您想要一个始终保持在线、响应迅速且拥有完全控制权的单用户私人助手，非它莫属。

[官网](https://openclaw.ai) · [官方文档](https://docs.openclaw.ai) · [愿景](VISION.md) · [DeepWiki](https://deepwiki.com/openclaw/openclaw) · [快速开始](https://docs.openclaw.ai/start/getting-started) · [更新指南](https://docs.openclaw.ai/install/updating) · [展示](https://docs.openclaw.ai/start/showcase) · [常见问题](https://docs.openclaw.ai/help/faq) · [Docker 安装](https://docs.openclaw.ai/install/docker) · [Discord 社区](https://discord.gg/clawd)

首选安装方式：在您的终端中运行新手指南（`openclaw onboard`）。
向导将逐步指引您完成网关（gateway）、工作区（workspace）、频道（channels）和技能（skills）的设置。CLI 向导是系统强烈推荐的途径，支持 **macOS、Linux 以及 Windows（推荐使用 WSL2）**。
同时兼容 npm、pnpm 或 bun 等常见包管理器。
如果您是首次安装？请从这儿开始：[入坑指南](https://docs.openclaw.ai/start/getting-started)

## 赞助商

| OpenAI                                                            | Blacksmith                                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [![OpenAI](docs/assets/sponsors/openai.svg)](https://openai.com/) | [![Blacksmith](docs/assets/sponsors/blacksmith.svg)](https://blacksmith.sh/) |

**集成支持 (OAuth):**

- **[OpenAI](https://openai.com/)** (ChatGPT/Codex)

模型说明：尽管本平台支持各大主流模型，但我强烈推荐使用 **Anthropic Pro/Max (100/200) + Opus 4.6** 以获得更强健的长上下文理解能力和对提示词注入攻击的防御水平。详情请参阅 [指南](https://docs.openclaw.ai/start/onboarding)。

## 模型 (选取与鉴权)

- 模型配置及 CLI 指南：[模型指南](https://docs.openclaw.ai/concepts/models)
- 权限配置文件轮换 (OAuth 与 API 密钥) 以及回退策略：[模型故障接管](https://docs.openclaw.ai/concepts/model-failover)

## 安装 (官方推荐)

运行要求：**Node 环境 ≥ 22**。

```bash
npm install -g openclaw@latest
# 或使用 pnpm: pnpm add -g openclaw@latest

openclaw onboard --install-daemon
```

向导将会帮您把 Gateway 守护进程安装为后台服务 (launchd/systemd 用户服务)，以确保其持久运行。

## 快速上手 (TL;DR)

想了解完整的新手导航（鉴权、配对、通信通道设置等）：[快速开始指南](https://docs.openclaw.ai/start/getting-started)

```bash
openclaw onboard --install-daemon

openclaw gateway --port 18789 --verbose

# 发送一条消息
openclaw message send --to +1234567890 --message "Hello from OpenClaw"

# 与助手对话 (并可路由到您的任何连线平台：WhatsApp/Telegram/Slack/Discord 等)
openclaw agent --message "梳理发布清单" --thinking high
```

准备好升级了吗？[更新指南在此](https://docs.openclaw.ai/install/updating) (跑一遍 `openclaw doctor` 检查配置)。

## 源码开发 (Development)

从源码构建时，推荐使用 `pnpm`。`Bun` 可选（用于直接运行 TypeScript）。

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw

pnpm install
pnpm ui:build # 首次运行时自动安装 UI 依赖项
pnpm build

pnpm openclaw onboard --install-daemon

# 进入开发循环 (自动检测 TS 变更并重载)
pnpm gateway:watch
```

提示：执行 `pnpm openclaw ...` 会通过 `tsx` 直接运行 TypeScript 源码代码，而 `pnpm build` 命令将产出通用的 `dist/` 编译文件，方便后续通过 Node 或打包后的二进制 `openclaw` 执行。

## 安全性默认原则 (防 DM 骚扰)

OpenClaw 实际接入了您的社交与通信通道。我们必须将任何外界传入的单聊（DM）视为 **不受信用的输入源**。

完整安全文档：[安全性说明](https://docs.openclaw.ai/gateway/security)

在 Telegram、WhatsApp、Slack、Discord 等渠道接收到陌生消息的默认策略：

- **匹配策略**：发送者若不在您的熟人白名单内，他们会收到一段配对代号（Pairing code），而机器人将停止响应其消息。
- 用这行命令来审批匹配: `openclaw pairing approve <channel> <code>`。
- 如果想要开放所有私信：设置 `dmPolicy="open"` 且设定频道白名单中包含 `"*"` 即可开放权限。

您可以运行 `openclaw doctor` 来筛查任何风险或被误配的私聊权限。

## 核心亮点

- **[本地优先网关 (Local-first Gateway)](https://docs.openclaw.ai/gateway)** — 一体化控制平面，管控您的所有会话、多端通道、技能插件与事件触发。
- **[全平台通信通道](https://docs.openclaw.ai/channels)** — 囊括绝大多数主流通讯工具（WhatsApp、Telegram、Slack、Discord、iMessage、WebChat等）以及跨端原生支持。
- **[多智能体路由 (Multi-agent routing)](https://docs.openclaw.ai/gateway/configuration)** — 支持对入口渠道及用户自动隔离，并指向您设置的独立代理工作区。
- **[实时视觉画板 (Live Canvas)](https://docs.openclaw.ai/platforms/mac/canvas)** — 以客户端渲染为主，受您代理（Agent）全程控制的互动式协作空间面板。

## Tailscale 云接管 (Gateway dashboard访问)

OpenClaw 支持无需映射公网 IP 自动搭建 **Tailscale Serve** (限内网机器访问) 或 **Funnel** (公网打洞)。

只需配置 `gateway.tailscale.mode` 选项即可轻松开启。详见 [Tailscale 指南](https://docs.openclaw.ai/gateway/tailscale)。

---

## Molty 🦞

OpenClaw 其实主要是为了拯救并服务一只名为 **Molty** 🦞 的特殊太空气泡龙 (Space Lobster AI Assistant) 而由 Peter Steinberger 这位工程师携手社区共同发起的。

- [openclaw.ai](https://openclaw.ai)
- [@openclaw Twitter/X](https://x.com/openclaw)

## 社区贡献

加入我们！详阅 [CONTRIBUTING.md](CONTRIBUTING.md) 以了解准则、维护者联系以及提交合并请求 (PR) 的方法。
我们极其欢迎任何融入 AI / 代码极客氛围的各类功能点 PR！🤖
