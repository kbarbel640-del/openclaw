#!/usr/bin/env bash
set -euo pipefail

# ElevenLabs Voice Clone CLI
# Usage: voice-clone.sh <action> [options]
#
# Actions:
#   clone    --name "Name" --files file1.mp3 [file2.mp3 ...]
#   list
#   generate --voice-id <id> --text "Text" --output file.mp3
#   delete   --voice-id <id>
#   settings --voice-id <id>
#
# Requires: ELEVENLABS_API_KEY

API_BASE="https://api.elevenlabs.io/v1"

check_api_key() {
  if [[ -z "${ELEVENLABS_API_KEY:-}" ]]; then
    echo "Error: ELEVENLABS_API_KEY environment variable is required"
    echo "Get a free key at https://elevenlabs.io"
    exit 1
  fi
}

clone_voice() {
  local name=""
  local description=""
  local files=()

  while [[ $# -gt 0 ]]; do
    case $1 in
      --name) name="$2"; shift 2 ;;
      --description) description="$2"; shift 2 ;;
      --files) shift; while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do files+=("$1"); shift; done ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
  done

  if [[ -z "$name" || ${#files[@]} -eq 0 ]]; then
    echo "Usage: voice-clone.sh clone --name \"Voice Name\" --files sample1.mp3 [sample2.mp3 ...]"
    echo ""
    echo "Tips for best results:"
    echo "  - Use 1-3 minutes of clean audio per sample"
    echo "  - Avoid background noise"
    echo "  - Supported formats: MP3, WAV, M4A, FLAC, OGG, WEBM"
    exit 1
  fi

  # Build the curl command with file uploads
  local curl_args=(-s -X POST "${API_BASE}/voices/add"
    -H "xi-api-key: ${ELEVENLABS_API_KEY}"
    -F "name=${name}")

  if [[ -n "$description" ]]; then
    curl_args+=(-F "description=${description}")
  fi

  for file in "${files[@]}"; do
    if [[ ! -f "$file" ]]; then
      echo "Error: File not found: $file"
      exit 1
    fi
    curl_args+=(-F "files=@${file}")
  done

  echo "Cloning voice '${name}' from ${#files[@]} sample(s)..."
  local response
  response=$(curl "${curl_args[@]}")

  local voice_id
  voice_id=$(echo "$response" | jq -r '.voice_id // empty')

  if [[ -n "$voice_id" ]]; then
    echo "Voice cloned successfully!"
    echo "  Voice ID: ${voice_id}"
    echo "  Name: ${name}"
    echo ""
    echo "Use this voice for TTS:"
    echo "  voice-clone.sh generate --voice-id ${voice_id} --text \"Hello world\" --output speech.mp3"
    echo ""
    echo "Configure as default OpenClaw TTS voice:"
    echo "  Add to ~/.openclaw/openclaw.json:"
    echo "  { messages: { tts: { provider: \"elevenlabs\", voiceId: \"${voice_id}\" } } }"
  else
    echo "Error cloning voice:"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    exit 1
  fi
}

list_voices() {
  echo "Fetching voices..."
  local response
  response=$(curl -s "${API_BASE}/voices" \
    -H "xi-api-key: ${ELEVENLABS_API_KEY}")

  local count
  count=$(echo "$response" | jq '.voices | length')
  echo "Found ${count} voice(s):"
  echo ""

  echo "$response" | jq -r '.voices[] | "  \(.voice_id)  \(.name)  [\(.category // "unknown")]  \(.labels | to_entries | map("\(.key)=\(.value)") | join(", "))"'
}

generate_speech() {
  local voice_id=""
  local text=""
  local output="speech.mp3"
  local model="eleven_multilingual_v2"
  local stability="0.5"
  local similarity="0.75"
  local style="0.5"

  while [[ $# -gt 0 ]]; do
    case $1 in
      --voice-id) voice_id="$2"; shift 2 ;;
      --text) text="$2"; shift 2 ;;
      --output) output="$2"; shift 2 ;;
      --model) model="$2"; shift 2 ;;
      --stability) stability="$2"; shift 2 ;;
      --similarity) similarity="$2"; shift 2 ;;
      --style) style="$2"; shift 2 ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
  done

  if [[ -z "$voice_id" || -z "$text" ]]; then
    echo "Usage: voice-clone.sh generate --voice-id <id> --text \"Text to speak\" [--output file.mp3]"
    echo ""
    echo "Options:"
    echo "  --model      Model ID (default: eleven_multilingual_v2)"
    echo "  --stability  0.0-1.0 (default: 0.5)"
    echo "  --similarity 0.0-1.0 (default: 0.75)"
    echo "  --style      0.0-1.0 (default: 0.5)"
    exit 1
  fi

  echo "Generating speech with voice ${voice_id}..."
  local http_code
  http_code=$(curl -s -w "%{http_code}" -X POST "${API_BASE}/text-to-speech/${voice_id}" \
    -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": $(echo "$text" | jq -Rs .),
      \"model_id\": \"${model}\",
      \"voice_settings\": {
        \"stability\": ${stability},
        \"similarity_boost\": ${similarity},
        \"style\": ${style},
        \"use_speaker_boost\": true
      }
    }" \
    --output "${output}")

  if [[ "$http_code" == "200" ]]; then
    local size
    size=$(wc -c < "$output")
    echo "Generated: ${output} (${size} bytes)"
  else
    echo "Error (HTTP ${http_code}):"
    cat "$output"
    rm -f "$output"
    exit 1
  fi
}

