---
summary: "Sử dụng API hợp nhất của Qianfan để truy cập nhiều mô hình trong OpenClaw"
read_when:
  - Bạn muốn một khóa API duy nhất cho nhiều LLM
  - Bạn cần hướng dẫn thiết lập Baidu Qianfan
title: "Qianfan"
x-i18n:
  source_path: providers/qianfan.md
  source_hash: 2ca710b422f190b6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:02Z
---

# Hướng dẫn Nhà cung cấp Qianfan

Qianfan là nền tảng MaaS của Baidu, cung cấp **API hợp nhất** để định tuyến yêu cầu tới nhiều mô hình phía sau một
endpoint và khóa API duy nhất. Nền tảng này tương thích với OpenAI, vì vậy hầu hết các SDK OpenAI đều hoạt động chỉ bằng cách đổi base URL.

## Điều kiện tiên quyết

1. Tài khoản Baidu Cloud có quyền truy cập API Qianfan
2. Một khóa API từ bảng điều khiển Qianfan
3. OpenClaw đã được cài đặt trên hệ thống của bạn

## Lấy khóa API

1. Truy cập [Qianfan Console](https://console.bce.baidu.com/qianfan/ais/console/apiKey)
2. Tạo ứng dụng mới hoặc chọn ứng dụng hiện có
3. Tạo khóa API (định dạng: `bce-v3/ALTAK-...`)
4. Sao chép khóa API để sử dụng với OpenClaw

## Thiết lập CLI

```bash
openclaw onboard --auth-choice qianfan-api-key
```

## Tài liệu liên quan

- [Cấu hình OpenClaw](/gateway/configuration)
- [Nhà cung cấp mô hình](/concepts/model-providers)
- [Thiết lập tác tử](/concepts/agent)
- [Tài liệu API Qianfan](https://cloud.baidu.com/doc/qianfan-api/s/3m7of64lb)
