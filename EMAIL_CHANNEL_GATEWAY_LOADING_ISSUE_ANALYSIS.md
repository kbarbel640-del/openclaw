# Email Channel Gateway 加载问题分析报告

**分析日期**: 2026-02-24
**问题**: Gateway 启动失败，错误 "extension entry escapes package directory: ./index.ts"
**结论**: ✅ **不是 OpenClaw 的 Bug，是配置错误**

---

## 🔍 问题根源

### 发现的问题

**错误信息**:

```
extension entry escapes package directory: ./index.ts
```

**根本原因**:
项目目录 `/Users/guxiaobo/Documents/GitHub/openclaw/extensions/email-channel/package.json` 中的路径配置错误。

### 错误的配置

```json
{
  "name": "@openclaw/email",
  "version": "1.0.0",
  "main": "index.ts", // ❌ 错误：文件不存在
  "openclaw": {
    "extensions": [
      "./index.ts" // ❌ 错误：文件不存在于根目录
    ]
  }
}
```

**实际文件结构**:

```
extensions/email-channel/
├── package.json
├── src/
│   ├── index.ts      # ✅ 实际入口文件在这里
│   ├── channel.ts
│   └── runtime.ts
└── dist/
    └── index.js      # ✅ 或编译后的入口
```

### 为什么触发 "escapes package directory" 错误

1. OpenClaw 扫描 `extensions/` 目录
2. 读取 `email-channel/package.json`，发现 `"extensions": ["./index.ts"]`
3. 尝试解析路径：`/path/to/openclaw/extensions/email-channel/index.ts`
4. 使用 `isPathInsideWithRealpath()` 验证路径安全性
5. 由于文件不存在，`realpath()` 返回 `null`
6. 在 `requireRealpath: true` 模式下，返回 `false`
7. 触发错误："extension entry escapes package directory"

**关键代码** (`src/security/scan-paths.ts`):

```typescript
export function isPathInsideWithRealpath(
  basePath: string,
  candidatePath: string,
  opts?: { requireRealpath?: boolean },
): boolean {
  if (!isPathInside(basePath, candidatePath)) {
    return false;
  }
  const baseReal = safeRealpathSync(basePath);
  const candidateReal = safeRealpathSync(candidatePath);
  if (!baseReal || !candidateReal) {
    // 当文件不存在时，realpath 返回 null
    // requireRealpath: true 时，返回 false
    return opts?.requireRealpath !== true;
  }
  return isPathInside(baseReal, candidateReal);
}
```

---

## ✅ 解决方案

### 1. 修复 package.json 路径

**修复前**:

```json
{
  "main": "index.ts",
  "openclaw": {
    "extensions": ["./index.ts"]
  }
}
```

**修复后**:

```json
{
  "main": "./src/index.ts",
  "openclaw": {
    "extensions": ["./src/index.ts"]
  }
}
```

### 2. 添加 openclaw.plugin.json

项目目录缺少插件清单文件。

**创建**: `extensions/email-channel/openclaw.plugin.json`

```json
{
  "id": "email",
  "channels": ["email"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

---

## 🧪 验证结果

### 修复后的 Gateway 启动日志

```
Config warnings:\n- plugins.entries.email: plugin email: duplicate plugin id detected

[plugins] email: loaded without install/load-path provenance
[plugins] duplicate plugin id detected; later plugin may be overridden
  (/Users/guxiaobo/Documents/GitHub/openclaw/extensions/email-channel/src/index.ts)

