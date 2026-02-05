#!/Users/sulaxd/clawd/skills/bg666-db/.venv/bin/python3
"""
Telegram 操作工具
Usage:
  tg.py chats [--limit N]              列出對話
  tg.py read <chat> [--limit N]        讀取消息
  tg.py send <chat> <message>          發送消息
  tg.py media <chat> [--limit N]       下載媒體
  tg.py search <chat> <keyword>        搜尋消息
"""

import sys
import os
import asyncio
import argparse
from datetime import datetime

# Telegram 配置
TG_SESSION = os.path.expanduser('~/Documents/two/mcp-telegram/session/claude_session')
API_ID = 37267916
API_HASH = '74542a9d30de41fa61e1eb104399f8c6'
MEDIA_DIR = '/tmp/tg_media'

async def get_client():
    from telethon import TelegramClient
    client = TelegramClient(TG_SESSION, API_ID, API_HASH)
    await client.connect()
    if not await client.is_user_authorized():
        raise Exception('Telegram 未授權')
    return client

async def list_chats(limit=20):
    client = await get_client()
    dialogs = await client.get_dialogs(limit=limit)
    
    print(f'最近 {limit} 個對話:\n')
    for d in dialogs:
        chat_type = '👤' if d.is_user else ('📢' if d.is_channel else '👥')
        print(f'{chat_type} {d.name}')
        print(f'   ID: {d.id}')
        print()
    
    await client.disconnect()

async def read_messages(chat, limit=20):
    client = await get_client()
    
    # 解析 chat（支持 ID 或名稱）
    try:
        chat_id = int(chat)
    except ValueError:
        chat_id = chat
    
    messages = await client.get_messages(chat_id, limit=limit)
    
    print(f'最近 {limit} 條消息:\n')
    for msg in reversed(messages):
        sender = msg.sender
        name = getattr(sender, 'first_name', '') or getattr(sender, 'title', 'Unknown') if sender else 'Unknown'
        date = msg.date.strftime('%m-%d %H:%M')
        text = msg.text or ''
        media = ' [📎媒體]' if msg.media else ''
        
        print(f'[{date}] {name}: {text[:200]}{media}')
        if len(text) > 200:
            print(f'   ...（共 {len(text)} 字）')
        print()
    
    await client.disconnect()

async def send_message(chat, message):
    client = await get_client()
    
    try:
        chat_id = int(chat)
    except ValueError:
        chat_id = chat
    
    result = await client.send_message(chat_id, message)
    print(f'✅ 已發送，message_id: {result.id}')
    
    await client.disconnect()

async def download_media(chat, limit=10):
    from telethon.tl.types import MessageMediaPhoto, MessageMediaDocument
    
    client = await get_client()
    os.makedirs(MEDIA_DIR, exist_ok=True)
    
    try:
        chat_id = int(chat)
    except ValueError:
        chat_id = chat
    
    messages = await client.get_messages(chat_id, limit=limit)
    
    count = 0
    for msg in messages:
        if msg.media and isinstance(msg.media, (MessageMediaPhoto, MessageMediaDocument)):
            path = await client.download_media(msg, MEDIA_DIR)
            sender = msg.sender
            name = getattr(sender, 'first_name', '') or 'Unknown' if sender else 'Unknown'
            date = msg.date.strftime('%m-%d %H:%M')
            print(f'[{date}] {name}: {msg.text or "(無文字)"}')
            print(f'   📎 {path}')
            print()
            count += 1
    
    print(f'共下載 {count} 個媒體文件到 {MEDIA_DIR}')
    await client.disconnect()

async def search_messages(chat, keyword, limit=50):
    client = await get_client()
    
    try:
        chat_id = int(chat)
    except ValueError:
        chat_id = chat
    
    messages = await client.get_messages(chat_id, limit=limit, search=keyword)
    
    print(f'搜尋 "{keyword}" 結果（最近 {limit} 條）:\n')
    for msg in reversed(messages):
        sender = msg.sender
        name = getattr(sender, 'first_name', '') or getattr(sender, 'title', 'Unknown') if sender else 'Unknown'
        date = msg.date.strftime('%m-%d %H:%M')
        text = msg.text or ''
        
        print(f'[{date}] {name}: {text[:200]}')
        print()
    
    print(f'共 {len(messages)} 條結果')
    await client.disconnect()

def main():
    parser = argparse.ArgumentParser(description='Telegram 操作工具')
    subparsers = parser.add_subparsers(dest='command', help='命令')
    
    # chats
    p_chats = subparsers.add_parser('chats', help='列出對話')
    p_chats.add_argument('--limit', type=int, default=20, help='數量')
    
    # read
    p_read = subparsers.add_parser('read', help='讀取消息')
    p_read.add_argument('chat', help='對話 ID 或名稱')
    p_read.add_argument('--limit', type=int, default=20, help='數量')
    
    # send
    p_send = subparsers.add_parser('send', help='發送消息')
    p_send.add_argument('chat', help='對話 ID 或名稱')
    p_send.add_argument('message', help='消息內容')
    
    # media
    p_media = subparsers.add_parser('media', help='下載媒體')
    p_media.add_argument('chat', help='對話 ID 或名稱')
    p_media.add_argument('--limit', type=int, default=10, help='數量')
    
    # search
    p_search = subparsers.add_parser('search', help='搜尋消息')
    p_search.add_argument('chat', help='對話 ID 或名稱')
    p_search.add_argument('keyword', help='關鍵字')
    p_search.add_argument('--limit', type=int, default=50, help='數量')
    
    args = parser.parse_args()
    
    if args.command == 'chats':
        asyncio.run(list_chats(args.limit))
    elif args.command == 'read':
        asyncio.run(read_messages(args.chat, args.limit))
    elif args.command == 'send':
        asyncio.run(send_message(args.chat, args.message))
    elif args.command == 'media':
        asyncio.run(download_media(args.chat, args.limit))
    elif args.command == 'search':
        asyncio.run(search_messages(args.chat, args.keyword, args.limit))
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
