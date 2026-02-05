#!/usr/bin/env python3
"""
Generate final version with self-deprecating ending
"""
import asyncio
import edge_tts
import os
from moviepy import *
from PIL import Image, ImageDraw, ImageFont
import numpy as np

SKILL_DIR = "/Users/sulaxd/clawd/skills/threads-video"
OUTPUT_DIR = f"{SKILL_DIR}/output"
BGM_FILE = f"{SKILL_DIR}/assets/bgm.mp3"

# New script - shorter, self-deprecating ending
SCRIPT = """你用 AI 省下的時間，最後都去刷抖音了。
別騙自己。
AI 不是讓你變強，是讓你更會逃避。
我也是。"""

async def generate_voice():
    print("🎙️ Generating new voice...")
    output_file = f"{OUTPUT_DIR}/voice_final_v2.mp3"
    communicate = edge_tts.Communicate(SCRIPT, "zh-TW-YunJheNeural", rate="-5%")
    await communicate.save(output_file)
    print(f"   ✅ {output_file}")
    return output_file

asyncio.run(generate_voice())
