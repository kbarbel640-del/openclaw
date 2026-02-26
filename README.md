# 🦞 openclawWeComzh — Personal AI Assistant

> **为国内生态倾力打造的 OpenClaw 深度中文化版本。**
> 这是一个让你可以在本地私有化运行、掌控全局的智能个人助理。

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/luolin-ai/openclawWeComzh/main/docs/assets/openclaw-logo-text-dark.png">
        <img src="https://raw.githubusercontent.com/luolin-ai/openclawWeComzh/main/docs/assets/openclaw-logo-text.png" alt="openclawWeComzh" width="400">
    </picture>
</p>

<p align="center">
  <a href="https://github.com/luolin-ai/openclawWeComzh/actions"><img src="https://img.shields.io/github/actions/workflow/status/luolin-ai/openclawWeComzh/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/luolin-ai/openclawWeComzh/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%E2%89%A5%2022-green.svg?style=for-the-badge" alt="Node Version Requirement"></a>
</p>

## 📌 项目简介 (Introduction)

**openclawWeComzh** 是基于开源巨作 [OpenClaw](https://github.com/openclaw/openclaw) 的深度中文化定制分支。原版 OpenClaw 提供了极其惊艳的本地网关（Gateway）架构、全平面的端侧操作代理（能直接调用和控制你的 macOS 环境、浏览器甚至终端）。而本项目致力于解决国内开发者在使用时遇到的语言障碍和本地模型调用痛点。

🌟 **我们的愿景:** 让强大的原生端侧 AI 能力，以最舒适的中文交互和最契合国内大模型生态的方式，交付到每位开发者手中。

## 🚀 最新特性与更新 (Recent Updates)

🎉 **v2026.2.x 核心里程碑**

- 🧠 **Qwen / DeepSeek 流式深度整合**：
  - **思考过程全解析**：彻底修复了 Qwen-Web 和 DeepSeek 模型在输出深度推理标签 (`[(deep_think)]` / `<think>`) 时的截断或溢出问题。流式输出期间，UI 界面将优雅且平滑地展开“深度思考中 (Deep Thinking...)”折叠面板，展现 AI 推理全貌。
  - **本地工具强制关联机制**：修复了长时间多轮对话后，模型容易遗忘内部 XML 工具调用格式的问题。通过在上下文链路中注入隐式约束，确保模型能够随心所欲且稳定地唤起你的独立浏览器 (`openclaw` Profile) 或执行高危指令 (Bash commands)。
- 🇨🇳 **CLI 界面深度中文化**：
  - 我们对原生极具赛博朋克风格的终端向导工具 (`openclaw onboard`) 进行了逐字逐句的翻译和润色。
  - 涵盖所有配置流程：包括网关鉴权、模型选择、外部通讯渠道（Channels）接入和扩展技能（Skills）安装。保留了原汁原味的 Lobster 专属渐变色彩引擎。

## 📦 快速安装与启动 (Quick Start)

### 1. ⚡ 一键极速安装 (推荐)

如果你只是想快速体验或部署系统，可以直接在终端执行以下一键安装指令。该脚本会自动为您检测环境、配置依赖并启动向导：

```bash
curl -fsSL https://raw.githubusercontent.com/luolin-ai/openclawWeComzh/main/install.sh | bash
```

**🌐 各系统环境安装说明：**

- **🍎 macOS**: 原生支持。脚本会自动检查系统依赖并引导是否安装 `cmake/brew` 等底层编译工具（用于本地大模型加速计算等扩展模块）。
- **🐧 Linux**: 广泛兼容各大主流发行版 (Ubuntu/Debian, CentOS/RHEL, Arch, Alpine等)。自动判断并提权安装例如 `build-essential` 等 C++ 编译环境。
- **🪟 Windows**: 请务必在 **WSL2** (Windows Subsystem for Linux) 环境下执行上述脚本，暂不支持直接使用 PowerShell 或 CMD 原生安装运行。

---

### 2. 🛠️ 本地源码开发 (Development)

如果你希望进行二次定制架构开发，可以通过以下步骤运行：

**环境准备：** 确保已安装 [Node.js](https://nodejs.org/) (**≥ 22.0.0**) 和包管理器 `pnpm` (`npm i -g pnpm`)。

```bash
# 获取源码
git clone https://github.com/luolin-ai/openclawWeComzh.git
cd openclawWeComzh

# 安装项目依赖
pnpm install

# 编译项目 (首次运行将自动构建 UI 前端工程)
pnpm build

# 启动全中文沉浸式配置向导，注册基础设置并安装后台守护进程
pnpm openclaw onboard --install-daemon

# 以开发者模式启动网关（支持 TypeScript 热更新）
pnpm gateway:watch
```

## ✨ 核心亮点 (Key Features)

| 模块名称               | 特性说明                                                                                                                      |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **全流程中文化界面**   | 从终端命令行的 `onboard` 到各种错误日志、高亮提示，全面采用了符合国人阅读习惯的中文语境与高亮色彩排版。                       |
| **原生大语言模型适配** | 针对国内顶级开源模型（Qwen、DeepSeek等）的 Web 接口与专属推理链路进行了特化适配，支持完整的深度思考过程展示与上下文工具对齐。 |
| **系统级本地设备控制** | 完美继承开源版本的所有高阶特性：直接在对话框中让 AI 帮你执行终端命令行、操作自动化浏览器、读写本地文件目录。                  |
| **扩展通信渠道引擎**   | 计划对企微/微信等国内高频使用的社交与办公渠道进行原生接入开发（研发中），敬请期待！                                           |

## 🗺️ 发展路线图 (Roadmap)

- [x] CLI 终端向导演示流程的完全汉化。
- [x] 解决主流中文模型（Qwen、DeepSeek）在推理长文本和执行 Tool Calling 时的标签解析异常。
- [ ] (Next) 深度适配企微 / 微信等个人及企业通信渠道，逐步取代或并行国外的 Discord / Slack。
- [ ] (Next) 梳理和本土化所有的提示词系统组件库 (`AGENTS.md`, `TOOLS.md` 等)。

## 🤝 鸣谢与声明 (Acknowledgments & Disclaimer)

1. **项目归属声明**：本项目属于下游的本土化定制与优化分支，相关地址为：[luolin-ai/openclawWeComzh](https://github.com/luolin-ai/openclawWeComzh)。我们不对原项目导致的任何系统级风险（如使用 Bash 代理工具破坏本地环境）承担责任。
2. **上游社区致谢**：项目极度依赖并完全源于极致优秀的 [OpenClaw](https://github.com/openclaw/openclaw) 系统。所有的核心架构设计、精妙的 WebSockets 协议通信和前沿的 UI 渲染引擎均来自 `openclaw` 原生社区的无私奉献！特别感谢开源作者和社区无尽的探索。
3. **进阶技术参考**：如果你对 OpenClaw 底层的代理实现原理或插件化机制感兴趣，极其推荐阅读原版架构进阶文档：[OpenClaw Docs](https://docs.openclaw.ai/)。

<br />
<p align="center">
    <i>“用中国的语言，拥抱未来架构的个人 AI 助理”</i>
</p>
