# RAG Learning System — Инструкция

## Что это?

Система псевдообучения через RAG (Retrieval Augmented Generation):

- Сохраняет примеры ошибок и правильных действий
- Ищет похожие ситуации через Voyage AI embeddings
- Автоматически добавляет релевантные примеры в промпт для Groq

## Файлы

```
moltbot/
├─ learnings/
│  ├─ feedback.jsonl          # База примеров + embeddings
│  └─ README.md               # Эта инструкция
├─ hooks/
│  ├─ prompt-master-v2.sh     # Новая версия с RAG
│  └─ nodes/
│     ├─ rag-search.sh        # Поиск похожих примеров
│     └─ embed-learnings.sh   # Генерация embeddings
└─ bin/
   └─ learn                   # Команда для добавления примеров
```

## Как использовать

### 1. Добавить новый пример обучения

Когда AI сделал что-то не так:

```bash
~/moltbot/bin/learn \
  "что ты сказал" \
  "что AI сделал" \
  "что должен был сделать" \
  "категория (optional)"
```

**Примеры:**

```bash
# AI создал задачу вместо того чтобы пропустить бытовуху
learn "надо в магазин" "создал задачу" "ignore" "reflection"

# AI сохранил идею вместо выполнения команды
learn "запусти сервер на 3000" "сохранил как идею" "выполнить команду" "task"

# AI не распознал идею
learn "можно сделать бота для учёта времени" "ничего не сделал" "сохранить идею" "idea"
```

### 2. Сгенерировать embeddings

После добавления новых примеров:

```bash
~/moltbot/hooks/nodes/embed-learnings.sh
```

Это создаст векторные представления через Voyage AI для всех записей без embeddings.

### 3. Тестировать поиск

Проверить что RAG находит релевантные примеры:

```bash
~/moltbot/hooks/nodes/rag-search.sh "надо создать новый проект" 3
```

Вывод покажет топ-3 похожих примера из истории.

### 4. Активировать в production

Заменить старый prompt-master на новый:

```bash
cd ~/moltbot/hooks
cp prompt-master.sh prompt-master-old.sh    # Бэкап
cp prompt-master-v2.sh prompt-master.sh     # Активация RAG
```

Или для теста можно редактировать `~/.openclaw/openclaw.json` → изменить путь к хуку.

## Формат feedback.jsonl

Каждая строка — JSON объект:

```json
{
  "input": "текст от пользователя",
  "claude_response": "что AI сделал (optional)",
  "correct_action": "что должен был сделать",
  "category": "idea|task|reflection|general",
  "embedding": [0.123, -0.456, ...],  // 1024 floats от Voyage AI
  "date": "2026-02-13"
}
```

## Как это работает

1. **Пользователь пишет** → `prompt-master-v2.sh` получает сообщение
2. **RAG поиск** → `rag-search.sh` ищет похожие примеры через Voyage AI
3. **Инжект в промпт** → добавляет топ-3 в системный промпт для Groq
4. **Groq структурирует** → с учётом исторических примеров
5. **Opus получает** → улучшенный промпт

## Мониторинг

Проверить сколько примеров в базе:

```bash
grep -v '^#' ~/moltbot/learnings/feedback.jsonl | grep -c '"input"'
```

Проверить сколько с embeddings:

```bash
grep '"embedding":' ~/moltbot/learnings/feedback.jsonl | wc -l
```

## Troubleshooting

**RAG не работает:**

- Проверь `source ~/.claude/secrets.env` → `echo $VOYAGE_API_KEY`
- Проверь права: `chmod +x ~/moltbot/hooks/nodes/*.sh`

**Embeddings не генерируются:**

- API ключ валиден?
- Rate limit — добавь `sleep` в embed-learnings.sh

**Плохие результаты поиска:**

- Нужно больше примеров (минимум 10-20)
- Проверь категории — может нужна более точная классификация