Gateway listening on ws://127.0.0.1:18789
```

**关键发现**:

- ✅ Email channel 成功加载
- ⚠️ 检测到重复的 plugin id（项目目录 + 本地安装）
- ✅ Gateway 正常启动

---

## 📊 问题分类

### 这不是 OpenClaw 的 Bug

**原因**:

1. ✅ OpenClaw 的路径安全检查工作正常
2. ✅ 当文件路径正确时，`isPathInsideWithRealpath()` 正确返回 `true`
3. ✅ 错误是由配置错误导致的（路径指向不存在的文件）
4. ✅ 修复配置后，插件成功加载

### 这是配置错误

**证据**:

1. ❌ `package.json` 中声明了 `./index.ts`，但文件不存在
2. ❌ 缺少必需的 `openclaw.plugin.json` 文件
3. ✅ 修复这两个问题后，Gateway 成功启动

---

## 🎯 最佳实践建议

### 1. package.json 配置规范

对于 TypeScript 插件：

**开发模式**（源码加载）:

```json
{
  "main": "./src/index.ts",
  "openclaw": {
    "extensions": ["./src/index.ts"]
  }
}
```

**生产模式**（编译后）:

```json
{
  "main": "./dist/index.js",
  "openclaw": {
    "extensions": ["./dist/index.js"]
  }
}
```

### 2. 必需的插件文件

每个 OpenClaw 插件必须包含：

```
extensions/my-plugin/
├── package.json              # 包配置
├── openclaw.plugin.json      # ✅ 插件清单（必需）
├── src/
│   └── index.ts              # 入口文件
└── README.md
```

### 3. openclaw.plugin.json 模板

```json
{
  "id": "plugin-id",
  "channels": ["channel-name"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

### 4. 避免重复加载

**问题**: 同时存在项目目录和本地安装会导致重复加载

**解决方案**:

1. **开发时**: 删除 `~/.openclaw/extensions/email-channel/`，只使用项目目录
2. **生产时**: 删除项目目录的插件，只保留 `~/.openclaw/extensions/`
3. **或**: 使用 `plugins.allow` 明确指定要加载的插件

---

## 📝 修复的文件

### 已修复

1. ✅ `extensions/email-channel/package.json`
   - 更新 `main` 为 `./src/index.ts`
   - 更新 `openclaw.extensions` 为 `["./src/index.ts"]`

2. ✅ `extensions/email-channel/openclaw.plugin.json`
   - 新建插件清单文件

---

## 🔄 后续行动

### 不需要向官方提交 Bug

**理由**:

- ✅ 这不是 OpenClaw 的 bug
- ✅ 是配置错误导致的
- ✅ OpenClaw 的安全检查工作正常

### 需要提交的修复

将以下文件提交到 `feature/email-channel` 分支：

1. `extensions/email-channel/package.json` - 修复路径配置
2. `extensions/email-channel/openclaw.plugin.json` - 添加插件清单

### 建议的文档改进

可以向 OpenClaw 官方提交文档改进建议：

1. **插件开发指南** - 明确说明 `openclaw.extensions` 路径必须指向实际存在的文件
2. **错误信息改进** - 当文件不存在时，提供更清晰的错误信息
   - 当前: "extension entry escapes package directory"
   - 建议: "extension entry not found: ./index.ts"

---

## 🧪 测试命令

### 验证插件加载

```bash
# 启动 gateway
pnpm openclaw gateway run --bind loopback --port 18789 --force

# 查看插件状态
pnpm openclaw doctor | grep -A 10 "Plugin diagnostics"
```

### 预期结果

```
✓ email: loaded from /path/to/extensions/email-channel/src/index.ts
✓ Gateway listening on ws://127.0.0.1:18789
```

---

## 📊 总结

| 问题                             | 状态      | 原因                      | 解决方案                        |
| -------------------------------- | --------- | ------------------------- | ------------------------------- |
| "escapes package directory" 错误 | ✅ 已解决 | package.json 路径错误     | 修改为 `./src/index.ts`         |
| "plugin manifest not found" 错误 | ✅ 已解决 | 缺少 openclaw.plugin.json | 创建插件清单文件                |
| 插件重复加载警告                 | ⚠️ 已识别 | 项目 + 本地双重安装       | 使用 `plugins.allow` 或删除其一 |

---

**结论**: 问题已完全解决，不是 OpenClaw 的 bug，无需向官方提交 issue。

**核心问题**: 配置错误（路径指向不存在的文件）
**解决方案**: 修复 package.json 路径 + 添加 openclaw.plugin.json
**验证结果**: ✅ Gateway 成功启动，email channel 成功加载
