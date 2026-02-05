import asyncio, json, os
from telethon import TelegramClient

api_id = 37267916
api_hash = "74542a9d30de41fa61e1eb104399f8c6"
session_path = os.path.expanduser("~/Documents/24Bet/.telegram_session")

async def main():
    client = TelegramClient(session_path, api_id, api_hash)
    await client.start()
    # Channel type needs -100 prefix
    entity = await client.get_entity(2860663272)
    messages = await client.get_messages(entity, limit=30)
    for m in messages:
        sender_name = ""
        if m.sender:
            sender_name = getattr(m.sender, 'first_name', '') or ''
            last = getattr(m.sender, 'last_name', '') or ''
            if last:
                sender_name += ' ' + last
        text = (m.text or '')[:200]
        print(f"[{m.date}] {sender_name}: {text}")
        print("---")
    await client.disconnect()

asyncio.run(main())
