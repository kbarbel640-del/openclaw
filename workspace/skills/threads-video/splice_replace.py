#!/usr/bin/env python3
"""
Replace YunJhe's "AI" with George's "AI" pronunciation
(Not mixing - complete replacement)
"""
import subprocess
import os

OUTPUT_DIR = "/Users/sulaxd/clawd/skills/threads-video/output"
GEORGE = f"{OUTPUT_DIR}/voice_elevenlabs.mp3"
YUNJHE = f"{OUTPUT_DIR}/voice_yunjhe.mp3"
OUTPUT = f"{OUTPUT_DIR}/voice_replaced.mp3"

# YunJhe timing:
# [00:00.000 --> 00:01.720] 你用AI省下的时间
#   - "你用" ~0.00-0.50
#   - "AI" ~0.50-0.85  <-- REPLACE THIS
#   - "省下的時間" ~0.85-1.72
# [00:05.240 --> 00:07.860] AI不是让你变强
#   - "AI" ~5.24-5.60  <-- REPLACE THIS
#   - "不是讓你變強" ~5.60-7.86

# George timing:
# "你用AI" - AI is around 0.40-0.70s
# "AI不是" - AI is around 5.05-5.35s

def run(cmd):
    print(f"  $ {cmd[:80]}...")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  Error: {result.stderr}")
    return result

print("🔧 Replacing YunJhe's 'AI' with George's pronunciation...")

# Extract George's "AI" clips
print("\n1️⃣ Extracting George's AI...")
run(f'ffmpeg -y -i "{GEORGE}" -ss 0.40 -t 0.30 -acodec libmp3lame "{OUTPUT_DIR}/g_ai1.mp3"')
run(f'ffmpeg -y -i "{GEORGE}" -ss 5.05 -t 0.30 -acodec libmp3lame "{OUTPUT_DIR}/g_ai2.mp3"')

# Split YunJhe into segments (removing his "AI" parts)
print("\n2️⃣ Splitting YunJhe (removing his AI)...")
# Part 1: "你用" (before first AI)
run(f'ffmpeg -y -i "{YUNJHE}" -ss 0 -t 0.50 -acodec libmp3lame "{OUTPUT_DIR}/y_1.mp3"')
# Part 2: "省下的時間...別騙自己" (after first AI, before second AI)
run(f'ffmpeg -y -i "{YUNJHE}" -ss 0.85 -t 4.39 -acodec libmp3lame "{OUTPUT_DIR}/y_2.mp3"')
# Part 3: "不是讓你變強..." (after second AI to end)
run(f'ffmpeg -y -i "{YUNJHE}" -ss 5.60 -acodec libmp3lame "{OUTPUT_DIR}/y_3.mp3"')

# Concatenate: 你用 + [George AI] + 省下...別騙 + [George AI] + 不是...
print("\n3️⃣ Concatenating with George's AI...")
concat_list = f"{OUTPUT_DIR}/concat2.txt"
with open(concat_list, 'w') as f:
    f.write(f"file 'y_1.mp3'\n")    # 你用
    f.write(f"file 'g_ai1.mp3'\n")  # AI (George)
    f.write(f"file 'y_2.mp3'\n")    # 省下的時間...別騙自己
    f.write(f"file 'g_ai2.mp3'\n")  # AI (George)
    f.write(f"file 'y_3.mp3'\n")    # 不是讓你變強...

run(f'ffmpeg -y -f concat -safe 0 -i "{concat_list}" -acodec libmp3lame "{OUTPUT}"')

# Cleanup
print("\n4️⃣ Cleanup...")
for f in ['g_ai1.mp3', 'g_ai2.mp3', 'y_1.mp3', 'y_2.mp3', 'y_3.mp3', 'concat2.txt']:
    try:
        os.remove(f"{OUTPUT_DIR}/{f}")
    except:
        pass

size_kb = os.path.getsize(OUTPUT) / 1024
print(f"\n✅ Done! {OUTPUT}")
print(f"   Size: {size_kb:.1f} KB")
