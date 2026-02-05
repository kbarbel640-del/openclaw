#!/usr/bin/env python3
"""
Generate voice using Edge TTS (YunJhe - Taiwan male)
"""
import asyncio
import edge_tts
import os

OUTPUT_DIR = "/Users/sulaxd/clawd/skills/threads-video/output"
OUTPUT_FILE = f"{OUTPUT_DIR}/voice_yunjhe.mp3"

# 腳本
SCRIPT = """你用 AI 省下的時間，最後都去刷抖音了。
別騙自己。
AI 不是讓你變強，是讓你更會逃避。
真正的用法？買回注意力，不是時間。"""

async def generate():
    print("🎙️ Generating voice with Edge TTS...")
    print("   Voice: YunJhe (zh-TW-YunJheNeural)")
    
    communicate = edge_tts.Communicate(
        SCRIPT, 
        "zh-TW-YunJheNeural",
        rate="-5%"  # slightly slower
    )
    await communicate.save(OUTPUT_FILE)
    
    size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"✅ Generated: {OUTPUT_FILE}")
    print(f"   Size: {size_kb:.1f} KB")

if __name__ == "__main__":
    asyncio.run(generate())
