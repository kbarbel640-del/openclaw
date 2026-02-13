# OpenCode Coder - 快速编码助手

使用OpenCode CLI (v1.1.50) 快速生成、分析和重构代码 🧑‍💻

## 🚀 快速开始

### 基础使用

```bash
# 直接运行（在当前目录）
opencode run '创建一个Flask REST API'

# 指定工作目录
opencode run --context ~/myproject '分析代码结构'
```

## 📋 常见任务

### Python项目

```bash
# Web应用
opencode run '用FastAPI创建一个用户管理系统，包括CRUD接口'

# 数据分析
opencode run '写一个用pandas分析股票数据的脚本，计算移动平均线和RSI'

# 交易策略
opencode run '创建Python脚本实现双均线交叉策略，包含入场止损止盈逻辑'
```

### JavaScript/前端

```bash
# React组件
opencode run '写一个React仪表盘组件，显示实时交易数据图表'

# Node.js API
opencode run '用Express.js创建RESTful API，处理订单管理'
```

### 代码分析/修复

```bash
# 解释代码
opencode run '解释main.py文件做了什么'

# 修复bug
opencode run '修复数据处理器中的内存泄漏问题'

# 重构
opencode run '重构用户模块，遵循SOLID原则'

# 写测试
opencode run '为payment模块写单元测试，使用pytest'
```

## 🎯 MT5交易相关

### 交易策略开发

```bash
# 创建策略
opencode run '创建MT5 Python脚本实现布林带策略，包含开仓平仓逻辑'

# 技术指标
opencode run '写Python函数计算RSI、MACD和布林带指标，使用pandas'

# 回测框架
opencode run '设计一个简单的回测框架，测试交易策略'
```

### 数据处理

```bash
# 获取市场数据
opencode run '写脚本从MT5获取EURUSD H1数据，保存到CSV'

# 数据分析
opencode run '分析历史K线数据，找出最佳参数组合'
```

## 📝 提示词技巧

### 🎯 要具体

✅ 好的提示词：
```
创建一个Flask REST API，有以下端点：
- POST /api/users - 创建用户
- GET /api/users/{id} - 获取用户
- PUT /api/users/{id} - 更新用户
- DELETE /api/users/{id} - 删除用户
使用SQLAlchemy和SQLite数据库，包含输入验证
```

❌ 不好的提示词：
```
创建API
```

### 🎯 提供上下文

在工作目录中运行，OpenCode可以看到你的代码：

```bash
cd ~/myproject
opencode run '添加JWT认证到现有的API'
```

### 🎯 指定技术栈

```
使用FastAPI、Pydantic和PostgreSQL构建...
用React + TypeScript + Tailwind CSS创建...
```

## 🔧 高级用法

### 在OpenClaw中使用

```bash
# 必须使用PTY模式
bash pty:true workdir:~/project command:"opencode run '创建交易策略脚本'"

# 更长的任务，用后台模式
bash pty:true workdir:~/project background:true command:"opencode run '完整实现一个量化交易系统'"
```

### 查看进度

```bash
# 查看后台任务
process action:list

# 查看输出
process action:log sessionId:xxx
```

## ⚠️ 重要提示

1. **PTY模式**: OpenCode需要交互式终端，始终使用 `pty:true`
2. **工作目录**: 设置 `workdir` 让OpenCode看到你的代码
3. **代码审查**: 生成代码后务必审查
4. **测试**: 部署前充分测试，特别是交易代码

## 📚 示例提示词

| 任务类型 | 提示词 |
|---------|-------|
| API | "用FastAPI创建REST API，包含用户认证和JWT tokens" |
| 数据库 | "添加SQLAlchemy模型：User, Order, Product表" |
| 前端 | "构建React仪表盘组件，显示实时交易图表" |
| 算法 | "实现二叉搜索树，支持插入、删除、查找操作" |
| 测试 | "用pytest写calculator模块的完整单元测试" |
| 文档 | "为utils.py所有函数添加docstring和类型提示" |

---

OpenCode Coder - 让写代码更快 🚀
