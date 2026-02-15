#!/bin/bash
# Idea Capture Trigger — автоматический захват идей из сообщений
# Вызывается на каждое сообщение, проверяет является ли оно идеей

# Читаем входной JSON с prompt
INPUT=$(cat)
USER_MSG=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('prompt','').strip())" 2>/dev/null)

# Пропускаем heartbeat/system
if echo "$USER_MSG" | grep -qiE '^(HEARTBEAT|heartbeat_ok|📊|Context check)'; then
  exit 0
fi

# Пропускаем пустые и очень короткие
if [ -z "$USER_MSG" ] || [ ${#USER_MSG} -lt 10 ]; then
  exit 0
fi

# Запускаем Python-скрипт для анализа
RESULT=$(echo "$USER_MSG" | python3 /Users/vladdick/moltbot/scripts/idea-capture.py 2>/dev/null)

# Парсим JSON
IS_IDEA=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('is_idea') else 'false')" 2>/dev/null)
CONFIDENCE=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('confidence',0))" 2>/dev/null)
ACTION=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('action','none'))" 2>/dev/null)
TITLE=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title',''))" 2>/dev/null)
FILEPATH=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('filepath',''))" 2>/dev/null)

# Высокая уверенность — сохранено автоматически
if [ "$IS_IDEA" = "true" ] && [ "$ACTION" = "saved" ]; then
  cat << EOF

💡 **Автоматически сохранена идея** (уверенность: $CONFIDENCE/10)
**$TITLE**
📁 \`$FILEPATH\`

Хочешь уточнить или связать с другими идеями?
EOF
fi

# Средняя уверенность — нужно уточнить
if [ "$IS_IDEA" = "true" ] && [ "$ACTION" = "needs_clarification" ]; then
  cat << EOF

⚡ **Возможно, идея:** "$TITLE" (уверенность: $CONFIDENCE/10)

Уточни, чтобы я сохранил:
- Это про проект/инструмент или просто мысль?
- Какую проблему решает?

[Сохранить как Seed] [Уточнить] [Не идея, пропустить]
EOF
fi

exit 0
