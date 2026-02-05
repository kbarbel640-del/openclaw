#!/usr/bin/env python3
"""
Dad Companion - Telegram 版語音發送
用法: python3 send_telegram.py --slot morning|lunch|afternoon|dinner|night [--dry-run]

流程：生成講稿 → ElevenLabs TTS → Telegram Bot sendVoice
比 LINE 版簡單：不需要 ffmpeg 轉碼、不需要 ngrok
"""

import argparse
import json
import os
import sys
import random
from datetime import datetime, timezone, timedelta
import urllib.request

# === 設定 ===
ELEVENLABS_API_KEY = "sk_3104bbde53dd3b6716a7df321eecd3ea98425bb3d5a31507"
ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # George - 暖心說書人
ELEVENLABS_MODEL = "eleven_multilingual_v2"
BOT_TOKEN = "8327498414:AAFVEs7Ouf6JESIWGpLnD77GvJkxe9uXp68"  # 無極 bot
DAD_CHAT_ID = ""  # TODO: 爸爸的 Telegram chat_id

TPE = timezone(timedelta(hours=8))

# === 台灣俗語庫 ===
PROVERBS = [
    "食飯皇帝大", "一日之計在於晨", "天公疼好人",
    "歹竹出好筍", "有量才有福", "好天著存雨來糧",
    "一枝草一點露", "食果子拜樹頭", "三分天注定，七分靠打拼",
    "人情留一線，日後好相看", "做人著認份，做事著認真",
    "吃虧就是佔便宜", "有燒香就有保庇", "船到橋頭自然直",
    "呷緊弄破碗", "細姨仔生的也是人", "龜笑鱉無尾",
    "半路認老爸", "偷雞也要蝕把米", "生吃都不夠，哪有通曬乾",
]

# === 小故事庫（台灣老時光）===
STORIES = [
    "以前阿公那個年代，過年都要自己做年糕。一家人圍在灶腳，小孩子在旁邊偷吃花生。那個味道，到現在都還記得啊。",
    "你知道嗎，台灣以前火車站都有賣便當的阿伯。一個鐵盒子，排骨飯配酸菜，熱騰騰的。現在想起來都會流口水。",
    "以前鄉下夏天，小孩子都跑去溪邊抓蝦。水涼涼的，太陽大大的，玩到傍晚才回家。媽媽在門口等著罵人，但還是留了飯。",
    "老一輩的人常說，灶腳是一個家的心臟。不管外面多辛苦，回到家聞到飯菜香，什麼煩惱都沒了啊。",
    "台灣的廟會真的很熱鬧。小時候最期待拜拜完可以吃的東西，那個三層肉配筍乾，比什麼大餐都好吃。",
    "以前家裡養雞，早上天還沒亮，公雞就在叫了。阿嬤會去撿雞蛋，煎一個荷包蛋給你吃，那是最幸福的早餐。",
    "記不記得以前的柑仔店，什麼都賣。一塊錢可以買一包王子麵，捏碎了撒調味粉，邊走邊吃。",
    "以前過年最開心的就是拿紅包，然後媽媽會說「來，我幫你存起來」。到現在也不知道存到哪裡去了啊。",
    "早期台灣農村，大家互相幫忙收割稻子。今天幫你家，明天幫我家。那種人情味，現在很少見了。",
    "以前沒有冷氣，夏天晚上全家搬椅子到門口乘涼。看星星，聽蟲叫，隔壁鄰居也出來，大家聊天到很晚。",
]


