# Email Channel 加载路径和配置说明

## 📁 插件加载目录

### OpenClaw 从以下位置加载插件：

#### 1. 全局扩展目录 (优先)

```
~/.openclaw/extensions/
```

**发现逻辑**:

- OpenClaw 启动时自动扫描 `~/.openclaw/extensions/` 目录
- 查找包含 `openclaw.extensions` 字段的 `package.json`
- 这就是你看到的 `email-channel` 被加载的位置

**实际加载**:

```
~/.openclaw/extensions/email-channel/
├── index.ts                    # ← 入口文件 (package.json 中指定)
├── package.json                # ← 包含 "openclaw": {"extensions": ["./index.ts"]}
├── node_modules/               # ← 依赖
└── src/                        # ← 源代码
    ├── channel.ts
    └── runtime.ts
```

#### 2. 工作区扩展目录

```
<workspace>/.openclaw/extensions/
```

#### 3. 项目 extensions 目录

```
<project>/extensions/
```

## ⚙️ 配置文件位置

### Email Channel 配置

**位置**: `~/.openclaw/openclaw.json`

```json
{
  "channels": {
    "email": {
      "accounts": {
        "default": {
          "imap": {
            "host": "imap.qq.com",
            "port": 993,
            "secure": true,
            "user": "guxiaobo1982@qq.com",
            "password": "cgcxtmrovpzrbgcg"
          },
          "smtp": {
            "host": "smtp.qq.com",
            "port": 587,
            "secure": false,
            "user": "guxiaobo1982@qq.com",
            "password": "cgcxtmrovpzrbgcg"
          },
          "checkInterval": 30,
          "allowedSenders": ["smartware@163.com", "guxiaobo1982@163.com"]
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

## 🔄 加载流程

### 1. 插件发现

```typescript
// src/plugins/discovery.ts
const globalDir = path.join(resolveConfigDir(), "extensions");
// → ~/.openclaw/extensions/

discoverInDirectory({
  dir: globalDir, // ← 扫描这个目录
  origin: "global",
  // ...
});
```

### 2. 读取 package.json

```bash
# 在 ~/.openclaw/extensions/email-channel/
cat package.json
```

```json
{
  "name": "@openclaw/email",
  "openclaw": {
    "extensions": ["./index.ts"]  # ← 指定入口文件
  }
}
```

### 3. 加载入口文件

```typescript
// 动态导入
import("/Users/guxiaobo/.openclaw/extensions/email-channel/index.ts");
```

### 4. 注册 Channel

```typescript
// index.ts
api.registerChannel({ plugin: emailPlugin });
```

### 5. 读取配置

```typescript
// 从 ~/.openclaw/openclaw.json 读取
const config = cfg.channels?.email?.accounts?.default;
```

## 📊 插件目录结构

### ~/.openclaw/extensions/email-channel/

```
email-channel/
├── index.ts                # 插件入口
├── package.json            # 插件配置
├── node_modules/           # 依赖
├── state/                  # 运行时状态目录
│   ├── state-default.json  # default 账户的状态
│   └── state-<account>.json # 其他账户的状态文件
└── src/                    # 源代码
    ├── channel.ts
    └── runtime.ts
```

**作用**:

- ✅ 插件源代码
- ✅ 依赖包
- ✅ 被动态加载
- ✅ 存储已处理的消息 ID（去重）
- ✅ 记录最后处理时间戳
- ✅ 重试计数器
- ✅ 持久化，重启后恢复

**状态文件格式** (`state/state-default.json`):

```json
{
  "lastProcessedTimestamp": "2026-02-20T15:03:38.218Z",
  "processedMessageIds": [
    "<1147e64.f9a2e.19c7690ad16.Coremail.guxiaobo1982@163.com>"
    // ...
  ],
  "failedAttempts": {
    "<message-id>": 1
  }
}
```

## 🔧 如何更新插件代码

### 方法 1: 直接替换 (推荐)

```bash
# 1. 删除旧版本
rm -rf ~/.openclaw/extensions/email-channel/

# 2. 复制新版本
cp -r /path/to/openclaw/extensions/email-channel ~/.openclaw/extensions/

