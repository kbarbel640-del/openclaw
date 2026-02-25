# Discord 富 UI 组件使用指南

简化版的 Discord 富 UI 组件库，支持按钮、选择菜单、模态框和媒体画廊。

## 快速开始

```typescript
import { confirmDestructive, sendModelPicker, sendCodeReviewUI } from "openclaw/agents/discord-ui";
```

## 功能列表

### 1. 确认按钮 (Confirmation Buttons)

```typescript
import { confirmDestructive } from "openclaw/agents/discord-ui";

// 发送删除确认按钮
await confirmDestructive({
  action: "delete",
  target: "/path/to/file.txt",
  cfg: openclawConfig,
  channel: "1475765287436554280",
});

// 自定义确认
import { requestConfirmation } from "openclaw/agents/discord-ui";

await requestConfirmation({
  scene: "generic",
  title: "请确认",
  description: "确定要执行此操作吗？",
  channel: "1475765287436554280",
  cfg: openclawConfig,
});
```

**场景类型：**

- `destructive` - 破坏性操作（删除等）
- `access-request` - 访问请求
- `generic` - 通用确认

### 2. 选择菜单 (Select Menus)

```typescript
import { sendModelPicker, sendSelectMenu } from "openclaw/agents/discord-ui";

// 模型选择器
await sendModelPicker({
  cfg: openclawConfig,
  channel: "1475765287436554280",
});

// 自定义选择菜单
await sendSelectMenu({
  cfg: openclawConfig,
  channel: "1475765287436554280",
  content: "选择优先级：",
  selectMenu: {
    type: "string",
    placeholder: "选择优先级...",
    options: [
      { label: "🔴 紧急", value: "urgent", emoji: "🔴" },
      { label: "🟠 高", value: "high", emoji: "🟠" },
      { label: "🟡 中", value: "medium", emoji: "🟡" },
      { label: "🟢 低", value: "low", emoji: "🟢" },
    ],
  },
});
```

**选择菜单类型：**

- `string` - 字符串选择
- `user` - 用户选择 (@mention)
- `role` - 角色选择 (@role)
- `channel` - 频道选择 (#channel)

### 3. 模态框 (Modals)

```typescript
import { buildCreateThreadModal, buildCodeReviewModal } from "openclaw/agents/discord-ui";

// 创建子区模态框
const modal = buildCreateThreadModal();

// 代码审查模态框
const modal = buildCodeReviewModal();
```

**注意：** 模态框只能在响应 Discord Interaction（按钮点击等）时显示，不能主动发送。

### 4. 媒体画廊 (Media Gallery)

```typescript
import { sendMediaGallery } from "openclaw/agents/discord-ui";

await sendMediaGallery({
  cfg: openclawConfig,
  channel: "1475765287436554280",
  title: "📸 截图对比",
  images: [
    { url: "https://example.com/before.png", description: "优化前" },
    { url: "https://example.com/after.png", description: "优化后" },
  ],
});
```

### 5. 组合组件

```typescript
import { sendCodeReviewUI } from "openclaw/agents/discord-ui";

// 代码审查界面：按钮 + 选择菜单
await sendCodeReviewUI({
  cfg: openclawConfig,
  channel: "1475765287436554280",
  prTitle: "PR #22563: Discord 状态机 2.0",
  prUrl: "https://github.com/openclaw/openclaw/pull/22563",
});
```

## 获取 Discord Channel ID

1. 在 Discord 中右键点击频道
2. 选择"复制频道 ID"（需要开启开发者模式）

## 注意事项

1. **简化版实现** - 当前版本只发送 UI 组件，不处理用户点击响应
2. **模态框限制** - 只能在响应 interaction 时显示
3. **组件限制** - 每行最多 5 个按钮，每条消息最多 5 行

## 示例场景

| 场景     | 推荐组件                 |
| -------- | ------------------------ |
| 删除确认 | `confirmDestructive`     |
| 模型切换 | `sendModelPicker`        |
| 开子区   | `buildCreateThreadModal` |
| 代码审查 | `sendCodeReviewUI`       |
| 截图展示 | `sendMediaGallery`       |
