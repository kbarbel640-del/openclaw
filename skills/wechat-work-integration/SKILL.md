# 企业微信集成技能

## 描述
为OpenClaw提供企业微信集成能力，包括通讯录同步、消息推送和应用管理功能。

## 功能列表

- 发送企业微信消息
- 接收企业微信消息
- 同步企业通讯录
- 管理企业应用
- 推送通知

## 配置要求

需要在配置文件中设置以下参数：

```json5
{
  channels: {
    wechatWork: {
      corpId: "your_corp_id",
      corpSecret: "your_corp_secret",
      agentId: "your_agent_id",
      token: "your_token",
      encodingAesKey: "your_aes_key"
    }
  }
}
```

## 使用示例

- 发送消息: `openclaw message send --to wechatwork:user_id --message "Hello"`
- 同步通讯录: `openclaw wechatwork sync-contacts`
- 推送消息: `openclaw wechatwork push --users user_ids --message "Notification"`

## 技术实现

使用企业微信API实现，支持消息加密解密和回调验证机制。