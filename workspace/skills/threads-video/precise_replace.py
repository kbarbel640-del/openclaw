#!/usr/bin/env python3
"""
Precise replacement - cut YunJhe's AI completely, insert George's AI
Using pydub for more precise audio editing
"""
from pydub import AudioSegment
import os

OUTPUT_DIR = "/Users/sulaxd/clawd/skills/threads-video/output"
GEORGE = f"{OUTPUT_DIR}/voice_elevenlabs.mp3"
YUNJHE = f"{OUTPUT_DIR}/voice_yunjhe.mp3"
OUTPUT = f"{OUTPUT_DIR}/voice_precise.mp3"

print("🎙️ Loading audio files...")
george = AudioSegment.from_mp3(GEORGE)
yunjhe = AudioSegment.from_mp3(YUNJHE)

print(f"   George duration: {len(george)}ms")
print(f"   YunJhe duration: {len(yunjhe)}ms")

# YunJhe timestamps (from careful analysis):
# "你用" ends around 450-500ms
# "AI" is from ~500ms to ~850ms
# "省下的時間" starts around ~850ms
# Second "AI" is around 5240-5600ms

# George timestamps:
# First "AI" is around 400-700ms
# Second "AI" is around 5050-5350ms

print("\n🔪 Extracting segments...")

# Extract George's AI pronunciations
george_ai1 = george[400:700]  # First "AI"
george_ai2 = george[5050:5350]  # Second "AI"

print(f"   George AI 1: {len(george_ai1)}ms")
print(f"   George AI 2: {len(george_ai2)}ms")

# Split YunJhe into parts (excluding his AI)
yunjhe_part1 = yunjhe[0:500]      # "你用"
yunjhe_part2 = yunjhe[850:5240]   # "省下的時間...別騙自己"
yunjhe_part3 = yunjhe[5600:]      # "不是讓你變強...到結尾"

print(f"   YunJhe part 1 (你用): {len(yunjhe_part1)}ms")
print(f"   YunJhe part 2 (省下...別騙): {len(yunjhe_part2)}ms")
print(f"   YunJhe part 3 (不是...結尾): {len(yunjhe_part3)}ms")

# Combine: 你用 + [George AI] + 省下...別騙 + [George AI] + 不是...結尾
print("\n🔧 Combining...")
result = yunjhe_part1 + george_ai1 + yunjhe_part2 + george_ai2 + yunjhe_part3

print(f"   Result duration: {len(result)}ms")

# Export
result.export(OUTPUT, format="mp3")
size_kb = os.path.getsize(OUTPUT) / 1024
print(f"\n✅ Done! {OUTPUT}")
print(f"   Size: {size_kb:.1f} KB")
