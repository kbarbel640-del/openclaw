#!/bin/bash
# Auto-Memory Hook — автоматически анализирует чат и пишет в память
# Запускается через agentHooks.UserPromptSubmit

# Получаем prompt из JSON stdin
INPUT=$(cat)
USER_MSG=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('prompt','').strip())" 2>/dev/null)

# === ФИЛЬТР 1: Пропускаем служебные сообщения ===
if echo "$USER_MSG" | grep -qiE '^(HEARTBEAT|heartbeat_ok|📊|Context check|🔍|System:|Read HEARTBEAT)'; then
  exit 0
fi

# === ФИЛЬТР 2: Пропускаем короткие сообщения ===
if [ -z "$USER_MSG" ] || [ ${#USER_MSG} -lt 30 ]; then
  exit 0
fi

# === ФИЛЬТР 3: Пропускаем рутинные ответы ===
if echo "$USER_MSG" | grep -qiE '^(ок|понял|сделаю|хорошо|ясно|ага|done|ok|HEARTBEAT_OK)$'; then
  exit 0
fi

# === ФИЛЬТР 4: Проверяем ключевые слова проектов/решений ===
# Если нет ключевых слов — пропускаем (не пишем шум)
KEYWORDS=(
  'проект' 'система' 'автоматиз' 'скрипт' 'бот' 'приложение'
  'решение' 'план' 'идея' 'архитектура' 'протокол' 'алгоритм'
  'ошибка' 'баг' 'фикс' 'проблема' 'решил' 'сделал' 'готово'
  'надо' 'нужно' 'стоит' 'создать' 'построить' 'запилить'
  'предпочитаю' 'люблю' 'не люблю' 'хочу' 'важно' 'критично'
  'content factory' 'ai secretar' 'molt' 'gateway' 'telegram'
  'код' 'фича' 'функция' 'модуль' 'компонент'
  'память' 'memory' 'контекст' 'конфиг' 'настройка'
)

HAS_KEYWORD=false
for keyword in "${KEYWORDS[@]}"; do
  if echo "$USER_MSG" | grep -qi "$keyword"; then
    HAS_KEYWORD=true
    break
  fi
done

if [ "$HAS_KEYWORD" = false ]; then
  exit 0
fi

# Счётчик сообщений (локальный)
COUNTER_FILE="/tmp/openclaw-auto-memory-counter"
COUNT=0
if [ -f "$COUNTER_FILE" ]; then
  COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
fi
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

# Запускаем только каждые 5 сообщений
if [ $((COUNT % 5)) -ne 0 ]; then
  exit 0
fi

# Проверяем GROQ ключ
GROQ_KEY="${GROQ_API_KEY}"
if [ -z "$GROQ_KEY" ] || [ "$GROQ_KEY" = "YOUR_GROQ_KEY_HERE" ]; then
  echo "[auto-memory] Ошибка: GROQ_API_KEY не установлен" >&2
  exit 0
fi

# Обрезаем сообщение для API (макс 1500 символов)
TRIMMED_MSG="${USER_MSG:0:1500}"

# Формируем JSON через Python (корректное эскейпирование)
JSON_PAYLOAD=$(python3 << PYEOF
import json

system_prompt = '''Ты — Memory Extractor. Проанализируй сообщение пользователя и извлеки ВАЖНУЮ информацию.

Извлекай ТОЛЬКО:
1. Решения или предпочтения пользователя
2. Новая информация (ключи, архитектура, планы)
3. Ошибки или уроки
4. Задачи поставленные или закрытые

Если ничего важного — ответь: "SKIP"
Если есть важное — ответь в формате:
TYPE: [decision|preference|error|lesson|task]
CONTENT: 1-3 предложения суть

Будь конкретен. Не добавляй воду.'''

user_msg = '''$TRIMMED_MSG'''

payload = {
    "model": "llama-3.3-70b-versatile",
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg}
    ],
    "max_tokens": 150,
    "temperature": 0.3
}

print(json.dumps(payload))
PYEOF
)

# Вызываем Groq с таймаутом
RESPONSE=$(curl -s --max-time 10 "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer $GROQ_KEY" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" 2>/dev/null)

# Проверяем ответ
if [ -z "$RESPONSE" ]; then
  exit 0
fi

# Проверяем на ошибку
if echo "$RESPONSE" | grep -q '"error"'; then
  exit 0
fi

# Парсим результат
RESULT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])" 2>/dev/null)

# Если ошибка или SKIP — выходим
if [ -z "$RESULT" ] || [ "$RESULT" = "SKIP" ] || echo "$RESULT" | grep -q "^SKIP"; then
  exit 0
fi

# === ФИЛЬТР 5: Проверяем что результат содержит осмысленный контент ===
if echo "$RESULT" | grep -qiE '^(SKIP|НЕТ|нет|ничего|пусто)'; then
  exit 0
fi

# Записываем в память
DATE=$(date +%Y-%m-%d)
AUTO_DIR="/Users/vladdick/moltbot/memory/auto"
mkdir -p "$AUTO_DIR"

echo "---" >> "$AUTO_DIR/$DATE.md"
echo "$(date '+%H:%M') | $RESULT" >> "$AUTO_DIR/$DATE.md"
echo "" >> "$AUTO_DIR/$DATE.md"

# Уведомление (тихое)
echo "[auto-memory] Записано в память" >&2

exit 0
