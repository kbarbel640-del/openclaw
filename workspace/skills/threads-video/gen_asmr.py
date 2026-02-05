#!/usr/bin/env python3
"""
ASMR version with shimmer voice (slower, softer)
"""
import os
from moviepy import *
from PIL import Image, ImageDraw, ImageFont
import numpy as np

SKILL_DIR = "/Users/sulaxd/clawd/skills/threads-video"
OUTPUT_DIR = f"{SKILL_DIR}/output"
VOICE_FILE = f"{OUTPUT_DIR}/voice_shimmer.mp3"
BGM_FILE = f"{SKILL_DIR}/assets/bgm.mp3"
OUTPUT_FILE = f"{OUTPUT_DIR}/video-02-asmr.mp4"

WIDTH = 1080
HEIGHT = 1920
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_SIZE_NORMAL = 72
FONT_SIZE_EMPHASIS = 96

# Shimmer voice timing (0.9x speed, softer)
SUBTITLES = [
    (0.00, 1.60, "你用 AI 省下的時間", False),
    (1.60, 3.10, "最後都去刷抖音了", False),
    (3.10, 4.66, "別騙自己", True),
    (4.66, 6.94, "AI 不是讓你變強", False),
    (6.94, 8.88, "是讓你更會逃避", False),
    (8.88, 11.00, "真正的用法？", False),
    (11.00, 13.04, "買回注意力", True),
    (13.04, 15.00, "不是時間", True),
]

def create_text_frame(text, emphasis=False, size=(WIDTH, HEIGHT)):
    img = Image.new('RGB', size, color='black')
    draw = ImageDraw.Draw(img)
    
    font_size = FONT_SIZE_EMPHASIS if emphasis else FONT_SIZE_NORMAL
    try:
        font = ImageFont.truetype(FONT_PATH, font_size)
    except:
        font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size[0] - text_width) // 2
    y = (size[1] - text_height) // 2
    
    draw.text((x, y), text, font=font, fill='white')
    return np.array(img)

def make_frame(t):
    for start, end, text, emphasis in SUBTITLES:
        if start <= t < end:
            return create_text_frame(text, emphasis)
    return create_text_frame("", False)

print("🎬 Creating ASMR version with shimmer voice...")

audio = AudioFileClip(VOICE_FILE)
duration = audio.duration
print(f"   Audio duration: {duration:.2f}s")

video = VideoClip(make_frame, duration=duration)
video = video.with_fps(30)

# Lower BGM volume for ASMR effect
bgm = AudioFileClip(BGM_FILE).with_volume_scaled(0.10)  # Even softer
final_audio = CompositeAudioClip([audio, bgm.with_duration(duration)])
video = video.with_audio(final_audio)

print("📹 Rendering...")
video.write_videofile(
    OUTPUT_FILE,
    fps=30,
    codec='libx264',
    audio_codec='aac',
    audio_bitrate='128k',
    preset='fast',
    threads=4,
    logger=None
)

print(f"\n✅ Done! {OUTPUT_FILE}")
print(f"   Size: {os.path.getsize(OUTPUT_FILE) / 1024:.0f} KB")
