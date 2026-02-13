#!/usr/bin/env python3
"""
Email Fetch - 从IMAP获取邮件
"""
import imaplib
import json
import sys
import re
import os
from datetime import datetime, timedelta

from email.header import make_header, decode_header

WORKSPACE_PATH = os.path.join(os.path.expanduser('~'), '.openclaw', 'workspace')
CONFIG_PATH = os.path.join(WORKSPACE_PATH, 'email_config.json')

def decode_header(header):
    """解码邮件头"""
    if header is None:
        return ""

    try:
        decoded = make_header(decode_header(header))
        return str(decoded)
    except:
        pass

    # Fallback
    mime_pattern = re.compile(r'=\?([^?]+)\?([BbQq])\?([^?]+)\?=')

    def decode_part(match):
        encoding = match.group(1).lower()
        encoding_type = match.group(2).upper()
        content = match.group(3)

        try:
            if encoding_type == 'B':
                import base64
                content = base64.b64decode(content)
            elif encoding_type == 'Q':
                import quopri
                content = quopri.decodestring(content)
            return content.decode(encoding or 'utf-8', errors='ignore')
        except:
            return match.group(0)

    decoded = mime_pattern.sub(decode_part, header)
    return decoded if decoded else header

def fetch_emails(hours_back=24, limit=None):
    """获取邮件"""
    # 加载配置
    if not os.path.exists(CONFIG_PATH):
        print(f"Config not found: {CONFIG_PATH}")
        return []

    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        config = json.load(f)

    results = []
    since_date = (datetime.now() - timedelta(hours=hours_back)).strftime("%d-%b-%Y")

    for account in config.get('accounts', []):
        account_name = account.get('name', 'unknown')
        host = account['host']
        port = account['port']
        username = account['username']
        password = account['password']

        print(f"\nFetching from {account_name}...")

        try:
            mail = imaplib.IMAP4_SSL(host, port)
            mail.login(username, password)
            mail.select('INBOX')

            # 搜索邮件
            search_criteria = f'(SINCE {since_date})'
            typ, data = mail.search(None, search_criteria)

            if not data or not data[0]:
                print(f"  No emails found")
                mail.close()
                mail.logout()
                continue

            email_ids = data[0].split()
            if limit:
                email_ids = email_ids[-limit:]

            print(f"  Found {len(email_ids)} emails")

            # 获取邮件头
            for eid in email_ids:
                try:
                    typ, msg_data = mail.fetch(eid, '(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])')
                    if not msg_data or not msg_data[0]:
                        continue

                    raw_header = msg_data[0][1]
                    if isinstance(raw_header, bytes):
                        try:
                            raw_header = raw_header.decode('utf-8', errors='ignore')
                        except:
                            continue

                    # 解析头部
                    from_val, subject_val, date_val = '', '', ''

                    for line in raw_header.split('\n'):
                        line = line.strip()
                        if line.startswith('From:'):
                            from_val = line[5:].strip()
                        elif line.startswith('Subject:'):
                            subject_val = line[8:].strip()
                        elif line.startswith('Date:'):
                            date_val = line[5:].strip()

                    # 解码
                    from_val = decode_header(from_val)
                    subject_val = decode_header(subject_val)

                    # 清理发件人
                    if '<' in from_val and '>' in from_val:
                        from_val = from_val.split('<')[0].strip(' "')

                    email_info = {
                        'from': from_val,
                        'subject': subject_val,
                        'date': date_val,
                        'account': account_name
                    }
                    results.append(email_info)

                except Exception as e:
                    print(f"  Error processing email: {e}")
                    continue

            mail.close()
            mail.logout()
            print(f"  ✅ Fetched {len([e for e in results if e['account'] == account_name])} emails")

        except Exception as e:
            print(f"  ❌ Error: {e}")

    return results

def save_results(emails):
    """保存结果"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"emails_{timestamp}.json"
    filepath = os.path.join(WORKSPACE_PATH, filename)

    result = {
        "timestamp": datetime.now().isoformat(),
        "count": len(emails),
        "emails": emails
    }

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Saved to: {filepath}")
    return filepath

def main():
    hours = 24
    limit = None

    # 解析参数
    for i, arg in enumerate(sys.argv):
        if arg == "--hours" and i + 1 < len(sys.argv):
            hours = int(sys.argv[i + 1])
        elif arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    print("=" * 60)
    print("📧 Email Fetch")
    print("=" * 60)
    print(f"Hours: {hours}")
    print(f"Limit: {limit or 'None'}\n")

    emails = fetch_emails(hours_back=hours, limit=limit)

    if emails:
        save_results(emails)

        # 预览
        print("\n" + "-" * 60)
        print(f"Top {min(5, len(emails))} emails:")
        print("-" * 60)
        for i, email in enumerate(emails[:5], 1):
            print(f"{i}. [{email['account']}] {email['from'][:40]}")
            print(f"   {email['subject'][:50]}")
            print()

if __name__ == '__main__':
    main()
