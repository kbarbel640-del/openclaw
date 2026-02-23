# Email Channel 配置示例

## 📋 基于实际配置的示例

以下是基于你的 QQ 邮箱配置的实际工作示例：

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
            "password": "your-authorization-code"
          },
          "smtp": {
            "host": "smtp.qq.com",
            "port": 587,
            "secure": false,
            "user": "your-email@qq.com",
            "password": "your-authorization-code"
          },
          "checkInterval": 30,
          "allowedSenders": ["sender1@163.com", "sender2@example.com"],
          "maxAttachmentSize": 10485760
        },
        "gmail": {
          "enabled": true,
          "imap": {
            "host": "imap.gmail.com",
            "port": 993,
            "secure": true,
            "user": "your-email@gmail.com",
            "password": "your-app-password"
          },
          "smtp": {
            "host": "smtp.gmail.com",
            "port": 465,
            "secure": true,
            "user": "your-email@gmail.com",
            "password": "your-app-password"
          },
          "checkInterval": 60,
          "allowedSenders": ["*@company.com"],
          "maxAttachmentSize": 20971520
        }
      }
    }
  },
  "plugins": {
    "enabled": true,
    "entries": {
      "email": {
        "enabled": true
      }
    },
    "load": {
      "paths": ["./extensions/email-channel"]
    },
    "allow": ["email"]
  }
}
```

## 🔧 配置字段说明

### Account 字段

| 字段                | 类型     | 必需   | 默认值   | 说明                 |
| ------------------- | -------- | ------ | -------- | -------------------- |
| `enabled`           | boolean  | 否     | true     | 是否启用此账户       |
| `imap`              | object   | **是** | -        | IMAP 服务器配置      |
| `smtp`              | object   | **是** | -        | SMTP 服务器配置      |
| `checkInterval`     | number   | 否     | 30       | 邮件检查间隔（秒）   |
| `allowedSenders`    | string[] | 否     | []       | 允许的发件人白名单   |
| `maxAttachmentSize` | number   | 否     | 10485760 | 附件大小限制（字节） |

### IMAP 配置

| 字段       | 类型    | 必需   | 说明            |
| ---------- | ------- | ------ | --------------- |
| `host`     | string  | **是** | IMAP 服务器地址 |
| `port`     | number  | **是** | IMAP 服务器端口 |
| `secure`   | boolean | **是** | 是否使用 TLS    |
| `user`     | string  | **是** | 邮箱地址/用户名 |
| `password` | string  | **是** | 密码或授权码    |

### SMTP 配置

| 字段       | 类型    | 必需   | 说明             |
| ---------- | ------- | ------ | ---------------- |
| `host`     | string  | **是** | SMTP 服务器地址  |
| `port`     | number  | **是** | SMTP 服务器端口  |
| `secure`   | boolean | **是** | 是否使用 SSL/TLS |
| `user`     | string  | **是** | 邮箱地址/用户名  |
| `password` | string  | **是** | 密码或授权码     |

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

**注意**: QQ 邮箱需要使用授权码，不是 QQ 密码。
获取方式: QQ 邮箱设置 → 账户 → POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务 → 生成授权码

### Gmail

```json
{
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
  }
}
```

**注意**: Gmail 需要开启两步验证并生成应用专用密码。

### 163 邮箱

```json
{
  "imap": {
    "host": "imap.163.com",
    "port": 993,
    "secure": true,
    "user": "your-email@163.com",
    "password": "authorization-code"
  },
  "smtp": {
    "host": "smtp.163.com",
    "port": 465,
    "secure": true,
    "user": "your-email@163.com",
    "password": "authorization-code"
  }
}
```

### Outlook/Hotmail

```json
{
  "imap": {
    "host": "outlook.office365.com",
    "port": 993,
    "secure": true,
    "user": "your-email@outlook.com",
    "password": "your-password"
  },
  "smtp": {
    "host": "smtp.office365.com",
    "port": 587,
    "secure": false,
    "user": "your-email@outlook.com",
    "password": "your-password"
  }
}
```

## 🔒 安全配置

### Allowed Senders 白名单

`allowedSenders` 控制哪些发件人可以发送邮件给 OpenClaw：

```json
{
  "allowedSenders": [
    "exact@example.com", // 精确匹配
    "*@company.com", // 域名通配符
    "*@*.company.com" // 子域名通配符
  ]
}
```

**安全警告**:
⚠️ `allowedSenders` 检查的是邮件的 "From" 头，该头**可能被伪造**。

**生产环境建议**:

1. 在 IMAP 服务器层面启用 DKIM/SPF/DMARC 验证
2. 不要仅依赖 `allowedSenders` 作为唯一安全措施
3. 定期审查允许的发件人列表

### 附件大小限制

```json
{
  "maxAttachmentSize": 10485760 // 10MB in bytes
}
```

超过此限制的附件将被自动拒绝，并发送通知邮件给发件人。

## 🚀 动态加载配置

### 方法 1: Bundled Extension (自动)

Email channel 在 `extensions/email-channel/` 下会被自动发现，无需额外配置。

### 方法 2: 配置路径

```json
{
  "plugins": {
    "enabled": true,
    "load": {
      "paths": ["./extensions/email-channel", "../other-channels/custom-channel"]
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

## 📊 多账户配置

### 不同邮箱提供商

```json
{
  "channels": {
    "email": {
      "accounts": {
        "personal": {
          "enabled": true,
          "imap": {
            "host": "imap.gmail.com",
            "port": 993,
            ...
          },
          "smtp": {
            "host": "smtp.gmail.com",
            ...
          }
        },
        "work": {
          "enabled": true,
          "imap": {
            "host": "imap.company.com",
            "port": 993,
            ...
          },
          "smtp": {
            "host": "smtp.company.com",
            ...
          }
        }
      }
    }
  }
}
```

### 账户特定配置

```json
{
  "channels": {
    "email": {
      "accounts": {
        "alerts": {
          "enabled": true,
          "checkInterval": 10, // 更频繁检查
          "allowedSenders": ["alerts@monitoring.com"],
          "maxAttachmentSize": 5242880 // 5MB
        },
        "documents": {
          "enabled": true,
          "checkInterval": 60, // 较少检查
          "allowedSenders": ["*@company.com"],
          "maxAttachmentSize": 52428800 // 50MB
        }
      }
    }
  }
}
```

## ✅ 验证配置

### 检查配置语法

```bash
# 在 OpenClaw 项目目录
pnpm build
pnpm start
```

### 查看日志

```bash
# Email channel 会输出详细日志
[EMAIL PLUGIN] [default] Starting email channel
[EMAIL PLUGIN] [default] Connecting to IMAP server imap.qq.com:993
[EMAIL PLUGIN] [default] IMAP connection ready!
[EMAIL PLUGIN] [default] Only accepting emails from: sender1@163.com, sender2@example.com
[EMAIL PLUGIN] [default] Maximum attachment size: 10.00MB
[EMAIL PLUGIN] [default] Searching for emails since 23-Feb-2026
[EMAIL PLUGIN] [default] Found 2 email(s) since 23-Feb-2026
[EMAIL PLUGIN] [default] ✓ ACCEPTED email from: sender1@163.com
```

## 🔧 故障排除

### 连接失败

```
Error: IMAP connection error
```

**检查**:

1. IMAP/SMTP 服务器地址和端口是否正确
2. 是否使用了授权码而不是密码（QQ、163等）
3. 防火墙是否允许相应端口
4. 邮箱是否启用了 IMAP/SMTP 服务

### 认证失败

```
Error: Authentication failed
```

**检查**:

1. 用户名（通常是完整邮箱地址）
2. 密码或授权码是否正确
3. Gmail 是否使用了应用专用密码
4. QQ/163 是否已生成授权码

### 邮件未被处理

```
No emails processed
```

**检查**:

1. `enabled` 是否为 true
2. `allowedSenders` 是否配置正确
3. 邮件是否已被标记为已读
4. 检查间隔是否合理

## 📝 最佳实践

### 1. 使用授权码

不要使用邮箱登录密码，使用专用的授权码/应用密码：

- ✅ QQ邮箱: 生成授权码
- ✅ Gmail: 生成应用专用密码
- ✅ 163: 设置客户端授权密码

### 2. 合理设置检查间隔

```json
{
  "checkInterval": 30 // 推荐: 30-60 秒
}
```

- 太频繁（< 10秒）: 增加 IMAP 服务器负担
- 太慢（> 300秒）: 延迟响应

### 3. 限制允许的发件人

```json
{
  "allowedSenders": [
    "*@company.com", // 公司邮箱
    "specific@partner.com" // 特定合作伙伴
  ]
}
```

### 4. 监控日志

定期查看日志，确保：

- ✅ IMAP/SMTP 连接正常
- ✅ 邮件被正确处理
- ✅ 附件处理正常
- ✅ 没有错误或警告

### 5. 备份配置

```bash
# 备份配置文件
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup
```

## 🎯 测试配置

### 发送测试邮件

从允许的发件人地址发送一封测试邮件：

```
主题: Test Email for OpenClaw

这是一封测试邮件，用于验证 email channel 配置是否正确。
```

### 检查处理日志

```bash
# 查看日志
tail -f ~/.openclaw/logs/openclaw.log | grep "EMAIL PLUGIN"
```

预期输出:

```
[EMAIL PLUGIN] [default] Processing email from sender@example.com: "Test Email for OpenClaw"
[EMAIL PLUGIN] [default] Email processed successfully
```

---

**配置版本**: 2026-02-23
**基于**: 实际 QQ 邮箱配置
**测试状态**: ✅ 工作正常