# 3. 安装依赖
cd ~/.openclaw/extensions/email-channel
npm install
```

### 方法 2: 符号链接

```bash
# 创建符号链接（开发模式）
ln -s /path/to/openclaw/extensions/email-channel ~/.openclaw/extensions/email-channel
```

### 方法 3: 配置路径

在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "plugins": {
    "load": {
      "paths": ["/Users/guxiaobo/Documents/GitHub/openclaw/extensions/email-channel"]
    },
    "allow": ["email"]
  }
}
```

## 📝 配置文件详解

### package.json (插件配置)

**位置**: `~/.openclaw/extensions/email-channel/package.json`

```json
{
  "name": "@openclaw/email",
  "version": "1.0.0",
  "type": "module",
  "main": "index.ts",
  "dependencies": {
    "imap": "^0.8.19",
    "mailparser": "^3.6.9",
    "nodemailer": "^6.9.13",
    "utf7": "^1.0.2"
  },
  "openclaw": {
    "extensions": ["./index.ts"] // ← 入口文件
  }
}
```

**关键字段**:

- `openclaw.extensions`: 指定入口文件数组
- `dependencies`: 运行时依赖
- `type: "module"`: 使用 ESM

### openclaw.json (用户配置)

**位置**: `~/.openclaw/openclaw.json`

```json
{
  "channels": {
    "email": {
      // ← channel ID
      "accounts": {
        "default": {
          // ← account ID
          "enabled": true,
          "imap": {
            /* ... */
          },
          "smtp": {
            /* ... */
          },
          "checkInterval": 30,
          "allowedSenders": []
        },
        "gmail": {
          // ← 可以配置多个账户
          "enabled": true,
          "imap": {
            /* ... */
          },
          "smtp": {
            /* ... */
          }
        }
      }
    }
  },
  "plugins": {
    "enabled": true,
    "entries": {
      "email": {
        // ← plugin ID
        "enabled": true
      }
    }
  }
}
```

## 🔍 调试和日志

### 查看加载日志

```bash
# 启动 OpenClaw 并查看插件加载
pnpm start 2>&1 | grep -i "plugin\|email"
```

**输出示例**:

```
[plugins] discovered non-bundled plugins may auto-load: email
[plugins] email: loaded from ~/.openclaw/extensions/email-channel/index.ts
[EMAIL PLUGIN] Starting email channel
[EMAIL PLUGIN] Connecting to IMAP server imap.qq.com:993
```

### 查看插件列表

```bash
# 列出已发现的插件
ls -la ~/.openclaw/extensions/
```

### 查看状态文件

```bash
# 查看已处理的消息
cat ~/.openclaw/extensions/email/state.json | jq '.processedMessageIds | length'
```

## 🎯 总结

### 加载顺序

1. **启动** → 扫描 `~/.openclaw/extensions/`
2. **发现** → 读取 `package.json` 中的 `openclaw.extensions`
3. **加载** → 动态导入 `./index.ts`
4. **注册** → 调用 `api.registerChannel({ plugin: emailPlugin })`
5. **配置** → 从 `~/.openclaw/openclaw.json` 读取配置
6. **启动** → 调用 `gateway.startAccount()` 启动账户
7. **运行** → 开始 IMAP 轮询，处理邮件

### 关键目录

| 目录                                    | 用途     | 内容                              |
| --------------------------------------- | -------- | --------------------------------- |
| `~/.openclaw/extensions/email-channel/` | 插件目录 | TypeScript 源码、依赖、运行时状态 |
| `~/.openclaw/openclaw.json`             | 用户配置 | IMAP/SMTP 配置、账户信息          |

### 注意事项

- ✅ 所有文件都保存在 `~/.openclaw/extensions/email-channel/` 目录下
- ✅ 状态文件保存在 `~/.openclaw/extensions/email-channel/state/` 子目录
- ✅ 可以安全删除整个 `email-channel/` 目录并重新安装（会丢失状态）
- ⚠️ 删除 `state/` 目录会导致消息重复处理

---

**更新时间**: 2026-02-24
**插件加载位置**: `~/.openclaw/extensions/email-channel/`
**配置文件位置**: `~/.openclaw/openclaw.json`
**状态存储位置**: `~/.openclaw/extensions/email/`
