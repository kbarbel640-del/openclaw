import asyncio, json, os
from telethon import TelegramClient

api_id = 37267916
api_hash = "74542a9d30de41fa61e1eb104399f8c6"
session_path = os.path.expanduser("~/Documents/24Bet/.telegram_session")

async def main():
    client = TelegramClient(session_path, api_id, api_hash)
    await client.start()
    dialogs = await client.get_dialogs(limit=50)
    results = []
    for d in dialogs:
        eid = getattr(d.entity, 'id', 0)
        results.append({"id": eid, "name": d.name, "type": type(d.entity).__name__})
    print(json.dumps(results, ensure_ascii=False, indent=2))
    await client.disconnect()

asyncio.run(main())
