# OpenClaw TypeScript → Python 迁移

## 项目概述
OpenClaw 个人 AI 助手。后端从 TypeScript 转 Python，前端 UI 保留原 JS/TS。
只保留 Telegram 频道，其他频道删除。全功能保留。

## 当前进度
**批次 2 / 15：配置系统** ✅ 已完成

## 已完成的 Python 文件
- openclaw_py/types/base.py - 核心基础类型（14 个 Literal 类型 + normalize_chat_type 函数）
- openclaw_py/config/types.py - 配置 Pydantic 模型（40+ 配置类）
- openclaw_py/config/env_substitution.py - 环境变量替换（${VAR} 语法）
- openclaw_py/config/paths.py - 配置路径解析
- openclaw_py/config/defaults.py - 默认值应用
- openclaw_py/config/loader.py - 配置加载器（YAML/JSON）

## 环境
- Python 3.13（Conda 环境：marui）
- 包管理：Poetry
- IDE：PyCharm
- AI 工具：Claude Code (Max $200/月)

## 技术选型规则（必须遵守）
- 类型/校验：Pydantic v2
- Telegram：aiogram 3.x
- Web 服务器：FastAPI + uvicorn
- AI Claude：anthropic SDK
- AI OpenAI：openai SDK
- 多模型路由：litellm
- 异步：asyncio + aiofiles
- 日志：loguru
- CLI：typer
- 测试：pytest + pytest-asyncio
- JSON：orjson
- 事件：pyee
- 命名风格：snake_case

## 目录结构
```
openclaw_py/
├── types/          # Pydantic 数据模型
├── config/         # 配置加载和校验
├── logging/        # 日志系统
├── utils/          # 工具函数
├── sessions/       # 会话管理（持久化）
├── gateway/        # FastAPI 服务器（WebSocket + HTTP）
├── agents/         # AI Agent 运行时
│   ├── providers/  # Claude、OpenAI 等提供商
│   ├── tools/      # bash、文件操作等
│   └── skills/     # 自定义技能系统
├── channels/
│   └── telegram/   # Telegram 全功能
├── routing/        # 消息路由
├── users/          # 用户管理和权限
└── cli/            # 命令行工具
```

## 不要转换的目录
src/discord/、src/slack/、src/signal/、src/imessage/、
src/line/、src/web/ (WhatsApp)、src/macos/、src/canvas-host/、
src/browser/、src/tts/、src/daemon/、src/node-host/、src/tui/、
extensions/、Swabble/、apps/

## 前端 UI
保留原 JS/TS 不动。Python 后端必须保持 WebSocket 和 HTTP 协议
与原版兼容，确保前端无需修改即可连接。

## 转换原则
1. 先读懂 TS 逻辑，再用 Pythonic 方式重写
2. Gateway 协议必须兼容原版前端
3. 每个模块写 pytest 测试
4. 每批次完成后更新本文件
5. commit 格式：batch-N: 简短描述

## 批次列表
1.  ✅ 项目骨架 + 核心类型
2.  ✅ 配置系统
3.  ⬜ 日志 + 工具函数
4.  ⬜ 会话管理 + 持久化
5.  ⬜ Gateway 服务器 - HTTP
6.  ⬜ Gateway 服务器 - WebSocket
7.  ⬜ Agent 运行时 - 模型调用
8.  ⬜ Agent 上下文 + 用量
9.  ⬜ Agent 工具 + Skills
10. ⬜ Telegram - 核心 Bot
11. ⬜ Telegram - 媒体/Webhook/群组
12. ⬜ 用户管理 + 权限
13. ⬜ 消息路由（全链路）
14. ⬜ CLI 命令行
15. ⬜ 集成测试 + 前后端联调
