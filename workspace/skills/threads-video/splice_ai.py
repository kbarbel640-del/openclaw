#!/usr/bin/env python3
"""
Splice George's "AI" pronunciation into YunJhe's voice
"""
import subprocess
import os

OUTPUT_DIR = "/Users/sulaxd/clawd/skills/threads-video/output"
GEORGE = f"{OUTPUT_DIR}/voice_elevenlabs.mp3"
YUNJHE = f"{OUTPUT_DIR}/voice_yunjhe.mp3"
OUTPUT = f"{OUTPUT_DIR}/voice_spliced.mp3"

# Based on listening analysis:
# George: "你用AI" - AI is around 0.35-0.65s
# George: "AI不是" - AI is around 5.0-5.3s
# YunJhe: "你用AI" - AI is around 0.45-0.75s  
# YunJhe: "AI不是" - AI is around 5.35-5.65s

def run(cmd):
    print(f"  $ {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  Error: {result.stderr}")
    return result

print("🔧 Splicing George's 'AI' into YunJhe's voice...")

# Step 1: Extract George's "AI" clips
print("\n1️⃣ Extracting George's AI clips...")
run(f'ffmpeg -y -i "{GEORGE}" -ss 0.35 -t 0.35 -acodec libmp3lame "{OUTPUT_DIR}/george_ai1.mp3"')
run(f'ffmpeg -y -i "{GEORGE}" -ss 5.0 -t 0.35 -acodec libmp3lame "{OUTPUT_DIR}/george_ai2.mp3"')

# Step 2: Split YunJhe into segments (before AI, after AI)
print("\n2️⃣ Splitting YunJhe...")
# Segment 1: "你用" (0 - 0.45s)
run(f'ffmpeg -y -i "{YUNJHE}" -ss 0 -t 0.45 -acodec libmp3lame "{OUTPUT_DIR}/yunjhe_1.mp3"')
# Segment 2: "省下的時間..." (0.80 - 5.35s) 
run(f'ffmpeg -y -i "{YUNJHE}" -ss 0.80 -t 4.55 -acodec libmp3lame "{OUTPUT_DIR}/yunjhe_2.mp3"')
# Segment 3: "不是讓你變強..." (5.70 - end)
run(f'ffmpeg -y -i "{YUNJHE}" -ss 5.70 -acodec libmp3lame "{OUTPUT_DIR}/yunjhe_3.mp3"')

# Step 3: Concatenate all parts
print("\n3️⃣ Concatenating...")
concat_list = f"{OUTPUT_DIR}/concat.txt"
with open(concat_list, 'w') as f:
    f.write(f"file 'yunjhe_1.mp3'\n")      # 你用
    f.write(f"file 'george_ai1.mp3'\n")    # AI (George)
    f.write(f"file 'yunjhe_2.mp3'\n")      # 省下的時間...別騙自己...
    f.write(f"file 'george_ai2.mp3'\n")    # AI (George)
    f.write(f"file 'yunjhe_3.mp3'\n")      # 不是讓你變強...

run(f'ffmpeg -y -f concat -safe 0 -i "{concat_list}" -acodec libmp3lame "{OUTPUT}"')

# Cleanup
for f in ['george_ai1.mp3', 'george_ai2.mp3', 'yunjhe_1.mp3', 'yunjhe_2.mp3', 'yunjhe_3.mp3', 'concat.txt']:
    try:
        os.remove(f"{OUTPUT_DIR}/{f}")
    except:
        pass

size_kb = os.path.getsize(OUTPUT) / 1024
print(f"\n✅ Done! {OUTPUT}")
print(f"   Size: {size_kb:.1f} KB")
