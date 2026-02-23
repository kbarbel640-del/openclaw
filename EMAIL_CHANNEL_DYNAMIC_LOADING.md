# Email Channel 动态加载实现

## 🎯 目标

使 OpenClaw 能够根据配置文件动态加载 email channel 等用户自主开发的 channel 插件。

## ✅ 当前状态

### 1. 官方 Plugin SDK 支持动态加载

OpenClaw 已经具备完整的插件动态加载机制：

**位置**: `src/plugins/loader.ts`, `src/plugins/install.ts`

**加载路径**:

1. Workspace plugins (`package.json` 中的依赖)
2. Config paths (`plugins.load.paths` 配置)
3. Global paths (`~/.openclaw/plugins/`)
4. Bundled plugins (`src/channels/`, `extensions/`)

### 2. Plugin 配置格式

**package.json** (extensions/email-channel/package.json):

```json
{
  "name": "@openclaw/email",
  "type": "module",
  "main": "index.ts",
  "openclaw": {
    "extensions": ["./index.ts"]
  },
  "dependencies": {
    "imap": "^0.8.19",
    "mailparser": "^3.6.9",
    "nodemailer": "^6.9.13"
  }
}
```

### 3. 用户配置示例

**openclaw.json**:

```json
{
  "plugins": {
    "load": {
      "paths": ["./extensions/email-channel"]
    },
    "allow": ["email"]
  },
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
          "enabled": true
        }
      }
    }
  }
}
```

## 🔧 Plugin SDK 最小修改

### PR #24087 包含的改进

#### 1. Simple Config Helpers (可选使用)

**文件**: `src/channels/plugins/simple-config-helpers.ts`

**功能**: 简化 channel 配置 schema 定义

**使用场景**: 对于简单的 channel，减少样板代码

```typescript
// 使用 helper (可选)
import { buildSimpleChannelConfigSchema } from "openclaw/plugin-sdk";

configSchema: buildSimpleChannelConfigSchema({
  accountProperties: {
    imap: { type: "object", ... },
    smtp: { type: "object", ... },
  },
}),

// 或使用标准方法
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";

configSchema: buildChannelConfigSchema({
  properties: {
    imap: { type: "object", ... },
    smtp: { type: "object", ... },
  },
}),
```

#### 2. Discovery Metadata (可选使用)

**文件**: `src/channels/plugins/types.plugin.ts`

**功能**: 添加插件发现和分类元数据

**类型定义**:

```typescript
export type ChannelDiscoveryMeta = {
  category?: string; // "email", "messaging", "social"
  keywords?: string[]; // 搜索关键词
  maturity?: "stable" | "beta" | "experimental";
  docsLink?: string;
  author?: string;
};
```

**使用示例**:

```typescript
const emailPlugin: ChannelPlugin = {
  id: "email",
  meta: {
    label: "Email",
    discovery: {
      category: "email",
      keywords: ["email", "imap", "smtp"],
      maturity: "experimental",
      author: "OpenClaw Community",
    },
  },
  // ...
};
```

#### 3. Channel 开发文档

**文件**: `docs/plugins/developing-channel-plugins.md`

**内容**:

- 如何创建独立的 channel 插件
- 项目结构最佳实践
- 配置 schema 设计
- 动态加载配置
- 发布和分发指南

## 📦 Email Channel 实现

### 完整功能

**位置**: `extensions/email-channel/`

**核心功能**:

1. ✅ IMAP 邮件接收和轮询
2. ✅ SMTP 邮件发送
3. ✅ 并行处理 (不同发件人并行，相同发件人顺序)
4. ✅ 附件处理 (入站/出站)
5. ✅ 状态持久化 (避免重复处理)
6. ✅ 重试机制
7. ✅ 多账户支持
8. ✅ Allowed senders 白名单
9. ✅ 附件大小限制

**使用 Plugin SDK**:

```typescript
import type { ChannelPlugin, OpenClawConfig } from "openclaw/plugin-sdk";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";
```

### 架构设计

```
extensions/email-channel/
├── package.json          # 插件元数据 (openclaw.extensions)
├── tsconfig.json         # TypeScript 配置
├── src/
│   ├── index.ts          # 插件入口 (register)
│   ├── channel.ts        # ChannelPlugin 定义
│   └── runtime.ts        # IMAP/SMTP 运行时实现
└── README.md             # 使用文档
```

## 🚀 动态加载流程

### 1. 插件发现

OpenClaw 启动时扫描插件位置：

```typescript
// src/plugins/loader.ts
const pluginPaths = [
  ...workspacePlugins, // package.json dependencies
  ...configPaths, // plugins.load.paths
  ...globalPaths, // ~/.openclaw/plugins/
  ...bundledPaths, // extensions/*, src/channels/*
];
```

### 2. 插件加载

对每个插件路径：

```typescript
// 读取 package.json
const manifest = require("./extensions/email-channel/package.json");

// 检查 openclaw.extensions
if (!manifest.openclaw?.extensions) {
  throw new Error("Missing openclaw.extensions");
}

// 动态导入
for (const ext of manifest.openclaw.extensions) {
  const module = await import("./extensions/email-channel/index.ts");
  plugins.push(module.default);
}
```

### 3. 插件注册

```typescript
// src/plugins/registry.ts
for (const plugin of loadedPlugins) {
  plugin.register(api);

  // 如果是 channel plugin
  if (plugin.id === "email-channel") {
    api.registerChannel({ plugin: emailPlugin });
  }
}
```

