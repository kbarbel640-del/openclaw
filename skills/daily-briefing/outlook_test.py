#!/usr/bin/env python3
"""
Outlook IMAP Connection Test
"""
import imaplib

HOSTS = [
    ("outlook.office365.com", 993),
    ("imap-mail.outlook.com", 993),
]

USERNAME = "wongjunman@hotmail.com"
PASSWORD = "pjmdrhlbtxmzlpsj"

for host, port in HOSTS:
    print(f"\nTrying {host}:{port}...")

    try:
        mail = imaplib.IMAP4_SSL(host, port)
        mail.login(USERNAME, PASSWORD)
        mail.select('INBOX')

        print(f"✅ Success! Connected to {host}")

        # Count emails
        typ, data = mail.search(None, 'ALL')
        email_count = len(data[0].split())
        print(f"📧 Inbox has {email_count} emails")

        mail.close()
        mail.logout()
        break

    except Exception as e:
        print(f"❌ Failed: {e}")

# Try STARTTLS instead of SSL
for host, port in [("outlook.office365.com", 143)]:
    print(f"\nTrying STARTTLS {host}:{port}...")

    try:
        mail = imaplib.IMAP4(host, port)
        mail.starttls()
        mail.login(USERNAME, PASSWORD)
        mail.select('INBOX')

        print(f"✅ Success! Connected to {host} via STARTTLS")

        typ, data = mail.search(None, 'ALL')
        email_count = len(data[0].split())
        print(f"📧 Inbox has {email_count} emails")

        mail.close()
        mail.logout()
        break

    except Exception as e:
        print(f"❌ Failed: {e}")
