#!/usr/bin/env python3
"""
Generate video with precise AI replacement
"""
import os
from moviepy import *
from PIL import Image, ImageDraw, ImageFont
import numpy as np

SKILL_DIR = "/Users/sulaxd/clawd/skills/threads-video"
OUTPUT_DIR = f"{SKILL_DIR}/output"
VOICE_FILE = f"{OUTPUT_DIR}/voice_precise.mp3"
BGM_FILE = f"{SKILL_DIR}/assets/bgm.mp3"
OUTPUT_FILE = f"{OUTPUT_DIR}/video-07-precise.mp4"

WIDTH = 1080
HEIGHT = 1920
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_SIZE_NORMAL = 72
FONT_SIZE_EMPHASIS = 96

# Timing based on splice points:
# 0-500ms: 你用
# 500-800ms: AI (George)
# 800-5190ms: 省下的時間...別騙自己
# 5190-5490ms: AI (George)
# 5490-end: 不是讓你變強...

SUBTITLES = [
    (0.00, 0.80, "你用 AI", False),
    (0.80, 1.70, "省下的時間", False),
    (1.70, 3.50, "最後都去刷抖音了", False),
    (3.50, 5.19, "別騙自己", True),
    (5.19, 7.80, "AI 不是讓你變強", False),
    (7.80, 9.30, "是讓你更會逃避", False),
    (9.30, 11.50, "真正的用法？", False),
    (11.50, 13.50, "買回注意力", True),
    (13.50, 15.56, "不是時間", True),
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

print("🎬 Creating video with precise AI replacement...")

audio = AudioFileClip(VOICE_FILE)
duration = audio.duration
print(f"   Audio duration: {duration:.2f}s")

video = VideoClip(make_frame, duration=duration)
video = video.with_fps(30)

bgm = AudioFileClip(BGM_FILE).with_volume_scaled(0.15)
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
