# Skill Guard 接入指南

> **版本**: v1.0  
> **日期**: 2026-02-07  
> **定位**: 面向业务方的功能接入文档，涵盖代码侧和云端两个方向  
> **适用对象**: 后端开发、云端平台开发、安全工程师、第三方集成方

---

## 目录

1. [Skill Guard 是什么](#1-skill-guard-是什么)
2. [配置说明](#2-配置说明)
3. [使用方式](#3-使用方式)
4. [云端如何对接](#4-云端如何对接)
5. [新仓库/分支如何接入](#5-新仓库分支如何接入)
6. [静态代码扫描规则](#6-静态代码扫描规则)
7. [审计日志](#7-审计日志)
8. [降级与容错](#8-降级与容错)
9. [FAQ](#9-faq)

---

## 1. Skill Guard 是什么

Skill Guard 是 OpenClaw 的 **Skill 安全准入框架**，采用与 Android 应用商店类似的安全模型：

```
┌─────────────────────────────────────────┐
│           Skill 商店（云端）              │
│                                         │
│   开发者提交 → 自动扫描 → 人工审核       │
│   → SHA256 逐文件入库 → 发布到 Manifest   │
│   → 紧急情况可 Blocklist 下架             │
└────────────────┬────────────────────────┘
                 │ HTTPS (ETag/304)
┌────────────────▼────────────────────────┐
│        OpenClaw 客户端（本地）            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 商店 Skill                      │    │
│  │ → Manifest SHA256 逐文件校验    │    │
│  │ → Blocklist 紧急阻断            │    │
│  │ → hash 匹配才允许加载           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 侧载 Skill（用户自装）          │    │
│  │ → 本地静态代码扫描              │    │
│  │ → critical 发现 → 阻断          │    │
│  │ → warn 发现 → 警告放行          │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 核心能力

| 能力          | 说明                                                  |
| ------------- | ----------------------------------------------------- |
| **商店校验**  | 逐文件 SHA256 校验，防篡改、防注入                    |
| **Blocklist** | 云端紧急下架，客户端即时阻断                          |
| **侧载扫描**  | 8 条静态扫描规则，检测危险代码模式                    |
| **策略可配**  | 三种侧载策略：`warn` / `block-critical` / `block-all` |
| **审计追踪**  | JSONL 格式审计日志，记录所有安全事件                  |
| **优雅降级**  | 云端不可达时自动使用缓存，无缓存时降级放行            |
| **重启持久**  | Gateway SIGUSR1 重启后 Guard 自动恢复                 |

---

## 2. 配置说明

配置位于 OpenClaw 配置文件（默认 `~/.config/openclaw/openclaw.json`）的 `skills.guard` 字段。

### 2.1 完整配置结构

```jsonc
{
  "skills": {
    "guard": {
      // 总开关，设为 false 可完全禁用 Guard
      "enabled": true,

      // 可信商店列表（按优先级排序，第一个成功即停止）
      "trustedStores": [
        {
          "name": "Official Store", // 显示名称（可选）
          "url": "https://store.example.com/api/v1/skill-guard", // 商店 API 基础 URL
          "apiKey": "${OPENCLAW_STORE_API_KEY}", // API 密钥（可选，支持环境变量）
        },
        {
          "name": "Mirror Store", // 备用商店
          "url": "https://mirror.example.com/api/v1/skill-guard",
        },
      ],

      // 侧载策略
      // "warn"           — 扫描但不阻断，仅告警
      // "block-critical" — 发现 critical 级问题则阻断（默认）
      // "block-all"      — 发现任何问题（critical 或 warn）都阻断
      "sideloadPolicy": "block-critical",

      // 后台同步间隔（秒），默认 300
      "syncIntervalSeconds": 300,

      // 是否启用审计日志，默认 true
      "auditLog": true,
    },
  },
}
```

### 2.2 配置项详解

| 配置项                   | 类型                 | 默认值             | 说明                                                             |
| ------------------------ | -------------------- | ------------------ | ---------------------------------------------------------------- |
| `enabled`                | `boolean`            | `true`             | 总开关。`false` = 跳过所有校验，所有 Skill 直接加载              |
| `trustedStores`          | `SkillStoreConfig[]` | `[]`               | 空数组 = 所有 Skill 视为侧载，走本地扫描                         |
| `trustedStores[].url`    | `string`             | —                  | **必填**。商店 API 基础 URL，Guard 会请求 `{url}/manifest`       |
| `trustedStores[].apiKey` | `string`             | —                  | 可选。发送为 `Authorization: Bearer {apiKey}` 头                 |
| `trustedStores[].name`   | `string`             | —                  | 可选。日志和调试中显示的名称                                     |
| `sideloadPolicy`         | `string`             | `"block-critical"` | 控制侧载 Skill（不在商店中的）的处理策略                         |
| `syncIntervalSeconds`    | `number`             | `300`              | 后台定期同步 Manifest 的间隔（秒），`0` = 仅启动时同步           |
| `auditLog`               | `boolean`            | `true`             | 是否写入审计日志到 `{stateDir}/security/skill-guard/audit.jsonl` |

### 2.3 最小配置示例

```json
{
  "skills": {
    "guard": {
      "enabled": true,
      "trustedStores": [{ "url": "https://your-store.com/api/v1/skill-guard" }]
    }
  }
}
```

### 2.4 生产环境推荐配置

```json
{
  "skills": {
    "guard": {
      "enabled": true,
      "trustedStores": [
        {
          "name": "Production Store",
          "url": "https://skill-store.your-company.com/api/v1/skill-guard",
          "apiKey": "${SKILL_STORE_API_KEY}"
        }
      ],
      "sideloadPolicy": "block-critical",
      "syncIntervalSeconds": 60,
      "auditLog": true
    }
  }
}
```

---

## 3. 使用方式

### 3.1 对用户透明

Skill Guard 工作在 Skill 加载管线中，对终端用户**完全透明**：

- **被阻断的 Skill**：不出现在 Skills 页面、不出现在 Chat 对话、Agent 无法看到
- **通过校验的 Skill**：正常显示和使用，与无 Guard 时行为一致
- **侧载警告**：出现在审计日志中，不影响用户使用体验

### 3.2 管理员视角

管理员可以通过以下方式了解 Guard 运行状态：

#### Skills 页面

- 打开 Gateway Control UI → Skills 页面
- 只有通过 Guard 校验的 Skill 才会出现在列表中
- 被阻断的 Skill **完全不可见**（不是显示为 "blocked"，而是直接从列表移除）

#### 审计日志

```bash
# 查看所有安全事件
cat ~/.openclaw/security/skill-guard/audit.jsonl | python3 -m json.tool --no-ensure-ascii

# 查看被阻断的 Skill
cat ~/.openclaw/security/skill-guard/audit.jsonl | \
  python3 -c "import json,sys; [print(f\"{e['skill']:30s} {e['reason']}\") for l in sys.stdin for e in [json.loads(l)] if e.get('event')=='blocked']"

# 查看同步状态
grep '"config_sync' ~/.openclaw/security/skill-guard/audit.jsonl | tail -5
```

#### Gateway 日志

```bash
# 查看 Guard 注册状态
grep "skill load guard" /tmp/openclaw/*.log

# 预期：每次 Gateway 启动/重启都应看到 "skill load guard registered"
```

### 3.3 Disable/Enable Skill

在 Skills 页面点击 Disable/Enable 按钮会触发 Gateway 重启。**重启后 Guard 自动恢复**，被阻断的 Skill 不会因重启而泄漏。

---

## 4. 云端如何对接

### 4.1 API 规范

云端商店需要实现 **2 个 HTTP GET 接口**：

#### 接口 1: 获取 Manifest

```
GET {baseUrl}/manifest
```

**请求头**:

| 头                               | 说明                                  |
| -------------------------------- | ------------------------------------- |
| `Authorization: Bearer {apiKey}` | 可选，配置了 `apiKey` 时发送          |
| `If-None-Match: "{version}"`     | 可选，ETag 缓存，携带上次获取的版本号 |

**响应 200** (正常):

```http
HTTP/1.1 200 OK
Content-Type: application/json
ETag: "2026020801"
```

```json
{
  "store": {
    "name": "My Skill Store",
    "version": "2026020801"
  },
  "syncIntervalSeconds": 60,
  "blocklist": ["malicious-skill-a", "revoked-skill-b"],
  "skills": {
    "verified-tool": {
      "version": "1.2.0",
      "publisher": "official",
      "verified": true,
      "fileCount": 3,
      "files": {
        "SKILL.md": "a1b2c3d4e5f6...64位小写hex...",
        "scripts/run.py": "f6e5d4c3b2a1...64位小写hex...",
        "config/default.json": "1234abcd5678...64位小写hex..."
      }
    }
  }
}
```

**响应 304** (未修改):

```http
HTTP/1.1 304 Not Modified
```

当 `If-None-Match` 头的值与当前 `store.version` 匹配时返回。

#### 接口 2: 查询单个 Skill

```
GET {baseUrl}/skills/{skillName}
```

**响应 200**:

```json
{
  "name": "verified-tool",
  "version": "1.2.0",
  "fileCount": 3,
  "files": {
    "SKILL.md": "a1b2c3d4e5f6...",
    "scripts/run.py": "f6e5d4c3b2a1..."
  },
  "publisher": "official",
  "downloadUrl": "https://store.example.com/packages/verified-tool-1.2.0.tar.gz"
}
```

**响应 404**:

```json
{
  "error": "skill_not_found"
}
```

### 4.2 Manifest 字段详解

#### store 对象

| 字段      | 类型     | 必填 | 说明                                                             |
| --------- | -------- | ---- | ---------------------------------------------------------------- |
| `name`    | `string` | ✅   | 商店显示名称                                                     |
| `version` | `string` | ✅   | Manifest 版本号，**用作 ETag**。每次 Manifest 内容变化时必须更新 |

#### blocklist 数组

| 类型       | 说明                                                          |
| ---------- | ------------------------------------------------------------- |
| `string[]` | 需要紧急阻断的 Skill 名称列表。不论本地文件是否匹配，直接阻断 |

#### skills 对象

键为 Skill 名称（对应本地 `skills/{name}/` 目录名），值为 `ManifestSkill`：

| 字段        | 类型                     | 必填 | 说明                                       |
| ----------- | ------------------------ | ---- | ------------------------------------------ |
| `version`   | `string`                 | ✅   | Skill 版本号                               |
| `publisher` | `string`                 | —    | 发布者名称                                 |
| `verified`  | `boolean`                | —    | 是否经过人工审核                           |
| `fileCount` | `number`                 | ✅   | 文件总数（**快速校验路径**，不匹配即阻断） |
| `files`     | `Record<string, string>` | ✅   | 相对路径 → SHA256 hex（64 位小写）映射     |

### 4.3 SHA256 Hash 计算规则

```bash
# 计算单个文件的 SHA256
sha256sum path/to/file | cut -d' ' -f1

# Python 示例
import hashlib
with open("path/to/file", "rb") as f:
    print(hashlib.sha256(f.read()).hexdigest())
```

**关键规则**:

- Hash 值为 **64 位小写十六进制** 字符串
- 基于文件的 **原始字节内容**（不做换行符转换）
- 路径使用 **正斜杠 `/`**，相对于 Skill 根目录
- 遍历时 **跳过** `.` 开头的隐藏文件/目录和 `node_modules`

### 4.4 校验流程（6 步）

客户端收到 Manifest 后，对每个本地 Skill 执行以下校验：

```
Step 1: Blocklist 检查
  └─ Skill 名称在 blocklist 中 → 阻断

Step 2: 商店存在性检查
  └─ Skill 不在 manifest.skills 中 → 视为侧载，走本地扫描

Step 3: 文件数量快速校验
  └─ 本地文件数 ≠ manifest.fileCount → 阻断

Step 4: 额外文件检测（注入防护）
  └─ 本地存在 manifest 中未声明的文件 → 阻断

Step 5: 缺失文件检测
  └─ manifest 声明的文件本地不存在 → 阻断

Step 6: 逐文件 SHA256 校验
  └─ 任何文件 hash 不匹配 → 阻断
```

### 4.5 云端实现参考

以下是一个最小化的 Python 参考实现：

```python
from http.server import HTTPServer, BaseHTTPRequestHandler
import json, hashlib, os, re

MANIFEST = {
    "store": {"name": "My Store", "version": "v1"},
    "syncIntervalSeconds": 60,
    "blocklist": [],
    "skills": {}
}

def compute_skill_manifest(skill_dir):
    """为一个 Skill 目录计算 manifest 条目"""
    files = {}
    for root, dirs, filenames in os.walk(skill_dir):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
        for f in filenames:
            if f.startswith('.'): continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, skill_dir).replace('\\', '/')
            with open(full, 'rb') as fh:
                files[rel] = hashlib.sha256(fh.read()).hexdigest()
    return {
        "version": "1.0.0",
        "publisher": "my-org",
        "verified": True,
        "fileCount": len(files),
        "files": files
    }

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.endswith('/manifest'):
            etag = f'"{MANIFEST["store"]["version"]}"'
            if self.headers.get('If-None-Match') == etag:
                self.send_response(304)
                self.end_headers()
                return
            body = json.dumps(MANIFEST).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('ETag', etag)
            self.end_headers()
            self.wfile.write(body)

        elif '/skills/' in self.path:
            name = self.path.split('/skills/')[-1].strip('/')
            skill = MANIFEST["skills"].get(name)
            if not skill:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "skill_not_found"}).encode())
                return
            body = json.dumps({"name": name, **skill}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body)

HTTPServer(('0.0.0.0', 9876), Handler).serve_forever()
```

---

## 5. 新仓库/分支如何接入

### 5.1 代码侧接入（3 步）

#### Step 1: 确认扩展存在

确保你的仓库包含 `extensions/skill-guard/` 目录，包含以下文件：

```
extensions/skill-guard/
├── index.ts              # 扩展入口
├── package.json          # 扩展元数据
└── src/
    ├── audit-logger.ts   # 审计日志
    ├── cloud-client.ts   # 云端通信
    ├── hash-cache.ts     # Manifest 缓存
    ├── types.ts          # 类型定义
    └── verify-engine.ts  # 校验引擎
```

#### Step 2: 确认核心集成点

确保 `src/agents/skills/workspace.ts` 中包含 Guard 调用（位于 `loadSkillEntries()` 函数的 merged Map 构建之后）：

```typescript
// --- Skill Guard: evaluate loaded skills before building entries ---
const guard = getSkillLoadGuard();
if (guard) {
  const verdict = guard.evaluate(merged);
  for (const name of verdict.blocked) {
    skillsLogger.warn(`skill blocked by guard: ${name}`);
    merged.delete(name);
  }
  if (verdict.warnings) {
    for (const w of verdict.warnings) {
      skillsLogger.info(`skill guard warning [${w.name}]: ${w.message}`);
    }
  }
}
```

确保 `src/agents/skills/load-guard.ts` 使用 `globalThis` 共享 guard 引用：

```typescript
const GUARD_KEY = "__openclaw_skill_load_guard__" as const;
```

#### Step 3: 启用配置

在配置文件中添加：

```json
{
  "plugins": {
    "entries": {
      "skill-guard": { "enabled": true }
    }
  },
  "skills": {
    "guard": {
      "enabled": true,
      "trustedStores": [{ "url": "https://your-store.com/api/v1/skill-guard" }]
    }
  }
}
```

### 5.2 云端侧接入

#### Step 1: 实现 Manifest API

按照 [第 4 节](#4-云端如何对接) 实现 2 个 HTTP GET 接口。

#### Step 2: 构建 Skill 目录

为每个 Skill 计算 SHA256 hash 并生成 Manifest：

```bash
# 为单个 Skill 生成 manifest 条目
python3 -c "
import hashlib, os, json
skill_dir = 'path/to/your-skill'
files = {}
for root, dirs, fnames in os.walk(skill_dir):
    dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
    for f in fnames:
        if f.startswith('.'): continue
        full = os.path.join(root, f)
        rel = os.path.relpath(full, skill_dir).replace(os.sep, '/')
        with open(full, 'rb') as fh:
            files[rel] = hashlib.sha256(fh.read()).hexdigest()
print(json.dumps({
    'version': '1.0.0',
    'publisher': 'your-org',
    'verified': True,
    'fileCount': len(files),
    'files': files
}, indent=2))
"
```

#### Step 3: 设置 Blocklist

在 Manifest 的 `blocklist` 数组中添加需要紧急阻断的 Skill 名称：

```json
{
  "blocklist": ["compromised-skill", "deprecated-risky-tool"]
}
```

#### Step 4: 实现版本管理

每次 Manifest 内容变化时更新 `store.version`，支持 ETag/304 缓存。推荐使用时间戳或自增版本号：

```json
{
  "store": {
    "name": "My Store",
    "version": "2026020801"
  }
}
```

### 5.3 验证接入是否成功

```bash
# 1. 检查 Gateway 日志中 Guard 注册
grep "skill load guard registered" /tmp/openclaw/*.log

# 2. 检查审计日志中的同步事件
grep "config_sync" ~/.openclaw/security/skill-guard/audit.jsonl

# 3. 检查 Manifest 缓存
cat ~/.openclaw/security/skill-guard/manifest-cache.json | python3 -m json.tool

# 4. 通过 API 确认 Skill 状态
# 连接 WebSocket 调用 skills.status，确认被阻断的 Skill 不在返回列表中
```

---

## 6. 静态代码扫描规则

对于不在商店中的侧载 Skill，Guard 使用以下 8 条规则进行静态扫描：

### Critical 级（默认阻断）

| 规则 ID                  | 检测内容       | 匹配模式                                                       |
| ------------------------ | -------------- | -------------------------------------------------------------- |
| `dangerous-exec`         | Shell 命令执行 | `exec()`, `execSync()`, `spawn()`, `spawnSync()`, `execFile()` |
| `dynamic-code-execution` | 动态代码执行   | `eval()`, `new Function()`                                     |
| `crypto-mining`          | 加密货币挖矿   | `stratum+tcp`, `coinhive`, `cryptonight`, `xmrig`              |
| `env-harvesting`         | 环境变量窃取   | `process.env` 访问 + 网络发送组合                              |

### Warn 级（默认告警放行）

| 规则 ID                    | 检测内容             | 匹配模式                                    |
| -------------------------- | -------------------- | ------------------------------------------- |
| `suspicious-network`       | 非标准端口 WebSocket | `new WebSocket('wss://host:port')`          |
| `potential-exfiltration`   | 文件读取+网络发送    | `readFileSync` + `fetch`/`http` 组合        |
| `obfuscated-code` (hex)    | 十六进制混淆         | 连续 6+ 个 `\xNN` 序列                      |
| `obfuscated-code` (base64) | Base64 混淆          | `atob()`/`Buffer.from()` + 200+ 字符 base64 |

### 策略对照

| 发现级别 | `warn` 策略 | `block-critical` 策略 | `block-all` 策略 |
| -------- | ----------- | --------------------- | ---------------- |
| critical | ⚠️ 告警放行 | ❌ 阻断               | ❌ 阻断          |
| warn     | ✅ 放行     | ✅ 放行               | ❌ 阻断          |
| 无发现   | ✅ 放行     | ✅ 放行               | ✅ 放行          |

---

## 7. 审计日志

### 7.1 文件位置

```
{stateDir}/security/skill-guard/audit.jsonl
```

默认路径：`~/.openclaw/security/skill-guard/audit.jsonl`

### 7.2 事件类型

| 事件                 | 说明                       | 关键字段           |
| -------------------- | -------------------------- | ------------------ |
| `config_sync`        | Manifest 同步成功          | `detail`: 版本号   |
| `config_sync_failed` | Manifest 同步失败          | `detail`: 错误信息 |
| `cache_fallback`     | 使用缓存 Manifest          | —                  |
| `verification_off`   | 无 Manifest 可用，跳过校验 | `detail`: 原因     |
| `load_pass`          | 商店 Skill 校验通过        | `skill`, `source`  |
| `blocked`            | Skill 被阻断               | `skill`, `reason`  |
| `not_in_store`       | Skill 不在商店中（标记）   | `skill`            |
| `sideload_pass`      | 侧载 Skill 扫描通过        | `skill`            |
| `sideload_warn`      | 侧载 Skill 有警告但放行    | `skill`, `reason`  |

### 7.3 日志记录格式

```json
{"ts":"2026-02-08T10:30:00.000Z","event":"config_sync","detail":"version=2026020801"}
{"ts":"2026-02-08T10:30:00.001Z","event":"load_pass","skill":"my-tool","source":"store"}
{"ts":"2026-02-08T10:30:00.002Z","event":"blocked","skill":"bad-skill","reason":"blocklisted"}
{"ts":"2026-02-08T10:30:00.003Z","event":"blocked","skill":"tampered","reason":"hash mismatch: SKILL.md"}
{"ts":"2026-02-08T10:30:00.004Z","event":"not_in_store","skill":"custom-tool"}
{"ts":"2026-02-08T10:30:00.005Z","event":"sideload_pass","skill":"custom-tool"}
```

---

## 8. 降级与容错

### 8.1 降级决策树

```
Guard 启用?
├─ 否 (enabled=false) → 所有 Skill 直接加载
└─ 是
   ├─ trustedStores 为空 → 所有 Skill 视为侧载，走本地扫描
   └─ 有 trustedStores
      ├─ 云端同步成功 → 正常校验模式
      ├─ 云端同步失败 + 有磁盘缓存 → 使用缓存（审计记录 cache_fallback）
      └─ 云端同步失败 + 无缓存 → verification_off（全部放行，审计记录）
```

### 8.2 设计保证

- **永不阻塞启动**: 网络/商店故障不会阻止 Gateway 启动
- **永不崩溃**: 所有 I/O 操作都有错误捕获，最坏情况降级放行
- **重启安全**: SIGUSR1 重启后 Guard 在 `service.start()` 中自动恢复
- **请求超时**: 云端请求 15 秒超时，防止无限等待

---

## 9. FAQ

### Q: 如果我的商店暂时下线，会发生什么？

**A**: Guard 会使用上一次成功同步的缓存 Manifest 继续工作。如果没有缓存，会降级为全部放行（审计日志记录 `verification_off`）。

### Q: 如何紧急阻断一个有问题的 Skill？

**A**: 在商店的 Manifest `blocklist` 中添加该 Skill 名称，更新 `store.version`。客户端下次同步时（默认 ≤5 分钟）会自动阻断。

### Q: 侧载 Skill 需要在商店注册吗？

**A**: 不需要。不在商店中的 Skill 自动视为侧载，走本地静态扫描流程。

### Q: 如何允许一个被扫描器标记的侧载 Skill？

**A**: 将 `sideloadPolicy` 设为 `"warn"`，或将该 Skill 纳入商店管理（提供正确的 SHA256 hash）。

### Q: 多个商店的优先级是什么？

**A**: `trustedStores` 数组按顺序尝试，第一个成功返回的商店的 Manifest 生效。

### Q: 如何完全禁用 Guard 进行调试？

**A**: 设置 `skills.guard.enabled: false`，重启 Gateway。

### Q: Skill 文件更新后需要做什么？

**A**: 云端需要重新计算更新文件的 SHA256 hash，更新 Manifest 中的 `files` 和 `fileCount`，并更新 `store.version`。

---

## 10. Skill Store CLI（内置 skill-store）

### 10.1 概述

OpenClaw 内置了 `skill-store` BUILT-IN Skill，提供从可信商店 **搜索、安装、更新、卸载** Skill 的完整能力。它是 `clawhub` 的安全替代方案：

| 对比项    | clawhub                 | skill-store                            |
| --------- | ----------------------- | -------------------------------------- |
| 来源验证  | 无                      | SHA256 逐文件校验                      |
| Blocklist | 无                      | 安装前检查商店 blocklist               |
| 依赖      | 需要 `npm i -g clawhub` | Python 3（系统自带）                   |
| 搜索      | 远程 API (clawhub.com)  | 本地 manifest 缓存（离线可用）         |
| 配置      | 独立 registry           | 复用 `skills.guard.trustedStores` 配置 |

### 10.2 文件结构

```
skills/skill-store/
├── SKILL.md          # Agent 指令文档（frontmatter + 命令说明）
└── store-cli.py      # Python CLI 工具（≈600 行，零外部依赖）
```

该 Skill 位于仓库 `skills/` 目录中，以 `openclaw-bundled` 身份加载，Agent 通过 `exec` 工具调用 `store-cli.py`。

### 10.3 命令参考

| 命令               | 说明                                           | 示例                                              |
| ------------------ | ---------------------------------------------- | ------------------------------------------------- |
| `search <keyword>` | 在本地 manifest 缓存中按名称模糊搜索           | `python3 <DIR>/store-cli.py search architecture`  |
| `list`             | 列出商店全部可用 skill                         | `python3 <DIR>/store-cli.py list`                 |
| `list --installed` | 列出已安装 skill 及版本对比                    | `python3 <DIR>/store-cli.py list --installed`     |
| `install <name>`   | 下载 + SHA256 验证 + 安装到 managed 目录       | `python3 <DIR>/store-cli.py install architecture` |
| `info <name>`      | 显示 skill 详细信息（版本/publisher/文件哈希） | `python3 <DIR>/store-cli.py info architecture`    |
| `update <name>`    | 更新指定 skill 到最新版本                      | `python3 <DIR>/store-cli.py update architecture`  |
| `update --all`     | 更新所有已安装 skill                           | `python3 <DIR>/store-cli.py update --all`         |
| `remove <name>`    | 卸载 skill                                     | `python3 <DIR>/store-cli.py remove architecture`  |

### 10.4 安装流程（安全验证链）

```
store-cli.py install <name>
  │
  ├─ 1. 检查 blocklist → 在名单中则拒绝安装
  ├─ 2. 从商店下载 .tar.gz
  ├─ 3. 解压到临时目录
  ├─ 4. 路径安全检查（防 path traversal）
  ├─ 5. SHA256 逐文件校验（对比 manifest 哈希）
  ├─ 6. 文件数量校验（对比 manifest fileCount）
  ├─ 7. 检查 SKILL.md frontmatter（OpenClaw loader 需要 description 字段）
  │     └─ 若缺少 → 从 config.json 提取元数据注入 frontmatter
  │        └─ 使用 store.* 前缀目录名避免 Guard hash re-check 冲突
  └─ 8. 写入 ~/.openclaw-dev/skills/（managed 目录）
```

### 10.5 配置发现

`store-cli.py` 自动从 `openclaw.json` 读取商店 URL：

```python
config["skills"]["guard"]["trustedStores"][0]["url"]
```

无需额外配置。只要 Skill Guard 已配置商店地址，`skill-store` 即可使用。

### 10.6 禁用 clawhub（推荐）

配置 `skill-store` 后，建议在 `openclaw.json` 中禁用 clawhub，避免 Agent 混淆：

```json
{
  "skills": {
    "entries": {
      "clawhub": { "enabled": false }
    }
  }
}
```

---

## 修订记录

| 版本 | 日期       | 变更内容                                              |
| ---- | ---------- | ----------------------------------------------------- |
| v1.0 | 2026-02-07 | 初始版本                                              |
| v1.1 | 2026-02-08 | 新增第 10 节：Skill Store CLI（内置 skill-store）说明 |
