# Email Channel 状态文件迁移指南

## 变更说明

从版本 1.1.0 开始，Email Channel 的状态文件保存位置已更改：

**旧位置**: `~/.openclaw/extensions/email/`
**新位置**: `~/.openclaw/extensions/email-channel/state/`

## 为什么要迁移？

1. **统一管理**: 所有插件相关文件（代码 + 状态）现在都在同一个目录下
2. **简化备份**: 只需备份一个目录即可
3. **易于清理**: 删除插件时不会遗漏状态文件

## 迁移步骤

### 自动迁移（推荐）

如果您有现有的状态文件，可以运行以下命令自动迁移：

```bash
# 1. 创建新的状态目录
mkdir -p ~/.openclaw/extensions/email-channel/state

# 2. 迁移所有状态文件
cp ~/.openclaw/extensions/email/state-*.json ~/.openclaw/extensions/email-channel/state/

# 3. 验证迁移成功
ls -la ~/.openclaw/extensions/email-channel/state/

# 4. 确认无误后，可以删除旧目录（可选）
# rm -rf ~/.openclaw/extensions/email/
```

### 手动迁移

如果您想手动迁移特定账户的状态：

```bash
# 迁移 default 账户
cp ~/.openclaw/extensions/email/state-default.json ~/.openclaw/extensions/email-channel/state/

# 迁移其他账户（例如 gmail 账户）
cp ~/.openclaw/extensions/email/state-gmail.json ~/.openclaw/extensions/email-channel/state/
```

## 状态文件内容

每个状态文件包含：

```json
{
  "lastProcessedTimestamp": "2026-02-21T05:49:32.440Z",
  "processedMessageIds": ["<message-id-1>", "<message-id-2>"],
  "failedAttempts": {
    "<message-id>": 1
  }
}
```

- **lastProcessedTimestamp**: 最后处理的邮件时间戳
- **processedMessageIds**: 已处理的消息 ID 列表（用于去重）
- **failedAttempts**: 失败的消息及其重试次数

## 验证迁移

重启 OpenClaw 后，检查日志确认状态加载成功：

```bash
pnpm start 2>&1 | grep "Loaded state"
```

应该看到类似的输出：

```
[EMAIL PLUGIN] [default] Loaded state: lastProcessed=2026-02-21T05:49:32.440Z, processedCount=13
```

## 回滚

如果迁移后遇到问题，可以回滚到旧版本：

1. 恢复旧的 runtime.ts 文件
2. 状态文件仍然在旧位置（如果未删除）

## 常见问题

### Q: 迁移后会不会丢失已处理的消息记录？

A: 不会。只要正确复制了状态文件，所有已处理的消息 ID 都会保留。

### Q: 可以跳过迁移吗？

A: 可以，但需要使用旧版本的 runtime.ts。新版本只会在新位置查找状态文件。

### Q: 旧的状态文件可以删除吗？

A: 迁移成功并验证无误后，可以删除 `~/.openclaw/extensions/email/` 目录。建议先保留几天确认一切正常。

---

**更新时间**: 2026-02-24
**版本**: 1.1.0
