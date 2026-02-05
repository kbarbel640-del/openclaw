#!/usr/bin/env python3
from google import genai
from google.genai import types
import time

client = genai.Client(api_key="AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M")

print("🎬 Scene 2: Discovery")
op = client.models.generate_videos(
    model="veo-3.0-generate-001",
    prompt="""
    A person at laptop, screen glow illuminating face.
    Looks distracted. Then notification appears on screen.
    Leans forward with curiosity, expression warming up.
    Japanese drama style, hopeful atmosphere.
    9:16 vertical.
    """,
    config=types.GenerateVideosConfig(aspect_ratio="9:16"),
)

count = 0
while not op.done:
    count += 1
    print(f"⏳ {count * 20}s")
    time.sleep(20)
    op = client.operations.get(op)

v = op.result.generated_videos[0]
client.files.download(file=v.video)
v.video.save("/Users/sulaxd/clawd/output/threads/jp_2.mp4")
print("✅ Scene 2 saved!")
