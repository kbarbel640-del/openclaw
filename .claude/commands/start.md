---
description: 开始新批次（强制对齐上下文后才能写代码）
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

## 任务：开始批次 $ARGUMENTS

你必须严格按以下顺序执行，不能跳过任何步骤。

### 第 1 步：读取状态
1. 读取 STATE.md，确认当前批次号和状态
2. 读取 INTERFACES.md，了解所有已完成模块的公开接口
3. 读取 CHANGELOG.md 最后一条记录，了解上次做了什么

### 第 2 步：状态报告
向用户报告以下信息：
- 当前批次号
- 已完成的批次列表
- 本批次需要转换的 TS 文件列表（从 src/ 下找）
- 本批次依赖的已有 Python 模块（从 INTERFACES.md 中找）
- 如果有已知问题（STATE.md 中的"已知问题"），先说明

### 第 3 步：读取依赖
读取 openclaw_py/ 下本批次会用到的已有 .py 文件。
特别注意 import 路径和类/函数签名。

### 第 4 步：分析 TS 源码
读取本批次对应的 src/ 下的 TypeScript 文件。
列出需要转换的核心功能点。

### 第 5 步：输出计划
输出一份简短的转换计划：
- 要创建的 Python 文件列表
- 每个文件的核心内容
- 依赖关系（import 什么已有模块）
- 预计测试点

### 第 6 步：等待确认
告诉用户："计划就绪，输入 '开始' 我就动手写代码。"
在用户确认前，不要创建或修改任何文件。

## 批次编号对照
1=项目骨架+核心类型, 2=配置系统, 3=日志+工具函数,
4=会话管理+持久化, 5=Gateway HTTP, 6=Gateway WebSocket,
7=Agent模型调用, 8=Agent上下文+用量, 9=Agent工具+Skills,
10=Telegram核心Bot, 11=Telegram媒体/Webhook/群组,
12=用户管理+权限, 13=消息路由, 14=CLI命令行,
15=集成测试+联调
