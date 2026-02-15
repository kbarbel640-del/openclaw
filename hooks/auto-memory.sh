#!/bin/bash
# Auto-Memory Hook — автоматически анализирует чат и пишет в память
# Запускается раз в 5 сообщений через memory-counter trigger

COUNTER_FILE="/tmp/openclaw-msg-counter"
INPUT=$(cat)

# Пропускаем heartbeat/system
USER_MSG=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('prompt',''))" 2>/dev/null)
if echo "$USER_MSG" | grep -qiE '^(HEARTBEAT|heartbeat_ok|📊|Context check)'; then
  exit 0
fi

# Читаем счётчик
COUNT=0
if [ -f "$COUNTER_FILE" ]; then
  COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
fi

# Не каждые 5 сообщений — выходим
if [ $((COUNT % 5)) -ne 0 ]; then
  exit 0
fi

# Получаем последние сообщения из сессии (если доступно)
# Или используем текущий prompt как контекст
GROQ_KEY="${GROQ_API_KEY:-YOUR_GROQ_KEY_HERE}"

SYSTEM_PROMPT='Ты — Memory Extractor. Проанализируй сообщение пользователя и извлеки ВАЖНУЮ информацию для сохранения.

Извлекай ТОЛЬКО:
1. Решения или предпочтения пользователя
2. Новая информация (ключи, архитектура, планы)
3. Ошибки или уроки
4. Задачи поставленные или закрытые

Если ничего важного — ответь: "SKIP"
Если есть важное — ответь в формате:
TYPE: [decision|preference|error|lesson|task]
CONTENT: 1-3 предложения суть

Будь конкретен. Не добавляй воду.'

# Escape для JSON
ESCAPED_MSG=$(echo "$USER_MSG" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()[:2000]))" 2>/dev/null)

# Вызываем Groq
RESPONSE=$(curl -s --max-time 5 "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer $GROQ_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"llama-3.3-70b-versatile\",\"messages\":[{\"role\":\"system\",\"content\":\"$SYSTEM_PROMPT\"},{\"role\":\"user\",\"content\":$ESCAPED_MSG}],\"max_tokens\":150}" 2>/dev/null)

# Парсим результат
RESULT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])" 2>/dev/null)

# Если SKIP или пусто — выходим
if [ -z "$RESULT" ] || [ "$RESULT" = "SKIP" ] || echo "$RESULT" | grep -q "^SKIP"; then
  exit 0
fi

# Записываем в auto-memory
DATE=$(date +%Y-%m-%d)
AUTO_DIR="/Users/vladdick/moltbot/memory/auto"
mkdir -p "$AUTO_DIR"

echo "---" >> "$AUTO_DIR/$DATE.md"
echo "$(date '+%H:%M') | $RESULT" >> "$AUTO_DIR/$DATE.md"
echo "" >> "$AUTO_DIR/$DATE.md"

# Уведомление (тихое, в лог)
echo "[auto-memory] Записано: $RESULT" >&2

exit 0
