# 🦞 openclawWeComzh — Personal AI Assistant (Chinese Localized)

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/luolin-ai/openclawWeComzh/main/docs/assets/openclaw-logo-text-dark.png">
        <img src="https://raw.githubusercontent.com/luolin-ai/openclawWeComzh/main/docs/assets/openclaw-logo-text.png" alt="openclawWeComzh" width="500">
    </picture>
</p>

## 📌 项目简介 (Introduction)

**openclawWeComzh** 旨在为国内用户提供更流畅、更符合本地化生态的 AI 个人助手体验。
该项目在保留了原有强大的网关（Gateway）架构、自动化执行（Bash、Browser 控制）、以及原汁原味的高保真 UI 设计的同时，重点优化了终端向导（CLI Wizard）的中文化交互，并深度加强了国内主流大语言模型（如 Qwen）的支持。

## 🚀 最近更新 (Recent Updates)

**Qwen Web API 流式深度整合与 CLI 中国本地化 (v2026.2.19)**

- **Qwen 思考过程全解析**：修复了 Qwen-Web 在深度推理 (`[(deep_think)]`) 时的文本溢出问题。现在流式输出会默认在 UI 中展开“深度思考中 (Deep Thinking...)”面板。
- **本地工具强制关联**：针对长时间对话 Qwen 容易忘记工具调用格式的问题，在持续对话上下文中注入了强制的 `<tool_call>` XML 约束机制，确保其能稳定调用开启独立浏览器 (`openclaw` Profile) 或执行 Bash 命令。
- **CLI 界面深度中文化**：对 `openclaw onboard` 终端向导进行了全面的中文润色（覆盖 Auth、Channels、Skills 等所有配置流程），同时保留了 Lobster 专属的高级色彩美学风格，提供更友好的本土上手体验。

## 📦 安装与启动 (Quick Start)

环境要求：**Node ≥22**.
推荐使用 `pnpm` 进行本地源码运行：

```bash
git clone https://github.com/luolin-ai/openclawWeComzh.git
cd openclawWeComzh

# 安装依赖
pnpm install

# 编译项目
pnpm build

# 启动全中文配置向导，并安装后台驻留服务
pnpm openclaw onboard --install-daemon

# 启动开发服务器（支持热更新）
pnpm gateway:watch
```

## ✨ 核心特性 (Key Features)

- **全流程中文化配置**：从终端向导 `onboard` 到 CLI 终端输出，全面优化中文提示词与高亮色彩排版。
- **深度整合 Qwen 模型**：针对通义千问（Qwen）Web 接口和 API 进行了原生适配，包括 `<think>` 和 `[(deep_think)]` 推理全过程标签的稳定捕获和本地前端渲染渲染。
- **本地设备控制**：完美继承并解锁本地终端执行、本地 Chrome/Chromium 浏览器自动化等高级代理能力。
- **多渠道接入（研发中）**：计划深度适配企微/微信等本地社交渠道，以及 Feishu 等办公协同平台。

## 🤝 鸣谢 (Acknowledgments)

本项目地址：[openclawWeComzh](https://github.com/luolin-ai/openclawWeComzh)。特别感谢原项目社区所有成员以及贡献者的努力！所有的架构设计、核心协议及 UI 引擎均基于强大的开源社区生态。
对于想要了解底层架构原理的用户，请直接参考原版仓库的进阶文档：[OpenClaw Docs](https://docs.openclaw.ai/)
