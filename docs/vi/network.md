---
summary: "Trung tâm mạng: bề mặt Gateway, ghép cặp, khám phá và bảo mật"
read_when:
  - Bạn cần tổng quan về kiến trúc mạng + bảo mật
  - Bạn đang gỡ lỗi truy cập local so với tailnet hoặc ghép cặp
  - Bạn muốn danh sách chuẩn các tài liệu về mạng
title: "Mạng"
x-i18n:
  source_path: network.md
  source_hash: 0fe4e7dbc8ddea31
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:37Z
---

# Trung tâm mạng

Trung tâm này liên kết các tài liệu cốt lõi về cách OpenClaw kết nối, ghép cặp và bảo mật
thiết bị trên localhost, LAN và tailnet.

## Mô hình cốt lõi

- [Kiến trúc Gateway](/concepts/architecture)
- [Giao thức Gateway](/gateway/protocol)
- [Runbook Gateway](/gateway)
- [Bề mặt web + chế độ bind](/web)

## Ghép cặp + định danh

- [Tổng quan ghép cặp (Tin nhan truc tiep + node)](/start/pairing)
- [Ghép cặp node do Gateway sở hữu](/gateway/pairing)
- [CLI Thiết bị (ghép cặp + xoay vòng token)](/cli/devices)
- [CLI Ghép cặp (phê duyệt Tin nhan truc tiep)](/cli/pairing)

Tin cậy cục bộ:

- Kết nối cục bộ (loopback hoặc địa chỉ tailnet của chính máy chủ Gateway) có thể được
  tự động phê duyệt ghép cặp để giữ trải nghiệm cùng máy mượt mà.
- Các client tailnet/LAN không cục bộ vẫn cần phê duyệt ghép cặp rõ ràng.

## Khám phá + truyền tải

- [Khám phá & truyền tải](/gateway/discovery)
- [Bonjour / mDNS](/gateway/bonjour)
- [Truy cập từ xa (SSH)](/gateway/remote)
- [Tailscale](/gateway/tailscale)

## Node + truyền tải

- [Tổng quan node](/nodes)
- [Giao thức Bridge (node legacy)](/gateway/bridge-protocol)
- [Runbook node: iOS](/platforms/ios)
- [Runbook node: Android](/platforms/android)

## Bảo mật

- [Tổng quan bảo mật](/gateway/security)
- [Tham chiếu cấu hình Gateway](/gateway/configuration)
- [Xu ly su co](/gateway/troubleshooting)
- [Doctor](/gateway/doctor)
