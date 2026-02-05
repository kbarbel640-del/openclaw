#!/usr/bin/env python3
"""
Generate voice using ElevenLabs API
"""
import requests
import os

API_KEY = "sk_3104bbde53dd3b6716a7df321eecd3ea98425bb3d5a31507"
VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # George - 暖心說書人

OUTPUT_DIR = "/Users/sulaxd/clawd/skills/threads-video/output"
OUTPUT_FILE = f"{OUTPUT_DIR}/voice_elevenlabs.mp3"

# 腳本 - 用「AI」不是「人工智能」
SCRIPT = """你用 AI 省下的時間，最後都去刷抖音了。
別騙自己。
AI 不是讓你變強，是讓你更會逃避。
真正的用法？買回注意力，不是時間。"""

def generate():
    print("🎙️ Generating voice with ElevenLabs...")
    print(f"   Voice: George ({VOICE_ID})")
    
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": API_KEY
    }
    
    data = {
        "text": SCRIPT,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.8,
            "style": 0.3,  # More expressive
            "use_speaker_boost": True
        }
    }
    
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code == 200:
        with open(OUTPUT_FILE, "wb") as f:
            f.write(response.content)
        size_kb = os.path.getsize(OUTPUT_FILE) / 1024
        print(f"✅ Generated: {OUTPUT_FILE}")
        print(f"   Size: {size_kb:.1f} KB")
        return OUTPUT_FILE
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        return None

if __name__ == "__main__":
    generate()
