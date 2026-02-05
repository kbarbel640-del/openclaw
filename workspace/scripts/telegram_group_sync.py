#!/usr/bin/env python3
"""
Telegram 群組自動同步腳本
- 掃描杜甫的 Telegram 群組
- 發現新群組自動加進 Moltbot config
- 用 userbot 邀請 bot 進群
"""

import json
import subprocess
import sys
from pathlib import Path

# 配置
USERBOT_API = "http://host.docker.internal:18790"
MOLTBOT_CONFIG = Path("/home/node/.moltbot/moltbot.json")
BOT_USERNAME = "x01clawbot"

BOT_TOKEN = "8327498414:AAFVEs7Ouf6JESIWGpLnD77GvJkxe9uXp68"
BOT_ID = 8327498414

def get_userbot_chats():
    """從 userbot 獲取杜甫的群組列表"""
    try:
        result = subprocess.run(
            ["curl", "-s", f"{USERBOT_API}/chats"],
            capture_output=True, text=True, timeout=30
        )
        data = json.loads(result.stdout)
        # 只要 group 類型
        groups = [c for c in data.get("chats", []) if c.get("type") == "group"]
        return groups
    except Exception as e:
        print(f"Error fetching chats: {e}", file=sys.stderr)
        return []

def is_bot_in_group(chat_id: int) -> bool:
    """檢查 bot 是否在群組裡"""
    try:
        result = subprocess.run(
            ["curl", "-s", 
             f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMember?chat_id={chat_id}&user_id={BOT_ID}"],
            capture_output=True, text=True, timeout=10
        )
        data = json.loads(result.stdout)
        if data.get("ok"):
            status = data.get("result", {}).get("status", "")
            # member, administrator, creator 都算在群裡
            return status in ["member", "administrator", "creator", "restricted"]
        return False
    except Exception as e:
        print(f"Error checking bot in group {chat_id}: {e}", file=sys.stderr)
        return False

def get_config_groups():
    """獲取 config 裡已登記的 Telegram 群組"""
    try:
        with open(MOLTBOT_CONFIG) as f:
            config = json.load(f)
        groups = config.get("channels", {}).get("telegram", {}).get("groups", {})
        return set(groups.keys())
    except Exception as e:
        print(f"Error reading config: {e}", file=sys.stderr)
        return set()

def add_group_to_config(chat_id: int):
    """把群組加進 Moltbot config"""
    try:
        with open(MOLTBOT_CONFIG) as f:
            config = json.load(f)
        
        if "channels" not in config:
            config["channels"] = {}
        if "telegram" not in config["channels"]:
            config["channels"]["telegram"] = {}
        if "groups" not in config["channels"]["telegram"]:
            config["channels"]["telegram"]["groups"] = {}
        
        config["channels"]["telegram"]["groups"][str(chat_id)] = {
            "requireMention": False
        }
        
        with open(MOLTBOT_CONFIG, "w") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return True
    except Exception as e:
        print(f"Error updating config: {e}", file=sys.stderr)
        return False

def main():
    """主程序"""
    print("🔍 掃描杜甫的 Telegram 群組...")
    
    # 獲取 userbot 群組
    userbot_groups = get_userbot_chats()
    if not userbot_groups:
        print("無法獲取群組列表")
        return {"new_groups": [], "errors": ["無法獲取群組列表"]}
    
    # 獲取 config 裡的群組
    config_groups = get_config_groups()
    
    # 找出新群組（config 裡沒有的）
    new_groups = []
    for group in userbot_groups:
        chat_id = str(group["id"])
        if chat_id not in config_groups:
            new_groups.append(group)
    
    if not new_groups:
        print("✅ 沒有發現新群組")
        return {"new_groups": [], "synced": []}
    
    print(f"📢 發現 {len(new_groups)} 個新群組")
    
    synced = []
    errors = []
    
    for group in new_groups:
        chat_id = group["id"]
        chat_name = group["name"]
        print(f"\n處理: {chat_name} ({chat_id})")
        
        # 1. 檢查 bot 是否在群裡（安全檢查：杜甫在 + bot 在 = 才加）
        if not is_bot_in_group(chat_id):
            print(f"  ⏭️ Bot 不在群裡，跳過（等杜甫邀請 bot 後再同步）")
            continue
        
        # 2. 加進 config
        if add_group_to_config(chat_id):
            print(f"  ✓ 已加入 config")
            
            synced.append({
                "id": chat_id,
                "name": chat_name
            })
        else:
            errors.append(f"無法添加 {chat_name} 到 config")
    
    result = {
        "new_groups": [{"id": g["id"], "name": g["name"]} for g in new_groups],
        "synced": synced,
        "errors": errors
    }
    
    if synced:
        print(f"\n🎉 已同步 {len(synced)} 個新群組")
        print("⚠️ 需要重啟 Gateway 才能生效")
    
    # JSON 輸出供程式使用
    print("\n--- JSON ---")
    print(json.dumps(result, ensure_ascii=False))
    
    return result

if __name__ == "__main__":
    main()
