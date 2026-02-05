#!/usr/bin/env python3
"""
LINE Push Message 工具
用法：python send.py <group_id> "訊息內容"
"""

import sys
import httpx

TOKEN = "MSw4CiIT7VUkNgyM/dybttiL1XaKxtHAbg/PiLEWvegkeiOpzKw1uRoip+FereFiT6fxBMlKRuHsheP2xU2Rg5AjmDlGZAif7s2/MZHfCwtIEF84QD6XjWloKFqXPjR+6IW8m1GZc/pfyGc+ylDBNgdB04t89/1O/w1cDnyilFU="

# 群組快捷
GROUPS = {
    "爬山": "C51ba089b96b952137055c303bf87006f",
}

def send(to: str, message: str):
    # 支援快捷名稱
    target = GROUPS.get(to, to)
    
    resp = httpx.post(
        "https://api.line.me/v2/bot/message/push",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TOKEN}"
        },
        json={
            "to": target,
            "messages": [{"type": "text", "text": message}]
        }
    )
    
    if resp.status_code == 200:
        print(f"✅ 已發送到 {to}")
    else:
        print(f"❌ 錯誤: {resp.status_code}")
        print(resp.text)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python send.py <group_id|快捷名> '訊息'")
        print("快捷: 爬山")
        sys.exit(1)
    
    send(sys.argv[1], sys.argv[2])
