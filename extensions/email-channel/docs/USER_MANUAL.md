# Email Channel 用户手册

**版本**: 1.1.0
**最后更新**: 2026-02-24
**适用**: OpenClaw 2026.2.0+

---

## 📖 目录

- [简介](#简介)
- [功能特性](#功能特性)
- [系统要求](#系统要求)
- [安装](#安装)
- [配置](#配置)
- [部署](#部署)
- [使用指南](#使用指南)
- [故障排除](#故障排除)
- [最佳实践](#最佳实践)
- [安全注意事项](#安全注意事项)
- [FAQ](#faq)

---

## 简介

Email Channel 是 OpenClaw 的一个插件，允许您通过标准的 IMAP/SMTP 协议发送和接收电子邮件。它支持多账户、附件处理、发件人过滤等功能。

### 主要用途

- 📧 将 OpenClaw 连接到任何标准邮箱（Gmail, Outlook, QQ邮箱等）
- 🔄 自动轮询收件箱处理新邮件
- 📎 支持附件的接收和处理
- 🔒 支持发件人白名单过滤
- 💬 多账户并发处理
- 🔄 自动去重和重试机制

---

## 功能特性

### ✅ 核心功能

- **IMAP 接收**: 自动轮询 IMAP 邮箱，处理新邮件
- **SMTP 发送**: 通过 SMTP 服务器发送回复邮件
- **附件支持**: 接收和发送邮件附件（最大 10MB）
- **多账户**: 支持同时配置多个邮箱账户
- **并发处理**: 不同发件人的邮件并行处理
- **去重机制**: 自动跳过已处理的邮件
- **重试逻辑**: 失败的邮件自动重试（最多3次）
- **状态持久化**: 重启后恢复处理状态

### ✅ 安全功能

- **发件人白名单**: 只处理授权发件人的邮件
- **TLS/SSL**: 支持 IMAPS 和 SMTPS 加密连接
- **附件大小限制**: 防止过大的附件占用资源

### ✅ 智能功能

- **消息队列**: 同一发件人的邮件按顺序处理
- **自动回复**: 附件过大时自动发送拒绝通知
- **垃圾邮件过滤**: 基于 allowedSenders 的基础过滤

---

## 系统要求

### 必需

- **OpenClaw**: 2026.2.0 或更高版本
- **Node.js**: 18.0.0 或更高版本
- **邮箱账户**: 支持 IMAP/SMTP 的邮箱服务

### 支持的邮箱服务

- ✅ Gmail (需要应用专用密码)
- ✅ Outlook/Hotmail
- ✅ QQ邮箱
- ✅ 163邮箱
- ✅ 自建邮件服务器
- ✅ 任何标准 IMAP/SMTP 服务器

---

## 安装

### 方法 1: 从源代码安装（开发模式）

```bash
# 1. 克隆 OpenClaw 仓库
git clone https://github.com/yourusername/openclaw.git
cd openclaw

# 2. 切换到 email-channel 分支
git checkout feature/email-channel

# 3. 安装依赖
pnpm install

# 4. 构建（如果需要）
pnpm build

# 5. 安装 email-channel 依赖
cd extensions/email-channel
npm install
```

### 方法 2: 安装到 OpenClaw 全局扩展目录（推荐）

```bash
# 1. 创建扩展目录
mkdir -p ~/.openclaw/extensions

# 2. 复制 email-channel 到扩展目录
cp -r /path/to/openclaw/extensions/email-channel ~/.openclaw/extensions/

# 3. 安装依赖
cd ~/.openclaw/extensions/email-channel
npm install
```

### 方法 3: 使用符号链接（开发模式）

```bash
# 创建符号链接，方便开发调试
ln -s /path/to/openclaw/extensions/email-channel ~/.openclaw/extensions/email-channel
```

### 验证安装

```bash
# 检查文件结构
ls -la ~/.openclaw/extensions/email-channel/

# 应该看到：
# ├── index.ts (或 src/index.ts)
# ├── package.json
# ├── openclaw.plugin.json
# ├── src/
# │   ├── index.ts
# │   ├── channel.ts
# │   └── runtime.ts
# └── node_modules/
```

---

## 配置

### 基础配置

配置文件位置: `~/.openclaw/openclaw.json`

### 配置示例

```json
{
  "channels": {
    "email": {
      "accounts": {
        "default": {
          "enabled": true,
          "imap": {
            "host": "imap.example.com",
            "port": 993,
            "secure": true,
            "user": "your-email@example.com",
            "password": "your-app-password"
          },
          "smtp": {
            "host": "smtp.example.com",
            "port": 587,
            "secure": false,
            "user": "your-email@example.com",
            "password": "your-app-password"
          },
          "checkInterval": 30,
          "allowedSenders": ["trusted-user1@example.com", "trusted-user2@example.com"],
          "maxAttachmentSize": 10485760
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
    }
  }
}
```

### 配置字段说明

#### 账户配置 (`accounts`)

| 字段                | 类型     | 必需 | 默认值   | 说明                 |
| ------------------- | -------- | ---- | -------- | -------------------- |
| `enabled`           | boolean  | 否   | true     | 是否启用此账户       |
| `imap`              | object   | ✅   | -        | IMAP 服务器配置      |
| `smtp`              | object   | ✅   | -        | SMTP 服务器配置      |
| `checkInterval`     | number   | 否   | 30       | 轮询间隔（秒）       |
| `allowedSenders`    | string[] | 否   | []       | 白名单发件人列表     |
| `maxAttachmentSize` | number   | 否   | 10485760 | 最大附件大小（字节） |

#### IMAP 配置

| 字段       | 类型    | 必需 | 说明                                       |
| ---------- | ------- | ---- | ------------------------------------------ |
| `host`     | string  | ✅   | IMAP 服务器地址                            |
| `port`     | number  | ✅   | IMAP 端口（通常 993 for SSL, 143 for TLS） |
| `secure`   | boolean | ✅   | 是否使用 SSL/TLS                           |
| `user`     | string  | ✅   | 邮箱地址或用户名                           |
| `password` | string  | ✅   | 邮箱密码或应用专用密码                     |

#### SMTP 配置

| 字段       | 类型    | 必需 | 说明                                       |
| ---------- | ------- | ---- | ------------------------------------------ |
| `host`     | string  | ✅   | SMTP 服务器地址                            |
| `port`     | number  | ✅   | SMTP 端口（通常 465 for SSL, 587 for TLS） |
| `secure`   | boolean | ✅   | 是否使用 SSL/TLS                           |
| `user`     | string  | ✅   | 邮箱地址或用户名                           |
| `password` | string  | ✅   | 邮箱密码或应用专用密码                     |

### 常用邮箱配置

#### Gmail

```json
{
  "imap": {
    "host": "imap.gmail.com",
    "port": 993,
    "secure": true,
    "user": "your-email@gmail.com",
    "password": "your-app-password"
  },
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false,
    "user": "your-email@gmail.com",
    "password": "your-app-password"
  }
}
```

**注意**: Gmail 需要使用 [应用专用密码](https://support.google.com/accounts/answer/185833)

#### QQ 邮箱

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

**注意**: QQ 邮箱需要在邮箱设置中开启 IMAP/SMTP 服务，并获取授权码

#### 163 邮箱

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

#### Outlook

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

### 多账户配置

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
            "secure": true,
            "user": "personal@gmail.com",
            "password": "app-password-1"
          },
          "smtp": {
            "host": "smtp.gmail.com",
            "port": 587,
            "secure": false,
            "user": "personal@gmail.com",
            "password": "app-password-1"
          }
        },
        "work": {
          "enabled": true,
          "imap": {
            "host": "imap.company.com",
            "port": 993,
            "secure": true,
            "user": "work@company.com",
            "password": "work-password"
          },
          "smtp": {
            "host": "smtp.company.com",
            "port": 587,
            "secure": false,
            "user": "work@company.com",
            "password": "work-password"
          }
        }
      }
    }
  }
}
```

---

## 部署

### 本地部署

#### 1. 启动 Gateway

```bash
# 启动 OpenClaw Gateway
pnpm openclaw gateway run --bind loopback --port 18789

# 或使用 --force 强制重启
pnpm openclaw gateway run --bind loopback --port 18789 --force
```

#### 2. 验证部署

```bash
# 检查 gateway 状态
pnpm openclaw health

# 检查 email channel 状态
pnpm openclaw doctor | grep -A 10 "Plugin diagnostics"
```

#### 3. 查看日志

```bash
# 实时查看 gateway 日志
tail -f ~/.openclaw/logs/gateway.log

# 或通过 RPC 查看日志
pnpm openclaw logs
```

### 生产环境部署

#### 1. 配置 LaunchAgent (macOS)

```bash
# OpenClaw 会自动创建 LaunchAgent
# 启动服务
pnpm openclaw gateway start

# 停止服务
pnpm openclaw gateway stop

# 查看服务状态
launchctl list | grep openclaw
```

#### 2. 配置 systemd (Linux)

创建服务文件: `/etc/systemd/system/openclaw-gateway.service`

```ini
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/openclaw
ExecStart=/usr/bin/node /opt/openclaw/dist/cli.js gateway run --bind 0.0.0.0 --port 18789
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 启用并启动服务
sudo systemctl enable openclaw-gateway
sudo systemctl start openclaw-gateway

# 查看状态
sudo systemctl status openclaw-gateway
```

#### 3. Docker 部署

创建 `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装 OpenClaw
RUN npm install -g openclaw@latest

# 创建配置目录
RUN mkdir -p /root/.openclaw/extensions

# 复制 email-channel 插件
COPY extensions/email-channel /root/.openclaw/extensions/email-channel
WORKDIR /root/.openclaw/extensions/email-channel
RUN npm install --production

# 复制配置文件
COPY openclaw.json /root/.openclaw/openclaw.json

EXPOSE 18789

CMD ["openclaw", "gateway", "run", "--bind", "0.0.0.0", "--port", "18789"]
```

构建并运行：

```bash
# 构建镜像
docker build -t openclaw-email-channel .

# 运行容器
docker run -d \
  --name openclaw-gateway \
  -p 18789:18789 \
  -v /path/to/openclaw.json:/root/.openclaw/openclaw.json \
  openclaw-email-channel
```

---

## 使用指南

### 发送邮件

通过 OpenClaw CLI 发送邮件：

```bash
# 发送简单文本邮件
pnpm openclaw message send \
  --channel email \
  --to recipient@example.com \
  --message "Hello from OpenClaw!"

# 发送带附件的邮件
pnpm openclaw message send \
  --channel email \
  --to recipient@example.com \
  --message "Please find attached file" \
  --attachment /path/to/file.pdf
```

### 接收邮件

Email channel 会自动轮询 IMAP 收件箱并处理新邮件。处理流程：

1. **扫描**: 每 `checkInterval` 秒扫描一次 INBOX
2. **过滤**: 检查发件人是否在 `allowedSenders` 列表中
3. **去重**: 跳过已处理的消息（通过 Message-ID）
4. **处理**: 将邮件内容传递给 OpenClaw agent
5. **标记**: 处理完成后标记为已读（\Seen flag）

### 查看处理状态

```bash
# 查看状态文件
cat ~/.openclaw/extensions/email-channel/state/state-default.json

# 输出示例：
{
  "lastProcessedTimestamp": "2026-02-24T10:00:00.000Z",
  "processedMessageIds": [
    "<message-id-1@example.com>",
    "<message-id-2@example.com>"
  ],
  "failedAttempts": {}
}
```

### 查看日志

```bash
# 实时查看 email channel 日志
tail -f ~/.openclaw/logs/gateway.log | grep EMAIL

# 常见日志示例：
[EMAIL PLUGIN] [default] Loaded state: lastProcessed=..., processedCount=13
[EMAIL PLUGIN] [default] Connecting to IMAP server imap.qq.com:993
[EMAIL PLUGIN] [default] IMAP connection ready!
[EMAIL PLUGIN] [default] Found 42 email(s) since 21-Feb-2026
[EMAIL PLUGIN] [default] ✓ ACCEPTED email from: sender@example.com
[EMAIL PLUGIN] [default] ✗ Ignoring email from unauthorized sender: spam@example.com
```

---

## 故障排除

### 问题 1: Gateway 无法启动

**症状**:

```
extension entry escapes package directory: ./index.ts
```

**原因**: `package.json` 中的路径错误

**解决方案**:

1. 检查 `package.json`:

```bash
cat ~/.openclaw/extensions/email-channel/package.json | jq '.openclaw.extensions'
```

2. 确保路径正确：

```json
{
  "openclaw": {
    "extensions": ["./src/index.ts"]
  }
}
```

3. 检查文件是否存在：

```bash
ls -la ~/.openclaw/extensions/email-channel/src/index.ts
```

### 问题 2: IMAP 连接失败

**症状**:

```
[EMAIL PLUGIN] [default] IMAP connection error: ...
```

**检查清单**:

1. **网络连接**:

```bash
# 测试 IMAP 服务器连接
telnet imap.example.com 993
```

2. **凭据正确**:
   - 确认邮箱地址正确
   - 确认密码或授权码正确
   - 对于 Gmail/QQ，使用应用专用密码/授权码

3. **端口和协议**:
   - IMAP: 通常 993 (SSL) 或 143 (STARTTLS)
   - SMTP: 通常 465 (SSL) 或 587 (STARTTLS)

4. **防火墙**:
   - 确保相关端口未被阻止

### 问题 3: 邮件未被处理

**可能原因**:

1. **发件人不在白名单**:

```bash
# 检查日志
grep "Ignoring email from unauthorized sender" ~/.openclaw/logs/gateway.log
```

**解决方案**: 添加发件人到 `allowedSenders` 列表

2. **邮件已被处理**:

```bash
# 检查状态文件
cat ~/.openclaw/extensions/email-channel/state/state-default.json | jq '.processedMessageIds'
```

3. **IMAP 文件夹错误**:
   - Email channel 只监控 INBOX
   - 确保邮件在 INBOX 而不是其他文件夹

### 问题 4: 附件处理失败

**症状**:

```
⚠️ Oversized attachments detected: ...
```

**原因**: 附件超过大小限制（默认 10MB）

**解决方案**:

1. 调整大小限制：

```json
{
  "maxAttachmentSize": 20971520 // 20MB
}
```

2. 或要求发件人使用文件共享服务

### 问题 5: 状态文件丢失

**症状**: 邮件被重复处理

**原因**: 状态文件被删除或损坏

**解决方案**:

1. 检查状态目录：

```bash
ls -la ~/.openclaw/extensions/email-channel/state/
```

2. 恢复状态文件（如果有备份）:

```bash
cp backup/state-default.json ~/.openclaw/extensions/email-channel/state/
```

3. 或等待系统重新建立状态（可能会重复处理一些邮件）

### 问题 6: 插件未加载

**症状**: `pnpm openclaw doctor` 中没有显示 email channel

**检查清单**:

1. **插件文件完整性**:

```bash
ls -la ~/.openclaw/extensions/email-channel/
# 应该看到：package.json, openclaw.plugin.json, src/, node_modules/
```

2. **package.json 格式正确**:

```bash
cat ~/.openclaw/extensions/email-channel/package.json | jq .
```

3. **openclaw.plugin.json 存在**:

```bash
cat ~/.openclaw/extensions/email-channel/openclaw.plugin.json
```

4. **依赖已安装**:

```bash
cd ~/.openclaw/extensions/email-channel
npm install
```

---

## 最佳实践

### 1. 安全配置

#### 使用应用专用密码

不要使用邮箱登录密码，而是使用应用专用密码：

- **Gmail**: [创建应用专用密码](https://support.google.com/accounts/answer/185833)
- **QQ邮箱**: 在邮箱设置中生成授权码
- **Outlook**: 使用应用密码

#### 限制发件人

始终配置 `allowedSenders` 白名单：

```json
{
  "allowedSenders": ["trusted-user1@example.com", "trusted-user2@example.com"]
}
```

#### 定期更新密码

- 每 3-6 个月更新一次应用密码
- 如果怀疑密码泄露，立即更换

### 2. 性能优化

#### 调整轮询间隔

根据邮件量调整 `checkInterval`:

- **高频使用**: 15-30 秒
- **中等使用**: 60-120 秒
- **低频使用**: 300-600 秒

```json
{
  "checkInterval": 60
}
```

#### 清理状态文件

定期清理过期的消息 ID：

状态文件会自动维护最近 1000 个消息 ID，无需手动清理。

### 3. 多账户管理

#### 使用有意义的账户 ID

```json
{
  "accounts": {
    "personal-gmail": { ... },
    "work-outlook": { ... },
    "support": { ... }
  }
}
```

#### 分离配置

为不同类型的邮件使用不同的账户：

- **个人邮件**: personal-gmail
- **工作邮件**: work-outlook
- **客户支持**: support

### 4. 监控和日志

#### 启用详细日志

```bash
# 启动 gateway 时使用 debug 日志级别
pnpm openclaw gateway run --log-level debug
```

#### 监控关键指标

- IMAP 连接状态
- 处理的邮件数量
- 失败重试次数
- 附件大小统计

### 5. 备份和恢复

#### 备份状态文件

```bash
# 定期备份状态文件
cp ~/.openclaw/extensions/email-channel/state/state-*.json /backup/email-channel/
```

#### 备份配置

```bash
# 备份 OpenClaw 配置
cp ~/.openclaw/openclaw.json /backup/openclaw-config.json
```

---

## 安全注意事项

### ⚠️ 重要安全警告

#### 1. allowedSenders 不是安全机制

```
WARNING: allowedSenders checks "From" address which can be forged.
Use with IMAP server-level DKIM/SPF/DMARC validation for security.
```

`allowedSenders` 只是基本的过滤，**不能**作为唯一的安全措施，因为：

- 发件人地址可以被伪造
- 攻击者可以伪装成授权发件人

**正确的安全措施**:

- 在 IMAP 服务器层面启用 DKIM 验证
- 配置 SPF 记录
- 启用 DMARC 策略
- 使用 TLS/SSL 加密连接

#### 2. 密码安全

**不要**:

- ❌ 使用邮箱登录密码
- ❌ 在代码中硬编码密码
- ❌ 将密码提交到 git 仓库
- ❌ 在不安全的网络传输密码

**应该**:

- ✅ 使用应用专用密码
- ✅ 将密码存储在 `~/.openclaw/openclaw.json`
- ✅ 设置文件权限: `chmod 600 ~/.openclaw/openclaw.json`
- ✅ 定期更换密码

#### 3. 网络安全

**建议**:

- ✅ 始终使用 SSL/TLS 连接
- ✅ 在防火墙中限制 IMAP/SMTP 端口访问
- ✅ 使用 VPN 或专用网络
- ✅ 定期检查连接日志

#### 4. 数据隐私

**注意**:

- 📧 邮件内容可能包含敏感信息
- 🔐 遵守数据保护法规（GDPR, CCPA 等）
- 🗑️ 定期清理日志和状态文件
- 📋 制定数据保留策略

#### 5. 附件安全

**风险**:

- 🦠 附件可能包含恶意软件
- 💣 压缩文件炸弹
- 📂 路径遍历攻击

**防护措施**:

- ✅ 限制附件大小
- ✅ 使用病毒扫描
- ✅ 在沙箱环境中处理附件
- ✅ 验证文件类型

---

## FAQ

### Q1: Email channel 支持哪些邮箱服务？

**A**: 支持任何标准 IMAP/SMTP 服务器，包括：

- Gmail
- Outlook/Hotmail
- Yahoo Mail
- QQ 邮箱
- 163 邮箱
- 自建邮件服务器

### Q2: 如何获取 Gmail 的应用密码？

**A**:

1. 访问 [Google 账户设置](https://myaccount.google.com/)
2. 启用两步验证
3. 搜索"应用密码"
4. 生成新的应用密码
5. 在配置中使用该密码

### Q3: 可以同时使用多个邮箱账户吗？

**A**: 可以，在 `accounts` 中配置多个账户：

```json
{
  "accounts": {
    "personal": { ... },
    "work": { ... }
  }
}
```

每个账户独立运行，互不干扰。

### Q4: 邮件处理失败后会重试吗？

**A**: 会，最多重试 3 次。超过 3 次后会被标记为已处理，避免无限重试。

### Q5: 如何查看已处理的消息列表？

**A**: 查看状态文件：

```bash
cat ~/.openclaw/extensions/email-channel/state/state-default.json | jq '.processedMessageIds'
```

### Q6: 状态文件可以删除吗？

**A**: 可以，但会导致：

- 已处理的邮件会被重新处理
- 丢失去重信息
- 可能产生重复操作

建议只在必要时删除，并提前备份。

### Q7: 如何禁用某个账户？

**A**: 设置 `enabled: false`：

```json
{
  "accounts": {
    "work": {
      "enabled": false,
      ...
    }
  }
}
```

### Q8: 附件大小限制是多少？

**A**: 默认 10MB。可以通过 `maxAttachmentSize` 调整：

```json
{
  "maxAttachmentSize": 20971520 // 20MB
}
```

### Q9: 如何调试 IMAP/SMTP 连接问题？

**A**:

1. 使用 debug 日志级别：

```bash
pnpm openclaw gateway run --log-level debug
```

2. 测试连接：

```bash
# IMAP
telnet imap.example.com 993

# SMTP
telnet smtp.example.com 587
```

### Q10: Email channel 支持加密邮件吗？

**A**: 不直接支持 PGP/S/MIME 加密。如果需要处理加密邮件，需要：

- 在邮件服务器层面解密
- 或使用支持加密的邮件网关

### Q11: 如何处理垃圾邮件？

**A**:

1. 配置 `allowedSenders` 白名单
2. 在邮件服务器层面启用垃圾邮件过滤
3. 使用 SpamAssassin 或类似工具

### Q12: 可以自定义邮件处理逻辑吗？

**A**: 可以，通过修改 OpenClaw agent 的配置和 hooks。Email channel 只是传输层，业务逻辑在 agent 中实现。

---

## 获取帮助

### 文档

- [OpenClaw 官方文档](https://docs.openclaw.ai)
- [Email Channel GitHub](https://github.com/yourusername/openclaw/tree/feature/email-channel)

### 社区

- [GitHub Issues](https://github.com/openclaw/openclaw/issues)
- [Discord 社区](https://discord.gg/openclaw)

### 报告问题

如果发现 bug 或有功能建议，请：

1. 查看 [已有 Issues](https://github.com/openclaw/openclaw/issues)
2. 收集相关信息：
   - OpenClaw 版本
   - Node.js 版本
   - 操作系统
   - 配置文件（移除敏感信息）
   - 错误日志
3. [创建新 Issue](https://github.com/openclaw/openclaw/issues/new)

---

## 更新日志

### v1.1.0 (2026-02-24)

- ✨ 新增：状态文件统一到 `email-channel/state/` 目录
- 🐛 修复：Gateway 启动时的路径验证问题
- 📝 改进：完善文档和用户手册
- 🔒 安全：添加 allowedSenders 安全警告

### v1.0.0 (2026-02-20)

- 🎉 首次发布
- ✅ IMAP/SMTP 基础功能
- ✅ 多账户支持
- ✅ 附件处理
- ✅ 发件人白名单
- ✅ 并发处理和去重

---

## 许可证

MIT License

---

**最后更新**: 2026-02-24
**维护者**: OpenClaw Contributors
**版本**: 1.1.0
