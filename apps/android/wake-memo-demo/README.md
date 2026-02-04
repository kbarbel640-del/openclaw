# Wake Memo Demo (OpenWakeWord)

Privacy-first Android demo:
- Always-on wake word detection (on-device)
- Wake word starts WAV recording
- Stop word ends WAV recording
- Optional debug-only Google SpeechRecognizer screen

Default words:
- Wake: "hey jarvis"
- Stop: "alexa"

## Setup

1) Download OpenWakeWord TFLite models into assets:

```bash
cd /home/raw/Documents/GitHub/clawdbot/apps/android/wake-memo-demo
./scripts/fetch-oww-models.sh
```

Models live in `wake-memo-demo/src/main/assets/oww`:
- `melspectrogram.tflite`
- `embedding_model.tflite`
- `hey_jarvis_v0.1.tflite`
- `alexa_v0.1.tflite`

Note: openWakeWord code is Apache-2.0, but the official pre-trained models are CC BY-NC-SA. Use custom models for commercial use.

2) (Optional) Picovoice engine

If you want to switch to Picovoice, add this to `~/.gradle/gradle.properties`:

```properties
PICOVOICE_ACCESS_KEY=YOUR_KEY_HERE
```

Then edit the engine type in `wake-memo-demo/src/main/java/ai/openclaw/wakememo/WakeMemoService.kt`.

## Build & Run

```bash
cd /home/raw/Documents/GitHub/clawdbot/apps/android
./gradlew :wake-memo-demo:installDebug
```

Launch **Wake Memo Demo** on device.

## Usage

1) Tap **Start Always-Listening**
2) Say **"hey jarvis"** to start recording
3) Say **"alexa"** to stop

Files are saved to:

```
/Android/data/ai.openclaw.wakememo/files/Music/memos/
```

## Debug Transcription (Google, Debug-only)

In debug builds, a **Debug Transcribe (Google)** button appears. It runs Android's `SpeechRecognizer` once for manual testing. It is not used by the wake word pipeline.

## Architecture

- `WakeWordEngine` interface keeps the detection engine swappable
- `OpenWakeWordEngine` is the default implementation
- `PorcupineWakeWordEngine` remains as a secondary option
- Audio is captured via `AudioRecord` and shared between detection + WAV recording
