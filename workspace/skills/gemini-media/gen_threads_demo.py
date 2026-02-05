#!/usr/bin/env python3
"""
生成 Threads 風格測試影片
使用 Top 10 技巧的完整模板
"""

from google import genai
from google.genai import types
import time

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
OUTPUT_DIR = "/Users/sulaxd/clawd/skills/gemini-media"

def generate_threads_video():
    """生成 Threads 風格影片"""
    client = genai.Client(api_key=API_KEY)
    
    # 使用完整的 Threads 模板
    prompt = """
    Medium shot with shallow depth of field (f/2.0),
    a focused Asian male creator in his 30s working on a MacBook,
    typing with quiet determination, slight confident smile,
    minimalist home office with plants, warm morning sunlight streaming through window,
    warm and aspirational mood, shot like Apple commercial,
    9:16 vertical composition optimized for mobile viewing,
    subject positioned in center-left third rule,
    cinematic color grading with warm tones.
    
    SFX: gentle keyboard tapping, soft ambient music.
    Ambient noise: quiet morning atmosphere, distant birds.
    """
    
    print("🎬 開始生成 Threads 風格影片...")
    print(f"Prompt: {prompt[:200]}...")
    
    # 發起生成請求
    operation = client.models.generate_videos(
        model="veo-3.0-generate-001",
        prompt=prompt,
        config=types.GenerateVideosConfig(
            aspect_ratio="9:16",
        ),
    )
    
    # 等待完成
    poll_count = 0
    while not operation.done:
        poll_count += 1
        print(f"⏳ 等待中... ({poll_count * 20}s)")
        time.sleep(20)
        operation = client.operations.get(operation)
    
    print("✅ 生成完成！")
    
    # 下載影片
    if hasattr(operation, 'result') and operation.result:
        if hasattr(operation.result, 'generated_videos') and operation.result.generated_videos:
            video = operation.result.generated_videos[0]
            output_path = f"{OUTPUT_DIR}/threads_demo.mp4"
            
            client.files.download(file=video.video)
            video.video.save(output_path)
            
            print(f"💾 已保存: {output_path}")
            return output_path
    
    print("❌ 生成失敗")
    return None

if __name__ == "__main__":
    generate_threads_video()
