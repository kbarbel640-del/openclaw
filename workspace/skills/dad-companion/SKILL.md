---
name: dad-companion
description: 爸爸陪伴語音系統 — ElevenLabs TTS 定時推送 LINE 語音給老爸
---

# Dad Companion 🧓

## 目的
用 ElevenLabs 高品質語音定時推送到爸爸的 LINE，陪伴老人家、建立生活節奏感。

## 聲音設定
- **Engine**: ElevenLabs
- **Voice**: George (JBFqnCBsd6RMkjVDRZzb) — 暖心說書人
- **Model**: eleven_multilingual_v2
- **Settings**: stability=0.55, similarity_boost=0.75

## 講稿原則
- 用「啊」「啦」「呢」結尾，不用「喔」
- 短句、自然斷句
- 像兒子跟爸爸說話的語氣
- 帶天氣、時間、農曆等實用資訊
- 下午場加小故事/俗語（上癮機制）

## 每日排程（台北時間）
| 時段 | 內容 |
|------|------|
| 07:00 | 早安 + 天氣 + 農曆/節氣 |
| 11:30 | 午餐提醒 + 台灣俗語 |
| 15:00 | 下午茶 + 小故事/舊時代趣聞 |
| 17:30 | 晚餐倒數 + 今天新聞一句話 |
| 21:00 | 晚安 + 明天天氣預告 |

## 技術流程
1. Cron 觸發 → 生成當日講稿（含天氣/農曆）
2. ElevenLabs API → mp3
3. ffmpeg → m4a (LINE 需要)
4. LINE Push API → 發送語音
