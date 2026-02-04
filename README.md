# 🦞 OpenCray — 中国区 IM 扩展版

<p align="center">
  <strong>为中国用户打造的 OpenClaw 即时通讯渠道扩展</strong>
</p>

<p align="center">
  <a href="https://github.com/CrayBotAGI/OpenCray"><img src="https://img.shields.io/badge/基于-OpenClaw-blue.svg?style=for-the-badge" alt="基于 OpenClaw"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="MIT License"></a>
</p>

## 📢 项目介绍

**OpenCray** 是基于 [OpenClaw](https://github.com/openclaw/openclaw) 的中国区即时通讯渠道扩展版本，专为国内用户提供主流 IM 平台的无缝接入支持。

在 OpenClaw 原有的 WhatsApp、Telegram、Discord、Slack 等国际化渠道基础上，OpenCray 新增了以下**中国本土化渠道支持**：

### 🎯 支持的中国区 IM 平台

| 平台                 | 扩展名称            | 状态    | 说明                          |
| -------------------- | ------------------- | ------- | ----------------------------- |
| 🟦 **飞书/Lark**     | `feishu-unofficial` | ✅ 可用 | 支持私聊/群聊，WebSocket 模式 |
| 🔵 **钉钉**          | `dingtalk`          | ✅ 可用 | 企业机器人，支持卡片消息      |
| 🐧 **QQ (NapCat)**   | `napcat-qq`         | ✅ 可用 | 基于 OneBot11 协议            |
| 🤖 **QQ 官方机器人** | `qqbot`             | ✅ 可用 | QQ 开放平台官方 API           |
| 🟩 **企业微信**      | `wecom`             | ✅ 可用 | 企业应用接入                  |

### ✨ 核心特性

- 🇨🇳 **本土化优先**：专为中国 IM 生态设计，符合国内用户使用习惯
- 🔌 **插件化架构**：所有渠道均为独立扩展，按需启用
- 🛡️ **安全可控**：支持私有部署，数据完全自主可控
- 🔄 **统一接口**：所有渠道使用统一的 OpenClaw 协议，切换无感
- 📦 **共享工具库**：`china-shared` 提供通用功能（文件处理、媒体解析、策略管理等）

## 🚀 快速开始

### 前置要求

- **Node.js** ≥ 22
- **pnpm** / npm / bun（推荐 pnpm）
- Git

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/CrayBotAGI/OpenCray.git
cd OpenCray
git checkout opencray-im-cn
```

2. **安装依赖**

```bash
pnpm install
```

3. **构建项目**

```bash
pnpm build
```

4. **运行向导配置**

```bash
pnpm openclaw onboard
```

按照向导提示配置你需要的中国区 IM 渠道。

### 渠道配置示例

#### 🐧 NapCat QQ 配置

```bash
# 启动 NapCat 服务（需先安装 NapCatQQ）
# 配置 WebSocket 或反向 WebSocket 连接

pnpm openclaw config set napcat-qq.enabled true
pnpm openclaw config set napcat-qq.connectionMode ws
pnpm openclaw config set napcat-qq.endpoint ws://localhost:3001
```

#### 🔵 钉钉配置

```bash
pnpm openclaw config set dingtalk.enabled true
pnpm openclaw config set dingtalk.appKey YOUR_APP_KEY
pnpm openclaw config set dingtalk.appSecret YOUR_APP_SECRET
pnpm openclaw config set dingtalk.connectionMode websocket
```

#### 🟦 飞书配置

```bash
pnpm openclaw config set feishu-unofficial.enabled true
pnpm openclaw config set feishu-unofficial.appId YOUR_APP_ID
pnpm openclaw config set feishu-unofficial.appSecret YOUR_APP_SECRET
pnpm openclaw config set feishu-unofficial.connectionMode websocket
```

## 📁 项目结构

```
OpenCray/
├── extensions/
│   ├── china-shared/          # 中国区扩展共享工具库
│   │   ├── src/
│   │   │   ├── file/         # 文件处理工具
│   │   │   ├── http/         # HTTP 客户端 & 重试
│   │   │   ├── logger/       # 日志工具
│   │   │   ├── media/        # 媒体解析与 I/O
│   │   │   └── policy/       # DM/群组策略
│   │   └── package.json
│   ├── dingtalk/              # 钉钉扩展
│   │   ├── src/
│   │   │   ├── bot.ts        # 机器人核心逻辑
│   │   │   ├── card.ts       # 卡片消息构建
│   │   │   ├── channel.ts    # 渠道适配器
│   │   │   ├── monitor.ts    # 消息监听
│   │   │   └── send.ts       # 消息发送
│   │   └── openclaw.plugin.json
│   ├── feishu-unofficial/     # 飞书扩展（非官方）
│   │   ├── src/
│   │   │   ├── bot.ts
│   │   │   ├── channel.ts
│   │   │   ├── gateway.ts    # WebSocket 网关
│   │   │   └── send.ts
│   │   └── openclaw.plugin.json
│   ├── napcat-qq/             # QQ 扩展（NapCat）
│   │   ├── src/
│   │   │   ├── channel.ts
│   │   │   ├── connection.ts # WebSocket 连接
│   │   │   ├── monitor.ts
│   │   │   ├── onebot/       # OneBot11 协议实现
│   │   │   └── send.ts
│   │   └── openclaw.plugin.json
│   ├── qqbot/                 # QQ 官方机器人扩展
│   │   ├── src/
│   │   │   ├── api.ts        # QQ 开放平台 API
│   │   │   ├── gateway.ts    # WebSocket 事件监听
│   │   │   └── image-server.ts # 图片服务器
│   │   └── openclaw.plugin.json
│   └── wecom/                 # 企业微信扩展
│       ├── src/
│       │   ├── bot.ts
│       │   ├── crypto.ts     # 消息加解密
│       │   └── monitor.ts
│       └── openclaw.plugin.json
└── ... (OpenClaw 核心文件)
```

## 🔧 技术架构

### 共享工具库 (`china-shared`)

为所有中国区扩展提供统一的基础设施：

- **文件处理**：文件上传下载、路径管理
- **HTTP 客户端**：统一的 HTTP 请求封装，支持自动重试
- **媒体解析**：图片、视频、音频等媒体文件解析与处理
- **策略管理**：DM（私聊）和群组消息的策略控制
- **日志系统**：统一的日志记录接口

### 插件注册机制

每个扩展通过 `openclaw.plugin.json` 声明自己的能力：

```json
{
  "id": "napcat-qq",
  "channels": ["napcat-qq"],
  "configSchema": {
    "type": "object",
    "properties": {
      "enabled": { "type": "boolean" },
      "connectionMode": { "type": "string", "enum": ["ws", "reverse-ws"] },
      "endpoint": { "type": "string" }
    }
  }
}
```

### 通信模式

| 扩展              | 支持的模式                 | 推荐模式  |
| ----------------- | -------------------------- | --------- |
| napcat-qq         | WebSocket / 反向 WebSocket | WebSocket |
| dingtalk          | WebSocket (Stream)         | WebSocket |
| feishu-unofficial | WebSocket                  | WebSocket |
| qqbot             | WebSocket                  | WebSocket |
| wecom             | Webhook / 轮询             | Webhook   |

## 📚 文档与支持

- **上游文档**：[OpenClaw Docs](https://docs.openclaw.ai)
- **中文社区**：[OpenClaw 中文论坛](https://docs.openclaw.ai/zh-CN)
- **问题反馈**：[GitHub Issues](https://github.com/CrayBotAGI/OpenCray/issues)

### 相关平台文档

- [NapCatQQ 文档](https://napneko.github.io/)
- [钉钉开放平台](https://open.dingtalk.com/)
- [飞书开放平台](https://open.feishu.cn/)
- [QQ 开放平台](https://q.qq.com/)
- [企业微信 API](https://developer.work.weixin.qq.com/)

## 🤝 贡献指南

欢迎提交 PR 和 Issue！

### 开发流程

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m "feat: 添加新功能"`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript
- 遵循 OpenClaw 代码风格（通过 `pnpm check` 检查）
- 添加必要的测试用例
- 更新相关文档

## ⚠️ 注意事项

1. **官方飞书支持**：OpenClaw 主仓库已内置官方飞书扩展（`extensions/feishu`），本项目的 `feishu-unofficial` 为早期独立实现版本，功能可能有差异
2. **NapCat 依赖**：使用 `napcat-qq` 扩展需要先部署 NapCatQQ 服务
3. **网络环境**：部分平台 API 可能需要特定的网络环境才能正常访问
4. **合规使用**：请遵守各平台的使用条款和开发者协议

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

<p align="center">
  基于 <a href="https://github.com/openclaw/openclaw">OpenClaw</a> | 由 <a href="https://github.com/CrayBotAGI">CrayBot AGI</a> 维护
</p>
