#!/bin/bash
# Groq Whisper transcription script
FILE="$1"
GROQ_KEY="${GROQ_API_KEY}"

curl -s -X POST "https://api.groq.com/openai/v1/audio/transcriptions" \
  -H "Authorization: Bearer ${GROQ_KEY}" \
  -F "file=@${FILE}" \
  -F "model=whisper-large-v3" \
  -F "language=ru" | jq -r '.text // empty'
