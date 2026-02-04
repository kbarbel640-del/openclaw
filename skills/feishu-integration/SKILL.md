# 飞书集成技能

## 描述
为OpenClaw提供飞书集成能力，包括消息通知、文档协作和视频会议功能。

## 功能列表

- 发送飞书消息
- 接收飞书消息
- 管理飞书文档
- 安排视频会议
- 获取组织架构

## 配置要求

需要在配置文件中设置以下参数：

```json5
{
  channels: {
    feishu: {
      appId: "your_app_id",
      appSecret: "your_app_secret",
      encryptKey: "your_encrypt_key",
      verificationToken: "your_verification_token"
    }
  }
}
```

## 使用示例

- 发送消息: `openclaw message send --to feishu:user_id --message "Hello"`
- 查询文档: `openclaw feishu docs`
- 安排会议: `openclaw feishu meeting --attendees user_ids --time "2023-12-25 10:00"`

## 技术实现

使用飞书开放平台API实现，支持推送验证和事件订阅机制。