delete_voice() {
  local voice_id=""

  while [[ $# -gt 0 ]]; do
    case $1 in
      --voice-id) voice_id="$2"; shift 2 ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
  done

  if [[ -z "$voice_id" ]]; then
    echo "Usage: voice-clone.sh delete --voice-id <id>"
    exit 1
  fi

  echo "Deleting voice ${voice_id}..."
  local response
  response=$(curl -s -X DELETE "${API_BASE}/voices/${voice_id}" \
    -H "xi-api-key: ${ELEVENLABS_API_KEY}")

  echo "Voice deleted: ${voice_id}"
}

get_settings() {
  local voice_id=""

  while [[ $# -gt 0 ]]; do
    case $1 in
      --voice-id) voice_id="$2"; shift 2 ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
  done

  if [[ -z "$voice_id" ]]; then
    echo "Usage: voice-clone.sh settings --voice-id <id>"
    exit 1
  fi

  curl -s "${API_BASE}/voices/${voice_id}/settings" \
    -H "xi-api-key: ${ELEVENLABS_API_KEY}" | jq .
}

# Main dispatcher
check_api_key

ACTION="${1:-help}"
shift || true

case "$ACTION" in
  clone)    clone_voice "$@" ;;
  list)     list_voices ;;
  generate) generate_speech "$@" ;;
  delete)   delete_voice "$@" ;;
  settings) get_settings "$@" ;;
  help|--help|-h)
    echo "ElevenLabs Voice Clone CLI"
    echo ""
    echo "Usage: voice-clone.sh <action> [options]"
    echo ""
    echo "Actions:"
    echo "  clone     Clone a new voice from audio samples"
    echo "  list      List all available voices"
    echo "  generate  Generate speech with a voice"
    echo "  delete    Delete a cloned voice"
    echo "  settings  Get voice generation settings"
    echo ""
    echo "Examples:"
    echo "  voice-clone.sh clone --name \"MyVoice\" --files sample1.mp3 sample2.mp3"
    echo "  voice-clone.sh list"
    echo "  voice-clone.sh generate --voice-id abc123 --text \"Hello\" --output hello.mp3"
    echo "  voice-clone.sh delete --voice-id abc123"
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Run 'voice-clone.sh help' for usage"
    exit 1
    ;;
esac
