---
summary: "Ke hoach: Them endpoint OpenResponses /v1/responses va loai bo chat completions mot cach gon gang"
owner: "openclaw"
status: "draft"
last_updated: "2026-01-19"
title: "Ke hoach Gateway OpenResponses"
x-i18n:
  source_path: experiments/plans/openresponses-gateway.md
  source_hash: 71a22c48397507d1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:19Z
---

# Ke hoach Tich hop Gateway OpenResponses

## Bo canh

Gateway OpenClaw hien dang cung cap mot endpoint Chat Completions tuong thich OpenAI o muc toi thieu tai
`/v1/chat/completions` (xem [OpenAI Chat Completions](/gateway/openai-http-api)).

Open Responses la mot tieu chuan suy luan mo dua tren OpenAI Responses API. No duoc thiet ke
cho cac quy trinh agentic va su dung dau vao dua tren item cung voi cac su kien streaming ngu nghia. Dac ta
OpenResponses dinh nghia `/v1/responses`, khong phai `/v1/chat/completions`.

## Muc tieu

- Them mot endpoint `/v1/responses` tuan thu ngu nghia OpenResponses.
- Giu Chat Completions nhu mot lop tuong thich de dang tat va cuoi cung loai bo.
- Chuan hoa viec xac thuc va phan tich bang cac schema tach biet, co the tai su dung.

## Khong phai muc tieu

- Dat day du tinh nang OpenResponses ngay lan dau (hinh anh, tep, cong cu duoc host).
- Thay the logic thuc thi agent noi bo hoac dieu phoi cong cu.
- Thay doi hanh vi `/v1/chat/completions` hien tai trong giai doan dau.

## Tom tat nghien cuu

Nguon: OpenResponses OpenAPI, trang dac ta OpenResponses, va bai viet blog cua Hugging Face.

Cac diem chinh rut ra:

- `POST /v1/responses` chap nhan cac truong `CreateResponseBody` nhu `model`, `input` (chuoi hoac
  `ItemParam[]`), `instructions`, `tools`, `tool_choice`, `stream`, `max_output_tokens`, va
  `max_tool_calls`.
- `ItemParam` la mot discriminated union gom:
  - cac item `message` voi cac vai tro `system`, `developer`, `user`, `assistant`
  - `function_call` va `function_call_output`
  - `reasoning`
  - `item_reference`
- Phan hoi thanh cong tra ve mot `ResponseResource` voi cac item `object: "response"`, `status`, va
  `output`.
- Streaming su dung cac su kien ngu nghia nhu:
  - `response.created`, `response.in_progress`, `response.completed`, `response.failed`
  - `response.output_item.added`, `response.output_item.done`
  - `response.content_part.added`, `response.content_part.done`
  - `response.output_text.delta`, `response.output_text.done`
- Dac ta yeu cau:
  - `Content-Type: text/event-stream`
  - `event:` phai khop voi truong JSON `type`
  - su kien ket thuc phai la gia tri literal `[DONE]`
- Cac item ly luan co the lo `content`, `encrypted_content`, va `summary`.
- Vi du cua HF bao gom `OpenResponses-Version: latest` trong request (header tuy chon).

## Kien truc de xuat

- Them `src/gateway/open-responses.schema.ts` chi chua cac schema Zod (khong import gateway).
- Them `src/gateway/openresponses-http.ts` (hoac `open-responses-http.ts`) cho `/v1/responses`.
- Giu `src/gateway/openai-http.ts` nguyen ven nhu mot bo chuyen doi tuong thich ke thua.
- Them cau hinh `gateway.http.endpoints.responses.enabled` (mac dinh `false`).
- Giu `gateway.http.endpoints.chatCompletions.enabled` doc lap; cho phep bat/tat rieng tung endpoint.
- Phat canh bao khi khoi dong neu Chat Completions duoc bat de bao hieu trang thai ke thua.

## Lo trinh loai bo Chat Completions

- Duy tri ranh gioi module nghiem ngat: khong dung chung kieu schema giua responses va chat completions.
- Bien Chat Completions thanh tuy chon qua cau hinh de co the tat ma khong can thay doi ma.
- Cap nhat tai lieu de gan nhan Chat Completions la ke thua khi `/v1/responses` on dinh.
- Buoc tuy chon trong tuong lai: anh xa request Chat Completions sang trinh xu ly Responses de don gian hoa
  lo trinh loai bo.

## Tap ho tro Giai doan 1

- Chap nhan `input` duoi dang chuoi hoac `ItemParam[]` voi cac vai tro thong diep va `function_call_output`.
- Trich xuat thong diep system va developer vao `extraSystemPrompt`.
- Su dung `user` hoac `function_call_output` gan nhat lam thong diep hien tai cho cac lan chay agent.
- Tu choi cac phan noi dung khong ho tro (image/file) voi `invalid_request_error`.
- Tra ve mot thong diep assistant don le voi noi dung `output_text`.
- Tra ve `usage` voi cac gia tri bang 0 cho den khi he thong tinh token duoc ket noi.

## Chien luoc xac thuc (Khong dung SDK)

- Trien khai cac schema Zod cho tap con duoc ho tro cua:
  - `CreateResponseBody`
  - `ItemParam` + cac union phan noi dung thong diep
  - `ResponseResource`
  - Cac hinh dang su kien streaming duoc gateway su dung
- Giu cac schema trong mot module duy nhat, tach biet de tranh lech va cho phep codegen trong tuong lai.

## Trien khai Streaming (Giai doan 1)

- Cac dong SSE co ca `event:` va `data:`.
- Trinh tu bat buoc (toi thieu kha dung):
  - `response.created`
  - `response.output_item.added`
  - `response.content_part.added`
  - `response.output_text.delta` (lap lai khi can)
  - `response.output_text.done`
  - `response.content_part.done`
  - `response.completed`
  - `[DONE]`

## Ke hoach Kiem thu va Xac minh

- Them bao phu e2e cho `/v1/responses`:
  - Yeu cau xac thuc
  - Hinh dang phan hoi khong streaming
  - Thu tu su kien stream va `[DONE]`
  - Dinh tuyen session voi header va `user`
- Giu `src/gateway/openai-http.e2e.test.ts` khong thay doi.
- Thu cong: curl den `/v1/responses` voi `stream: true` va xac minh thu tu su kien va su kien ket thuc
  `[DONE]`.

## Cap nhat Tai lieu (Theo sau)

- Them mot trang tai lieu moi cho cach su dung va vi du `/v1/responses`.
- Cap nhat `/gateway/openai-http-api` voi ghi chu ke thua va lien ket den `/v1/responses`.
