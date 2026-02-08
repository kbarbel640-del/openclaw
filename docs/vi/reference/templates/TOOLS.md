---
summary: "Mẫu workspace cho TOOLS.md"
read_when:
  - Khởi tạo workspace thủ công
x-i18n:
  source_path: reference/templates/TOOLS.md
  source_hash: 3ed08cd537620749
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:16Z
---

# TOOLS.md - Ghi chú cục bộ

Skills xác định _cách_ các công cụ hoạt động. Tệp này dành cho các chi tiết _riêng của bạn_ — những thứ chỉ có trong thiết lập của bạn.

## Nội dung nên có

Những thứ như:

- Tên và vị trí camera
- Máy chủ SSH và bí danh
- Giọng nói ưa thích cho TTS
- Tên loa/phòng
- Biệt danh thiết bị
- Bất kỳ thứ gì phụ thuộc vào môi trường

## Ví dụ

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Vì sao tách riêng?

Skills được chia sẻ. Thiết lập của bạn là của bạn. Tách riêng giúp bạn cập nhật Skills mà không làm mất ghi chú, và chia sẻ Skills mà không làm lộ hạ tầng của bạn.

---

Hãy thêm bất cứ thứ gì giúp bạn làm việc hiệu quả. Đây là bảng ghi chú nhanh của bạn.
