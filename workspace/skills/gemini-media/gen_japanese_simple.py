#!/usr/bin/env python3
"""日式廣告 - 簡潔 prompt 版"""

from google import genai
from google.genai import types
import time
import subprocess

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
OUTPUT_DIR = "/Users/sulaxd/clawd/output/threads"

SCENES = [
    """
    A person alone in a cozy room at night, soft lamp light.
    Looking at phone screen showing unread message, slightly sad expression.
    Types something then deletes it. Small sigh.
    Japanese drama aesthetic, warm intimate atmosphere.
    9:16 vertical.
    """,
    """
    Same person now at laptop, screen glow on face.
    Distracted, chin on hand. Then notification appears.
    Leans forward with curiosity, expression warming up.
    Japanese drama lighting, hopeful transition.
    9:16 vertical.
    """,
    """
    Close-up on face reading screen, expression softening.
    Eyes slightly teary but smiling gently.
    Types slowly, peacefully. A tear of relief with gentle smile.
    Warm golden light, emotionally touching.
    9:16 vertical.
    """,
]

def main():
    print("🎌 日式廣告「已讀」")
    client = genai.Client(api_key=API_KEY)
    timestamp = int(time.time())
    paths = []
    
    for i, prompt in enumerate(SCENES):
        print(f"\n🎬 Scene {i+1}/3")
        
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
        
        path = f"{OUTPUT_DIR}/jp_{i+1}.mp4"
        v = op.result.generated_videos[0]
        client.files.download(file=v.video)
        v.video.save(path)
        paths.append(path)
        print(f"  ✅ {path}")
    
    # 拼接
    print("\n🎞️ 拼接...")
    with open(f"{OUTPUT_DIR}/jp_list.txt", "w") as f:
        for p in paths:
            f.write(f"file '{p}'\n")
    
    final = f"{OUTPUT_DIR}/japanese_ad_{timestamp}.mp4"
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0",
                   "-i", f"{OUTPUT_DIR}/jp_list.txt", "-c", "copy", final],
                  capture_output=True)
    
    print(f"\n🎌 完成: {final}")

if __name__ == "__main__":
    main()
