#!/usr/bin/env python3
"""Download large-v3-turbo model for Whisper."""

import whisper
import sys
import os

MODEL_NAME = "large-v3-turbo"
DOWNLOAD_ROOT = "D:/models/Whisper"

print("=" * 60)
print(f"Downloading Whisper {MODEL_NAME} model")
print("=" * 60)
print("Model size: ~1.6GB")
print(f"Download location: {DOWNLOAD_ROOT}/{MODEL_NAME}.pt")
print("")

if not os.path.exists(DOWNLOAD_ROOT):
    print(f"Warning: {DOWNLOAD_ROOT} not found. Creating it...")
    os.makedirs(DOWNLOAD_ROOT, exist_ok=True)

print("This will take 3-10 minutes depending on your connection.")
print("Press Ctrl+C to cancel")
print("=" * 60)
print("")

try:
    model = whisper.load_model(MODEL_NAME, download_root=DOWNLOAD_ROOT)
    print("")
    print("=" * 60)
    print("✓ Model download complete!")
    print("=" * 60)
    print("")
    print("The large-v3-turbo model is now ready for use.")
    print("You can now transcribe audio with:")
    print('  .venv\\Scripts\\python.exe scripts\\transcribe.py "audio.wav"')
    print("")
    sys.exit(0)
except KeyboardInterrupt:
    print("")
    print("\nDownload cancelled by user.")
    print("Run this script again to resume.")
    sys.exit(1)
except Exception as e:
    print(f"\n✗ Error: {e}")
    sys.exit(1)
