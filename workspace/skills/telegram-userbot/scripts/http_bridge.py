#!/usr/bin/env python3
"""
Telegram HTTP Bridge for Clawdbot (Multi-Session)
支持多個 Telegram 帳號切換
"""

import os
import sys
import json
import asyncio
import argparse
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from aiohttp import web
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError

# Config 路徑
SKILL_DIR = Path(__file__).parent.parent
CONFIG_PATH = SKILL_DIR / "config.json"

# 多 session 管理
telegram_clients = {}  # session_name -> TelegramClient
client_locks = {}  # session_name -> asyncio.Lock


def load_config():
    """載入設定"""
    with open(CONFIG_PATH) as f:
        return json.load(f)


def get_default_session():
    """取得預設 session 名稱"""
    config = load_config()
    sessions = config.get("sessions", {})
    for name, sess in sessions.items():
        if sess.get("default"):
            return name
    # 沒有 default，返回第一個
    return list(sessions.keys())[0] if sessions else None


async def get_client(session_name: str = None):
    """取得指定 session 的 Telegram client"""
    global telegram_clients, client_locks
    
    config = load_config()
    
    # 決定使用哪個 session
    if session_name is None:
        session_name = get_default_session()
    
    sessions = config.get("sessions", {})
    if session_name not in sessions:
        raise ValueError(f"Session '{session_name}' not found. Available: {list(sessions.keys())}")
    
    sess_config = sessions[session_name]
    tg = config["telegram"]
    
    # 確保有 lock
    if session_name not in client_locks:
        client_locks[session_name] = asyncio.Lock()
    
    async with client_locks[session_name]:
        # 檢查是否已連線
        if session_name in telegram_clients:
            client = telegram_clients[session_name]
            if client.is_connected():
                return client
            else:
                # 斷線了，清除重連
                del telegram_clients[session_name]
        
        # 建立新連線
        session_path = sess_config["session_path"]
        client = TelegramClient(session_path, tg["api_id"], tg["api_hash"])
        await client.connect()
        
        if not await client.is_user_authorized():
            raise Exception(f"Session '{session_name}' not authorized. Run auth first.")
        
        telegram_clients[session_name] = client
        me = await client.get_me()
        print(f"[INFO] Connected session '{session_name}' as: {me.first_name} (@{me.username})")
        
        return client


async def resolve_chat(client, chat_identifier):
    """解析聊天 ID 或名稱"""
    # 純數字：當作 chat ID
    if isinstance(chat_identifier, int) or (isinstance(chat_identifier, str) and chat_identifier.lstrip('-').isdigit()):
        return await client.get_entity(int(chat_identifier))
    # @ 開頭：當作 username
    if chat_identifier.startswith('@'):
        return await client.get_entity(chat_identifier)
    # 其他：搜尋對話名稱
    dialogs = await client.get_dialogs(limit=100)
    for d in dialogs:
        if chat_identifier.lower() in d.name.lower():
            return d.entity
    raise ValueError(f"Chat not found: {chat_identifier}")


# ============== HTTP Handlers ==============

async def handle_health(request):
    """GET /health - 健康檢查"""
    try:
        session = request.query.get("session")
        client = await get_client(session)
        me = await client.get_me()
        return web.json_response({
            "status": "ok",
            "session": session or get_default_session(),
            "user": me.first_name,
            "username": me.username
        })
    except Exception as e:
        return web.json_response({"status": "error", "error": str(e)}, status=500)


