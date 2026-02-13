import os
from huggingface_hub import snapshot_download

# Configuration
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
# 优先使用C盘（D盘有权限问题）
C_DIR = "C:/Users/User/.openclaw/models/Qwen3-TTS/Qwen3-TTS-12Hz-1.7B-Base"
D_DIR = "D:/models/Qwen3-TTS/Qwen3-TTS-12Hz-1.7B-Base"
ALT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model_weights")


def download():
    # 按优先级选择目录
    if os.path.exists("C:/") and os.access("C:/", os.W_OK):
        target_dir = C_DIR
    elif os.path.exists("D:/") and os.access("D:/", os.W_OK):
        target_dir = D_DIR
    else:
        target_dir = ALT_DIR

    print("=" * 60)
    print(f"📥 下载 Qwen3-TTS 模型")
    print("=" * 60)
    print(f"📦 模型: {MODEL_ID}")
    print(f"📁 目标路径: {target_dir}")
    print(f"💾 大小: ~3.5GB")
    print("⏳ 下载中，请稍候...")
    print("-" * 60)

    try:
        snapshot_download(
            repo_id=MODEL_ID,
            local_dir=target_dir,
            local_dir_use_symlinks=False,
            ignore_patterns=["*.msgpack", "*.h5", "*.tflite"],
        )
        print("\n" + "=" * 60)
        print("✅ 下载完成！")
        print("=" * 60)
        print(f"📂 模型路径: {target_dir}")
        print("\n🚀 启动服务器:")
        print(f'   export TTS_MODEL_PATH="{target_dir}" && python server.py')
    except Exception as e:
        print(f"\n" + "=" * 60)
        print("❌ 下载失败")
        print("=" * 60)
        print(f"错误: {e}")
        print("\n🔧 可能的解决方案:")
        print("   1. 检查网络连接")
        print("   2. 确保有足够的磁盘空间 (~4GB)")
        print("   3. 尝试手动下载 model files")


if __name__ == "__main__":
    download()
