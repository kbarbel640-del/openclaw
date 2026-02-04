# OpenClaw 中国用户安装指南

## 快速安装

### 一键安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw/main/scripts/china-install.sh -o china-install.sh
chmod +x china-install.sh
./china-install.sh
```

### 手动安装

```bash
# 安装 Node.js (推荐使用国内镜像)
curl -o- https://npmmirror.com/mirrors/node/latest-v22.x/node-v22.22.0-linux-x64.tar.xz | tar -xJf -
export PATH=$PWD/node-v22.22.0-linux-x64/bin:$PATH

# 安装 OpenClaw
npm install -g openclaw@latest --registry https://registry.npmmirror.com

# 初始化
openclaw onboard --install-daemon
```

## 国内服务集成配置

### 钉钉配置

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

### 飞书配置

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

### 企业微信配置

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

## 国内镜像加速

配置 npm 镜像以提高安装速度：

```bash
npm config set registry https://registry.npmmirror.com
```

## 服务启动

```bash
# 启动服务
openclaw gateway --port 18789 --verbose

# 查看状态
openclaw gateway status
```

## 使用示例

```bash
# 发送钉钉消息
openclaw message send --to dingtalk:user_id --message "Hello from OpenClaw"

# 发送飞书消息
openclaw message send --to feishu:user_id --message "Hello from OpenClaw"

# 发送企业微信消息
openclaw message send --to wechatwork:user_id --message "Hello from OpenClaw"

# 与助手对话
openclaw agent --message "今日工作总结" --thinking high
```

## 故障排除

### 网络问题
如果遇到网络问题，可尝试使用代理：

```bash
export HTTPS_PROXY=http://proxy.company.com:8080
export HTTP_PROXY=http://proxy.company.com:8080
```

### 权限问题
确保有足够的权限运行服务：

```bash
sudo chown -R $(whoami) ~/.openclaw
```

## 技术支持

- 中文文档: https://docs.openclaw.ai/zh
- 社区支持: 加入钉钉群或微信群获取支持
- GitHub Issues: https://github.com/openclaw/openclaw/issues