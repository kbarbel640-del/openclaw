---
summary: "Chuyen van ban thanh giong noi (TTS) cho cac phan hoi gui ra"
read_when:
  - Bat chuc nang chuyen van ban thanh giong noi cho phan hoi
  - Cau hinh nha cung cap TTS hoac gioi han
  - Su dung lenh /tts
title: "Chuyen Van Ban Thanh Giong Noi"
x-i18n:
  source_path: tts.md
  source_hash: 070ff0cc8592f64c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:09:24Z
---

# Chuyen van ban thanh giong noi (TTS)

OpenClaw co the chuyen cac phan hoi gui ra thanh am thanh bang ElevenLabs, OpenAI, hoac Edge TTS.
Tinh nang nay hoat dong o bat ky noi nao OpenClaw co the gui am thanh; Telegram se hien bong bong ghi am hinh tron.

## Dich vu ho tro

- **ElevenLabs** (nha cung cap chinh hoac du phong)
- **OpenAI** (nha cung cap chinh hoac du phong; cung duoc dung cho tom tat)
- **Edge TTS** (nha cung cap chinh hoac du phong; su dung `node-edge-tts`, mac dinh khi khong co khoa API)

### Ghi chu ve Edge TTS

Edge TTS su dung dich vu TTS than kinh truc tuyen cua Microsoft Edge thong qua thu vien
`node-edge-tts`. Day la dich vu duoc luu tru (khong phai local), su dung cac diem cuoi cua Microsoft, va
khong yeu cau khoa API. `node-edge-tts` mo ra cac tuy chon cau hinh giong noi va
dinh dang dau ra, nhung khong phai tat ca cac tuy chon deu duoc ho tro boi dich vu Edge. citeturn2search0

Vi Edge TTS la mot dich vu web cong khai khong co SLA hay han ngach duoc cong bo, hay xem no o
muc best-effort. Neu can gioi han va ho tro duoc dam bao, hay su dung OpenAI hoac ElevenLabs.
Tai lieu Speech REST API cua Microsoft mo ta gioi han 10 phut am thanh moi yeu cau; Edge TTS
khong cong bo gioi han, vi vay hay gia dinh gioi han tuong duong hoac thap hon. citeturn0search3

## Khoa tuy chon

Neu ban muon dung OpenAI hoac ElevenLabs:

- `ELEVENLABS_API_KEY` (hoac `XI_API_KEY`)
- `OPENAI_API_KEY`

Edge TTS **khong** yeu cau khoa API. Neu khong tim thay khoa API nao, OpenClaw se mac dinh
su dung Edge TTS (tru khi bi tat qua `messages.tts.edge.enabled=false`).

Neu cau hinh nhieu nha cung cap, nha cung cap duoc chon se duoc su dung truoc va cac nha cung cap khac
la phuong an du phong. Tu dong tom tat su dung `summaryModel` (hoac `agents.defaults.model.primary`) da cau hinh,
vi vay nha cung cap do cung phai duoc xac thuc neu ban bat tom tat.

## Lien ket dich vu

