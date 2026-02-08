---
summary: "Ghi chú giao thức RPC cho trình hướng dẫn huong dan ban dau và so do cau hinh"
read_when: "Thay đổi các bước của trình hướng dẫn huong dan ban dau hoặc các endpoint so do cau hinh"
title: "Onboarding và Giao thức Cau hinh"
x-i18n:
  source_path: experiments/onboarding-config-protocol.md
  source_hash: 55163b3ee029c024
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:59Z
---

# Onboarding + Giao thức Cau hinh

Mục đích: các bề mặt onboarding + cau hinh dùng chung trên CLI, ứng dụng macOS và Web UI.

## Thành phần

- Wizard engine (phiên dùng chung + lời nhắc + trạng thái huong dan ban dau).
- Onboarding trên CLI sử dụng cùng luồng wizard như các client UI.
- Gateway RPC cung cấp các endpoint wizard + so do cau hinh.
- Onboarding trên macOS sử dụng mô hình bước của wizard.
- Web UI hiển thị các biểu mẫu cau hinh từ JSON Schema + gợi ý UI.

## Gateway RPC

- `wizard.start` params: `{ mode?: "local"|"remote", workspace?: string }`
- `wizard.next` params: `{ sessionId, answer?: { stepId, value? } }`
- `wizard.cancel` params: `{ sessionId }`
- `wizard.status` params: `{ sessionId }`
- `config.schema` params: `{}`

Phản hồi (dạng)

- Wizard: `{ sessionId, done, step?, status?, error? }`
- So do cau hinh: `{ schema, uiHints, version, generatedAt }`

## Gợi ý UI

- `uiHints` được khóa theo đường dẫn; metadata tùy chọn (label/help/group/order/advanced/sensitive/placeholder).
- Các trường nhạy cảm được hiển thị dưới dạng input mật khẩu; không có lớp che dữ liệu.
- Các nút schema không được hỗ trợ sẽ quay về trình chỉnh sửa JSON thô.

## Ghi chú

- Tài liệu này là nơi duy nhất để theo dõi các refactor giao thức cho onboarding/cau hinh.
