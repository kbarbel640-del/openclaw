#!/bin/bash
# Idea Capture — классификация идей через Kimi K2.5

# Read stdin JSON
INPUT=$(cat)
USER_MSG=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('prompt',''))" 2>/dev/null)

if [ -z "$USER_MSG" ]; then
  exit 0
fi

# API keys
source ~/.claude/secrets.env
NVIDIA_API_KEY="${NVIDIA_NIM_API_KEY}"

if [ -z "$NVIDIA_API_KEY" ]; then
  exit 0
fi

# Промпт для классификации (escaped for JSON)
SYSTEM_PROMPT=$(cat << 'PROMPT_EOF'
Ты — классификатор идей для Влада. Определи это идея или нет. МАРКЕРЫ ИДЕИ: "надо", "нужно", "сделать", "создать", "можно попробовать", "хочу", "было бы круто". МАРКЕРЫ НЕ ИДЕИ: "запусти", "проверь", "сделай", "почему", "чувствую", "грустно". УВЕРЕННОСТЬ: 8-10 (точно идея, всё понятно) status: ready, 4-7 (похоже на идею, нужны уточнения) status: raw с вопросами, 0-3 (не идея) status: skip. Верни ТОЛЬКО JSON без markdown: {"confidence": 9, "status": "ready", "title": "Краткое название идеи (3-5 слов)", "description": "Суть идеи в 1-2 предложениях", "questions": []}. Если status=raw добавь 1-2 уточняющих вопроса в questions.
PROMPT_EOF
)

# Escape both messages for JSON
ESCAPED_SYSTEM=$(echo "$SYSTEM_PROMPT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")
ESCAPED_MSG=$(echo "$USER_MSG" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")

# Call Kimi K2.5 через NVIDIA NIM
RESPONSE=$(curl -s --max-time 10 "https://integrate.api.nvidia.com/v1/chat/completions" \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"moonshotai/kimi-k2.5\",\"messages\":[{\"role\":\"system\",\"content\":$ESCAPED_SYSTEM},{\"role\":\"user\",\"content\":$ESCAPED_MSG}],\"max_tokens\":300}" 2>/dev/null)

# Extract JSON
RESULT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])" 2>/dev/null)

# Fallback если API не ответил - простая классификация по ключевым словам
if [ -z "$RESULT" ]; then
  # Проверяем маркеры идеи
  if echo "$USER_MSG" | grep -Eqi "надо|нужно|сделать|создать|можно|хочу|было бы"; then
    # Это похоже на идею - сохраняем в ready
    RESULT="{\"confidence\": 8, \"status\": \"ready\", \"title\": \"Идея: $(echo "$USER_MSG" | head -c 40)...\", \"description\": \"$USER_MSG\", \"questions\": []}"
  else
    # Не похоже на идею
    exit 0
  fi
fi

# Parse classification
CONFIDENCE=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('confidence',0))" 2>/dev/null)
STATUS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','skip'))" 2>/dev/null)
TITLE=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title',''))" 2>/dev/null)
DESC=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('description',''))" 2>/dev/null)

# Skip если не идея
if [ "$STATUS" = "skip" ]; then
  exit 0
fi

# Создать файл идеи
IDEAS_DIR="$HOME/moltbot/notes/ideas"
DATE=$(date +%Y-%m-%d)
TIME=$(date +"%Y-%m-%d %H:%M")
SAFE_TITLE=$(echo "$TITLE" | tr '/' '-' | tr ' ' '-' | tr -cd '[:alnum:]-')
FILE_PATH="$IDEAS_DIR/$STATUS/$SAFE_TITLE.md"

cat > "$FILE_PATH" << IDEAEOF
# $TITLE

**Статус:** $STATUS
**Создано:** $DATE
**Последнее обращение:** $DATE

## Описание
$DESC

Оригинал: "$USER_MSG"

IDEAEOF

# Добавить вопросы если raw
if [ "$STATUS" = "raw" ]; then
  echo "## Вопросы для уточнения" >> "$FILE_PATH"
  echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'- {q}') for q in d.get('questions',[])]" >> "$FILE_PATH"
  echo "" >> "$FILE_PATH"
fi

# История
echo "## История" >> "$FILE_PATH"
echo "- $TIME: создана (confidence: $CONFIDENCE/10)" >> "$FILE_PATH"

# Вывод для пользователя
if [ "$STATUS" = "ready" ]; then
  echo "💡 Сохранил идею: **$TITLE** → готова к работе"
elif [ "$STATUS" = "raw" ]; then
  echo "💭 Сохранил идею: **$TITLE** → требует уточнения"
  QUESTIONS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join([f'  - {q}' for q in d.get('questions',[])]))")
  echo "Вопросы:"
  echo "$QUESTIONS"
fi
