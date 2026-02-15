#!/bin/bash
# Prompt Master v2 — с RAG обучением
# Reads user message from stdin JSON, RAG search, sends to Groq LLM

# Read stdin JSON
INPUT=$(cat)
USER_MSG=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('prompt',''))" 2>/dev/null)

if [ -z "$USER_MSG" ]; then
  exit 0
fi

GROQ_KEY="${GROQ_API_KEY:-YOUR_GROQ_KEY_HERE}"
SCRIPT_DIR="$HOME/moltbot/hooks/nodes"

# === RAG ПОИСК ===
# Ищем похожие примеры из истории обучения
RAG_EXAMPLES=""
if [ -x "$SCRIPT_DIR/rag-search.sh" ]; then
  RAG_OUTPUT=$("$SCRIPT_DIR/rag-search.sh" "$USER_MSG" 3 2>/dev/null)
  if [ -n "$RAG_OUTPUT" ]; then
    RAG_EXAMPLES="\n\n=== ОБУЧЕНИЕ ИЗ ИСТОРИИ ===\n$RAG_OUTPUT\n=== КОНЕЦ ПРИМЕРОВ ===\n"
  fi
fi

# Базовый системный промпт
BASE_SYSTEM='Ты — Prompt Master для ИИ-ассистента Molt (Jarvis Влада). Получи сырое сообщение и создай структурированный промпт для Opus. Не отвечай сам.\n\n## Алгоритм\n1. Определи тип: confirm | code | fix | brainstorm | question | action | memory\n2. Создай промпт по шаблону:\n\n[ТИП]: [описание 3-7 слов]\n\nКонтекст: [что понятно из сообщения]\n\nИнструкции:\n- [шаги 2-5 пунктов]\n\nПравила:\n- Следуй SOUL.md\n- Подтверждай изменения файлов перед выполнением\n- Не обрезай контент без запроса\n- Делай ТОЛЬКО то что просят, не расширяй scope\n- Стримь прогресс если задача > 1 мин\n- Записывай в memory решения и ошибки\n\nОригинал: [сообщение без изменений]\n\n3. Дополни по типу:\n- confirm → Продолжай текущую задачу по плану\n- code → Изучи стиль проекта, проверь learnings и скиллы\n- fix → Сначала логи, проверь learnings на похожие баги\n- brainstorm → Полный текст, проверь скилл creative-thought-partner\n- question → Конкретно, не придумывай\n- action → Выполни и отчитайся, подтверди опасное\n- memory → memory_search, полный контекст\n\nНе добавляй мотивацию. Не пиши больше 200 слов. Не убирай оригинал.'

# Добавляем RAG примеры если есть
SYSTEM_PROMPT="${BASE_SYSTEM}${RAG_EXAMPLES}"

# Escape user message for JSON
ESCAPED_MSG=$(echo "$USER_MSG" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" 2>/dev/null)

# Call Groq API
RESPONSE=$(curl -s --max-time 7 "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer $GROQ_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"llama-3.3-70b-versatile\",\"messages\":[{\"role\":\"system\",\"content\":\"$SYSTEM_PROMPT\"},{\"role\":\"user\",\"content\":$ESCAPED_MSG}],\"max_tokens\":300}" 2>/dev/null)

# Extract LLM response
RESULT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])" 2>/dev/null)

if [ -n "$RESULT" ]; then
  echo "$RESULT"
else
  # Fallback
  echo "⚠️ ОБЯЗАТЕЛЬНО: Ответь на ВСЕ пункты. Не уверен → скажи прямо. Записать в memory если решение/ошибка."
fi
