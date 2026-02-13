import os
import sys
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import io
import time
import logging
import subprocess

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tts-server")

app = FastAPI(title="Local Qwen3 TTS Server")

# Configuration
# Default to the Qwen3-TTS 1.7B Base model
DEFAULT_MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
MODEL_PATH = os.environ.get("TTS_MODEL_PATH", DEFAULT_MODEL_ID)
DEVICE = "cuda" if os.environ.get("USE_CUDA", "1") == "1" else "cpu"

# Reference audio (Eden's voice)
DEFAULT_REF_AUDIO = os.path.join(os.path.dirname(__file__), "default_ref.wav")
DEFAULT_REF_TEXT = "你好老大，我是Eden"

# Global state
qwen_model = None

# HACK: Bypass SoX check for qwen-tts
try:
    import sox
    sox.NO_SOX = True
    logger.info("SoX check bypassed, using ffmpeg as replacement")
except:
    logger.warning("SoX module not found, may cause issues")


class SpeechRequest(BaseModel):
    model: str = "default"
    input: str
    voice: str = "default"
    response_format: str = "mp3"
    speed: float = 1.0
    ref_audio: str = None
    ref_text: str = None


def load_model_qwen3():
    """
    Load Qwen3-TTS using the official Qwen3TTSModel wrapper.
    """
    global qwen_model
    logger.info(f"Loading Qwen3-TTS model: {MODEL_PATH} on {DEVICE}...")

    try:
        import torch
        from qwen_tts import Qwen3TTSModel

        qwen_model = Qwen3TTSModel.from_pretrained(
            MODEL_PATH,
            device_map=DEVICE,
            torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
        )
        logger.info("Qwen3-TTS loaded successfully (official wrapper).")

    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise RuntimeError(f"Could not load {MODEL_PATH}: {e}")


@app.on_event("startup")
async def startup_event():
    # Pre-load model on startup
    try:
        load_model_qwen3()
    except Exception as e:
        logger.error(f"Startup load failed: {e}. Will retry on first request.")


@app.post("/v1/audio/speech")
async def generate_speech(req: SpeechRequest):
    global qwen_model
    if qwen_model is None:
        load_model_qwen3()

    start_time = time.time()
    logger.info(f"Generating speech (len={len(req.input)} chars)")

    try:
        # Generate audio using Qwen3TTSModel
        # For Base model, we need ref_audio and ref_text for cloning/synthesis
        # If not provided, we can use a default built-in reference if available, or error out.
        # However, for generic "TTS" requests without voice clone params, Qwen3 Base might need a prompt.

        # NOTE: Qwen3-TTS-Base is primarily a Voice Clone model.
        # It requires a reference audio prompt to determine the voice.
        # If the user didn't provide one, we should probably fail or use a default placeholder if we had one.
        # For now, let's assume the user might provide one via extended params (not in standard OpenAI API),
        # or we throw an error if missing.

        # To make it compatible with standard OpenAI "speech" endpoint which just takes 'input' and 'voice',
        # we might need to map 'voice' to a preset ref_audio.

        # Simplified logic: if ref_audio is missing, use a dummy default (this might fail or produce random voice).
        # Better approach: The skill should document that ref_audio is needed or map 'voice' to files.

        # For this fix, we will try to use the 'voice_clone' API if ref is present,
        # otherwise we might fail or try an arbitrary generation if the model supports it.
        # Looking at Qwen3TTSModel source, generate_voice_clone REQUIRES ref_audio or voice_clone_prompt.

        ref_audio = req.ref_audio if req.ref_audio else DEFAULT_REF_AUDIO
        ref_text = req.ref_text if req.ref_text else DEFAULT_REF_TEXT

        # Fallback to default reference if user didn't provide ref_text but the file exists
        if ref_audio == DEFAULT_REF_AUDIO and not os.path.exists(ref_audio):
            # Try using the media inbound file
            media_ref = "C:\\Users\\User\\.openclaw\\media\\inbound\\file_7---576fefc7-1b59-476d-ae63-00e47ae5aeb7.ogg"
            if os.path.exists(media_ref):
                ref_audio = media_ref
                ref_text = DEFAULT_REF_TEXT

        wavs, sr = qwen_model.generate_voice_clone(
            text=req.input,
            ref_audio=ref_audio,
            ref_text=ref_text,
            language="Chinese",
            do_sample=False,
            repetition_penalty=1.2,
        )

        audio_data = wavs[0]  # Assuming batch size 1

        import soundfile as sf
        import io

        buffer = io.BytesIO()

        # Format handling
        if req.response_format == "telegram":
            # Telegram native format: OGG/Opus 16kHz mono 24kbps
            # First save to WAV
            temp_wav = io.BytesIO()
            sf.write(temp_wav, audio_data, sr, format="WAV")
            temp_wav.seek(0)

            # Convert to OGG/Opus using ffmpeg
            ogg_buffer = io.BytesIO()
            ffmpeg_cmd = [
                'ffmpeg', '-y',
                '-i', 'pipe:0',
                '-c:a', 'libopus',
                '-b:a', '24k',
                '-ac', '1',
                '-ar', '16000',
                '-f', 'ogg',
                'pipe:1'
            ]
            result = subprocess.run(
                ffmpeg_cmd,
                input=temp_wav.read(),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            ogg_buffer.write(result.stdout)
            ogg_buffer.seek(0)
            buffer = ogg_buffer
            media_type = "audio/ogg"
        else:
            format_map = {"mp3": "MP3", "opus": "OGG", "wav": "WAV", "pcm": "RAW"}
            sf_format = format_map.get(req.response_format, "MP3")
            sf.write(buffer, audio_data, sr, format=sf_format)
            buffer.seek(0)
            media_type = f"audio/{req.response_format}"
            if req.response_format == "pcm":
                media_type = "audio/pcm"

        logger.info(f"Generated in {time.time() - start_time:.2f}s ({req.response_format})")

        return Response(content=buffer.read(), media_type=media_type)

    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5050)
    args = parser.parse_args()
    uvicorn.run(app, host="0.0.0.0", port=args.port)
