# Skill Guard 经验教训文档

> **版本**: v1.0  
> **日期**: 2026-02-07  
> **状态**: 生产环境已修复  
> **适用团队**: 全团队（开发、测试、安全审计）

---

## 目的

本文档记录 Skill Guard 开发过程中遇到的关键 Bug 和设计缺陷，
提炼为可复用的经验教训，供团队在后续开发中参考，避免灾难性遗忘。

---

## 1. Bug 清单

### BUG-4: 模块实例隔离导致 Guard 注册失效

| 属性         | 值                                                                             |
| ------------ | ------------------------------------------------------------------------------ |
| **严重程度** | P0/Critical                                                                    |
| **影响范围** | Guard 完全失效，所有恶意 skill 可被加载                                        |
| **根因**     | bundled Gateway 和 jiti-loaded Extension 各自有独立的 `load-guard.ts` 模块实例 |
| **修复**     | 使用 `globalThis.__openclaw_skill_load_guard__` 共享 guard 引用                |
| **经验**     | **跨模块边界共享状态必须使用 globalThis**，不能依赖模块级变量                  |

### BUG-5: SIGUSR1 重启后 Guard 永久失效（配置变更 → 安全降级）

| 属性         | 值                                                            |
| ------------ | ------------------------------------------------------------- |
| **严重程度** | P0/Critical                                                   |
| **影响范围** | 任何 skills.update / config 修改后 Guard 永久失效             |
| **触发条件** | 用户在 UI 中 Disable/Enable 任意 skill                        |
| **根因**     | 插件缓存 + 服务生命周期断裂（详见下方分析）                   |
| **修复**     | 在 service.start() 中重新注册 guard                           |
| **经验**     | **插件系统的 stop/start 生命周期必须与安全组件注册/注销对称** |

---

## 2. BUG-5 深度分析

### 2.1 事件链

```
用户点击 Disable
    ↓
skills.update handler → writeConfigFile()
    ↓
config watcher 检测到文件变化
    ↓
config-reload 判断: meta.lastTouchedAt 变化 → 需要 gateway restart
    ↓
发送 SIGUSR1 信号
    ↓
Gateway 收到 SIGUSR1 → 开始重启
    ↓
┌─── 停止阶段 ───────────────────────────────┐
│ stopPluginServices()                       │
│   → skill-guard service.stop()             │
│     → unregister()                         │
│       → globalThis.__guard__ = null  ← !!  │
│     → audit.close()                        │
│       → fd = null                          │
└────────────────────────────────────────────┘
    ↓
┌─── 重启阶段 ───────────────────────────────┐
│ loadOpenClawPlugins()                      │
│   → buildCacheKey(workspaceDir, plugins)   │
│   → registryCache.get(key) → HIT!         │
│   → 返回缓存的 registry                    │
│   → register() 不被调用                ← !!│
└────────────────────────────────────────────┘
    ↓
┌─── 服务启动阶段 ──────────────────────────┐
│ startPluginServices()                      │
│   → skill-guard service.start()            │
│     → 原来只做 cloud sync                  │
│     → 不重新注册 guard               ← !!  │
│                                            │
│ 结果: globalThis.__guard__ === null        │
│       所有安全阻断能力丧失                  │
└────────────────────────────────────────────┘
```

### 2.2 为什么初始启动时 Guard 是正常的？

初始启动时：

1. `registryCache` 为空 → 缓存未命中
2. `loadOpenClawPlugins()` 创建新 registry → 调用 `register()`
3. `register()` 创建 HashCache, AuditLogger, VerifyEngine → 注册 guard
4. `startPluginServices()` → `start()` → cloud sync
5. guard 在 globalThis 中可用

### 2.3 为什么重启时缓存会命中？

`registryCache` 的 key 由 `workspaceDir` + `plugins` 配置构成。
`skills.update` 只修改 `skills.entries.xxx.enabled`，不修改 `plugins` 配置。
因此 key 不变 → 缓存命中 → `register()` 不再执行。

---

## 3. 提炼的设计原则

### 原则 1: 插件安全组件必须在 service.start() 中重新注册

**问题模式**: 安全组件在 `register()` 中注册，在 `stop()` 中注销，但重启时因缓存
`register()` 不再执行。

**正确做法**:

```typescript
// ✅ 正确: 同时在 register() 和 start() 中注册
let unregister = registerGuard(guard);

api.registerService({
  async start() {
    audit.init(); // 幂等重开
    cache.loadFromDisk(); // 从磁盘恢复
    unregister = registerGuard(guard); // 重新注册
  },
  async stop() {
    unregister();
    audit.close();
  },
});
```

### 原则 2: 资源初始化必须幂等

`AuditLogger.init()` 如果被重复调用（register + start），必须跳过已打开的 fd，
否则会导致文件描述符泄漏。

**正确做法**:

```typescript
init(): void {
  if (!this.enabled) return;
  if (this.fd !== null) return;  // 幂等保护
  this.fd = fs.openSync(this.filePath, "a");
}
```

### 原则 3: Gateway 重启是常态，不是异常

任何配置修改都可能触发 SIGUSR1 重启。安全组件必须能在重启后自动恢复，
不能假设 `register()` 只被调用一次。

**影响范围检查清单**:

- [ ] `skills.update` 触发的重启
- [ ] `config.apply` 触发的重启
- [ ] 外部工具修改配置文件触发的重启
- [ ] `meta.lastTouchedAt` 自动更新触发的重启

### 原则 4: 插件缓存是性能优化，但会绕过初始化

`loadOpenClawPlugins()` 的 `registryCache` 基于 `workspaceDir + plugins` 构建 key。
缓存命中时 `register()` 不再执行。任何依赖 `register()` 的初始化逻辑必须有
独立的恢复机制（如在 `start()` 中重做）。

### 原则 5: 测试必须覆盖"操作后"场景

单纯的"初始加载"测试不足以发现生命周期 Bug。必须测试：

- 配置修改后的状态
- Disable/Enable 循环后的状态
- Gateway 重启后的状态
- 多次重启后的状态累积

---

## 4. 测试回归检查清单

在未来任何涉及以下模块的修改中，必须执行 TC-16 回归测试：

| 修改模块                               | 回归原因                 |
| -------------------------------------- | ------------------------ |
| `extensions/skill-guard/index.ts`      | Guard 注册/注销逻辑      |
| `src/plugins/loader.ts`                | 插件缓存机制             |
| `src/plugins/services.ts`              | 服务 start/stop 生命周期 |
| `src/gateway/config-reload.ts`         | 配置变更 → 重启触发      |
| `src/agents/skills/load-guard.ts`      | globalThis guard 引用    |
| `src/agents/skills/workspace.ts`       | guard 调用点             |
| `src/gateway/server-methods/skills.ts` | skills.update handler    |

---

## 5. 相关文档

| 文档           | 路径                                                       |
| -------------- | ---------------------------------------------------------- |
| 最终设计方案   | `docs/security/skill-guard-final-design.md`                |
| 冒烟测试手册   | `docs/security/skill-guard-smoke-test-manual.md` (v1.3)    |
| 冒烟测试检查表 | `docs/security/skill-guard-smoke-test-checklist.md` (v2.0) |
| 本经验文档     | `docs/security/skill-guard-lessons-learned.md`             |

---

## 修订记录

| 版本 | 日期       | 变更内容                                    |
| ---- | ---------- | ------------------------------------------- |
| v1.0 | 2026-02-07 | 初始版本：记录 BUG-4、BUG-5 及 5 条设计原则 |