- [Huong dan OpenAI Text-to-Speech](https://platform.openai.com/docs/guides/text-to-speech)
- [Tai lieu tham chieu OpenAI Audio API](https://platform.openai.com/docs/api-reference/audio)
- [ElevenLabs Text to Speech](https://elevenlabs.io/docs/api-reference/text-to-speech)
- [Xac thuc ElevenLabs](https://elevenlabs.io/docs/api-reference/authentication)
- [node-edge-tts](https://github.com/SchneeHertz/node-edge-tts)
- [Dinh dang dau ra Microsoft Speech](https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech#audio-outputs)

## Co duoc bat mac dinh khong?

Khong. Auto‑TTS **tat** theo mac dinh. Hay bat trong cau hinh bang
`messages.tts.auto` hoac theo tung phien bang `/tts always` (biet danh: `/tts on`).

Edge TTS **duoc** bat mac dinh khi TTS duoc bat, va se duoc su dung tu dong
khi khong co khoa API OpenAI hoac ElevenLabs.

## Cau hinh

Cau hinh TTS nam duoi `messages.tts` trong `openclaw.json`.
So do day du nam trong [Cau hinh Gateway](/gateway/configuration).

### Cau hinh toi thieu (bat + nha cung cap)

```json5
{
  messages: {
    tts: {
      auto: "always",
      provider: "elevenlabs",
    },
  },
}
```

### OpenAI lam chinh voi ElevenLabs du phong

```json5
{
  messages: {
    tts: {
      auto: "always",
      provider: "openai",
      summaryModel: "openai/gpt-4.1-mini",
      modelOverrides: {
        enabled: true,
      },
      openai: {
        apiKey: "openai_api_key",
        model: "gpt-4o-mini-tts",
        voice: "alloy",
      },
      elevenlabs: {
        apiKey: "elevenlabs_api_key",
        baseUrl: "https://api.elevenlabs.io",
        voiceId: "voice_id",
        modelId: "eleven_multilingual_v2",
        seed: 42,
        applyTextNormalization: "auto",
        languageCode: "en",
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.0,
          useSpeakerBoost: true,
          speed: 1.0,
        },
      },
    },
  },
}
```

### Edge TTS lam chinh (khong can khoa API)

```json5
{
  messages: {
    tts: {
      auto: "always",
      provider: "edge",
      edge: {
        enabled: true,
        voice: "en-US-MichelleNeural",
        lang: "en-US",
        outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        rate: "+10%",
        pitch: "-5%",
      },
    },
  },
}
```

### Tat Edge TTS

```json5
{
  messages: {
    tts: {
      edge: {
        enabled: false,
      },
    },
  },
}
```

### Gioi han tuy chinh + duong dan prefs

```json5
{
  messages: {
    tts: {
      auto: "always",
      maxTextLength: 4000,
      timeoutMs: 30000,
      prefsPath: "~/.openclaw/settings/tts.json",
    },
  },
}
```

### Chi tra loi bang am thanh sau khi nhan tin nhan giong noi dau vao

```json5
{
  messages: {
    tts: {
      auto: "inbound",
    },
  },
}
```

### Tat tu dong tom tat cho cac phan hoi dai

```json5
{
  messages: {
    tts: {
      auto: "always",
    },
  },
}
```

Sau do chay:

```
/tts summary off
```

### Ghi chu ve cac truong

- `auto`: che do auto‑TTS (`off`, `always`, `inbound`, `tagged`).
  - `inbound` chi gui am thanh sau khi co tin nhan giong noi dau vao.
  - `tagged` chi gui am thanh khi phan hoi co the `[[tts]]`.
- `enabled`: cong tac ke thua (doctor se chuyen no sang `auto`).
- `mode`: `"final"` (mac dinh) hoac `"all"` (bao gom ca phan hoi tu tool/block).
- `provider`: `"elevenlabs"`, `"openai"`, hoac `"edge"` (tu dong du phong).
- Neu `provider` **chua dat**, OpenClaw uu tien `openai` (neu co khoa), sau do `elevenlabs` (neu co khoa),
  neu khong thi `edge`.
- `summaryModel`: mo hinh gia re tuy chon cho tu dong tom tat; mac dinh la `agents.defaults.model.primary`.
  - Chap nhan `provider/model` hoac biet danh mo hinh da cau hinh.
- `modelOverrides`: cho phep mo hinh phat ra chi dan TTS (bat mac dinh).
- `maxTextLength`: gioi han cung cho dau vao TTS (ky tu). `/tts audio` se that bai neu vuot qua.
- `timeoutMs`: thoi gian cho yeu cau (ms).
- `prefsPath`: ghi de duong dan JSON prefs cuc bo (nha cung cap/gioi han/tom tat).
- `apiKey` se lay gia tri tu bien moi truong (`ELEVENLABS_API_KEY`/`XI_API_KEY`, `OPENAI_API_KEY`).
- `elevenlabs.baseUrl`: ghi de URL co so API ElevenLabs.
- `elevenlabs.voiceSettings`:
  - `stability`, `similarityBoost`, `style`: `0..1`
  - `useSpeakerBoost`: `true|false`
  - `speed`: `0.5..2.0` (1.0 = binh thuong)
- `elevenlabs.applyTextNormalization`: `auto|on|off`
- `elevenlabs.languageCode`: ma ISO 639-1 2 ky tu (vi du: `en`, `de`)
- `elevenlabs.seed`: so nguyen `0..4294967295` (tinh xac dinh tot nhat co the)
- `edge.enabled`: cho phep su dung Edge TTS (mac dinh `true`; khong can khoa API).
- `edge.voice`: ten giong noi than kinh Edge (vi du: `en-US-MichelleNeural`).
- `edge.lang`: ma ngon ngu (vi du: `en-US`).
- `edge.outputFormat`: dinh dang dau ra Edge (vi du: `audio-24khz-48kbitrate-mono-mp3`).
  - Xem Microsoft Speech output formats de biet gia tri hop le; khong phai tat ca dinh dang deu duoc Edge ho tro.
- `edge.rate` / `edge.pitch` / `edge.volume`: chuoi phan tram (vi du: `+10%`, `-5%`).
- `edge.saveSubtitles`: ghi phu de JSON ben canh tep am thanh.
- `edge.proxy`: URL proxy cho cac yeu cau Edge TTS.
- `edge.timeoutMs`: ghi de thoi gian cho yeu cau (ms).

## Ghi de do mo hinh dieu khien (bat mac dinh)

Theo mac dinh, mo hinh **co the** phat ra chi dan TTS cho mot phan hoi don le.
Khi `messages.tts.auto` la `tagged`, cac chi dan nay la bat buoc de kich hoat am thanh.

Khi duoc bat, mo hinh co the phat ra cac chi dan `[[tts:...]]` de ghi de giong noi
cho mot phan hoi don le, cung voi khoi `[[tts:text]]...[[/tts:text]]` tuy chon de
cung cap the bieu cam (cuoi, goi hat, v.v.) chi nen xuat hien trong am thanh.

Vi du payload phan hoi:

```
Here you go.

[[tts:provider=elevenlabs voiceId=pMsXgVXv3BLzUgSXRplE model=eleven_v3 speed=1.1]]
[[tts:text]](laughs) Read the song once more.[[/tts:text]]
```

Cac khoa chi dan co san (khi duoc bat):

- `provider` (`openai` | `elevenlabs` | `edge`)
- `voice` (giong noi OpenAI) hoac `voiceId` (ElevenLabs)
- `model` (mo hinh TTS OpenAI hoac id mo hinh ElevenLabs)
- `stability`, `similarityBoost`, `style`, `speed`, `useSpeakerBoost`
- `applyTextNormalization` (`auto|on|off`)
- `languageCode` (ISO 639-1)
- `seed`

Tat tat ca ghi de do mo hinh:

```json5
{
  messages: {
    tts: {
      modelOverrides: {
        enabled: false,
      },
    },
  },
}
```

Allowlist tuy chon (tat mot so ghi de cu the trong khi van giu the):

```json5
{
  messages: {
    tts: {
      modelOverrides: {
        enabled: true,
        allowProvider: false,
        allowSeed: false,
      },
    },
  },
}
```

## Tuy chon theo nguoi dung

Lenh slash ghi cac ghi de cuc bo vao `prefsPath` (mac dinh:
`~/.openclaw/settings/tts.json`, ghi de bang `OPENCLAW_TTS_PREFS` hoac
`messages.tts.prefsPath`).

Cac truong duoc luu:

- `enabled`
- `provider`
- `maxLength` (nguong tom tat; mac dinh 1500 ky tu)
- `summarize` (mac dinh `true`)

Nhung gia tri nay ghi de `messages.tts.*` cho host do.

## Dinh dang dau ra (co dinh)

- **Telegram**: ghi am Opus (`opus_48000_64` tu ElevenLabs, `opus` tu OpenAI).
  - 48kHz / 64kbps la lua chon tot cho ghi am giong noi va bat buoc de co bong bong hinh tron.
- **Cac kenh khac**: MP3 (`mp3_44100_128` tu ElevenLabs, `mp3` tu OpenAI).
  - 44.1kHz / 128kbps la can bang mac dinh cho do ro giong noi.
- **Edge TTS**: su dung `edge.outputFormat` (mac dinh `audio-24khz-48kbitrate-mono-mp3`).
  - `node-edge-tts` chap nhan `outputFormat`, nhung khong phai tat ca dinh dang
    deu co san tu dich vu Edge. citeturn2search0
  - Gia tri dinh dang dau ra tuan theo Microsoft Speech output formats (bao gom Ogg/WebM Opus). citeturn1search0
  - Telegram `sendVoice` chap nhan OGG/MP3/M4A; hay dung OpenAI/ElevenLabs neu ban can
    ghi am Opus duoc dam bao. citeturn1search1
  - Neu dinh dang dau ra Edge da cau hinh that bai, OpenClaw se thu lai voi MP3.

Cac dinh dang cua OpenAI/ElevenLabs la co dinh; Telegram mong doi Opus de co UX ghi am.

## Hanh vi Auto‑TTS

Khi duoc bat, OpenClaw:

- bo qua TTS neu phan hoi da chua media hoac chi dan `MEDIA:`.
- bo qua cac phan hoi rat ngan (< 10 ky tu).
- tom tat cac phan hoi dai khi duoc bat bang `agents.defaults.model.primary` (hoac `summaryModel`).
- dinh kem am thanh da tao vao phan hoi.

Neu phan hoi vuot qua `maxLength` va tom tat bi tat (hoac khong co khoa API cho
mo hinh tom tat), am thanh
se bi bo qua va chi gui phan hoi van ban binh thuong.

## So do luong

```
Reply -> TTS enabled?
  no  -> send text
  yes -> has media / MEDIA: / short?
          yes -> send text
          no  -> length > limit?
                   no  -> TTS -> attach audio
                   yes -> summary enabled?
                            no  -> send text
                            yes -> summarize (summaryModel or agents.defaults.model.primary)
                                      -> TTS -> attach audio
```

## Su dung lenh slash

Chi co mot lenh: `/tts`.
Xem [Slash commands](/tools/slash-commands) de biet chi tiet bat.

Ghi chu cho Discord: `/tts` la lenh tich hop san cua Discord, vi vay OpenClaw dang ky
`/voice` lam lenh goc o do. Van ban `/tts ...` van hoat dong.

```
/tts off
/tts always
/tts inbound
/tts tagged
/tts status
/tts provider openai
/tts limit 2000
/tts summary off
/tts audio Hello from OpenClaw
```

Ghi chu:

- Lenh yeu cau nguoi gui duoc uy quyen (quy tac allowlist/owner van ap dung).
- `commands.text` hoac dang ky lenh goc phai duoc bat.
- `off|always|inbound|tagged` la cong tac theo phien (`/tts on` la biet danh cua `/tts always`).
- `limit` va `summary` duoc luu trong prefs cuc bo, khong phai cau hinh chinh.
- `/tts audio` tao mot phan hoi am thanh don le (khong bat/tat TTS).

## Cong cu agent

Cong cu `tts` chuyen van ban thanh giong noi va tra ve duong dan `MEDIA:`. Khi
ket qua tuong thich voi Telegram, cong cu se bao gom `[[audio_as_voice]]` de
Telegram gui bong bong giong noi.

## Gateway RPC

Cac phuong thuc Gateway:

- `tts.status`
- `tts.enable`
- `tts.disable`
- `tts.convert`
- `tts.setProvider`
- `tts.providers`