async def handle_sessions(request):
    """GET /sessions - 列出可用 sessions"""
    try:
        config = load_config()
        sessions = config.get("sessions", {})
        result = []
        for name, sess in sessions.items():
            info = {
                "name": name,
                "display_name": sess.get("name", name),
                "default": sess.get("default", False),
                "connected": name in telegram_clients and telegram_clients[name].is_connected()
            }
            # 如果已連線，取得 username
            if info["connected"]:
                try:
                    me = await telegram_clients[name].get_me()
                    info["username"] = me.username
                except:
                    pass
            result.append(info)
        return web.json_response({"sessions": result})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def handle_chats(request):
    """GET /chats - 列出聊天"""
    try:
        session = request.query.get("session")
        client = await get_client(session)
        limit = int(request.query.get("limit", 50))
        chat_type = request.query.get("type")  # group, user, channel
        
        chats = []
        async for dialog in client.iter_dialogs(limit=limit):
            dtype = "user" if dialog.is_user else ("group" if dialog.is_group else "channel")
            
            if chat_type and dtype != chat_type:
                continue
                
            chats.append({
                "id": dialog.id,
                "name": dialog.name or "",
                "type": dtype,
                "unread": dialog.unread_count
            })
        
        return web.json_response({
            "session": session or get_default_session(),
            "chats": chats
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def handle_messages(request):
    """GET /messages - 讀取訊息"""
    try:
        session = request.query.get("session")
        client = await get_client(session)
        
        chat = request.query.get("chat")
        if not chat:
            return web.json_response({"error": "Missing 'chat' parameter"}, status=400)
        
        limit = int(request.query.get("limit", 20))
        search = request.query.get("search")
        reverse = request.query.get("reverse", "").lower() in ("1", "true", "yes")
        
        entity = await resolve_chat(client, chat)
        
        if search:
            messages = await client.get_messages(entity, limit=limit, search=search)
        else:
            messages = await client.get_messages(entity, limit=limit)
        
        results = []
        for msg in messages:
            sender_name = ""
            if msg.sender:
                sender_name = getattr(msg.sender, 'first_name', '') or \
                             getattr(msg.sender, 'title', '') or \
                             str(msg.sender_id)
            
            results.append({
                "id": msg.id,
                "date": msg.date.isoformat() if msg.date else None,
                "sender": sender_name,
                "sender_id": msg.sender_id,
                "text": msg.text or "",
                "has_media": msg.media is not None
            })
        
        if reverse:
            results = list(reversed(results))
        
        return web.json_response({
            "session": session or get_default_session(),
            "chat": chat,
            "messages": results
        })
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def handle_send(request):
    """POST /send - 發送訊息"""
    try:
        data = await request.json()
        session = data.get("session")
        client = await get_client(session)
        
        chat = data.get("chat")
        message = data.get("message")
        reply_to = data.get("reply_to")
        
        if not chat:
            return web.json_response({"error": "Missing 'chat'"}, status=400)
        if not message:
            return web.json_response({"error": "Missing 'message'"}, status=400)
        
        entity = await resolve_chat(client, chat)
        
        sent = await client.send_message(
            entity,
            message,
            reply_to=reply_to
        )
        
        return web.json_response({
            "success": True,
            "session": session or get_default_session(),
            "message_id": sent.id,
            "chat_id": sent.chat_id
        })
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def handle_send_file(request):
    """POST /send_file - 發送檔案"""
    try:
        data = await request.json()
        session = data.get("session")
        client = await get_client(session)
        
        chat = data.get("chat")
        file_path = data.get("file")
        caption = data.get("caption", "")
        force_document = data.get("force_document", False)
        
        if not chat:
            return web.json_response({"error": "Missing 'chat'"}, status=400)
        if not file_path:
            return web.json_response({"error": "Missing 'file'"}, status=400)
        
        file_path = Path(file_path).expanduser()
        if not file_path.exists():
            return web.json_response({"error": f"File not found: {file_path}"}, status=404)
        
        entity = await resolve_chat(client, chat)
        
        sent = await client.send_file(
            entity,
            str(file_path),
            caption=caption,
            force_document=force_document
        )
        
        return web.json_response({
            "success": True,
            "session": session or get_default_session(),
            "message_id": sent.id,
            "chat_id": sent.chat_id,
            "file": str(file_path),
            "size": file_path.stat().st_size
        })
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def handle_download_media(request):
    """POST /download - 下載媒體"""
    try:
        data = await request.json()
        session = data.get("session")
        client = await get_client(session)
        
        chat = data.get("chat")
        message_id = data.get("message_id")
        
        if not chat or not message_id:
            return web.json_response({"error": "Missing 'chat' or 'message_id'"}, status=400)
        
        entity = await resolve_chat(client, chat)
        messages = await client.get_messages(entity, ids=[message_id])
        
        if not messages or not messages[0]:
            return web.json_response({"error": "Message not found"}, status=404)
        
        msg = messages[0]
        if not msg.media:
            return web.json_response({"error": "Message has no media"}, status=400)
        
        # 下載到臨時目錄
        download_dir = SKILL_DIR / "downloads"
        download_dir.mkdir(exist_ok=True)
        
        path = await client.download_media(msg, file=str(download_dir))
        
        return web.json_response({
            "success": True,
            "session": session or get_default_session(),
            "path": str(path),
            "filename": Path(path).name if path else None
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# ============== Server Setup ==============

def create_app():
    """建立 aiohttp 應用"""
    app = web.Application()
    
    # Routes
    app.router.add_get("/health", handle_health)
    app.router.add_get("/sessions", handle_sessions)
    app.router.add_get("/chats", handle_chats)
    app.router.add_get("/messages", handle_messages)
    app.router.add_post("/send", handle_send)
    app.router.add_post("/send_file", handle_send_file)
    app.router.add_post("/download", handle_download_media)
    
    return app


async def run_server(host: str, port: int):
    """啟動伺服器"""
    app = create_app()
    
    print(f"[INFO] Starting Telegram HTTP Bridge (Multi-Session) on {host}:{port}")
    
    # 顯示可用 sessions
    config = load_config()
    sessions = config.get("sessions", {})
    print(f"[INFO] Available sessions: {list(sessions.keys())}")
    
    # 預先連線預設 session
    try:
        default_session = get_default_session()
        if default_session:
            client = await get_client(default_session)
            me = await client.get_me()
            print(f"[INFO] Default session '{default_session}' ready: {me.first_name} (@{me.username})")
    except Exception as e:
        print(f"[WARN] Could not connect default session on startup: {e}")
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    
    print(f"[INFO] Bridge ready at http://{host}:{port}")
    print("[INFO] Endpoints:")
    print("  GET  /health?session=         - Health check")
    print("  GET  /sessions                - List available sessions")
    print("  GET  /chats?session=          - List chats")
    print("  GET  /messages?session=&chat= - Read messages")
    print("  POST /send                    - Send message {session, chat, message}")
    print("  POST /send_file               - Send file {session, chat, file}")
    print("  POST /download                - Download media {session, chat, message_id}")
    print("\n[INFO] Press Ctrl+C to stop")
    
    # 保持運行
    try:
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        pass
    finally:
        await runner.cleanup()
        # 關閉所有 clients
        for name, client in telegram_clients.items():
            if client.is_connected():
                await client.disconnect()
                print(f"[INFO] Disconnected session '{name}'")


def main():
    parser = argparse.ArgumentParser(description="Telegram HTTP Bridge (Multi-Session)")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", "-p", type=int, default=18790, help="Bind port")
    args = parser.parse_args()
    
    try:
        asyncio.run(run_server(args.host, args.port))
    except KeyboardInterrupt:
        print("\n[INFO] Stopped.")


if __name__ == "__main__":
    main()