def get_weather():
    """取得苗栗天氣"""
    try:
        url = "https://wttr.in/Miaoli,Taiwan?format=%t+%C&lang=zh-tw"
        req = urllib.request.Request(url, headers={"User-Agent": "curl/7.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode().strip()
    except:
        return "天氣還不錯"


def get_solar_term():
    """取得最近的節氣"""
    now = datetime.now(TPE)
    month, day = now.month, now.day
    
    terms = [
        (1, 5, "小寒"), (1, 20, "大寒"), (2, 3, "立春"), (2, 18, "雨水"),
        (3, 5, "驚蟄"), (3, 20, "春分"), (4, 4, "清明"), (4, 19, "穀雨"),
        (5, 5, "立夏"), (5, 20, "小滿"), (6, 5, "芒種"), (6, 21, "夏至"),
        (7, 6, "小暑"), (7, 22, "大暑"), (8, 7, "立秋"), (8, 22, "處暑"),
        (9, 7, "白露"), (9, 22, "秋分"), (10, 8, "寒露"), (10, 23, "霜降"),
        (11, 7, "立冬"), (11, 22, "小雪"), (12, 6, "大雪"), (12, 21, "冬至"),
    ]
    
    closest, min_diff = None, 999
    for m, d, name in terms:
        diff = abs((month - m) * 30 + (day - d))
        if diff < min_diff:
            min_diff = diff
            closest = name
    
    if min_diff <= 2:
        return f"，剛好是{closest}"
    elif min_diff <= 5:
        return f"，快到{closest}了"
    return ""


def generate_script(slot):
    """生成講稿 — 自然台灣口語，不用「喔」結尾"""
    now = datetime.now(TPE)
    weather = get_weather()
    solar = get_solar_term()
    weekday = ["一", "二", "三", "四", "五", "六", "日"][now.weekday()]
    
    random.seed(now.strftime("%Y%m%d") + slot)
    
    if slot == "morning":
        base = f"爸，早安啊。今天星期{weekday}{solar}。外面{weather}。"
        base += "起來動一動，吃個早餐，今天也要健健康康的。"
        
    elif slot == "lunch":
        proverb = random.choice(PROVERBS)
        base = f"爸，中午了，該吃飯啦。台灣人講「{proverb}」，吃飽才有力氣。慢慢吃，不要急。"
        
    elif slot == "afternoon":
        story = random.choice(STORIES)
        base = f"爸，下午了，喝杯茶休息一下。跟你說個事情。{story}"
        
    elif slot == "dinner":
        base = f"爸，再半個小時就吃晚餐了。今天外面{weather}。先去洗個手，等一下就開飯啦。"
        
    elif slot == "night":
        base = f"爸，晚安啦。今天辛苦了，早點休息。明天又是新的一天，我們明天早上見。"
        
    else:
        base = f"爸，{weather}，記得注意身體啊。"
    
    return base


def text_to_speech(text, output_path):
    """ElevenLabs TTS → OGG (Telegram 語音最佳格式)"""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    data = json.dumps({
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
    print(f"TTS: {size} bytes → {output_path}")
    return size > 1000


def send_telegram_voice(audio_path):
    """Telegram Bot API sendVoice"""
    if not DAD_CHAT_ID:
        print("ERROR: DAD_CHAT_ID not set!")
        return False
    
    import http.client
    import mimetypes
    
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    
    with open(audio_path, "rb") as f:
        audio_data = f.read()
    
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="chat_id"\r\n\r\n'
        f"{DAD_CHAT_ID}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="voice"; filename="voice.mp3"\r\n'
        f"Content-Type: audio/mpeg\r\n\r\n"
    ).encode() + audio_data + f"\r\n--{boundary}--\r\n".encode()
    
    conn = http.client.HTTPSConnection("api.telegram.org")
    conn.request("POST", f"/bot{BOT_TOKEN}/sendVoice", body,
                 {"Content-Type": f"multipart/form-data; boundary={boundary}"})
    
    resp = conn.getresponse()
    result = json.loads(resp.read())
    print(f"Telegram: {resp.status} ok={result.get('ok')}")
    return result.get("ok", False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--slot", required=True, 
                       choices=["morning", "lunch", "afternoon", "dinner", "night"])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    
    print(f"=== Dad Companion [{args.slot}] ===")
    
    # 1. 生成講稿
    script = generate_script(args.slot)
    print(f"📝 {script}")
    
    # 2. TTS
    mp3_path = "/tmp/dad_voice.mp3"
    if not text_to_speech(script, mp3_path):
        print("❌ TTS failed!")
        sys.exit(1)
    
    if args.dry_run:
        print(f"✅ [DRY RUN] script={len(script)}字 audio={os.path.getsize(mp3_path)}bytes")
        return
    
    # 3. 發送
    if send_telegram_voice(mp3_path):
        print("✅ 發送成功！")
    else:
        print("❌ 發送失敗")
        sys.exit(1)


if __name__ == "__main__":
    main()
