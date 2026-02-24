# Email Channel Plugin for OpenClaw

**版本**: 1.1.0 | **状态**: ✅ 生产可用 | **许可证**: MIT

[![OpenClaw](https://img.shields.io/badge/OpenClaw-2026.2.0+-blue.svg)](https://github.com/openclaw/openclaw)
[![Node.js](https://img.shields.io/badge/Node.js-18.0.0+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)

Send and receive email messages through OpenClaw using standard IMAP/SMTP protocols.

## ✨ 功能特性

### 核心功能

- ✅ IMAP 邮件接收和轮询
- ✅ SMTP 邮件发送
- ✅ 多账户支持
- ✅ 动态加载（基于配置）

### 高级功能

- ✅ **并行处理**: 不同发件人的邮件并行处理，相同发件人顺序处理
- ✅ **附件处理**: 完整的入站/出站附件支持，智能文件去重
- ✅ **状态持久化**: 避免重复处理，支持重启恢复
- ✅ **重试机制**: 失败自动重试，最多 3 次
- ✅ **安全过滤**: Allowed senders 白名单
- ✅ **大小限制**: 自动拒绝超大附件并发送通知
- ✅ **系统指令**: 自动指导 agent 生成文件

## 📦 安装

### Bundled Extension（自动）

Email channel 在 `extensions/email-channel/` 中，OpenClaw 会自动发现。

### 配置加载

在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "plugins": {
    "enabled": true,
    "load": {
      "paths": ["./extensions/email-channel"]
    },
    "allow": ["email"],
    "entries": {
      "email": {
        "enabled": true
      }
    }
  }
}
```

## ⚙️ 配置

### 完整配置示例

```json
{
  "channels": {
    "email": {
      "accounts": {
        "default": {
          "enabled": true,
          "imap": {
            "host": "imap.qq.com",
            "port": 993,
            "secure": true,
            "user": "your-email@qq.com",
            "password": "authorization-code"
          },
          "smtp": {
            "host": "smtp.qq.com",
            "port": 587,
            "secure": false,
            "user": "your-email@qq.com",
            "password": "authorization-code"
          },
          "checkInterval": 30,
          "allowedSenders": ["sender1@163.com", "*@company.com"],
          "maxAttachmentSize": 10485760
        }
      }
    }
  }
}
```

### 配置字段

| 字段                | 类型     | 必需   | 默认值 | 说明           |
| ------------------- | -------- | ------ | ------ | -------------- |
| `enabled`           | boolean  | 否     | true   | 是否启用       |
| `imap`              | object   | **是** | -      | IMAP 配置      |
| `smtp`              | object   | **是** | -      | SMTP 配置      |
| `checkInterval`     | number   | 否     | 30     | 检查间隔（秒） |
| `allowedSenders`    | string[] | 否     | []     | 白名单         |
| `maxAttachmentSize` | number   | 否     | 10MB   | 附件大小限制   |

## 📧 常见邮箱配置

### QQ 邮箱

```json
{
  "imap": {
    "host": "imap.qq.com",
    "port": 993,
    "secure": true,
    "user": "your-qq@qq.com",
    "password": "authorization-code"
  },
  "smtp": {
    "host": "smtp.qq.com",
    "port": 587,
    "secure": false,
    "user": "your-qq@qq.com",
    "password": "authorization-code"
  }
}
```

**注意**: 使用授权码，不是 QQ 密码

### Gmail

```json
{
  "imap": {
    "host": "imap.gmail.com",
    "port": 993,
    "secure": true,
    "user": "your@gmail.com",
    "password": "app-password"
  },
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 465,
    "secure": true,
    "user": "your@gmail.com",
    "password": "app-password"
  }
}
```

**注意**: 需要应用专用密码

### 163 邮箱

```json
{
  "imap": {
    "host": "imap.163.com",
    "port": 993,
    "secure": true
  },
  "smtp": {
    "host": "smtp.163.com",
    "port": 465,
    "secure": true
  }
}
```

## 🔒 安全配置

### Allowed Senders

```json
{
  "allowedSenders": [
    "exact@example.com", // 精确匹配
    "*@company.com", // 域名通配符
    "*@*.company.com" // 子域名通配符
  ]
}
```

⚠️ **安全警告**: `allowedSenders` 检查 "From" 头，该头可能被伪造。

**生产环境建议**:

1. 在 IMAP 服务器层面启用 DKIM/SPF/DMARC
2. 不要仅依赖白名单
3. 定期审查发件人列表

## 🚀 使用

### 启动

```bash
pnpm build
pnpm start
```

### 查看日志

```bash
[EMAIL PLUGIN] [default] Starting email channel
[EMAIL PLUGIN] [default] Connecting to IMAP server imap.qq.com:993
[EMAIL PLUGIN] [default] IMAP connection ready!
[EMAIL PLUGIN] [default] Only accepting emails from: sender1@163.com, *@company.com
[EMAIL PLUGIN] [default] Searching for emails since 23-Feb-2026
[EMAIL PLUGIN] [default] ✓ ACCEPTED email from: sender@example.com
[EMAIL PLUGIN] [default] Processing email: "Subject" (Attachments: 2)
```

## 🔧 故障排除

### 连接失败

**检查**:

- IMAP/SMTP 服务器地址和端口
- 是否使用授权码（不是密码）
- 防火墙设置
- 邮箱是否启用 IMAP/SMTP

### 认证失败

**检查**:

- 用户名（完整邮箱地址）
- 密码或授权码
- Gmail: 应用专用密码
- QQ/163: 授权码

### 邮件未处理

**检查**:

- `enabled: true`
- `allowedSenders` 配置
- `checkInterval` 设置
- 查看日志输出

## 📊 性能特性

### 并行处理

- 不同发件人: 完全并行
- 相同发件人: 顺序处理
- 错误隔离: 单个发件人不影响其他

### 内存管理

- 状态自动清理（保留最近 1000 条）
- 5 秒后清理已完成队列
- 避免内存泄漏

## 📝 开发

### 项目结构

```
extensions/email-channel/
├── package.json          # 插件元数据
├── tsconfig.json         # TypeScript 配置
├── src/
│   ├── index.ts          # 插件入口
│   ├── channel.ts        # Channel 定义
│   └── runtime.ts        # IMAP/SMTP 运行时
├── types/                # 类型定义
│   ├── imap.d.ts
│   ├── mailparser.d.ts
│   └── nodemailer.d.ts
└── README.md
```

### 使用 Plugin SDK

```typescript
import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";

const emailPlugin: ChannelPlugin = {
  id: "email",
  meta: {
    label: "Email",
    discovery: {
      category: "email",
      keywords: ["email", "imap", "smtp"],
      maturity: "experimental",
    },
  },
  configSchema: buildChannelConfigSchema({...}),
  // ...
};
```

### 构建

```bash
cd extensions/email-channel
pnpm install
pnpm build
```

## 🔄 更新和维护

### 同步 Upstream

```bash
git checkout feature/email-channel
git fetch upstream
git rebase upstream/main
pnpm install
pnpm build
```

## 📚 相关文档

- [配置指南](../../EMAIL_CHANNEL_CONFIG_GUIDE.md) - 详细配置说明
- [动态加载](../../EMAIL_CHANNEL_DYNAMIC_LOADING.md) - 动态加载实现
- [SDK 策略](../../EMAIL_CHANNEL_SDK_STRATEGY.md) - SDK 使用策略
- [同步报告](../../EMAIL_CHANNEL_SYNC_REPORT.md) - 功能同步报告

## 🤝 贡献

Email channel 在 [guxiaobo/openclaw](https://github.com/guxiaobo/openclaw) fork 中维护。

### 分支策略

- **upstream/main**: 官方 OpenClaw
- **feature/email-channel**: Email channel 完整实现

### Plugin SDK PR

[PR #24087](https://github.com/openclaw/openclaw/pull/24087) - Channel 开发辅助功能

## 📄 License

MIT

## 👤 Author

OpenClaw Community

---

**版本**: 1.0.0
**更新**: 2026-02-23
**分支**: feature/email-channel
**状态**: ✅ 生产就绪

---

## 📚 完整文档

详细的用户手册和配置指南已创建在 `docs/` 目录：

- **[用户手册](./docs/USER_MANUAL.md)** - 完整的安装、配置、部署和使用指南
  - 详细的功能说明
  - 常用邮箱配置示例
  - 多账户配置
  - 生产环境部署
  - 故障排除指南
  - 安全注意事项
  - FAQ

---

## 🙏 致谢

感谢所有贡献者和 OpenClaw 社区的支持！

---

**维护者**: OpenClaw Contributors  
**最后更新**: 2026-02-24  
**版本**: 1.1.0
