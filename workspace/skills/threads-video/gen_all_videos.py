#!/usr/bin/env python3
"""
Generate videos for all AI variants
"""
import os
from moviepy import *
from PIL import Image, ImageDraw, ImageFont
import numpy as np

SKILL_DIR = "/Users/sulaxd/clawd/skills/threads-video"
OUTPUT_DIR = f"{SKILL_DIR}/output"
BGM_FILE = f"{SKILL_DIR}/assets/bgm.mp3"

WIDTH = 1080
HEIGHT = 1920
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_SIZE_NORMAL = 72
FONT_SIZE_EMPHASIS = 96

VARIANTS = [
    "v1_AI",
    "v2_Ai", 
    "v3_ai",
    "v4_A_I",
    "v5_dot",
    "v6_full",
]

# Base subtitles (timing from YunJhe original)
def get_subtitles(ai1, ai2):
    return [
        (0.00, 1.72, f"你用 {ai1} 省下的時間", False),
        (1.72, 3.42, "最後都去刷抖音了", False),
        (3.42, 5.24, "別騙自己", True),
        (5.24, 7.86, f"{ai2} 不是讓你變強", False),
        (7.86, 9.34, "是讓你更會逃避", False),
        (9.34, 11.54, "真正的用法？", False),
        (11.54, 13.58, "買回注意力", True),
        (13.58, 16.00, "不是時間", True),
    ]

AI_MAP = {
    "v1_AI": ("AI", "AI"),
    "v2_Ai": ("AI", "Ai"),
    "v3_ai": ("AI", "ai"),
    "v4_A_I": ("AI", "A I"),
    "v5_dot": ("AI", "A.I."),
    "v6_full": ("ＡＩ", "ＡＩ"),
}

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

def make_video(variant):
    voice_file = f"{OUTPUT_DIR}/voice_{variant}.mp3"
    output_file = f"{OUTPUT_DIR}/video_{variant}.mp4"
    
    ai1, ai2 = AI_MAP[variant]
    subtitles = get_subtitles(ai1, ai2)
    
    def make_frame(t):
        for start, end, text, emphasis in subtitles:
            if start <= t < end:
                return create_text_frame(text, emphasis)
        return create_text_frame("", False)
    
    print(f"🎬 {variant}: AI1={ai1}, AI2={ai2}")
    
    audio = AudioFileClip(voice_file)
    duration = audio.duration
    
    video = VideoClip(make_frame, duration=duration)
    video = video.with_fps(30)
    
    bgm = AudioFileClip(BGM_FILE).with_volume_scaled(0.15)
    final_audio = CompositeAudioClip([audio, bgm.with_duration(duration)])
    video = video.with_audio(final_audio)
    
    video.write_videofile(
        output_file,
        fps=30,
        codec='libx264',
        audio_codec='aac',
        audio_bitrate='128k',
        preset='fast',
        threads=4,
        logger=None
    )
    
    size_kb = os.path.getsize(output_file) / 1024
    print(f"   ✅ {output_file} ({size_kb:.0f} KB)\n")

print("🎬 Generating all video variants...\n")
for v in VARIANTS:
    make_video(v)
print("✅ All done!")
