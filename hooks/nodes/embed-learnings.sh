#!/bin/bash
# Генерация embeddings для всех записей в feedback.jsonl через Voyage AI

source ~/.claude/secrets.env

FEEDBACK_FILE="$HOME/moltbot/learnings/feedback.jsonl"
EMBEDDINGS_FILE="$HOME/moltbot/learnings/feedback-embeddings.jsonl"

if [ -z "$VOYAGE_API_KEY" ]; then
  echo "❌ VOYAGE_API_KEY не найден в ~/.claude/secrets.env"
  exit 1
fi

# Читаем каждую строку (пропускаем комментарии)
while IFS= read -r line; do
  # Пропускаем комментарии и пустые строки
  if [[ "$line" =~ ^# ]] || [ -z "$line" ]; then
    continue
  fi

  # Извлекаем input текст
  INPUT_TEXT=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('input',''))" 2>/dev/null)

  if [ -z "$INPUT_TEXT" ]; then
    continue
  fi

  # Проверяем есть ли уже embedding
  HAS_EMBEDDING=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'embedding' in d and d['embedding'] else 'no')" 2>/dev/null)

  if [ "$HAS_EMBEDDING" = "yes" ]; then
    echo "✓ Уже есть: $INPUT_TEXT"
    echo "$line" >> "$EMBEDDINGS_FILE.tmp"
    continue
  fi

  # Генерируем embedding через Voyage AI
  echo "🔄 Генерирую embedding: $INPUT_TEXT"

  ESCAPED_TEXT=$(echo "$INPUT_TEXT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")

  RESPONSE=$(curl -s --max-time 10 "https://api.voyageai.com/v1/embeddings" \
    -H "Authorization: Bearer $VOYAGE_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"input\":[$ESCAPED_TEXT],\"model\":\"voyage-3\"}")

  # Извлекаем embedding
  EMBEDDING=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['data'][0]['embedding']))" 2>/dev/null)

  if [ -n "$EMBEDDING" ] && [ "$EMBEDDING" != "null" ]; then
    # Добавляем embedding к записи
    UPDATED=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); d['embedding']=$EMBEDDING; print(json.dumps(d))")
    echo "$UPDATED" >> "$EMBEDDINGS_FILE.tmp"
    echo "✅ Готово"
  else
    echo "❌ Ошибка API: $RESPONSE"
    echo "$line" >> "$EMBEDDINGS_FILE.tmp"
  fi

  sleep 0.5  # Rate limiting

done < "$FEEDBACK_FILE"

# Перезаписываем оригинальный файл
if [ -f "$EMBEDDINGS_FILE.tmp" ]; then
  mv "$EMBEDDINGS_FILE.tmp" "$FEEDBACK_FILE"
  echo ""
  echo "✅ Все embeddings обновлены в $FEEDBACK_FILE"
fi
