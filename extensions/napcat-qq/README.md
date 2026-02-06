# OpenClaw NapCatQQ Channel Plugin (OneBot v11)

通过 NapCatQQ/OneBot v11 协议实现的 QQ 消息渠道插件。
原作者：https://github.com/Taki-Ta/moltbot/tree/feat/qq-channel

## 原始项目信息

- **原项目**: qq-Napcat
- **版本**: 1.0.0
- **许可证**: MIT

## 功能特性

- 基于 NapCatQQ/OneBot v11 协议
- WebSocket 连接模式
- 私聊消息支持
- 群聊消息支持
- 多账户管理
- 消息白名单策略

## 前置要求

使用此插件需要先安装并配置 NapCatQQ：

1. 安装 [NapCatQQ](https://github.com/NapNeko/NapCatQQ)
2. 配置 OneBot v11 WebSocket 服务
3. 获取 WebSocket URL 和 Access Token

## 配置

```bash
openclaw config set channels.qq '{
  "enabled": true,
  "wsUrl": "ws://127.0.0.1:3001",
  "accessToken": "your-access-token"
}' --json
```

## 配置项说明

| 配置项           | 类型    | 说明                              |
| ---------------- | ------- | --------------------------------- |
| `enabled`        | boolean | 是否启用                          |
| `wsUrl`          | string  | NapCatQQ WebSocket URL            |
| `accessToken`    | string  | Access Token (可选)               |
| `dmPolicy`       | string  | 私聊策略: open/pairing/allowlist  |
| `groupPolicy`    | string  | 群聊策略: open/allowlist/disabled |
| `allowFrom`      | array   | 私聊白名单 QQ 号                  |
| `groupAllowFrom` | array   | 群聊白名单群号                    |

## 使用说明

1. 安装并启动 NapCatQQ
2. 配置 OneBot v11 WebSocket 反向连接或正向连接
3. 在 OpenClaw 中配置 WebSocket URL
4. 重启 OpenClaw 网关

## 相关链接

- [NapCatQQ](https://github.com/NapNeko/NapCatQQ)
- [OneBot v11 协议](https://github.com/botuniverse/onebot-11)

## License

MIT
