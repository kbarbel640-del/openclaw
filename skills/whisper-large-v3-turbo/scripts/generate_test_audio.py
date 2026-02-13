#!/usr/bin/env python3
"""Generate a simple test audio file for Whisper testing."""

import wave
import struct
import math

# Create a simple sine wave audio file
sample_rate = 16000
duration = 3  # seconds
frequency = 440  # Hz (A4 note)

# Generate sine wave
samples = []
for i in range(int(sample_rate * duration)):
    t = i / sample_rate
    # Create a simple beep sound
    sample = math.sin(2 * math.pi * frequency * t)
    # Add some variation to make it more interesting
    if i > sample_rate and i < sample_rate * 2:
        sample = math.sin(2 * math.pi * 880 * t)  # Higher pitch in middle
    samples.append(int(sample * 32767))

# Write to WAV file
with wave.open("test_audio.wav", "w") as wav_file:
    wav_file.setnchannels(1)  # Mono
    wav_file.setsampwidth(2)  # 16-bit
    wav_file.setframerate(sample_rate)

    for sample in samples:
        wav_file.writeframes(struct.pack("h", sample))

print("Created test_audio.wav (3 seconds, mono, 16-bit, 16kHz)")
print("Note: This is a synthetic audio file for testing purposes.")
print("For actual transcription testing, use a real audio file with speech.")
