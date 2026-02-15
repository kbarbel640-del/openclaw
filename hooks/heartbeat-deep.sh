#!/bin/bash
# Heartbeat Deep — проверяет файлы/notes через DeepSeek (OpenRouter)
# Вызывается из cron как systemEvent → UserPromptSubmit hook

set -euo pipefail
cd "$(dirname "$0")/.."

OPENROUTER_KEY="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"
MODEL="deepseek/deepseek-chat"
API_URL="https://openrouter.ai/api/v1/chat/completions"

# Собираем контекст
PROJECTS=""
if [ -d "notes/projects" ]; then
  PROJECTS=$(ls -1 notes/projects/*.md 2>/dev/null | head -5 | while read f; do
    echo "=== $(basename "$f") ==="
    head -20 "$f"
    echo ""
  done)
fi

LEARNINGS=""
if [ -f "memory/learnings/global.md" ]; then
  LEARNINGS=$(tail -20 memory/learnings/global.md)
fi

TODAY=$(date +%Y-%m-%d)
DAILY=""
if [ -f "memory/${TODAY}.md" ]; then
  DAILY=$(tail -20 "memory/${TODAY}.md")
fi

PROMPT="Ты heartbeat-checker для AI-агента Molt. Проверь контекст и ответь КРАТКО (2-3 строки макс).

Проекты:
${PROJECTS:-нет файлов}

Последние learnings:
${LEARNINGS:-нет}

Дневной лог (${TODAY}):
${DAILY:-нет}

Вопросы:
1. Есть ли срочное/просроченное в проектах?
2. Есть ли нерешённые ошибки в learnings?
3. Есть ли что-то что стоит сообщить владельцу?

Если всё ок — ответь: ALL_OK
Если есть что-то — кратко опиши (на русском)."

# Вызов DeepSeek через OpenRouter
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_KEY" \
  -d "$(jq -n \
    --arg model "$MODEL" \
    --arg prompt "$PROMPT" \
    '{model: $model, max_tokens: 200, messages: [{role: "user", content: $prompt}]}')" \
  2>/dev/null)

ANSWER=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "ERROR: no response"' 2>/dev/null)

if echo "$ANSWER" | grep -qi 'ALL_OK'; then
  # Всё ок — ничего не выводим (cron не отправит в TG)
  exit 0
else
  # Есть что сообщить — выводим для инжекции
  echo "🔍 Heartbeat Deep (DeepSeek): $ANSWER"
fi
