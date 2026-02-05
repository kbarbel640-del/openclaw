#!/usr/bin/env python3
"""
Generate multiple versions with different AI spellings
Focus on the second AI which has pronunciation issues
"""
import asyncio
import edge_tts
import os

OUTPUT_DIR = "/Users/sulaxd/clawd/skills/threads-video/output"

# Different AI spellings to try
VARIANTS = [
    ("v1_AI", "AI", "AI"),           # Original
    ("v2_Ai", "AI", "Ai"),           # Second one lowercase i
    ("v3_ai", "AI", "ai"),           # Second one all lowercase
    ("v4_A_I", "AI", "A I"),         # Second with space
    ("v5_dot", "AI", "A.I."),        # Second with dots
    ("v6_full", "ＡＩ", "ＡＩ"),      # Both fullwidth
]

TEMPLATE = """你用 {ai1} 省下的時間，最後都去刷抖音了。
別騙自己。
{ai2} 不是讓你變強，是讓你更會逃避。
真正的用法？買回注意力，不是時間。"""

async def generate_variant(name, ai1, ai2):
    script = TEMPLATE.format(ai1=ai1, ai2=ai2)
    output_file = f"{OUTPUT_DIR}/voice_{name}.mp3"
    
    print(f"🎙️ Generating {name}: AI1={ai1}, AI2={ai2}")
    
    communicate = edge_tts.Communicate(
        script, 
        "zh-TW-YunJheNeural",
        rate="-5%"
    )
    await communicate.save(output_file)
    
    size_kb = os.path.getsize(output_file) / 1024
    print(f"   ✅ {output_file} ({size_kb:.1f} KB)")
    return output_file

async def main():
    print("🔧 Generating AI spelling variants...\n")
    
    for name, ai1, ai2 in VARIANTS:
        await generate_variant(name, ai1, ai2)
    
    print("\n✅ All variants generated!")

if __name__ == "__main__":
    asyncio.run(main())
