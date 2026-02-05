#!/usr/bin/env python3
"""檢查 API Key 配額狀態"""

from google import genai
from google.genai import types

client = genai.Client(api_key="AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M")

print("Testing Veo 3 quota...")
try:
    op = client.models.generate_videos(
        model="veo-3.0-generate-001",
        prompt="A simple test scene",
        config=types.GenerateVideosConfig(aspect_ratio="9:16"),
    )
    print(f"✅ Quota OK! Operation: {op.name}")
except Exception as e:
    error_str = str(e)
    if "429" in error_str:
        print(f"❌ 429 配額用完: {error_str[:200]}")
    elif "403" in error_str:
        print(f"❌ 403 無權限: {error_str[:200]}")
    else:
        print(f"❌ 其他錯誤: {error_str[:200]}")
