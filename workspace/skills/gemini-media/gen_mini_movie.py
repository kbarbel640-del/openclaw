#!/usr/bin/env python3
"""
迷你電影生成器 - 多段拼接
3 段 x 8 秒 = 24 秒完整故事
"""

from google import genai
from google.genai import types
import time
import subprocess
import os

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
OUTPUT_DIR = "/Users/sulaxd/clawd/output/threads"

# 三幕劇結構
SCENES = [
    {
        "name": "act1_setup",
        "prompt": """
        Cinematic opening shot, dark room with only laptop screen glowing.
        A person sits alone, exhausted, head in hands.
        Slowly looks up at the screen with desperation.
        
        Moody blue lighting, shallow depth of field,
        melancholic atmosphere, film grain.
        SFX: Quiet ambient hum, distant city sounds, soft sigh.
        
        9:16 vertical, cinematic color grading.
        """
    },
    {
        "name": "act2_discovery",
        "prompt": """
        The screen suddenly bursts with colorful light and particles.
        Person's face illuminated, expression shifts from despair to wonder.
        Leans forward, eyes widening with realization.
        Light begins to spread around them.
        
        Dramatic lighting transition from blue to warm gold,
        magical particles floating, lens flares.
        SFX: Rising electronic crescendo, magical chimes, heartbeat quickening.
        
        9:16 vertical, high contrast cinematic look.
        """
    },
    {
        "name": "act3_transformation",
        "prompt": """
        Wide shot reveal: the person now standing confidently,
        surrounded by multiple floating holographic screens,
        creating content effortlessly with hand gestures.
        Golden hour lighting floods the room.
        
        Triumphant and empowering atmosphere,
        epic wide angle, slight slow motion.
        SFX: Powerful orchestral swell, then peaceful resolution.
        
        9:16 vertical, warm cinematic color grading.
        """
    },
]

def generate_scene(client, scene, index):
    """生成單個場景"""
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
    
    # 保存
    video_path = f"{OUTPUT_DIR}/scene_{index + 1}.mp4"
    video = operation.result.generated_videos[0]
    client.files.download(file=video.video)
    video.video.save(video_path)
    print(f"  ✅ {video_path}")
    
    return video_path

def concat_videos(video_paths, output_path):
    """用 ffmpeg 拼接影片"""
    print("\n🎞️ 拼接影片...")
    
    # 創建 concat 文件
    concat_file = f"{OUTPUT_DIR}/concat_list.txt"
    with open(concat_file, "w") as f:
        for path in video_paths:
            f.write(f"file '{path}'\n")
    
    # ffmpeg 拼接
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_file,
        "-c", "copy",
        output_path
    ]
    
    subprocess.run(cmd, capture_output=True)
    print(f"✅ 完成: {output_path}")
    return output_path

def main():
    print("🎬 開始生成迷你電影（3 幕 x 8 秒 = 24 秒）")
    
    client = genai.Client(api_key=API_KEY)
    timestamp = int(time.time())
    
    # 生成三個場景
    video_paths = []
    for i, scene in enumerate(SCENES):
        path = generate_scene(client, scene, i)
        video_paths.append(path)
    
    # 拼接
    final_path = f"{OUTPUT_DIR}/mini_movie_{timestamp}.mp4"
    concat_videos(video_paths, final_path)
    
    print(f"\n🎉 迷你電影完成: {final_path}")
    return final_path

if __name__ == "__main__":
    main()
