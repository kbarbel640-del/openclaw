#!/usr/bin/env python3
"""
Andrew 考勤抽查檢測 v2
使用 HTTP Bridge API，避免 sqlite lock 衝突
"""

import json
import urllib.request
from datetime import datetime, timezone, timedelta

BRIDGE_URL = "http://127.0.0.1:18790"
ATTENDANCE_CHAT_ID = "-1002860663272"  # G9 考勤群


def get_messages(limit=20):
    """從 bridge 取得考勤群訊息"""
    url = f"{BRIDGE_URL}/messages?session=andrew&chat={ATTENDANCE_CHAT_ID}&limit={limit}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return json.load(resp).get("messages", [])
    except Exception as e:
        print(json.dumps({"error": str(e), "needs_alert": False}))
        return []


def main():
    messages = get_messages()
    if not messages:
        print(json.dumps({"needs_alert": False, "error": "No messages or API error"}))
        return
    
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)
    
    vicky_check_time = None
    vicky_check_id = None
    andrew_replied = False
    
    for m in messages:
        sender = m.get("sender", "")
        text = m.get("text", "")
        msg_date = datetime.fromisoformat(m.get("date", "").replace("Z", "+00:00"))
        
        # 找 Vicky 的抽查訊息（1 小時內）
        if "Vicky" in sender and ("抽查" in text or "回复" in text or "回復" in text):
            if msg_date >= one_hour_ago:
                vicky_check_time = msg_date
                vicky_check_id = m.get("id")
    
    # 如果有抽查，檢查 Andrew 是否已回覆
    if vicky_check_time:
        for m in messages:
            sender = m.get("sender", "")
            msg_date = datetime.fromisoformat(m.get("date", "").replace("Z", "+00:00"))
            
            if "Andrew" in sender and msg_date > vicky_check_time:
                andrew_replied = True
                break
    
    result = {
        "needs_alert": vicky_check_time is not None and not andrew_replied,
        "has_check": vicky_check_time is not None,
        "andrew_replied": andrew_replied,
        "vicky_check_time": str(vicky_check_time) if vicky_check_time else None,
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
