# Skill Guard 最终落地方案

> **版本**: v4.0 (Production-Ready, Android Model)  
> **基线**: v2026.2.6 · `feature/skill-guard-enhancement`  
> **日期**: 2026-02-07  
> **定位**: 开发者可直接编码的落地文档，每一行改动对应真实源码路径

---

## 0. 商业模型：Android 式 Skill 商店

```
              ┌─────────────────────────────┐
              │  OpenClaw Skill Store (云端)  │
              │                              │
              │  开发者提交 → 自动扫描        │
              │  → 人工审核 → SHA256 入库     │
              │  → 发布到 Manifest            │
              └──────────────┬───────────────┘
                             │ HTTPS (ETag/304)
              ┌──────────────▼───────────────┐
              │  OpenClaw 客户端              │
              │                               │
              │  ┌───────────────────────┐    │
              │  │  商店 Skill            │    │
              │  │  → Manifest SHA256 校验│    │
              │  │  → hash 匹配才加载    │    │
              │  └───────────────────────┘    │
              │                               │
              │  ┌───────────────────────┐    │
              │  │  侧载 Skill (自装)     │    │
              │  │  → 本地行为扫描        │    │
              │  │  → critical → 阻断     │    │
              │  │  → warn → 警告放行     │    │
              │  └───────────────────────┘    │
              └───────────────────────────────┘
```

**核心逻辑（对标 Android）**:

- 默认从**可信商店**安装，商店 Skill 经过审核 + SHA256 逐文件校验
- 用户**可以侧载**自己的 Skill（类似 Android "允许安装未知来源"），侧载 Skill 走本地行为扫描
- 侧载扫描发现 critical 级问题默认**阻断**，warn 级**告警放行**
- 商店可随时通过 blocklist **紧急下架**有问题的 Skill

---

## 1. 配置设计

### 1.1 类型定义扩展

**文件**: `src/config/types.skills.ts`

当前源码（v2026.2.6 实际内容）:

```typescript
// 第 25-31 行
export type SkillsConfig = {
  allowBundled?: string[];
  load?: SkillsLoadConfig;
  install?: SkillsInstallConfig;
  entries?: Record<string, SkillConfig>;
};
```

**新增类型 + 扩展 SkillsConfig**:

```typescript
// ── 新增类型 ──

export type SkillStoreConfig = {
  /** 商店名称（日志/UI 显示用） */
  name?: string;
  /** 商店 Manifest API 基础 URL */
  url: string;
  /** 可选 API Key（支持 ${ENV_VAR} 引用） */
  apiKey?: string;
};

export type SkillGuardSideloadPolicy = "warn" | "block-critical" | "block-all";

export type SkillGuardConfig = {
  /** 总开关，默认 true */
  enabled?: boolean;
  /** 可信商店地址列表，按顺序查询 */
  trustedStores?: SkillStoreConfig[];
  /** 侧载 Skill 的扫描策略，默认 "block-critical" */
  sideloadPolicy?: SkillGuardSideloadPolicy;
  /** Manifest 同步间隔（秒），默认 300 */
  syncIntervalSeconds?: number;
  /** 审计日志开关，默认 true */
  auditLog?: boolean;
};

// ── 扩展 SkillsConfig ──

export type SkillsConfig = {
  allowBundled?: string[];
  load?: SkillsLoadConfig;
  install?: SkillsInstallConfig;
  entries?: Record<string, SkillConfig>;
  /** Skill 商店守卫配置 */
  guard?: SkillGuardConfig;
};
```

### 1.2 用户配置（openclaw.json）

```json5
{
  skills: {
    guard: {
      enabled: true,
      trustedStores: [
        {
          name: "OpenClaw Official Store",
          url: "https://store-api.openclaw.com/api/v1/skill-guard",
          apiKey: "${OPENCLAW_STORE_API_KEY}",
        },
      ],
      sideloadPolicy: "block-critical",
      syncIntervalSeconds: 300,
      auditLog: true,
    },
  },
}
```

**字段说明**:

| 字段                  | 默认值             | 说明                                |
| --------------------- | ------------------ | ----------------------------------- |
| `enabled`             | `true`             | 总开关，false 关闭所有校验          |
| `trustedStores`       | `[]`               | 可信商店列表，空 = 仅做本地侧载扫描 |
| `sideloadPolicy`      | `"block-critical"` | 侧载扫描发现 critical 时阻断        |
| `syncIntervalSeconds` | `300`              | 5分钟同步一次 Manifest              |
| `auditLog`            | `true`             | 记录审计日志到 JSONL                |

