---
summary: "Gửi các issue và báo cáo lỗi có tín hiệu cao"
title: "Gửi Issue"
x-i18n:
  source_path: help/submitting-an-issue.md
  source_hash: bcb33f05647e9f0d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:05Z
---

## Gửi Issue

Issue rõ ràng, súc tích giúp chẩn đoán và sửa lỗi nhanh hơn. Với lỗi, hồi quy hoặc thiếu tính năng, hãy bao gồm các mục sau:

### Những gì cần đưa vào

- [ ] Tiêu đề: khu vực & triệu chứng
- [ ] Các bước tái hiện tối thiểu
- [ ] Kết quả mong đợi so với thực tế
- [ ] Tác động & mức độ nghiêm trọng
- [ ] Môi trường: OS, runtime, phiên bản, cấu hình
- [ ] Bằng chứng: log đã lược bỏ thông tin nhạy cảm, ảnh chụp màn hình (không PII)
- [ ] Phạm vi: mới, hồi quy, hay tồn tại lâu
- [ ] Mã từ: lobster-biscuit trong issue của bạn
- [ ] Đã tìm trong codebase & GitHub xem có issue trùng
- [ ] Đã xác nhận chưa được sửa/giải quyết gần đây (đặc biệt là bảo mật)
- [ ] Khẳng định có bằng chứng hoặc cách tái hiện

Hãy ngắn gọn. Ngắn gọn > ngữ pháp hoàn hảo.

Xác thực (chạy/sửa trước PR):

- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm test`
- Nếu là mã giao thức: `pnpm protocol:check`

### Mẫu

#### Báo cáo lỗi

```md
- [ ] Minimal repro
- [ ] Expected vs actual
- [ ] Environment
- [ ] Affected channels, where not seen
- [ ] Logs/screenshots (redacted)
- [ ] Impact/severity
- [ ] Workarounds

### Summary

### Repro Steps

### Expected

### Actual

### Environment

### Logs/Evidence

### Impact

### Workarounds
```

#### Issue bảo mật

```md
### Summary

### Impact

### Versions

### Repro Steps (safe to share)

### Mitigation/workaround

### Evidence (redacted)
```

_Tránh đưa bí mật/chi tiết khai thác lên nơi công khai. Với issue nhạy cảm, hãy giảm thiểu chi tiết và yêu cầu tiết lộ riêng tư._

#### Báo cáo hồi quy

```md
### Summary

### Last Known Good

### First Known Bad

### Repro Steps

### Expected

### Actual

### Environment

### Logs/Evidence

### Impact
```

#### Yêu cầu tính năng

```md
### Summary

### Problem

### Proposed Solution

### Alternatives

### Impact

### Evidence/examples
```

#### Cải tiến

```md
### Summary

### Current vs Desired Behavior

### Rationale

### Alternatives

### Evidence/examples
```

#### Điều tra

```md
### Summary

### Symptoms

### What Was Tried

### Environment

### Logs/Evidence

### Impact
```

### Gửi PR sửa lỗi

Có issue trước PR là tùy chọn. Nếu bỏ qua, hãy đưa chi tiết vào PR. Giữ PR tập trung, nêu số issue, thêm test hoặc giải thích lý do thiếu test, ghi lại thay đổi hành vi/rủi ro, đính kèm log/ảnh chụp màn hình đã lược bỏ thông tin nhạy cảm làm bằng chứng, và chạy xác thực phù hợp trước khi gửi.
