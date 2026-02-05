#!/usr/bin/env python3
"""
日式廣告風格 - 年輕女性版
"""

from google import genai
from google.genai import types
import time
import subprocess

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
OUTPUT_DIR = "/Users/sulaxd/clawd/output/threads"

SCENES = [
    {
        "name": "scene1_loneliness",
        "prompt": """
        Japanese slice-of-life aesthetic, soft and melancholic.
        
        A young woman in her early 20s with gentle features,
        sitting alone in a cozy apartment at night,
        soft warm lamp lighting, minimalist Japanese interior.
        
        She looks at her phone, expression slightly sad.
        She types something, pauses, then puts the phone down.
        A small sigh escapes her.
        
        Soft focus, warm color grading like Japanese cinema,
        intimate and quiet atmosphere.
        
        SFX: Quiet ambience, soft sigh, distant city sounds.
        
        9:16 vertical, Japanese drama cinematography.
        """
    },
    {
        "name": "scene2_connection",
        "prompt": """
        Japanese slice-of-life aesthetic, warming up.
        
        Same young woman, now at her desk with laptop open.
        The screen glow illuminates her face softly.
        She seems distracted, looking at nothing.
        
        Then something on the screen catches her attention.
        She leans forward slightly, expression shifts to curiosity.
        A hint of warmth enters her eyes.
        
        Soft lighting, screen glow on face,
        intimate close-up, Japanese drama style.
        
        SFX: Soft notification sound, gentle keyboard tap.
        
        9:16 vertical, hopeful tone emerging.
        """
    },
    {
        "name": "scene3_understood", 
        "prompt": """
        Japanese slice-of-life aesthetic, emotional resolution.
        
        Same young woman, close-up on her face.
        Reading something on screen, her expression softens.
        Eyes glisten slightly, but she's smiling gently.
        She types slowly, meaningfully.
        
        A single tear of relief, but with a peaceful smile.
        The warm light makes her look at peace.
        
        Very soft cinematography, shallow depth of field,
        warm golden tones, emotionally resonant.
        
        SFX: Soft piano note, gentle breath, peaceful silence.
        
        9:16 vertical, touching Japanese drama ending.
        """
    },
]

def generate_scene(client, scene, index):
    print(f"\n🎬 Scene {index + 1}/3: {scene['name']}")
    
    operation = client.models.generate_videos(
        model="veo-3.0-generate-001",
        prompt=scene["prompt"],
        config=types.GenerateVideosConfig(aspect_ratio="9:16"),
    )
    
    poll_count = 0
    while not operation.done:
        poll_count += 1
        print(f"  ⏳ {poll_count * 20}s...")
        time.sleep(20)
        operation = client.operations.get(operation)
    
    video_path = f"{OUTPUT_DIR}/jp_scene_{index + 1}.mp4"
    video = operation.result.generated_videos[0]
    client.files.download(file=video.video)
    video.video.save(video_path)
    print(f"  ✅ {video_path}")
    
    return video_path

def concat_videos(video_paths, output_path):
    print("\n🎞️ 拼接...")
    concat_file = f"{OUTPUT_DIR}/jp_concat.txt"
    with open(concat_file, "w") as f:
        for path in video_paths:
            f.write(f"file '{path}'\n")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0",
                   "-i", concat_file, "-c", "copy", output_path], capture_output=True)
    print(f"✅ {output_path}")

def main():
    print("🎌 日式廣告「已讀」- 年輕女性版")
    client = genai.Client(api_key=API_KEY)
    timestamp = int(time.time())
    
    paths = []
    for i, scene in enumerate(SCENES):
        paths.append(generate_scene(client, scene, i))
    
    final = f"{OUTPUT_DIR}/japanese_ad_{timestamp}.mp4"
    concat_videos(paths, final)
    print(f"\n🎌 完成: {final}")

if __name__ == "__main__":
    main()