### 1.3 配置路径选择理由

配置放在 `skills.guard` 而非 `plugins.entries.skill-guard`:

- `skills.guard` = 内置安全能力，产品级卖点
- 用户心智："配 Skill 顺便配安全"
- CLI 友好：`openclaw config set skills.guard.enabled true`
- 零破坏：optional 字段不影响任何现有配置

---

## 2. 核心代码变更（3个文件，共 78 行）

### 2.1 新文件：`src/agents/skills/load-guard.ts`（35行）

```typescript
/**
 * Skill 加载守卫注册点。
 * skill-guard Extension 调用 registerSkillLoadGuard() 注入校验，
 * 核心代码在 loadSkillEntries() 中调用 guard.evaluate()。
 */
import type { Skill } from "@mariozechner/pi-coding-agent";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("skills/guard");

export type SkillLoadGuardVerdict = {
  /** 应阻断的 skill name 列表 */
  blocked: string[];
  /** 警告但不阻断 */
  warnings?: Array<{ name: string; message: string }>;
};

export type SkillLoadGuard = {
  /** 同步评估一批 skill，返回裁决 */
  evaluate(skills: Map<string, Skill>): SkillLoadGuardVerdict;
};

let _guard: SkillLoadGuard | null = null;

/** Extension 调用注册守卫，返回取消函数 */
export function registerSkillLoadGuard(guard: SkillLoadGuard): () => void {
  _guard = guard;
  log.info("skill load guard registered");
  return () => {
    _guard = null;
    log.info("skill load guard unregistered");
  };
}

/** 核心代码调用获取守卫实例 */
export function getSkillLoadGuard(): SkillLoadGuard | null {
  return _guard;
}
```

### 2.2 修改：`src/agents/skills/workspace.ts`（+1行 import, +12行逻辑）

**精确插入位置**: 第 171 行（`merged.set(skill.name, skill)` 最后一个循环结束）之后、第 173 行（`const skillEntries: SkillEntry[]` 开始）之前。

源码上下文确认:

```
158|  const merged = new Map<string, Skill>();
159|  // Precedence: extra < bundled < managed < workspace
160|  for (const skill of extraSkills) { merged.set(skill.name, skill); }
...
169|  for (const skill of workspaceSkills) {
170|    merged.set(skill.name, skill);
171|  }
172|                                        ← ★ 在此插入
173|  const skillEntries: SkillEntry[] = Array.from(merged.values()).map(...)
```

**插入内容**:

```typescript
// ── 文件顶部新增 import ──
import { getSkillLoadGuard } from "./load-guard.js";

// ── 第 171 行之后插入 ──
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

### 2.3 修改：`src/config/types.skills.ts`（+30行类型定义）

如 1.1 节所述。

---

## 3. Extension 文件结构

```
extensions/skill-guard/
├── package.json               # { "name": "@openclaw/skill-guard", "dependencies": {} }
├── openclaw.plugin.json       # { "id": "skill-guard" }
└── src/
    ├── index.ts               # 入口：读取 skills.guard，注册守卫 + 后台同步
    ├── types.ts               # Manifest 响应类型定义
    ├── cloud-client.ts        # 云端 API 客户端（对接 trustedStores[]）
    ├── hash-cache.ts          # 内存 + 磁盘缓存（manifest-cache.json）
    ├── verify-engine.ts       # 全目录 SHA256 校验 + 侧载行为扫描
    └── audit-logger.ts        # JSONL 审计日志
