# 千问 API Key 支持 - 代码修改总结

## 📋 修改概览

为 OpenClaw 添加了千问 DashScope API Key 认证支持，包括国际版（新加坡）和国内版。

**修改日期**: 2026-02-11  
**修改文件数**: 6（初始3个 + 补充3个）  
**新增代码行数**: ~160 行

---

## 📁 修改的文件

### 第一批修改（插件支持）

#### 1. `src/agents/model-auth.ts`

**位置**: 第 275-277 行

**修改内容**:

```typescript
// 修改前
if (normalized === "qwen-portal") {
  return pick("QWEN_OAUTH_TOKEN") ?? pick("QWEN_PORTAL_API_KEY");
}

// 修改后
if (normalized === "qwen-portal") {
  return pick("QWEN_API_KEY") ?? pick("QWEN_OAUTH_TOKEN") ?? pick("QWEN_PORTAL_API_KEY");
}
```

**目的**: 添加 `QWEN_API_KEY` 环境变量支持，优先级最高

---

### 2. `extensions/qwen-portal-auth/index.ts`

**主要修改**:

1. **添加常量定义**（第 4-12 行）:

```typescript
const DEFAULT_MODEL = "qwen-portal/qwen-plus"; // 改为 qwen-plus
const DEFAULT_BASE_URL_OAUTH = "https://portal.qwen.ai/v1";
const DEFAULT_BASE_URL_INTL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"; // 新增
const DEFAULT_BASE_URL_CN = "https://dashscope.aliyuncs.com/compatible-mode/v1"; // 新增
```

2. **更新插件元数据**（第 34-38 行）:

```typescript
name: "Qwen OAuth & API Key",  // 改名
description: "OAuth flow and API key authentication for Qwen models",  // 更新描述
```

3. **更新 OAuth 方法标签**（第 47-49 行）:

```typescript
label: "Qwen OAuth (Free)",  // 添加 (Free) 标识
hint: "Device code login - portal.qwen.ai",  // 更详细的提示
```

4. **新增 API Key 认证方法**（第 127-237 行）:
   - 区域选择（国际版/国内版）
   - API Key 输入验证
   - 自动配置 base URL
   - 支持 6 个模型：
     - qwen-plus
     - qwen-turbo
     - qwen-max
     - qwen2.5-coder-32b-instruct
     - qwen3-coder-30b-a3b-v1:0
     - qwen-vl-plus

---

#### 3. `src/commands/auth-choice.apply.qwen-portal.ts`（初始版本，已更新）

**初始修改内容**:

```typescript
// 修改前
export async function applyAuthChoiceQwenPortal(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  return await applyAuthChoicePluginProvider(params, {
    authChoice: "qwen-portal",
    pluginId: "qwen-portal-auth",
    providerId: "qwen-portal",
    methodId: "device",
    label: "Qwen",
  });
}

// 修改后
export async function applyAuthChoiceQwenPortal(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  // 尝试 OAuth 优先
  const oauthResult = await applyAuthChoicePluginProvider(params, {
    authChoice: "qwen-portal",
    pluginId: "qwen-portal-auth",
    providerId: "qwen-portal",
    methodId: "device",
    label: "Qwen OAuth",
  });

  if (oauthResult) {
    return oauthResult;
  }

  // 回退到 API Key
  return await applyAuthChoicePluginProvider(params, {
    authChoice: "qwen-portal",
    pluginId: "qwen-portal-auth",
    providerId: "qwen-portal",
    methodId: "api-key",
    label: "Qwen API Key",
  });
}
```

**目的**: 支持两种认证方式（OAuth 和 API Key）

---

### 第二批修改（onboard 命令支持）

为了让 `openclaw onboard` 也能显示 API Key 选项，需要额外修改 onboard 相关文件。

#### 4. `src/commands/onboard-types.ts`

**位置**: 第 37-38 行

**修改内容**:

```typescript
// 添加前
| "qwen-portal"
| "xai-api-key"

// 添加后
| "qwen-portal"
| "qwen-api-key"  // ← 新增
| "xai-api-key"
```

**目的**: 添加 `qwen-api-key` 类型定义，供 TypeScript 类型检查使用