### 4. Channel 激活

```typescript
// src/channels/plugins/manager.ts
const emailChannel = channelRegistry.get("email");
await emailChannel.start({ account, config });
```

## 🎯 最小修改原则

### 已包含的 SDK 修改 (PR #24087)

| 修改                        | 必要性     | 说明                     |
| --------------------------- | ---------- | ------------------------ |
| `simple-config-helpers.ts`  | **可选**   | 简化配置定义，但不是必需 |
| `ChannelDiscoveryMeta` 类型 | **可选**   | 元数据，用于插件目录     |
| 开发文档                    | **推荐**   | 帮助开发者，不影响功能   |
| 动态加载机制                | **已存在** | 官方已经支持             |

### 不需要的修改

❌ 修改核心加载逻辑
❌ 添加新的插件类型
❌ 修改配置格式
❌ 添加运行时依赖

## ✅ 优势

### 1. 标准兼容

- 使用官方动态加载机制
- 标准的 package.json 格式
- 标准的插件注册流程

### 2. 易于分发

- 可以作为独立 npm 包
- 可以通过 Git 仓库安装
- 可以本地路径加载

### 3. 灵活配置

- 用户自主选择加载哪些插件
- 通过配置文件控制
- 不需要重新编译 OpenClaw

### 4. 持续兼容

- 定期同步 upstream/main
- 保持与官方版本兼容
- 独立的版本管理

## 📝 使用方法

### 方法 1: Bundled Extension (推荐)

**已经包含在项目中**:

```
openclaw/
└── extensions/
    └── email-channel/   # ← 自动加载
```

**无需额外配置**，OpenClaw 自动发现 `extensions/` 下的插件。

### 方法 2: 配置路径加载

**openclaw.json**:

```json
{
  "plugins": {
    "load": {
      "paths": ["./extensions/email-channel", "../my-custom-channel"]
    }
  }
}
```

### 方法 3: npm 包 (未来)

**安装**:

```bash
npm install @guxiaobo/openclaw-email-channel
```

**配置**:

```json
{
  "plugins": {
    "load": {
      "paths": ["node_modules/@guxiaobo/openclaw-email-channel"]
    }
  }
}
```

### 方法 4: Git 仓库 (未来)

**package.json**:

```json
{
  "dependencies": {
    "@guxiaobo/openclaw-email-channel": "github:guxiaobo/openclaw#feature/email-channel"
  }
}
```

## 🔄 持续维护策略

### 定期同步 Upstream

```bash
# 每周或每月
git checkout feature/email-channel
git fetch upstream
git rebase upstream/main

# 测试兼容性
cd extensions/email-channel
pnpm install
pnpm build

# 运行测试
cd ../..
pnpm test

# 推送更新
git push origin feature/email-channel
```

### 兼容性检查

- ✅ Plugin SDK API 兼容
- ✅ 动态加载机制兼容
- ✅ 配置格式兼容
- ✅ 运行时行为一致

## 🎯 如果 PR 被合并

### Email channel 可以选择使用新 helper

```typescript
// 可选：使用 simple-config-helpers
import { buildSimpleChannelConfigSchema } from "openclaw/plugin-sdk";

configSchema: buildSimpleChannelConfigSchema({
  accountProperties: {
    imap: { ... },
    smtp: { ... },
  },
}),
```

### 或者继续使用标准方法

```typescript
// 继续使用标准方法
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";

configSchema: buildChannelConfigSchema({
  properties: { ... },
}),
```

## 🎯 如果 PR 未被合并

### Email channel 继续正常工作

- ✅ 动态加载不需要 PR
- ✅ 使用官方 SDK 的 `buildChannelConfigSchema`
- ✅ 所有功能正常
- ✅ 在 fork 中持续维护

### 未来选项

1. **继续使用 fork**
   - 定期同步 upstream
   - 独立维护 email channel
   - 不依赖未合并的 PR

2. **重新提交 PR**
   - 根据反馈调整
   - 拆分为更小的 PR
   - 提供更多使用场景

## 📊 对比表

| 功能               | PR 合并前    | PR 合并后          |
| ------------------ | ------------ | ------------------ |
| 动态加载           | ✅ 支持      | ✅ 支持            |
| Config helper      | 使用标准方法 | 可选 simple helper |
| Discovery metadata | 仅在 fork    | 官方支持           |
| 文档               | fork 中维护  | 官方文档           |
| 兼容性             | 需要定期同步 | 自动兼容           |

## 🎉 总结

### 当前实现已经满足目标

✅ **动态加载**: OpenClaw 官方已经支持
✅ **配置驱动**: 通过 openclaw.json 配置
✅ **用户自主**: 无需修改 OpenClaw 代码
✅ **独立分发**: 可作为独立包发布

### PR #24087 的价值

✅ **简化开发**: 提供 config helper (可选)
✅ **标准化**: Discovery metadata 标准
✅ **文档化**: Channel 开发指南
✅ **向后兼容**: 100% 兼容现有 channels

### 最小修改原则

✅ **核心功能**: 使用官方已有机制
✅ **可选增强**: Helper 是可选的
✅ **文档优先**: 帮助开发者
✅ **独立维护**: Fork 中独立演进

---

**文档版本**: 2026-02-23
**相关 PR**: #24087
**分支**: `feature/email-channel`
**动态加载**: ✅ 已支持
