#!/usr/bin/env python3
"""Create a simple voice-like test audio using numpy."""

import wave
import struct
import math
import numpy as np

# Create a simple "hello" pattern using different frequencies
sample_rate = 16000
duration = 2.0  # seconds

# Generate a simple speech-like pattern
# Using formant frequencies to simulate vowel sounds
t = np.linspace(0, duration, int(sample_rate * duration))

# Create a simple pattern that sounds somewhat like speech
# Using amplitude modulation to simulate syllables
audio = np.zeros_like(t)

# Add some noise and formant-like frequencies
for i, time in enumerate(t):
    # Base frequency (like vocal cords)
    base = 0.3 * np.sin(2 * np.pi * 120 * time)

    # Formants (resonant frequencies)
    f1 = 0.2 * np.sin(2 * np.pi * 800 * time)
    f2 = 0.15 * np.sin(2 * np.pi * 1200 * time)

    # Amplitude envelope (syllable-like)
    envelope = 1.0
    if time < 0.3:
        envelope = time / 0.3  # Attack
    elif time > 1.7:
        envelope = (2.0 - time) / 0.3  # Decay

    # Add some "breath" noise
    noise = 0.05 * np.random.randn()

    audio[i] = (base + f1 + f2 + noise) * envelope

# Convert to 16-bit PCM
audio_int16 = (audio * 32767).astype(np.int16)

# Write to WAV file
with wave.open("speech_test.wav", "w") as wav_file:
    wav_file.setnchannels(1)  # Mono
    wav_file.setsampwidth(2)  # 16-bit
    wav_file.setframerate(sample_rate)
    wav_file.writeframes(audio_int16.tobytes())

print("Created speech_test.wav (2 seconds, synthetic speech-like audio)")
print("Note: This is synthetic audio for testing Whisper loading.")
