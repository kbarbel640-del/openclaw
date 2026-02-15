#!/bin/bash
# Idea Callback Handler — обработка нажатий на кнопки idea capture

ACTION="$1"          # idea_work | idea_later | idea_done
IDEA_TITLE="$2"      # Название идеи из callback_data
CHAT_ID="$3"         # Telegram chat ID для ответа

IDEAS_DIR="$HOME/moltbot/notes/ideas"
BOT_TOKEN="8574937400:AAHq_AzxkUVapMvSC66hMkC_1Vk8ensOuAU"

# Найти файл идеи
find_idea_file() {
  for STATUS in raw ready done; do
    for file in "$IDEAS_DIR/$STATUS"/*.md; do
      if [ -f "$file" ]; then
        TITLE=$(head -1 "$file" | sed 's/^# //')
        if [ "$TITLE" = "$IDEA_TITLE" ]; then
          echo "$file"
          return 0
        fi
      fi
    done
  done
  return 1
}

IDEA_FILE=$(find_idea_file)

if [ -z "$IDEA_FILE" ]; then
  echo "❌ Идея не найдена: $IDEA_TITLE"
  exit 1
fi

case "$ACTION" in
  idea_work)
    # Переместить в ready
    FILENAME=$(basename "$IDEA_FILE")
    NEW_PATH="$IDEAS_DIR/ready/$FILENAME"

    if [ "$IDEA_FILE" != "$NEW_PATH" ]; then
      mv "$IDEA_FILE" "$NEW_PATH"
      sed -i '' "s/Статус: .*/Статус: ready/" "$NEW_PATH"
      echo "- $(date +"%Y-%m-%d %H:%M"): взял в работу (callback)" >> "$NEW_PATH"
    fi

    # Отправить ответ в Telegram
    curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
      -d chat_id=$CHAT_ID \
      -d text="✅ Отлично! Идея *$IDEA_TITLE* теперь в работе" \
      -d parse_mode=Markdown > /dev/null

    echo "✅ Переместил в ready: $IDEA_TITLE"
    ;;

  idea_done)
    # Переместить в done
    FILENAME=$(basename "$IDEA_FILE")
    NEW_PATH="$IDEAS_DIR/done/$FILENAME"

    mv "$IDEA_FILE" "$NEW_PATH"
    sed -i '' "s/Статус: .*/Статус: done/" "$NEW_PATH"
    echo "- $(date +"%Y-%m-%d %H:%M"): выполнено (callback)" >> "$NEW_PATH"

    # Отправить ответ
    curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
      -d chat_id=$CHAT_ID \
      -d text="🎉 Круто! Идея *$IDEA_TITLE* отмечена как выполненная" \
      -d parse_mode=Markdown > /dev/null

    echo "✅ Переместил в done: $IDEA_TITLE"
    ;;

  idea_later)
    # Обновить timestamp
    sed -i '' "s/Последнее обращение:.*/Последнее обращение: $(date +%Y-%m-%d)/" "$IDEA_FILE"
    echo "- $(date +"%Y-%m-%d %H:%M"): отложил (callback)" >> "$IDEA_FILE"

    # Отправить ответ
    curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
      -d chat_id=$CHAT_ID \
      -d text="👌 Хорошо, напомню позже про *$IDEA_TITLE*" \
      -d parse_mode=Markdown > /dev/null

    echo "✅ Обновил timestamp: $IDEA_TITLE"
    ;;

  *)
    echo "Unknown action: $ACTION"
    exit 1
    ;;
esac
