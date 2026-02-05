#!/usr/bin/env python3
from google import genai
from google.genai import types
import time

client = genai.Client(api_key="AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M")

prompt = """
A person sitting alone in a cozy room at night,
soft lamp lighting, looking at phone with gentle expression,
warm and intimate atmosphere, Japanese drama aesthetic.
9:16 vertical composition.
"""

print("Testing simple prompt...")
try:
    op = client.models.generate_videos(
        model="veo-3.0-generate-001",
        prompt=prompt,
        config=types.GenerateVideosConfig(aspect_ratio="9:16"),
    )
    print(f"Operation started: {op.name if hasattr(op, 'name') else 'OK'}")
    
    count = 0
    while not op.done:
        count += 1
        print(f"Waiting... {count * 20}s")
        time.sleep(20)
        op = client.operations.get(op)
    
    print(f"Done! Result: {op.result}")
    
    if op.result and op.result.generated_videos:
        v = op.result.generated_videos[0]
        client.files.download(file=v.video)
        v.video.save("/Users/sulaxd/clawd/output/threads/test_simple.mp4")
        print("Saved!")
        
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
