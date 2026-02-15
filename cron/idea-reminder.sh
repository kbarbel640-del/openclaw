#!/bin/bash
# Idea Reminder — ежедневное напоминание в 20:00

BOT_TOKEN="8574937400:AAHq_AzxkUVapMvSC66hMkC_1Vk8ensOuAU"
CHAT_ID="1993576661"
IDEAS_DIR="$HOME/moltbot/notes/ideas"
TODAY=$(date +%Y-%m-%d)

# Найти идеи для напоминания (старше 2 дней, не напоминали сегодня)
CANDIDATES=()
for STATUS_DIR in "$IDEAS_DIR/raw" "$IDEAS_DIR/ready"; do
  while IFS= read -r file; do
    # Пропустить если уже напоминали сегодня
    if grep -q "Последнее обращение: $TODAY" "$file"; then
      continue
    fi

    # Пропустить если создано меньше 2 дней назад
    CREATED=$(grep "Создано:" "$file" | cut -d: -f2- | xargs)
    DAYS_AGO=$(( ($(date +%s) - $(date -j -f "%Y-%m-%d" "$CREATED" +%s 2>/dev/null || echo 0)) / 86400 ))

    if [ "$DAYS_AGO" -ge 2 ]; then
      CANDIDATES+=("$file")
    fi
  done < <(find "$STATUS_DIR" -name "*.md" -type f 2>/dev/null)
done

# Если нет кандидатов — выход
if [ ${#CANDIDATES[@]} -eq 0 ]; then
  exit 0
fi

# Выбрать случайную идею
RANDOM_INDEX=$(( RANDOM % ${#CANDIDATES[@]} ))
IDEA_FILE="${CANDIDATES[$RANDOM_INDEX]}"

# Извлечь данные
IDEA_NAME=$(head -1 "$IDEA_FILE" | sed 's/^# //')
IDEA_STATUS=$(grep "Статус:" "$IDEA_FILE" | cut -d: -f2 | xargs)
IDEA_DESC=$(sed -n '/## Описание/,/##/p' "$IDEA_FILE" | tail -n +2 | head -n 3 | sed 's/^$//')
IDEA_CREATED=$(grep "Создано:" "$IDEA_FILE" | cut -d: -f2 | xargs)

# Сформировать сообщение
MESSAGE="🌱 Влад, помнишь мы обсуждали:

*$IDEA_NAME*

Статус: $IDEA_STATUS
Создано: $IDEA_CREATED

$IDEA_DESC

Что думаешь?"

# Отправить в Telegram
curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
  -d chat_id=$CHAT_ID \
  -d parse_mode=Markdown \
  -d text="$MESSAGE" \
  -d reply_markup='{
    "inline_keyboard": [[
      {"text": "✅ Взять в работу", "callback_data": "idea_work"},
      {"text": "⏰ Ещё не время", "callback_data": "idea_later"},
      {"text": "✔️ Выполнено", "callback_data": "idea_done"}
    ]]
  }' > /dev/null

# Обновить timestamp
sed -i '' "s/Последнее обращение:.*/Последнее обращение: $TODAY/" "$IDEA_FILE"
echo "- $(date +"%Y-%m-%d %H:%M"): напомнил через CRON" >> "$IDEA_FILE"

# Лог
echo "$(date): Напомнил про '$IDEA_NAME' (статус: $IDEA_STATUS)"
