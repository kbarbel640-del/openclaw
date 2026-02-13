#!/usr/bin/env python3
"""
Outlook 用户名格式测试
"""
import imaplib

PASSWORD = "pjmdrhlbtxmzlpsj"
HOST = "outlook.office365.com"
PORT = 993

# 尝试不同的用户名格式
usernames = [
    "wongjunman@hotmail.com",
    "wongjunman@hotmail.com@outlook.com",
    "wongjunman",
    "WongJunMan@hotmail.com"
]

print("=" * 60)
print("📧 Outlook 用户名格式测试")
print("=" * 60)
print(f"密码: pjmdrhlbtxm*****\n")

for username in usernames:
    print(f"\n尝试用户名: {username}")
    print("-" * 40)

    try:
        mail = imaplib.IMAP4_SSL(HOST, PORT)
        mail.login(username, PASSWORD)
        print(f"  ✅ 登录成功！")

        mail.select('INBOX')
        typ, data = mail.search(None, 'ALL')
        email_count = len(data[0].split()) if data[0] else 0

        print(f"  📧 收件箱有 {email_count} 封邮件")

        mail.close()
        mail.logout()

        print(f"\n🎉 找到正确的用户名: {username}")
        exit(0)

    except imaplib.IMAP4.error as e:
        error = str(e)
        if "AUTHENTICATIONFAILED" in error:
            print(f"  ❌ 认证失败 - 用户名或密码错误")
        elif "LOGIN failed" in error:
            print(f"  ❌ 登录失败")
        else:
            print(f"  ❌ {error}")

    except Exception as e:
        print(f"  ❌ {e}")

print("\n" + "="*60)
print("所有用户名格式都失败了")
print("="*60)
print("\n请检查:")
print("1. App Password 是否正确复制 (没有多余空格)")
print("2. Outlook IMAP 是否已启用")
print("3. 是否需要重新创建 App Password")
