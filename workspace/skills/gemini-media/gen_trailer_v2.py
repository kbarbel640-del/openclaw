#!/usr/bin/env python3
"""電影預告風格 - 簡化版"""

from google import genai
from google.genai import types
import time

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
OUTPUT_DIR = "/Users/sulaxd/clawd/output/threads"

client = genai.Client(api_key=API_KEY)
timestamp = int(time.time())

prompt = """
Cinematic movie trailer style, dramatic and mysterious.

A silhouette of a person slowly walking towards a glowing laptop screen 
in a dark room. Dramatic backlighting creates lens flares. 
The person reaches out to touch the screen, 
and light begins to emanate from their fingertips.

High contrast teal and orange color grading,
anamorphic lens flares, film grain texture,
epic and mysterious atmosphere.

SFX: Deep bass drone building tension, 
then a powerful brass hit as light spreads.

9:16 vertical composition.
"""

print("🎬 生成電影預告風格...")

operation = client.models.generate_videos(
    model="veo-3.0-generate-001",
    prompt=prompt,
    config=types.GenerateVideosConfig(aspect_ratio="9:16"),
)

poll_count = 0
while not operation.done:
    poll_count += 1
    print(f"⏳ {poll_count * 20}s...")
    time.sleep(20)
    operation = client.operations.get(operation)

video_path = f"{OUTPUT_DIR}/trailer_{timestamp}.mp4"
video = operation.result.generated_videos[0]
client.files.download(file=video.video)
video.video.save(video_path)
print(f"✅ {video_path}")
