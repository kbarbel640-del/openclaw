#!/usr/bin/env python3
import os
from moviepy import *
from PIL import Image, ImageDraw, ImageFont
import numpy as np

SKILL_DIR = "/Users/sulaxd/clawd/skills/threads-video"
OUTPUT_DIR = f"{SKILL_DIR}/output"
VOICE_FILE = f"{OUTPUT_DIR}/voice_dofu_v2.mp3"
BGM_FILE = f"{SKILL_DIR}/assets/bgm.mp3"
OUTPUT_FILE = f"{OUTPUT_DIR}/video-12-dofu-v2.mp4"

WIDTH, HEIGHT = 1080, 1920
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"

SUBTITLES = [
    (0.00, 1.72, "你用 AI 省下的時間", False),
    (1.72, 3.42, "最後都去刷抖音了", False),
    (3.42, 5.24, "別騙自己", True),
    (5.24, 6.36, "", False),
    (6.36, 7.72, "AI 不是讓你變強", False),
    (7.72, 9.20, "是讓你更會逃避", False),
    (9.20, 11.40, "真正的用法？", False),
    (11.40, 13.44, "買回注意力", True),
    (13.44, 15.57, "不是時間", True),
]

def create_text_frame(text, emphasis=False, size=(WIDTH, HEIGHT)):
    img = Image.new("RGB", size, color="black")
    draw = ImageDraw.Draw(img)
    if not text: return np.array(img)
    font_size = 96 if emphasis else 72
    try: font = ImageFont.truetype(FONT_PATH, font_size)
    except: font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (size[0] - (bbox[2] - bbox[0])) // 2
    y = (size[1] - (bbox[3] - bbox[1])) // 2
    draw.text((x, y), text, font=font, fill="white")
    return np.array(img)

def make_frame(t):
    for start, end, text, emphasis in SUBTITLES:
        if start <= t < end: return create_text_frame(text, emphasis)
    return create_text_frame("", False)

print("🎬 Creating video with Dofu's AI clip...")
audio = AudioFileClip(VOICE_FILE)
video = VideoClip(make_frame, duration=audio.duration).with_fps(30)
bgm = AudioFileClip(BGM_FILE).with_volume_scaled(0.15)
video = video.with_audio(CompositeAudioClip([audio, bgm.with_duration(audio.duration)]))
video.write_videofile(OUTPUT_FILE, fps=30, codec="libx264", audio_codec="aac", audio_bitrate="128k", preset="fast", threads=4, logger=None)
print(f"✅ Done: {OUTPUT_FILE}")
