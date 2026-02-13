#!/usr/bin/env python3
"""
Outlook Automated Test - 使用默认配置
"""
import imaplib

USERNAME = "wongjunman@hotmail.com"
PASSWORD = "pjmdrhlbtxmzlpsj"

configs = [
    ("outlook.office365.com", 993, "SSL"),
    ("imap-mail.outlook.com", 993, "SSL"),
]

print("=" * 60)
print("📧 Outlook 自动测试")
print("=" * 60)
print(f"用户名: {USERNAME}")
print(f"密码: {'已设置'}\n")

for host, port, method in configs:
    print(f"\n{'='*60}")
    print(f"测试: {host}:{port} ({method})")
    print('='*60)

    try:
        print("  连接中...")
        mail = imaplib.IMAP4_SSL(host, port)
        print("  ✅ 连接成功")

        print("  登录中...")
        mail.login(USERNAME, PASSWORD)
        print("  ✅ 登录成功")

        print("  访问收件箱...")
        mail.select('INBOX')
        print("  ✅ 收件箱访问成功")

        typ, data = mail.search(None, 'ALL')
        email_count = len(data[0].split()) if data[0] else 0
        print(f"  📧 收件箱有 {email_count} 封邮件")

        mail.close()
        mail.logout()

        print(f"\n🎉 成功！正确的配置是:")
        print(f"  Host: {host}")
        print(f"  Port: {port}")
        print(f"  Method: {method}")
        print(f"\n这个配置可以更新到 email_config.json")
        exit(0)

    except imaplib.IMAP4.error as e:
        error = str(e)
        print(f"  ❌ IMAP错误: {error}")

        if "LOGIN failed" in error:
            print("\n  💡 可能的原因:")
            print("  1. App Password 错误")
            print("  2. IMAP 未启用")
            print("  3. 需要重新创建 App Password")
            print("\n  检查步骤:")
            print("  1. https://outlook.live.com/mail/options/mail/accounts/popimap")
            print("  2. https://account.microsoft.com/security")
            print("  3. 高级安全选项 → 应用密码")

    except Exception as e:
        print(f"  ❌ 其他错误: {e}")

print("\n" + "="*60)
print("所有配置尝试都失败了 😞")
print("="*60)
