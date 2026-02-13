#!/usr/bin/env python3
"""
MiniCPM-V 4.5 视觉模型
图像理解和OCR识别
"""
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from PIL import Image
import sys
import os

# 模型路径
MODEL_PATH = r"C:\Users\User\.openclaw\models\MiniCPM-4.5V"

def load_model():
    """加载模型"""
    print("加载MiniCPM-V 4.5模型...")
    print(f"模型路径: {MODEL_PATH}")
    print("首次加载需要一些时间...")

    # 检查模型是否存在
    if not os.path.exists(MODEL_PATH):
        print(f"❌ 模型目录不存在: {MODEL_PATH}")
        print("请先运行模型下载脚本")
        return None, None

    # 检测GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"使用设备: {device}")

    if device == "cpu":
        print("⚠️ 使用CPU会比较慢，建议使用GPU")

    try:
        # 加载tokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_PATH,
            trust_remote_code=True
        )

        # 加载模型
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_PATH,
            trust_remote_code=True,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto" if device == "cuda" else None
        )

        if device == "cpu":
            model = model.to(device)

        model.eval()

        print("✅ 模型加载完成")

        return model, tokenizer

    except Exception as e:
        print(f"❌ 模型加载失败: {e}")
        return None, None

def analyze_image(image_path, question="请描述这张图片", model=None, tokenizer=None):
    """分析图片"""
    # 加载模型（如果还没加载）
    if model is None or tokenizer is None:
        model, tokenizer = load_model()
        if model is None:
            return None

    try:
        # 读取图片
        image = Image.open(image_path).convert("RGB")
        print(f"分析图片: {image_path}")
        print(f"问题: {question}")

        # 使用模型处理
        msgs = [{"role": "user", "content": question}]

        res = model.chat(
            image=image,
            msgs=msgs,
            tokenizer=tokenizer,
            sampling=False,
            temperature=0.7
        )

        return res

    except Exception as e:
        print(f"❌ 分析失败: {e}")
        return None

def main():
    if len(sys.argv) < 2:
        print("用法: python analyze.py <图片路径> [问题]")
        print("示例:")
        print("  python analyze.py test.jpg")
        print("  python analyze.py test.jpg '识别图片中的所有文字'")
        sys.exit(1)

    image_path = sys.argv[1]
    question = "请描述这张图片"

    if len(sys.argv) > 2:
        question = " ".join(sys.argv[2:])

    # 检查图片是否存在
    if not os.path.exists(image_path):
        print(f"❌ 图片不存在: {image_path}")
        sys.exit(1)

    # 加载模型
    print("=" * 60)
    print("MiniCPM-V 4.5 - 图像分析")
    print("=" * 60)

    model, tokenizer = load_model()
    if model is None:
        print("\n模型加载失败，请检查:")
        print("1. 模型是否已完成下载")
        print("2. 模型路径是否正确")
        print(f"3. 模型路径: {MODEL_PATH}")
        sys.exit(1)

    # 分析图片
    result = analyze_image(image_path, question, model, tokenizer)

    if result:
        print("\n" + "=" * 60)
        print("分析结果:")
        print("=" * 60)
        print(result)

if __name__ == '__main__':
    main()
