#!/usr/bin/env python3
"""生成 Scene 2 & 3"""

from google import genai
from google.genai import types
import time
import subprocess

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
OUTPUT_DIR = "/Users/sulaxd/clawd/output/threads"

SCENES = [
    (2, """
    A person at laptop, screen glow on face.
    Distracted, chin on hand. Notification appears.
    Leans forward with curiosity, expression warming.
    Japanese drama lighting, hopeful mood.
    9:16 vertical.
    """),
    (3, """
    Close-up face reading screen, expression softening.
    Eyes slightly teary but smiling gently.
    Types slowly. A tear of relief with gentle smile.
    Warm golden light, emotionally touching.
    9:16 vertical.
    """),
]

client = genai.Client(api_key=API_KEY)

for num, prompt in SCENES:
    print(f"\n🎬 Scene {num}")
    
    op = client.models.generate_videos(
        model="veo-3.0-generate-001",
        prompt=prompt,
        config=types.GenerateVideosConfig(aspect_ratio="9:16"),
    )
    
    count = 0
    while not op.done:
        count += 1
        print(f"  ⏳ {count * 20}s")
        time.sleep(20)
        op = client.operations.get(op)
    
    path = f"{OUTPUT_DIR}/jp_{num}.mp4"
    v = op.result.generated_videos[0]
    client.files.download(file=v.video)
    v.video.save(path)
    print(f"  ✅ {path}")

# 拼接
print("\n🎞️ 拼接完整影片...")
with open(f"{OUTPUT_DIR}/jp_final.txt", "w") as f:
    for i in [1, 2, 3]:
        f.write(f"file '{OUTPUT_DIR}/jp_{i}.mp4'\n")

timestamp = int(time.time())
final = f"{OUTPUT_DIR}/japanese_ad_{timestamp}.mp4"
subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0",
               "-i", f"{OUTPUT_DIR}/jp_final.txt", "-c", "copy", final],
              capture_output=True)

print(f"\n🎌 完成: {final}")
