# Email Channel - Plugin SDK 使用策略

## 📋 策略概述

**核心原则**: Email channel 完全使用官方 Plugin SDK，不修改 SDK，所有改动只在 fork 中。

### ✅ 当前策略

1. **使用官方 SDK**
   - Email channel 使用 `openclaw/plugin-sdk` 导出的所有功能
   - 不添加任何自定义 SDK helper
   - 依赖官方 SDK 的现有功能

2. **PR 内容（最小修改）**
   - ✅ 已提交 Plugin SDK 优化（PR #24087）
   - ✅ 包含 `buildSimpleChannelConfigSchema` helper
   - ✅ 包含 `ChannelDiscoveryMeta` 类型
   - ✅ 向后兼容，100% 兼容现有 channels

3. **Fork 中的 Email Channel**
   - 完整实现在 `extensions/email-channel/`
   - 使用官方 SDK 的 `buildChannelConfigSchema`
   - 使用官方 SDK 的 `ChannelPlugin` 类型
   - 所有业务逻辑在 channel 层面实现

## 🔧 技术实现

### 使用的官方 SDK 功能

```typescript
import type { ChannelPlugin, OpenClawConfig, ChannelGatewayAdapter } from "openclaw/plugin-sdk";

import {
  buildChannelConfigSchema, // 官方 SDK 提供
} from "openclaw/plugin-sdk";
```

### 不使用的功能（避免依赖）

```typescript
// ❌ 不使用自定义 helper（只在 PR 中）
import { buildSimpleChannelConfigSchema } from "openclaw/plugin-sdk";

// ✅ 使用官方标准 helper
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";
```

## 📦 实现架构

### Channel Plugin 结构

```typescript
const emailPlugin: ChannelPlugin<EmailAccount> = {
  id: "email",

  // 使用官方 SDK 的 discovery metadata
  meta: {
    id: "email",
    label: "Email",
    discovery: {
      category: "email",
      keywords: ["email", "imap", "smtp"],
      maturity: "experimental",
      author: "OpenClaw Community",
    },
  },

  // 使用官方 SDK 的 configSchema builder
  configSchema: buildChannelConfigSchema({
    properties: { ... },
  }),

  // 标准适配器
  config: { ... },
  gateway: emailGatewayAdapter,
  security: { ... },
  outbound: { ... },
  messaging: { ... },
};
```

### 运行时实现

所有业务逻辑在 `runtime.ts` 中实现：

- ✅ IMAP 连接和邮件轮询
- ✅ SMTP 发送
- ✅ 并行处理
- ✅ 附件处理
- ✅ 状态持久化
- ✅ 错误处理

## 🔄 持续兼容性维护

### 定期同步官方 main

```bash
# 每周或每月同步
git checkout feature/email-channel
git fetch upstream
git rebase upstream/main

# 解决冲突（如果有）
# 测试兼容性
pnpm build
pnpm test
```

### 兼容性检查清单

- ✅ SDK 类型定义兼容
- ✅ API 接口兼容
- ✅ 配置格式兼容
- ✅ 运行时行为兼容

## 📊 PR vs Fork 分离

### PR #24087 (官方仓库)

**目的**: 优化 Plugin SDK

**内容**:

- ✅ `buildSimpleChannelConfigSchema` helper
- ✅ `ChannelDiscoveryMeta` 类型
- ✅ Channel 开发文档

**状态**: 等待审核

### Fork (feature/email-channel 分支)

**目的**: Email channel 完整实现

**内容**:

- ✅ `extensions/email-channel/` 完整代码
- ✅ 使用官方 SDK
- ✅ 所有业务逻辑

**维护**:

- 持续开发
- 定期同步 upstream
- 保持兼容

## 🚀 部署和使用

### 如果 PR 被合并

```bash
# 官方 SDK 包含新的 helper
git checkout feature/email-channel
git rebase upstream/main

# Email channel 可以选择使用新的 helper
# 或者继续使用官方 buildChannelConfigSchema
```

### 如果 PR 未被合并

```bash
# Email channel 继续使用官方 SDK
# 不依赖 PR 中的新 helper
# 所有功能正常工作

git checkout feature/email-channel
git rebase upstream/main
# 继续使用官方 SDK 的 buildChannelConfigSchema
```

## ✅ 优势

### 1. 零依赖风险

- Email channel 不依赖未合并的 PR
- 即使 PR 被拒绝，email channel 依然可用
- 官方 SDK 提供足够的功能

### 2. 持续兼容

- 定期同步 upstream/main
- 立即发现兼容性问题
- 保持与最新版本兼容

### 3. 灵活演进

- 可以根据官方 SDK 发展调整实现
- 不受 PR 状态影响
- 独立的发布周期

### 4. 维护简单

- 只需维护一个分支
- 所有相关代码在一起
- 统一的测试和部署

## 📝 配置示例

### OpenClaw 配置

```json
{
  "channels": {
    "email": {
      "accounts": {
        "gmail": {
          "imap": {
            "host": "imap.gmail.com",
            "port": 993,
            "secure": true,
            "user": "your-email@gmail.com",
            "password": "app-password"
          },
          "smtp": {
            "host": "smtp.gmail.com",
            "port": 465,
            "secure": true,
            "user": "your-email@gmail.com",
            "password": "app-password"
          },
          "allowedSenders": ["*@company.com"],
          "maxAttachmentSize": 10485760,
          "checkInterval": 30,
          "enabled": true
        }
      }
    }
  }
}
```

## 🔍 未来改进

### 如果 PR 合并后

可选使用新的 helper 简化代码：

```typescript
// 可选：使用 PR 中的新 helper（如果已合并）
import { buildSimpleChannelConfigSchema } from "openclaw/plugin-sdk";

configSchema: buildSimpleChannelConfigSchema({
  accountProperties: {
    imap: { ... },
    smtp: { ... },
  },
}),
```

### 如果需要更多功能

1. **在 Fork 中实现**
   - 添加 runtime helpers
   - 扩展 channel 功能
   - 不修改 SDK

2. **或提交新 PR**
   - 提议新的 SDK 功能
   - 独立于 email channel
   - 通用性的改进

## 🎯 总结

### 关键原则

✅ **使用官方 SDK** - 不依赖未合并的 PR
✅ **最小修改** - PR 只包含通用 SDK 改进
✅ **持续同步** - 定期同步 upstream/main
✅ **独立演进** - Email channel 在 fork 中独立发展

### 当前状态

- ✅ Email channel 使用官方 SDK
- ✅ PR #24087 等待审核
- ✅ Fork 中完整实现
- ✅ 持续兼容性维护

---

**策略制定**: 2026-02-23
**最后更新**: 2026-02-23
**分支**: `feature/email-channel`
**PR**: #24087