```

**预计**: 7 个文件，~900 行，零外部依赖（仅 Node.js 内置 `crypto`/`fs`/`path`）

---

## 4. 云端 Skill Store API

### 4.1 三个 GET 接口

| #   | 路径                                            | 用途                      |
| --- | ----------------------------------------------- | ------------------------- |
| 1   | `GET /api/v1/skill-guard/manifest`              | 全量同步配置 + hash 清单  |
| 2   | `GET /api/v1/skill-guard/skills/:name`          | 单 Skill 查询（增量补充） |
| 3   | `GET /api/v1/skill-guard/skills/:name/download` | 下载 Skill tar.gz 包      |

### 4.2 Manifest 响应

```json
{
  "store": {
    "name": "OpenClaw Official Store",
    "version": "2026020701"
  },
  "syncIntervalSeconds": 300,
  "blocklist": ["malicious-skill-a", "crypto-miner-disguised"],
  "skills": {
    "web-search": {
      "version": "1.2.0",
      "publisher": "openclaw",
      "verified": true,
      "fileCount": 3,
      "files": {
        "SKILL.md": "a1b2c3d4e5f6...64 chars sha256 hex",
        "scripts/search.py": "b2c3d4e5f6a1...64 chars",
        "config.json": "c3d4e5f6a1b2...64 chars"
      }
    }
  }
}
```

**要点**:

- `files` 中路径用 `/` 分隔（跨平台统一）
- SHA256 小写 hex 64 字符
- 支持 `If-None-Match` / ETag → 304 Not Modified
- 100 Skill × 5 文件 ≈ 75KB，gzip 后 ≈ 11KB

---

## 5. 校验逻辑

### 5.1 每个 Skill 的判定流程

```
对每个 Skill:
  │
  ├─ 在 blocklist 中?
  │   └─ 是 → 阻断，记录日志
  │
  ├─ 在 manifest.skills 中?
  │   └─ 是 → 商店 Skill，执行全目录校验:
  │       ├─ 步骤 1: fileCount 快速路径 (数量不匹配 → 阻断)
  │       ├─ 步骤 2: 多余文件检测 (发现注入 → 阻断)
  │       ├─ 步骤 3: 缺失文件检测 (文件被删 → 阻断)
  │       └─ 步骤 4: 逐文件 SHA256 比对 (篡改 → 阻断)
  │
  └─ 不在 manifest 中?
      └─ 侧载 Skill → 调用 skill-scanner.ts 本地扫描
          ├─ critical 发现 + sideloadPolicy≠"warn" → 阻断
          ├─ critical 发现 + sideloadPolicy="warn" → 警告放行
          └─ 无 critical → 放行
```

### 5.2 侧载扫描复用现有 skill-scanner.ts

当前 `src/security/skill-scanner.ts`（v2026.2.6 实际规则）:

| 类型         | 规则数  | 规则ID                                                                            |
| ------------ | ------- | --------------------------------------------------------------------------------- |
| LINE_RULES   | 4条     | `dangerous-exec`, `dynamic-code-execution`, `crypto-mining`, `suspicious-network` |
| SOURCE_RULES | 4条     | `potential-exfiltration`, `obfuscated-code`×2, `env-harvesting`                   |
| **合计**     | **8条** | 覆盖命令注入/代码注入/挖矿/数据窃取/混淆/环境变量窃取                             |

Extension 中直接 `import { scanDirectoryWithSummary } from "openclaw/security/skill-scanner"` 复用。

### 5.3 降级策略

```
客户端启动
  │
  ├─ skills.guard.enabled = false → 跳过校验
  │
  ├─ trustedStores 为空 → 仅做侧载扫描（所有 Skill 视为侧载）
  │
  └─ 尝试连接 trustedStores:
      ├─ 成功 → 拉取 manifest → 缓存 → 正常模式
      └─ 全部失败 →
          ├─ 有磁盘缓存 → 用缓存（记录 cache_fallback）
          └─ 无缓存 → 所有 Skill 视为侧载，走本地扫描

