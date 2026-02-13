#!/usr/bin/env python3
"""
Email reader for Eden's daily briefing
Supports Gmail and Outlook/Hotmail via IMAP
"""
import imaplib
import email
from email.header import decode_header
import json
import os
from datetime import datetime, timedelta

def decode_header_value(header):
    """Decode email header value"""
    if header is None:
        return ""
    decoded_parts = []
    for part, encoding in decode_header(header):
        if isinstance(part, bytes):
            decoded_parts.append(part.decode(encoding or 'utf-8', errors='ignore'))
        else:
            decoded_parts.append(part)
    return ''.join(decoded_parts)

def get_emails(account_config, hours_back=24, limit=10):
    """Fetch recent emails from an account"""
    host = account_config['host']
    port = account_config['port']
    username = account_config['username']
    password = account_config['password']
    label = account_config.get('label', 'INBOX')
    use_ssl = account_config.get('use_ssl', True)

    try:
        # Connect to IMAP server
        if use_ssl:
            mail = imaplib.IMAP4_SSL(host, port)
        else:
            mail = imaplib.IMAP4(host, port)
            mail.starttls()
        mail.login(username, password)
        mail.select(label)

        # Calculate date for emails
        since_date = (datetime.now() - timedelta(hours=hours_back)).strftime("%d-%b-%Y")

        # Search for emails
        search_criteria = f'(SINCE {since_date})'
        typ, data = mail.search(None, search_criteria)

        email_ids = data[0].split()
        # Get last N emails
        email_ids = email_ids[-limit:] if len(email_ids) > limit else email_ids

        emails = []
        for eid in email_ids:
            typ, msg_data = mail.fetch(eid, '(RFC822)')
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)

            email_info = {
                'from': decode_header_value(msg.get('From', '')),
                'to': decode_header_value(msg.get('To', '')),
                'subject': decode_header_value(msg.get('Subject', '')),
                'date': msg.get('Date', ''),
                'account': account_config['name']
            }
            emails.append(email_info)

        mail.close()
        mail.logout()

        return emails

    except Exception as e:
        return {'error': f"{account_config['name']}: {str(e)}"}

def save_emails_to_file(emails, filename='recent_emails.json'):
    """Save emails to JSON file for briefing"""
    output_path = os.path.join(os.path.dirname(__file__), filename)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(emails, f, indent=2, ensure_ascii=False)
    return output_path

def load_passwords():
    """Load passwords from config file"""
    config_path = os.path.join(os.path.dirname(__file__), 'email_config.json')
    if not os.path.exists(config_path):
        return None
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)

if __name__ == '__main__':
    config = load_passwords()
    if not config:
        print("No email config found")
        exit(1)

    all_emails = []
    for account in config['accounts']:
        emails = get_emails(account, hours_back=24, limit=10)
        if isinstance(emails, list):
            all_emails.extend(emails)
        else:
            all_emails.append(emails)

    output = save_emails_to_file(all_emails)
    print(f"Saved {len(all_emails)} emails to {output}")
