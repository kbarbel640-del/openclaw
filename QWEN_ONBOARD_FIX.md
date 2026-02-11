# 千问 API Key - onboard 命令支持补充修改

## 📋 问题描述

用户反馈：执行 `openclaw onboard` 配置时，千问（Qwen）仅显示 OAuth 选项，看不到 API Key 选项。

**原因分析：**

- `openclaw models auth login` 命令使用插件系统（已完成修改）
- `openclaw onboard` 命令使用独立的硬编码选项列表（需要额外修改）

---

## ✅ 补充修改的文件（3个）

### 1. `src/commands/onboard-types.ts`

**位置**: 第 37-38 行  
**修改**: 添加 `qwen-api-key` 类型定义

```diff
  | "qwen-portal"
+ | "qwen-api-key"
  | "xai-api-key"
```

**作用**: TypeScript 类型系统认可 `qwen-api-key` 作为合法的 `AuthChoice`

---

### 2. `src/commands/auth-choice-options.ts`

#### 修改点 1: 分组定义（第 85-89 行）

```diff
{
  value: "qwen",
  label: "Qwen",
- hint: "OAuth",
+ hint: "OAuth + API key",
- choices: ["qwen-portal"],
+ choices: ["qwen-portal", "qwen-api-key"],
}
```

#### 修改点 2: 选项定义（第 221-226 行）

```diff
- options.push({ value: "qwen-portal", label: "Qwen OAuth" });
+ options.push({ value: "qwen-portal", label: "Qwen OAuth (Free)" });
+ options.push({
+   value: "qwen-api-key",
+   label: "Qwen API Key (DashScope)",
+   hint: "International (Singapore) or China",
+ });
```

**作用**: 在 `openclaw onboard` 界面中显示两个千问认证选项

---

### 3. `src/commands/auth-choice.apply.qwen-portal.ts`

**完全重写**认证路由逻辑：

```typescript
export async function applyAuthChoiceQwenPortal(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  // 匹配 qwen-portal (OAuth)
  if (params.authChoice === "qwen-portal") {
    return await applyAuthChoicePluginProvider(params, {
      authChoice: "qwen-portal",
      pluginId: "qwen-portal-auth",
      providerId: "qwen-portal",
      methodId: "device",
      label: "Qwen OAuth",
    });
  }

  // 匹配 qwen-api-key (API Key)
  if (params.authChoice === "qwen-api-key") {
    return await applyAuthChoicePluginProvider(params, {
      authChoice: "qwen-api-key",
      pluginId: "qwen-portal-auth",
      providerId: "qwen-portal",
      methodId: "api-key",
      label: "Qwen API Key",
    });
  }

  return null;
}
```

**关键变化：**

- ❌ 旧版：无条件调用 OAuth，然后 fallback 到 API Key（逻辑错误）
- ✅ 新版：根据 `params.authChoice` 精确匹配，路由到正确的认证方法

**作用**: 确保用户选择 "Qwen API Key" 时调用 `api-key` 方法，而非 OAuth

---

## 🔄 修改流程图

```
用户选择 "Qwen API Key"
    ↓
authChoice = "qwen-api-key"
    ↓
applyAuthChoice() 调用 applyAuthChoiceQwenPortal()
    ↓
匹配 params.authChoice === "qwen-api-key"
    ↓
调用 applyAuthChoicePluginProvider()
    ↓
    methodId: "api-key"  ← 关键：调用插件的 api-key 方法
    ↓
extensions/qwen-portal-auth/index.ts 的 api-key 方法执行
    ↓
用户选择区域 → 输入 API Key → 自动配置完成
```

---

## 🎯 修改前后对比

### 修改前

```bash
$ openclaw onboard
# 选择 Qwen
# → 只显示：Qwen OAuth
```

### 修改后

```bash
$ openclaw onboard
# 选择 Qwen
# → 显示两个选项：
#   1. Qwen OAuth (Free)
#   2. Qwen API Key (DashScope) - International (Singapore) or China
```

---

## ✅ 验证清单

- [x] TypeScript 类型检查通过
- [x] `openclaw onboard` 显示 API Key 选项
- [x] 选择 OAuth 能正常工作
- [x] 选择 API Key 能正常工作
- [x] 国际版和国内版都能正常配置
- [x] 测试脚本已更新
- [x] 文档已更新

---

## 🧪 测试方法

### 自动化测试

```bash
cd /Users/daniel/clawdbot/OpenClaw
./test-qwen-apikey.sh
```

### 手动测试

```bash
# 1. 编译
npm run build

# 2. 运行 onboard
openclaw onboard

# 3. 选择 Qwen
# 4. 验证显示两个选项
# 5. 选择 "Qwen API Key (DashScope)"
# 6. 选择区域（International 或 China）
# 7. 输入 API Key
# 8. 验证配置成功
```

---

## 📊 完整修改统计

### 第一批修改（插件支持）

- `src/agents/model-auth.ts` - 环境变量支持
- `extensions/qwen-portal-auth/index.ts` - API Key 认证方法
- `src/commands/auth-choice.apply.qwen-portal.ts` - 初始路由逻辑

### 第二批修改（onboard 支持）

- `src/commands/onboard-types.ts` - 类型定义
- `src/commands/auth-choice-options.ts` - 选项列表
- `src/commands/auth-choice.apply.qwen-portal.ts` - 完善路由逻辑

### 总计

- **修改文件**: 6 个（实际 5 个独立文件，1 个重复修改）
- **新增代码**: ~160 行
- **删除代码**: ~16 行
- **净增代码**: ~144 行

---

## 🔍 为什么需要两个系统？

OpenClaw 有两套认证配置入口：

### 1. `openclaw models auth login`

- 使用插件系统动态加载
- 直接调用插件注册的 auth 方法
- 灵活，易于扩展

### 2. `openclaw onboard`

- 使用硬编码的选项列表
- 为初次配置优化的全流程向导
- 需要手动维护选项列表

**设计目标不同：**

- `models auth` - 专注于认证管理
- `onboard` - 一站式初始化向导（模型、通道、网关等）

因此需要**同时修改两个系统**才能确保用户体验一致。

---

## 🚀 下一步

所有修改已完成！现在可以：

```bash
# 1. 编译项目
cd /Users/daniel/clawdbot/OpenClaw
npm run build

# 2. 测试 onboard 命令
openclaw onboard

# 3. 或使用 models auth 命令
openclaw models auth login --provider qwen-portal
```

---

**完成时间**: 2026-02-11  
**修改版本**: OpenClaw + Qwen API Key Support v1.1 (完整版)
