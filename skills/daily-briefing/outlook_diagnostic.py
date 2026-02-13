#!/usr/bin/env python3
"""
Outlook IMAP 深度诊断
"""
import imaplib
import getpass
import ssl

print("=" * 60)
print("📧 Outlook IMAP 深度诊断工具")
print("=" * 60)

# 默认配置
DEFAULT_USERNAME = "wongjunman@hotmail.com"
DEFAULT_PASSWORD = "pjmdrhlbtxmzlpsj"

# 获取用户输入（可以用默认或手动输入）
use_default = input(f"\n使用默认配置?\n  用户名: {DEFAULT_USERNAME}\n  密码: {'已设置' if DEFAULT_PASSWORD else '未设置'}\n[y/N]: ").strip().lower()

if use_default == 'y':
    username = DEFAULT_USERNAME
    password = DEFAULT_PASSWORD
else:
    username = input("请输入Outlook用户名: ").strip()
    password = getpass.getpass("请输入密码: ")

print("\n" + "=" * 60)
print("开始测试...\n" + "=" * 60)

# 测试配置
configs = [
    ("outlook.office365.com", 993, "SSL", ssl.SSLContext()),
    ("outlook.office365.com", 993, "SSL (no verify)", ssl.create_default_context()),
    ("imap-mail.outlook.com", 993, "SSL", ssl.SSLContext()),
    ("outlook.office365.com", 143, "STARTTLS", None),
]

for host, port, method, ssl_context in configs:
    print(f"\n测试: {host}:{port} ({method})")
    print("-" * 40)

    try:
        # 连接
        if "SSL" in method:
            mail = imaplib.IMAP4_SSL(host, port, ssl_context=ssl_context)
        else:
            mail = imaplib.IMAP4(host, port)
            mail.starttls()

        print(f"  ✅ 连接成功")

        # 登录
        mail.login(username, password)
        print(f"  ✅ 登录成功")

        # 选择收件箱
        mail.select('INBOX')
        print(f"  ✅ 收件箱访问成功")

        # 获取邮件数量
        typ, data = mail.search(None, 'ALL')
        email_count = len(data[0].split()) if data[0] else 0
        print(f"  📧 收件箱有 {email_count} 封邮件")

        # 获取最新一封邮件
        if email_count > 0:
            typ, data = mail.search(None, 'ALL')
            latest_id = data[0].split()[-1]
            typ, data = mail.fetch(latest_id, '(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)])')
            header = data[0][1].decode('utf-8', errors='ignore')
            print(f"\n  最新邮件示例:")
            print(f"  {header.strip()}")

        mail.close()
        mail.logout()

        print("\n" + "=" * 60)
        print("✅ ✅ ✅ 成功！配置如下：")
        print(f"  Host: {host}")
        print(f"  Port: {port}")
        print(f"  Method: {method}")
        print(f"  Username: {username}")
        print("把这个配置复制给Eden，并更新 email_config.json")
        print("=" * 60)
        input("\n按任意键退出...")
        exit(0)

    except imaplib.IMAP4.error as e:
        error = str(e)
        print(f"  ❌ IMAP错误: {error}")

        if "LOGIN failed" in error:
            print("\n  📋 可能的原因:")
            print("  1. App Password错误 - 检查是否复制正确（没有多余空格）")
            print("  2. 需要重新创建App Password")
            print("  3. IMAP未开启 - 去这里确认:")
            print("     https://outlook.live.com/mail/options/mail/accounts/popimap")
            print("  4. Outlook账户可能需要两步验证再创建App Password")

    except Exception as e:
        print(f"  ❌ 其他错误: {e}")

print("\n" + "=" * 60)
print("所有配置都失败了 😞")
print("\n建议步骤:")
print("1. 访问: https://outlook.live.com/mail/options/mail/accounts/popimap")
print("2. 确认IMAP已启用")
print("3. 去这里重新创建App Password:")
print("   https://account.microsoft.com/security")
print("   → 高级安全选项 → 应用密码")
print("4. 重新运行此工具")
print("=" * 60)
input("\n按任意键退出...")
