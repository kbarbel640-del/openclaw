#!/usr/bin/env python3
"""
Dad Companion - 生成語音並推送到 LINE
用法: python3 generate_and_send.py --slot morning|lunch|afternoon|dinner|night [--dry-run]
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
import urllib.request
import urllib.parse

# === 設定 ===
ELEVENLABS_API_KEY = "sk_3104bbde53dd3b6716a7df321eecd3ea98425bb3d5a31507"
ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # George
ELEVENLABS_MODEL = "eleven_multilingual_v2"
LINE_ACCESS_TOKEN = "MSw4CiIT7VUkNgyM/dybttiL1XaKxtHAbg/PiLEWvegkeiOpzKw1uRoip+FereFiT6fxBMlKRuHsheP2xU2Rg5AjmDlGZAif7s2/MZHfCwtIEF84QD6XjWloKFqXPjR+6IW8m1GZc/pfyGc+ylDBNgdB04t89/1O/w1cDnyilFU="
LINE_TARGET_ID = ""  # TODO: 填入爸爸的 LINE userId
NGROK_BASE_URL = ""  # TODO: 填入最新 ngrok URL
OUTPUT_DIR = "/Users/sulaxd/clawd/output"

TPE = timezone(timedelta(hours=8))

# === 台灣俗語庫 ===
PROVERBS = [
    "食飯皇帝大",
    "一日之計在於晨",
    "天公疼好人",
    "細漢偷挽匏，大漢偷牽牛",
    "歹竹出好筍",
    "做牛著拖，做人著磨",
    "有量才有福",
    "甘願做牛，毋驚無犁通拖",
    "好天著存雨來糧",
    "一枝草一點露",
    "食果子拜樹頭",
    "三分天注定，七分靠打拼",
    "有錢判生，無錢判死",
    "人情留一線，日後好相看",
    "西北雨直直落",
]

# === 小故事庫 ===
STORIES = [
    "以前阿公那個年代，過年都要自己包粽子。一家人圍在灶腳，一邊包一邊聊天，小孩子在旁邊偷吃花生。那個味道到現在都還記得。",
    "你知道嗎，台灣以前火車站都有賣便當的阿伯。一個鐵盒子，排骨飯配酸菜，熱騰騰的。現在想起來都會流口水。",
    "以前鄉下夏天，小孩子都跑去溪邊抓蝦。水涼涼的，太陽大大的，玩到傍晚才回家。媽媽在門口等著，手上拿著拖鞋。",
    "老一輩的人常說，灶腳是一個家的心臟。不管外面多辛苦，回到家聞到飯菜香，什麼煩惱都沒了。",
    "台灣的廟會真的很熱鬧。小時候最期待的就是拜拜完可以吃拜拜的東西，那個三層肉配筍乾，比什麼大餐都好吃。",
]


def get_weather():
    """取得苗栗天氣"""
    try:
        url = "https://wttr.in/Miaoli,Taiwan?format=%t+%C&lang=zh-tw"
        req = urllib.request.Request(url, headers={"User-Agent": "curl/7.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode().strip()
    except:
        return "天氣不錯"


def get_lunar_date():
    """取得農曆日期（簡易版）"""
    now = datetime.now(TPE)
    # 簡易版：用節氣/月份提示
    month = now.month
    day = now.day
    
    solar_terms = {
        (2, 3): "立春", (2, 18): "雨水",
        (3, 5): "驚蟄", (3, 20): "春分",
        (4, 4): "清明", (4, 19): "穀雨",
        (5, 5): "立夏", (5, 20): "小滿",
        (6, 5): "芒種", (6, 21): "夏至",
        (7, 6): "小暑", (7, 22): "大暑",
        (8, 7): "立秋", (8, 22): "處暑",
        (9, 7): "白露", (9, 22): "秋分",
        (10, 8): "寒露", (10, 23): "霜降",
        (11, 7): "立冬", (11, 22): "小雪",
        (12, 6): "大雪", (12, 21): "冬至",
        (1, 5): "小寒", (1, 20): "大寒",
    }
    
    # 找最近的節氣
    closest = None
    min_diff = 999
    for (m, d), name in solar_terms.items():
        diff = abs((month - m) * 30 + (day - d))
        if diff < min_diff:
            min_diff = diff
            closest = name
    
    if min_diff <= 2:
        return f"今天剛好是{closest}"
    elif min_diff <= 5:
        return f"快到{closest}了"
    return ""


def generate_script(slot):
    """生成講稿"""
    now = datetime.now(TPE)
    weather = get_weather()
    lunar = get_lunar_date()
    weekday = ["一", "二", "三", "四", "五", "六", "日"][now.weekday()]
    
    import random
    random.seed(now.strftime("%Y%m%d") + slot)
    
    if slot == "morning":
        base = f"爸，早安啊。今天星期{weekday}。外面{weather}。"
        if lunar:
            base += f"{lunar}。"
        base += "起來活動活動，吃個早餐，今天也要健健康康的。"
        
    elif slot == "lunch":
        proverb = random.choice(PROVERBS)
        base = f"爸，中午了，該吃飯啦。台灣人講「{proverb}」，吃飽才有力氣。慢慢吃，不要急。"
        
    elif slot == "afternoon":
        story = random.choice(STORIES)
        base = f"爸，下午了，喝杯茶休息一下。跟你講個事情。{story}"
        
    elif slot == "dinner":
        base = f"爸，再半個小時就吃晚餐了。今天外面{weather}。先去洗個手，等一下就開飯啦。"
        
    elif slot == "night":
        base = f"爸，晚安啦。今天辛苦了，早點休息。明天又是新的一天，我們明天早上見。"
        
    else:
        base = f"爸，{weather}，記得注意身體。"
    
    return base


def text_to_speech(text, output_path):
    """ElevenLabs TTS"""
    import json as json_mod
    
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    data = json_mod.dumps({
        "text": text,
        "model_id": ELEVENLABS_MODEL,
        "voice_settings": {
            "stability": 0.55,
            "similarity_boost": 0.75
        }
    }).encode()
    
    req = urllib.request.Request(url, data=data, headers={
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    })
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        with open(output_path, "wb") as f:
            f.write(resp.read())
    
    size = os.path.getsize(output_path)
    print(f"TTS done: {size} bytes -> {output_path}")
    return size > 1000


def convert_to_m4a(mp3_path, m4a_path):
    """ffmpeg 轉換"""
    cmd = f"ffmpeg -y -i {mp3_path} -c:a aac -b:a 128k -f mp4 -movflags +faststart {m4a_path} 2>&1 | tail -1"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    return os.path.exists(m4a_path) and os.path.getsize(m4a_path) > 1000


def get_duration_ms(m4a_path):
    """取得音檔長度（毫秒）"""
    cmd = f"ffprobe -v quiet -show_entries format=duration -of csv=p=0 {m4a_path}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
    try:
        return int(float(result.stdout.strip()) * 1000)
    except:
        return 10000  # fallback 10s


def send_line_audio(m4a_url, duration_ms):
    """LINE Push API 發語音"""
    if not LINE_TARGET_ID:
        print("ERROR: LINE_TARGET_ID not set!")
        return False
    
    data = json.dumps({
        "to": LINE_TARGET_ID,
        "messages": [{
            "type": "audio",
            "originalContentUrl": m4a_url,
            "duration": duration_ms
        }]
    }).encode()
    
    req = urllib.request.Request(
        "https://api.line.me/v2/bot/message/push",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LINE_ACCESS_TOKEN}"
        }
    )
    
    with urllib.request.urlopen(req, timeout=10) as resp:
        print(f"LINE push: {resp.status}")
        return resp.status == 200


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--slot", required=True, choices=["morning", "lunch", "afternoon", "dinner", "night"])
    parser.add_argument("--dry-run", action="store_true", help="只生成不發送")
    args = parser.parse_args()
    
    print(f"=== Dad Companion: {args.slot} ===")
    
    # 1. 生成講稿
    script = generate_script(args.slot)
    print(f"Script: {script}")
    
    # 2. TTS
    mp3_path = os.path.join(OUTPUT_DIR, "dad_voice.mp3")
    if not text_to_speech(script, mp3_path):
        print("TTS failed!")
        sys.exit(1)
    
    if args.dry_run:
        print(f"[DRY RUN] Would send: {mp3_path}")
        print(json.dumps({"ok": True, "dry_run": True, "script": script, "mp3": mp3_path}))
        return
    
    # 3. 轉 m4a
    m4a_path = os.path.join(OUTPUT_DIR, "dad_voice.m4a")
    if not convert_to_m4a(mp3_path, m4a_path):
        print("FFmpeg convert failed!")
        sys.exit(1)
    
    # 4. 取 duration
    duration_ms = get_duration_ms(m4a_path)
    print(f"Duration: {duration_ms}ms")
    
    # 5. LINE 發送
    m4a_url = f"{NGROK_BASE_URL}/dad_voice.m4a"
    if send_line_audio(m4a_url, duration_ms):
        print("Sent successfully!")
    else:
        print("Send failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