★ 保证: 任何情况下进程都能启动。不会因网络/商店问题导致启动失败。
```

---

## 6. 审计日志

JSONL 追加写入 `~/.openclaw/security/skill-guard/audit.jsonl`:

```jsonl
{"ts":"2026-02-07T12:00:00Z","event":"config_sync","detail":"version=2026020701"}
{"ts":"2026-02-07T12:00:00Z","event":"load_pass","skill":"web-search","source":"store"}
{"ts":"2026-02-07T12:00:00Z","event":"load_pass","skill":"my-tool","source":"sideload"}
{"ts":"2026-02-07T12:00:00Z","event":"blocked","skill":"crypto-miner","reason":"blocklisted"}
{"ts":"2026-02-07T12:00:01Z","event":"blocked","skill":"shady-skill","reason":"hash mismatch: scripts/run.py"}
{"ts":"2026-02-07T12:00:01Z","event":"blocked","skill":"injector","reason":"unexpected file: payload.js"}
{"ts":"2026-02-07T12:00:01Z","event":"sideload_warn","skill":"dev-tool","reason":"dangerous-exec detected"}
```

---

## 7. 开发计划

### Phase 1: 商店守卫（5天）

| 天  | 任务                                                      | 改核心        |
| --- | --------------------------------------------------------- | ------------- |
| D1  | `types.skills.ts` + `load-guard.ts` + `workspace.ts` 补丁 | ✅ 3文件/78行 |
| D2  | `cloud-client.ts` + `types.ts`                            | ❌ Extension  |
| D3  | `hash-cache.ts` + `audit-logger.ts`                       | ❌ Extension  |
| D4  | `verify-engine.ts`（SHA256 + 侧载扫描）                   | ❌ Extension  |
| D5  | `index.ts` + 集成测试                                     | ❌ Extension  |

### Phase 2-4（后续迭代）

| Phase | 内容                                              | 时间  |
| ----- | ------------------------------------------------- | ----- |
| 2     | 增强扫描规则(+5条) + SKILL.md 注入检测 + 安装阻断 | 2周   |
| 3     | Ed25519 签名验证 + manifest 防篡改 + 依赖审计     | 2周   |
| 4     | 运行时资源限制 + 许可证 + Marketplace 分成        | 4-7周 |

---

## 8. 商业化

| 版本             | 内容                                     | 价格        |
| ---------------- | ---------------------------------------- | ----------- |
| **Community**    | Phase 1 + Phase 2（商店校验 + 增强扫描） | **免费**    |
| **Professional** | + 签名验证 + 审计导出 + 规则库优先更新   | **$49/月**  |
| **Enterprise**   | + 运行时保护 + 私有商店 + SIEM + 多租户  | **$299/月** |

收入 = SaaS 订阅 + Marketplace 分成（开发者 70% / 平台 30%）

---

## 9. 收敛性审计报告

### 9.1 源码 vs 设计文档

| 检查项                          | 源码实际值                                  | 设计文档引用               | 收敛      |
| ------------------------------- | ------------------------------------------- | -------------------------- | --------- |
| `SkillsConfig` 结构             | `{ allowBundled, load, install, entries }`  | 新增 `guard` optional 字段 | ✅ 零破坏 |
| `loadSkillEntries()` 位置       | `workspace.ts:99`                           | 正确引用                   | ✅        |
| Map 合并结束位置                | `workspace.ts:171`                          | 插入点 171-173 之间        | ✅        |
| `loadSkillEntries()` 同步性     | 同步函数，用 `readFileSync`                 | SHA256 用 `readFileSync`   | ✅ 匹配   |
| LINE_RULES 数量                 | **4 条**                                    | 文档已修正为 4 条          | ✅        |
| SOURCE_RULES 数量               | **4 条**                                    | 文档已修正为 4 条          | ✅        |
| Plugin 注册接口                 | `src/plugins/types.ts` 有 `registerService` | Extension 使用此接口       | ✅        |
| SSRF 防护                       | `fetchWithSsrFGuard` 已存在                 | cloud-client 复用          | ✅        |
| `scanDirectoryWithSummary` 导出 | `skill-scanner.ts` 已 export                | 侧载扫描复用               | ✅        |
| Skill.baseDir 属性              | Skill 类型有 `baseDir`                      | SHA256 校验使用            | ✅        |

### 9.2 需求 vs 设计文档

| 原始需求               | 设计对应                               | 收敛 |
| ---------------------- | -------------------------------------- | ---- |
| 云端 Skill 商店        | `trustedStores` 配置 + Manifest API    | ✅   |
| 商店审核 Skill 安全性  | 提交→自动扫描→人工审核→SHA256入库      | ✅   |
| 端侧从商店下载         | cloud-client + Manifest SHA256 校验    | ✅   |
| 类 Android 模式        | 默认商店 + 允许侧载                    | ✅   |
| 用户可自行安装         | 侧载 Skill 走本地 skill-scanner 扫描   | ✅   |
| 配置文件含可信商店地址 | `skills.guard.trustedStores[]`         | ✅   |
| 支持多个商店           | 数组类型，按顺序查询                   | ✅   |
| Demo 写一个            | 默认配置示例含 1 个官方商店            | ✅   |
| 合并到 OpenClaw 配置   | 扩展 `SkillsConfig.guard`              | ✅   |
| 商业化可落地           | Community/Professional/Enterprise 三层 | ✅   |

### 9.3 research.md vs 最终方案

| research.md 设计点     | 最终方案采纳                 | 状态 |
| ---------------------- | ---------------------------- | ---- |
| Extension 即插即用架构 | ✅ 完整采用                  | 收敛 |
| 核心仅 1 处改动        | ✅ 3 文件/78 行              | 收敛 |
| 云端 3 个 GET 接口     | ✅ 完整采用                  | 收敛 |
| SHA256 全目录 6 步校验 | ✅ 简化为 4 步（合并了逻辑） | 收敛 |
| fileCount 快速路径     | ✅ 保留                      | 收敛 |
| Blocklist 紧急阻断     | ✅ 保留                      | 收敛 |
| JSONL 审计日志         | ✅ 保留                      | 收敛 |
| 降级决策树             | ✅ 简化保留                  | 收敛 |
| ETag 304 优化          | ✅ 保留                      | 收敛 |
| 5 天工时               | ✅ 保留                      | 收敛 |

**结论: 3 方（源码/需求/设计）完全收敛，零遗留冲突。**

---

## 10. 内置 Skill Store CLI

### 10.1 定位

Skill Guard 框架提供了"被动防御"（校验、阻断），而 `skill-store` BUILT-IN Skill 则提供了"主动管理"（搜索、安装、更新、卸载）。两者共同构成完整的 Skill 安全管控闭环：

```
┌─────────────────────────────────────────────────┐
│              完整 Skill 安全管控                   │
│                                                  │
│  ┌──────────────────┐   ┌─────────────────────┐ │
│  │ Skill Guard      │   │ skill-store CLI     │ │
│  │ (被动防御)        │   │ (主动管理)          │ │
│  │                  │   │                     │ │
│  │ • SHA256 校验    │   │ • 搜索商店目录      │ │
│  │ • Blocklist 阻断 │   │ • 安装 + SHA256 验证│ │
│  │ • 侧载扫描      │   │ • 更新 + 版本对比   │ │
│  │ • 审计日志      │   │ • 卸载              │ │
│  └──────────────────┘   └─────────────────────┘ │
│                                                  │
│  共享配置: skills.guard.trustedStores             │
│  共享数据: manifest-cache.json                    │
└─────────────────────────────────────────────────┘
```

### 10.2 文件结构

```
skills/skill-store/                ← 仓库 skills/ 目录，openclaw-bundled
├── SKILL.md                       ← Agent 指令文档（frontmatter + 命令说明）
└── store-cli.py                   ← Python 3 CLI（~600 行，零外部依赖）
```

### 10.3 与 clawhub 的替代关系

`skill-store` 在 SKILL.md frontmatter 中通过 description 声明为"PRIMARY and PREFERRED tool"，Agent 会优先选择它而非 clawhub。建议在配置中显式禁用 clawhub：

```json
{ "skills": { "entries": { "clawhub": { "enabled": false } } } }
```

### 10.4 安装验证链

```
store-cli.py install <name>
  1. Blocklist 检查
  2. 下载 .tar.gz（支持 Authorization header）
  3. path traversal 防护
  4. SHA256 逐文件校验
  5. fileCount 数量校验
  6. Frontmatter 兼容注入（store.* 前缀）
  7. 写入 managed 目录
