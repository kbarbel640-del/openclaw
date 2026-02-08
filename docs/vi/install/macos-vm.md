---
summary: "Chạy OpenClaw trong một macOS VM được sandbox (cục bộ hoặc lưu trữ) khi bạn cần cô lập hoặc iMessage"
read_when:
  - Bạn muốn cô lập OpenClaw khỏi môi trường macOS chính của mình
  - Bạn muốn tích hợp iMessage (BlueBubbles) trong sandbox
  - Bạn muốn một môi trường macOS có thể đặt lại và sao chép
  - Bạn muốn so sánh các tùy chọn macOS VM cục bộ và lưu trữ
title: "macOS VM"
x-i18n:
  source_path: install/macos-vm.md
  source_hash: 4d1c85a5e4945f9f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:42Z
---

# OpenClaw trên macOS VM (Sandboxing)

## Mặc định được khuyến nghị (đa số người dùng)

- **VPS Linux nhỏ** cho Gateway luôn bật và chi phí thấp. Xem [VPS hosting](/vps).
- **Phần cứng chuyên dụng** (Mac mini hoặc máy Linux) nếu bạn muốn toàn quyền kiểm soát và **IP dân cư** cho tự động hóa trình duyệt. Nhiều trang chặn IP trung tâm dữ liệu, nên duyệt cục bộ thường hiệu quả hơn.
- **Kết hợp:** giữ Gateway trên một VPS rẻ, và kết nối Mac của bạn như một **node** khi cần tự động hóa trình duyệt/UI. Xem [Nodes](/nodes) và [Gateway remote](/gateway/remote).

Hãy dùng macOS VM khi bạn thực sự cần các khả năng chỉ có trên macOS (iMessage/BlueBubbles) hoặc muốn cô lập nghiêm ngặt khỏi chiếc Mac dùng hằng ngày.

## Các tùy chọn macOS VM

### VM cục bộ trên Apple Silicon Mac (Lume)

