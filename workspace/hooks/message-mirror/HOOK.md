# Message Mirror Hook

將所有進入的訊息鏡像到 Telegram Log 群組。

## Events

- `message.inbound` - 收到訊息時觸發

## Config

```yaml
hooks:
  message-mirror:
    enabled: true
    logBotToken: "8415477831:AAFeyWZS8iAPqrQxYG_e3CxDWR2IrgIxw68"
    logGroupId: "" # 待填入
```

## Format

```
📨 [頻道] 來源
時間: YYYY-MM-DD HH:mm
---
訊息內容
```
