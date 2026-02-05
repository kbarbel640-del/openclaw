#!/usr/bin/env python3
"""
Generate video with precise subtitle sync using moviepy
"""
import os
from moviepy import *
from PIL import Image, ImageDraw, ImageFont
import numpy as np

# Paths
SKILL_DIR = "/Users/sulaxd/clawd/skills/threads-video"
OUTPUT_DIR = f"{SKILL_DIR}/output"
VOICE_FILE = f"{OUTPUT_DIR}/voice_v3_script.mp3"
BGM_FILE = f"{SKILL_DIR}/assets/bgm.mp3"
OUTPUT_FILE = f"{OUTPUT_DIR}/video-02-moviepy.mp4"

# Video dimensions (9:16 vertical)
WIDTH = 1080
HEIGHT = 1920

# Font
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_SIZE_NORMAL = 72
FONT_SIZE_EMPHASIS = 96

# Whisper timing (from actual transcription)
SUBTITLES = [
    (0.00, 2.98, "你用 AI 省下的時間\n最後都去刷抖音了", False),
    (2.98, 4.76, "別騙自己", True),  # emphasis
    (4.76, 7.10, "AI 不是讓你變強", False),
    (7.10, 8.46, "是讓你更會逃避", False),
    (8.46, 10.44, "真正的用法？", False),
    (10.44, 12.28, "買回注意力", True),  # emphasis
    (12.28, 14.18, "不是時間", True),  # emphasis
]

def create_text_frame(text, emphasis=False, size=(WIDTH, HEIGHT)):
    """Create a frame with centered text on black background"""
    img = Image.new('RGB', size, color='black')
    draw = ImageDraw.Draw(img)
    
    font_size = FONT_SIZE_EMPHASIS if emphasis else FONT_SIZE_NORMAL
    try:
        font = ImageFont.truetype(FONT_PATH, font_size)
    except:
        font = ImageFont.load_default()
    
    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Center text
    x = (size[0] - text_width) // 2
    y = (size[1] - text_height) // 2
    
    draw.text((x, y), text, font=font, fill='white')
    
    return np.array(img)

def make_frame(t):
    """Generate frame at time t"""
    for start, end, text, emphasis in SUBTITLES:
        if start <= t < end:
            return create_text_frame(text, emphasis)
    # Return black frame if no subtitle
    return create_text_frame("", False)

print("🎬 Creating video with moviepy...")

# Get audio duration
audio = AudioFileClip(VOICE_FILE)
duration = audio.duration
print(f"   Audio duration: {duration:.2f}s")

# Create video clip
video = VideoClip(make_frame, duration=duration)
video = video.with_fps(30)

# Process voice audio (add reverb effect simulation)
# Note: moviepy doesn't have built-in reverb, so we'll skip that for now
# and just use the original voice

# Load BGM and set volume
bgm = AudioFileClip(BGM_FILE).with_volume_scaled(0.15)

# Composite audio: voice + bgm
final_audio = CompositeAudioClip([audio, bgm.with_duration(duration)])

# Set audio to video
video = video.with_audio(final_audio)

# Write output
print("📹 Rendering video...")
video.write_videofile(
    OUTPUT_FILE,
    fps=30,
    codec='libx264',
    audio_codec='aac',
    audio_bitrate='128k',
    preset='fast',
    threads=4,
    logger=None  # Suppress progress bar
)

print(f"\n✅ Done! {OUTPUT_FILE}")
print(f"   Size: {os.path.getsize(OUTPUT_FILE) / 1024:.0f} KB")