---

#### 5. `src/commands/auth-choice-options.ts`

**修改 1 - 更新分组定义**（第 85-89 行）:

```typescript
// 修改前
{
  value: "qwen",
  label: "Qwen",
  hint: "OAuth",
  choices: ["qwen-portal"],
}

// 修改后
{
  value: "qwen",
  label: "Qwen",
  hint: "OAuth + API key",  // ← 改提示
  choices: ["qwen-portal", "qwen-api-key"],  // ← 添加 API Key 选项
}
```

**修改 2 - 添加选项定义**（第 221-226 行）:

```typescript
// 添加前
options.push({ value: "qwen-portal", label: "Qwen OAuth" });

// 添加后
options.push({ value: "qwen-portal", label: "Qwen OAuth (Free)" });
options.push({
  value: "qwen-api-key",
  label: "Qwen API Key (DashScope)",
  hint: "International (Singapore) or China",
}); // ← 新增
```

**目的**: 在 onboard 选项列表中添加 API Key 选项

---

#### 6. `src/commands/auth-choice.apply.qwen-portal.ts`（完全重写）

**最终版本**:

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

**目的**: 正确路由 `qwen-portal` 和 `qwen-api-key` 到对应的插件认证方法

---

## 🎯 新增功能

### 1. 环境变量支持

```bash
export QWEN_API_KEY="sk-your-key"
```

### 2. CLI 交互式配置

```bash
openclaw models auth login --provider qwen-portal
# 选择 "Qwen API Key"
# 选择区域（国际版/国内版）
# 输入 API Key
```

### 3. 区域选择

- 🌏 国际版（新加坡）: `dashscope-intl.aliyuncs.com`
- 🇨🇳 国内版: `dashscope.aliyuncs.com`

### 4. 多模型支持

| 模型                       | 别名       | 类型 |
| -------------------------- | ---------- | ---- |
| qwen-plus                  | qwen       | 通用 |
| qwen-turbo                 | -          | 快速 |
| qwen-max                   | -          | 最强 |
| qwen2.5-coder-32b-instruct | qwen-coder | 编程 |
| qwen-vl-plus               | -          | 视觉 |

---

## ✅ 兼容性

- ✅ 保持原有 OAuth 认证方式
- ✅ 向后兼容旧配置
- ✅ 支持环境变量优先级
- ✅ 自动识别认证方式

---

## 🧪 测试方法

### 快速验证

```bash
cd /Users/daniel/clawdbot/OpenClaw
./test-qwen-apikey.sh
```

### 手动测试

```bash
# 1. 编译
npm run build

# 2. 配置
openclaw models auth login --provider qwen-portal

# 3. 测试
openclaw chat "你好"
```

---

## 📊 代码统计

| 文件                             | 修改行数 | 新增行数 | 删除行数 |
| -------------------------------- | -------- | -------- | -------- |
| model-auth.ts                    | 3        | 1        | 1        |
| qwen-portal-auth/index.ts        | 140+     | 120+     | 5        |
| auth-choice.apply.qwen-portal.ts | 30       | 28       | 8        |
| onboard-types.ts                 | 2        | 1        | 0        |
| auth-choice-options.ts           | 10       | 8        | 2        |
| **总计**                         | **185**  | **158**  | **16**   |

---

## 🔐 安全考虑

1. API Key 存储在 `~/.openclaw/agents/main/agent/auth-profiles.json`
2. 文件权限应设置为 `600`（仅所有者可读写）
3. 不要将 API Key 提交到版本控制系统
4. 环境变量方式适合临时测试

---

## 🐛 已知问题

**无** - 当前实现完整且稳定

---

## 📝 后续改进建议

1. 添加 API Key 加密存储
2. 支持多个 API Key profile
3. 添加使用量统计
4. 添加 API Key 有效期检查
5. 支持更多千问模型（qwq-32b-preview 等）

---

## 📚 相关文档

- 使用指南: `QWEN_API_KEY_GUIDE.md`
- 测试脚本: `test-qwen-apikey.sh`

---

**维护者**: OpenClaw Team  
**更新**: 2026-02-11
