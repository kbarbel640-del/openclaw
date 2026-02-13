#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Eden TTS - 通用语音生成工具 (v2.0)
功能：
1. 支持长文本自动清理和分段
2. 自动应用最佳参数 (top_k=50, top_p=0.95)
3. 自动音频加速 (默认1.1x)
4. 输出 Telegram 兼容的 OGG 格式

用法:
  python tts_cli.py "你好，我是Eden"
  python tts_cli.py "长文本..." --speed 1.3
"""

import sys
import os
import re
import argparse
import subprocess
import torch
import soundfile as sf
from datetime import datetime
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("tts-cli")

# 绕过SoX检查
try:
    # 尝试添加常见路径
    sys.path.insert(
        0, r"C:\Users\User\AppData\Local\Programs\Python\Python311\Lib\site-packages"
    )
    import sox

    sox.NO_SOX = True
except ImportError:
    pass  # 允许失败，如果在其他环境

from qwen_tts import Qwen3TTSModel

# === 默认配置区域 ===
# 优先读取环境变量，否则使用默认路径
DEFAULT_MODEL_PATH = os.environ.get(
    "TTS_MODEL_PATH", "D:/models/Qwen3-TTS/Qwen3-TTS-12Hz-1.7B-Base"
)
# 默认参考音频 (Eden)
DEFAULT_REF_AUDIO = r"C:\Users\User\.openclaw\media\inbound\file_10---1ea85475-ec74-449f-b488-61c5039b8886.ogg"
DEFAULT_REF_TEXT = "不是吧,最近怎么老有人说我长得像什么豆包,我照了半天镜子也没看出来啊。你们说说到底哪里像了,是脸,是表情,还是我一说话就很AI。"
OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output"
)


def clean_text(text):
    """清理文本以优化朗读效果"""
    text = text.replace("[Paste完成！", "")
    text = re.sub(r"[^\w\s,。.，、：:?？!-]", "", text)

    lines = text.split("\n")
    spoken_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("•") or line.startswith("- "):
            line = line.replace("•", "").replace("- ", "")
        spoken_lines.append(line)

    return " ".join(spoken_lines)


def generate_audio(
    text,
    speed=1,
    model_path=DEFAULT_MODEL_PATH,
    ref_audio=DEFAULT_REF_AUDIO,
    ref_text=DEFAULT_REF_TEXT,
    output_file=None,
):
    """生成音频的核心逻辑"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if not output_file:
        timestamp = datetime.now().strftime("%H%M%S")
        output_file = os.path.join(OUTPUT_DIR, f"tts_{timestamp}.ogg")

    wav_temp = output_file.replace(".ogg", ".wav")

    logger.info(f"⏳ Loading model from {model_path}...")
    try:
        model = Qwen3TTSModel.from_pretrained(
            model_path,
            device_map="cuda",
            dtype=torch.float16,
        )
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        # Fallback logic could go here
        sys.exit(1)

    logger.info(f"🔊 Generating: {text[:30]}...")
    wavs, sr = model.generate_voice_clone(
        text=text,
        ref_audio=ref_audio,
        ref_text=ref_text,
        language="Chinese",
        do_sample=True,
        repetition_penalty=1.2,
        top_k=50,
        top_p=0.95,
    )

    sf.write(wav_temp, wavs[0], sr)

    logger.info(f"⏩ Converting & Speedup ({speed}x)...")
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                wav_temp,
                "-filter:a",
                f"atempo={speed}",
                "-c:a",
                "libopus",
                "-b:a",
                "24k",
                "-ac",
                "1",
                "-ar",
                "16000",
                output_file,
            ],
            check=True,
        )

        # Cleanup temp wav
        if os.path.exists(wav_temp):
            os.remove(wav_temp)

    except Exception as e:
        logger.error(f"FFmpeg failed: {e}")
        return wav_temp  # Return wav if ffmpeg fails

    return output_file


def main():
    parser = argparse.ArgumentParser(description="Eden TTS Generator (Qwen3)")
    parser.add_argument("text", help="Text to speak")
    parser.add_argument(
        "--speed", type=float, default=1.1, help="Speed multiplier (default: 1.1)"
    )
    parser.add_argument(
        "--model-path", default=DEFAULT_MODEL_PATH, help="Path to Qwen3-TTS model"
    )
    parser.add_argument(
        "--ref-audio", default=DEFAULT_REF_AUDIO, help="Reference audio path"
    )
    parser.add_argument(
        "--ref-text", default=DEFAULT_REF_TEXT, help="Reference audio text"
    )
    parser.add_argument("-o", "--output", help="Output filename")

    args = parser.parse_args()

    print("=" * 50)
    print(f"🐥 Eden TTS v2.0")
    print("=" * 50)

    clean_content = clean_text(args.text)

    try:
        output_path = generate_audio(
            clean_content,
            speed=args.speed,
            model_path=args.model_path,
            ref_audio=args.ref_audio,
            ref_text=args.ref_text,
            output_file=args.output,
        )
        print(f"✅ Success: {output_path}")
    except Exception as e:
        print(f"❌ Failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