Chạy OpenClaw trong một macOS VM được sandbox trên Apple Silicon Mac hiện có của bạn bằng [Lume](https://cua.ai/docs/lume).

Điều này mang lại:

- Môi trường macOS đầy đủ nhưng được cô lập (máy host của bạn luôn sạch)
- Hỗ trợ iMessage qua BlueBubbles (không thể trên Linux/Windows)
- Đặt lại tức thì bằng cách sao chép VM
- Không cần phần cứng hay chi phí đám mây bổ sung

### Nhà cung cấp Mac lưu trữ (đám mây)

Nếu bạn muốn macOS trên đám mây, các nhà cung cấp Mac lưu trữ cũng phù hợp:

- [MacStadium](https://www.macstadium.com/) (Mac được lưu trữ)
- Các nhà cung cấp Mac lưu trữ khác cũng dùng được; làm theo tài liệu VM + SSH của họ

Khi đã có quyền truy cập SSH vào macOS VM, tiếp tục ở bước 6 bên dưới.

---

## Lộ trình nhanh (Lume, người dùng có kinh nghiệm)

1. Cài đặt Lume
2. `lume create openclaw --os macos --ipsw latest`
3. Hoàn tất Setup Assistant, bật Remote Login (SSH)
4. `lume run openclaw --no-display`
5. SSH vào, cài OpenClaw, cấu hình các kênh
6. Hoàn tất

---

## Những gì bạn cần (Lume)

- Apple Silicon Mac (M1/M2/M3/M4)
- macOS Sequoia hoặc mới hơn trên máy host
- ~60 GB dung lượng trống cho mỗi VM
- ~20 phút

---

## 1) Cài đặt Lume

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/trycua/cua/main/libs/lume/scripts/install.sh)"
```

Nếu `~/.local/bin` không có trong PATH của bạn:

```bash
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.zshrc && source ~/.zshrc
```

Xác minh:

```bash
lume --version
```

Tài liệu: [Lume Installation](https://cua.ai/docs/lume/guide/getting-started/installation)

---

## 2) Tạo macOS VM

```bash
lume create openclaw --os macos --ipsw latest
```

Lệnh này sẽ tải macOS và tạo VM. Một cửa sổ VNC sẽ tự động mở.

Lưu ý: Quá trình tải có thể mất thời gian tùy vào kết nối của bạn.

---

## 3) Hoàn tất Setup Assistant

Trong cửa sổ VNC:

1. Chọn ngôn ngữ và khu vực
2. Bỏ qua Apple ID (hoặc đăng nhập nếu bạn muốn iMessage sau này)
3. Tạo tài khoản người dùng (ghi nhớ tên người dùng và mật khẩu)
4. Bỏ qua tất cả các tính năng tùy chọn

Sau khi hoàn tất, bật SSH:

1. Mở System Settings → General → Sharing
2. Bật "Remote Login"

---

## 4) Lấy địa chỉ IP của VM

```bash
lume get openclaw
```

Tìm địa chỉ IP (thường là `192.168.64.x`).

---

## 5) SSH vào VM

```bash
ssh youruser@192.168.64.X
```

Thay `youruser` bằng tài khoản bạn đã tạo, và IP bằng IP của VM.

---

## 6) Cài đặt OpenClaw

Bên trong VM:

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Làm theo các lời nhắc onboarding để thiết lập nhà cung cấp mô hình (Anthropic, OpenAI, v.v.).

---

## 7) Cấu hình các kênh

Chỉnh sửa tệp cấu hình:

```bash
nano ~/.openclaw/openclaw.json
```

Thêm các kênh của bạn:

```json
{
  "channels": {
    "whatsapp": {
      "dmPolicy": "allowlist",
      "allowFrom": ["+15551234567"]
    },
    "telegram": {
      "botToken": "YOUR_BOT_TOKEN"
    }
  }
}
```

Sau đó đăng nhập WhatsApp (quét QR):

```bash
openclaw channels login
```

---

## 8) Chạy VM không cần giao diện

Dừng VM và khởi động lại không hiển thị:

```bash
lume stop openclaw
lume run openclaw --no-display
```

VM sẽ chạy nền. Daemon của OpenClaw giữ Gateway hoạt động.

Để kiểm tra trạng thái:

```bash
ssh youruser@192.168.64.X "openclaw status"
```

---

## Thưởng thêm: tích hợp iMessage

Đây là tính năng “ăn tiền” khi chạy trên macOS. Dùng [BlueBubbles](https://bluebubbles.app) để thêm iMessage vào OpenClaw.

Bên trong VM:

1. Tải BlueBubbles từ bluebubbles.app
2. Đăng nhập bằng Apple ID của bạn
3. Bật Web API và đặt mật khẩu
4. Trỏ webhook của BlueBubbles về gateway của bạn (ví dụ: `https://your-gateway-host:3000/bluebubbles-webhook?password=<password>`)

Thêm vào cấu hình OpenClaw của bạn:

```json
{
  "channels": {
    "bluebubbles": {
      "serverUrl": "http://localhost:1234",
      "password": "your-api-password",
      "webhookPath": "/bluebubbles-webhook"
    }
  }
}
```

Khởi động lại Gateway. Giờ tác tử của bạn có thể gửi và nhận iMessage.

Chi tiết thiết lập đầy đủ: [BlueBubbles channel](/channels/bluebubbles)

---

## Lưu một ảnh chuẩn (golden image)

Trước khi tùy biến thêm, chụp snapshot trạng thái sạch:

```bash
lume stop openclaw
lume clone openclaw openclaw-golden
```

Đặt lại bất cứ lúc nào:

```bash
lume stop openclaw && lume delete openclaw
lume clone openclaw-golden openclaw
lume run openclaw --no-display
```

---

## Chạy 24/7

Giữ VM luôn chạy bằng cách:

- Cắm nguồn cho Mac của bạn
- Tắt chế độ ngủ trong System Settings → Energy Saver
- Dùng `caffeinate` nếu cần

Để luôn bật thực sự, cân nhắc Mac mini chuyên dụng hoặc một VPS nhỏ. Xem [VPS hosting](/vps).

---

## Xử lý sự cố

| Vấn đề                   | Giải pháp                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Không SSH được vào VM    | Kiểm tra đã bật "Remote Login" trong System Settings của VM                         |
| Không thấy IP của VM     | Chờ VM khởi động hoàn tất, chạy lại `lume get openclaw`                             |
| Không tìm thấy lệnh Lume | Thêm `~/.local/bin` vào PATH của bạn                                                |
| QR WhatsApp không quét   | Đảm bảo bạn đăng nhập trong VM (không phải host) khi chạy `openclaw channels login` |

---

## Tài liệu liên quan

- [VPS hosting](/vps)
- [Nodes](/nodes)
- [Gateway remote](/gateway/remote)
- [BlueBubbles channel](/channels/bluebubbles)
- [Lume Quickstart](https://cua.ai/docs/lume/guide/getting-started/quickstart)
- [Lume CLI Reference](https://cua.ai/docs/lume/reference/cli-reference)
- [Unattended VM Setup](https://cua.ai/docs/lume/guide/fundamentals/unattended-setup) (nâng cao)
- [Docker Sandboxing](/install/docker) (cách cô lập thay thế)
