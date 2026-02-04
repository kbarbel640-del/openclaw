# 钉钉集成技能

## 描述
为OpenClaw提供钉钉集成能力，包括消息收发、群组管理和日程同步功能。

## 功能列表

- 发送钉钉消息
- 接收钉钉消息
- 管理钉钉群组
- 同步钉钉日程
- 获取联系人信息

## 配置要求

需要在配置文件中设置以下参数：

```json5
{
  channels: {
    dingtalk: {
      corpId: "your_corp_id",
      clientId: "your_client_id", 
      clientSecret: "your_client_secret",
      agentId: "your_agent_id",
      callbackUrl: "https://your-domain.com/dingtalk/callback"
    }
  }
}
```

## 使用示例

- 发送消息: `openclaw message send --to dingtalk:user_id --message "Hello"`
- 查询联系人: `openclaw dingtalk contacts`
- 查询日程: `openclaw dingtalk schedule`

## 技术实现

使用钉钉开放平台API实现，支持OAuth2.0认证和回调机制。