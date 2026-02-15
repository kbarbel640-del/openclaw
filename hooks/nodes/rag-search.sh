#!/bin/bash
# RAG поиск похожих примеров через Voyage AI cosine similarity
# Usage: ./rag-search.sh "текст запроса" [top_n]

QUERY="$1"
TOP_N="${2:-3}"  # По умолчанию топ-3

source ~/.claude/secrets.env

FEEDBACK_FILE="$HOME/moltbot/learnings/feedback.jsonl"

if [ -z "$QUERY" ]; then
  exit 0
fi

if [ -z "$VOYAGE_API_KEY" ]; then
  exit 0
fi

if [ ! -f "$FEEDBACK_FILE" ]; then
  exit 0
fi

# Генерируем embedding для запроса
ESCAPED_QUERY=$(echo "$QUERY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")

RESPONSE=$(curl -s --max-time 5 "https://api.voyageai.com/v1/embeddings" \
  -H "Authorization: Bearer $VOYAGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"input\":[$ESCAPED_QUERY],\"model\":\"voyage-3\"}" 2>/dev/null)

QUERY_EMBEDDING=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['data'][0]['embedding']))" 2>/dev/null)

# Fallback на keyword matching если Voyage API недоступен
if [ -z "$QUERY_EMBEDDING" ] || [ "$QUERY_EMBEDDING" = "null" ]; then
  # Простой keyword matching как fallback
  echo "📚 Примеры (keyword fallback):"
  grep -v '^#' "$FEEDBACK_FILE" | while IFS= read -r line; do
    INPUT=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('input',''))" 2>/dev/null)
    CORRECT=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('correct_action',''))" 2>/dev/null)
    if echo "$INPUT" | grep -qi "$QUERY"; then
      echo "- '$INPUT' → $CORRECT"
    fi
  done | head -"$TOP_N"
  exit 0
fi

# Поиск похожих через Python (cosine similarity)
python3 << PYEOF
import json
import math

def cosine_similarity(a, b):
    dot = sum(x*y for x,y in zip(a,b))
    mag_a = math.sqrt(sum(x*x for x in a))
    mag_b = math.sqrt(sum(x*x for x in b))
    return dot / (mag_a * mag_b) if mag_a and mag_b else 0

query_emb = json.loads('$QUERY_EMBEDDING')
results = []

with open('$FEEDBACK_FILE', 'r') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        try:
            data = json.loads(line)
            if 'embedding' not in data or not data['embedding']:
                continue

            score = cosine_similarity(query_emb, data['embedding'])
            results.append((score, data))
        except:
            continue

# Сортируем по score (desc) и берём топ-N
results.sort(reverse=True, key=lambda x: x[0])
top_results = results[:$TOP_N]

# Форматируем вывод
if top_results:
    print("📚 Похожие примеры из истории:")
    for score, data in top_results:
        print(f"- '{data['input']}' → {data['correct_action']} (score: {score:.2f})")
PYEOF