```

---

## 11. 验收标准

| #   | 测试场景                                         | 预期结果                              |
| --- | ------------------------------------------------ | ------------------------------------- |
| 1   | `guard.enabled=false`                            | 全部正常加载                          |
| 2   | 商店 Skill，hash 匹配                            | 加载通过                              |
| 3   | 商店 Skill，文件被篡改                           | 阻断                                  |
| 4   | 商店 Skill，被注入文件                           | 阻断                                  |
| 5   | blocklist 中的 Skill                             | 阻断                                  |
| 6   | 侧载 Skill，无 critical                          | 放行                                  |
| 7   | 侧载 Skill，有 critical + policy=block-critical  | 阻断                                  |
| 8   | 侧载 Skill，有 critical + policy=warn            | 警告放行                              |
| 9   | 云端不可达 + 有缓存                              | 用缓存                                |
| 10  | 云端不可达 + 无缓存                              | 降级为侧载扫描                        |
| 11  | 100 个 Skill 全量校验                            | < 500ms                               |
| 12  | Skills 页面 Disable/Enable 后 Guard 持续有效     | 恶意 skill 始终被阻断                 |
| 13  | Gateway SIGUSR1 重启后 Guard 自动恢复            | 重启后 guard 重新注册，阻断能力不中断 |
| 14  | skill-store 在 BUILT-IN SKILLS 中可见且 eligible | skill-store 正常加载                  |
| 15  | store-cli.py search 返回匹配结果                 | 离线搜索 manifest 缓存                |
| 16  | store-cli.py install + SHA256 验证通过           | skill 安装到 managed 目录             |
| 17  | store-cli.py install blocklist skill 被拒绝      | 输出 blocklist 错误                   |
| 18  | store-cli.py remove 卸载成功                     | managed 目录中 skill 已删除           |
