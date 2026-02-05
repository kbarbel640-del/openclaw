#!/usr/bin/env python3
"""Test Veo 3 - 影片生成"""

from google import genai
from google.genai import types
import time

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
OUTPUT_DIR = "/Users/sulaxd/clawd/skills/gemini-media"

def generate_video(prompt: str, output_path: str = None):
    """生成影片"""
    client = genai.Client(api_key=API_KEY)
    
    print(f"🎬 開始生成影片...")
    print(f"Prompt: {prompt[:100]}...")
    
    # 發起生成請求
    operation = client.models.generate_videos(
        model="veo-3.0-generate-001",
        prompt=prompt,
        config=types.GenerateVideosConfig(
            aspect_ratio="9:16",  # Threads/IG 格式
        ),
    )
    
    print(f"Operation started: {operation.name if hasattr(operation, 'name') else 'unknown'}")
    
    # 等待完成
    poll_count = 0
    while not operation.done:
        poll_count += 1
        print(f"⏳ 等待中... ({poll_count * 20}s)")
        time.sleep(20)
        operation = client.operations.get(operation)
    
    print(f"✅ 生成完成！")
    
    # 檢查結果
    if hasattr(operation, 'result') and operation.result:
        result = operation.result
        print(f"Result: {result}")
        
        if hasattr(result, 'generated_videos') and result.generated_videos:
            video = result.generated_videos[0]
            print(f"Video: {video}")
            
            # 下載影片
            if output_path is None:
                output_path = f"{OUTPUT_DIR}/test_veo3_output.mp4"
            
            client.files.download(file=video.video)
            video.video.save(output_path)
            print(f"💾 已保存: {output_path}")
            return output_path
    
    print(f"❌ 沒有生成影片")
    print(f"Operation details: {operation}")
    return None

if __name__ == "__main__":
    prompt = """
    A steaming cup of coffee on a wooden desk, 
    morning sunlight streaming through a window,
    gentle steam rising, cozy atmosphere,
    cinematic lighting, 4K quality
    """
    
    generate_video(prompt)
