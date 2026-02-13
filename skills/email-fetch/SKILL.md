---
name: email-fetch
description: Use when you need to fetch emails from Gmail or Outlook via IMAP, e.g., to check new messages or automate email processing.
metadata:
  openclaw:
    emoji: 📧
    requires:
      python: ">=3.10"
    install:
      - label: "Install dependencies"
        command: "uv pip install -r requirements.txt"
    run:
      - label: "Fetch emails (last 24h, limit 20)"
        command: "python scripts/fetch.py --hours 24 --limit 20"
---

# Email Fetch (Python IMAP)

使用Python IMAP直接从Gmail/Outlook获取邮件。

**注意**: Himalaya CLI安装失败，所以使用Python imaplib直接连接。

## 使用方法

```bash
python scripts/fetch.py --hours 24 --limit 20
```

## 配置

邮件配置文件 `workspace/email_config.json`:
```json
{
  "accounts": [
    {
      "name": "Gmail",
      "host": "imap.gmail.com",
      "port": 993,
      "username": "wongjunman1@gmail.com",
      "password": "app_password"
    }
  ]
}
```

**Gmail App Password**: https://myaccount.google.com/apppasswords
**Outlook**: IMAP已禁用(BasicAuthBlocked)，建议转发到Gmail

## 输出

邮件保存到: `workspace/emails_YYYYMMDD_HHMMSS.json`

## 手动运行

```bash
# 获取过去24小时邮件
python scripts/fetch.py --hours 24

# 指定小时数和数量
python scripts/fetch.py --hours 48 --limit 20
```