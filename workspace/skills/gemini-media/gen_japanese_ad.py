#!/usr/bin/env python3
"""
日式廣告風格迷你電影
「已讀」- 日本高校生版
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
        
        A cute Japanese high school girl in uniform (sailor fuku),
        sitting alone in her bedroom at night,
        soft desk lamp lighting, warm but lonely atmosphere.
        
        She stares at her phone screen showing "Read" (已讀) with no reply.
        She types something, hesitates, then deletes it.
        Puts down the phone with a small sigh.
        
        Soft focus, warm color grading like Japanese drama,
        shallow depth of field, intimate framing.
        
        SFX: Quiet room ambience, soft typing sounds, gentle sigh.
        Ambient: Distant city sounds, clock ticking softly.
        
        9:16 vertical, cinematic Japanese drama style.
        """
    },
    {
        "name": "scene2_connection",
        "prompt": """
        Japanese slice-of-life aesthetic, transitioning from melancholy to warmth.
        
        Same cute Japanese high school girl,
        she opens her laptop, the screen illuminates her face.
        She starts working but seems distracted, resting chin on hand.
        
        Suddenly a chat notification pops up on screen.
        She leans in, curious. The glow on her face shifts warmer.
        
        Soft lighting transition, screen glow on face,
        intimate close-up shots, Japanese drama cinematography.
        
        SFX: Soft notification chime, gentle keyboard sounds.
        
        9:16 vertical, warm and hopeful tone emerging.
        """
    },
    {
        "name": "scene3_understood",
        "prompt": """
        Japanese slice-of-life aesthetic, emotional climax.
        
        Same cute Japanese high school girl,
        close-up on her face as she reads something touching on screen.
        Her expression softens, eyes become slightly teary but with a gentle smile.
        She types slowly, thoughtfully.
        
        A single tear rolls down as she smiles genuinely.
        The warm screen light makes her look peaceful.
        
        Very soft, intimate cinematography,
        shallow depth of field focused on her expression,
        warm golden tones, like a gentle embrace.
        
        SFX: Soft emotional piano note, gentle typing, quiet breath.
        
        9:16 vertical, emotionally resonant Japanese drama ending.
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
    print("\n🎞️ 拼接影片...")
    
    concat_file = f"{OUTPUT_DIR}/jp_concat_list.txt"
    with open(concat_file, "w") as f:
        for path in video_paths:
            f.write(f"file '{path}'\n")
    
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", 
           "-i", concat_file, "-c", "copy", output_path]
    subprocess.run(cmd, capture_output=True)
    print(f"✅ 完成: {output_path}")
    return output_path

def main():
    print("🎌 開始生成日式廣告「已讀」")
    print("👧 角色：日本高校生")
    
    client = genai.Client(api_key=API_KEY)
    timestamp = int(time.time())
    
    video_paths = []
    for i, scene in enumerate(SCENES):
        path = generate_scene(client, scene, i)
        video_paths.append(path)
    
    final_path = f"{OUTPUT_DIR}/japanese_ad_{timestamp}.mp4"
    concat_videos(video_paths, final_path)
    
    print(f"\n🎌 日式廣告完成: {final_path}")
    return final_path

if __name__ == "__main__":
    main()
