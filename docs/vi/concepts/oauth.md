---
summary: "OAuth trong OpenClaw: trao đổi token, lưu trữ và các mô hình nhiều tài khoản"
read_when:
  - Bạn muốn hiểu OAuth trong OpenClaw từ đầu đến cuối
  - Bạn gặp vấn đề token bị vô hiệu hóa / đăng xuất
  - Bạn muốn dùng luồng setup-token hoặc xác thực OAuth
  - Bạn muốn dùng nhiều tài khoản hoặc định tuyến theo hồ sơ
title: "OAuth"
x-i18n:
  source_path: concepts/oauth.md
  source_hash: af714bdadc4a8929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:48Z
---

# OAuth

OpenClaw hỗ trợ “xác thực thuê bao” qua OAuth cho các nhà cung cấp có hỗ trợ (đáng chú ý là **OpenAI Codex (ChatGPT OAuth)**). Với thuê bao Anthropic, hãy dùng luồng **setup-token**. Trang này giải thích:

- cách hoạt động của **trao đổi token** OAuth (PKCE)
- **nơi lưu trữ** token (và lý do)
- cách xử lý **nhiều tài khoản** (hồ sơ + ghi đè theo phiên)

OpenClaw cũng hỗ trợ **plugin nhà cung cấp** tự triển khai OAuth hoặc luồng API‑key riêng. Chạy chúng bằng:

```bash
openclaw models auth login --provider <id>
```

## Bể chứa token (vì sao cần)

Các nhà cung cấp OAuth thường phát hành **refresh token mới** trong quá trình đăng nhập/làm mới. Một số nhà cung cấp (hoặc client OAuth) có thể vô hiệu hóa các refresh token cũ khi token mới được cấp cho cùng người dùng/ứng dụng.

Triệu chứng thực tế:

- bạn đăng nhập qua OpenClaw _và_ qua Claude Code / Codex CLI → một trong hai sẽ ngẫu nhiên bị “đăng xuất” sau đó

Để giảm tình trạng này, OpenClaw coi `auth-profiles.json` như một **bể chứa token**:

- runtime đọc thông tin xác thực từ **một nơi**
- có thể giữ nhiều hồ sơ và định tuyến chúng một cách xác định

## Lưu trữ (token nằm ở đâu)

Bí mật được lưu **theo tác tử**:

- Hồ sơ xác thực (OAuth + API keys): `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- Bộ nhớ đệm runtime (tự quản lý; đừng chỉnh sửa): `~/.openclaw/agents/<agentId>/agent/auth.json`

Tệp kế thừa chỉ để nhập (vẫn được hỗ trợ, nhưng không phải kho chính):

- `~/.openclaw/credentials/oauth.json` (được nhập vào `auth-profiles.json` khi dùng lần đầu)

Tất cả các mục trên cũng tuân theo `$OPENCLAW_STATE_DIR` (ghi đè thư mục trạng thái). Tham chiếu đầy đủ: [/gateway/configuration](/gateway/configuration#auth-storage-oauth--api-keys)

## Anthropic setup-token (xác thực thuê bao)

Chạy `claude setup-token` trên bất kỳ máy nào, rồi dán vào OpenClaw:

```bash
openclaw models auth setup-token --provider anthropic
```

Nếu bạn tạo token ở nơi khác, hãy dán thủ công:

```bash
openclaw models auth paste-token --provider anthropic
```

Xác minh:

```bash
openclaw models status
```

## Trao đổi OAuth (cách đăng nhập hoạt động)

Các luồng đăng nhập tương tác của OpenClaw được triển khai trong `@mariozechner/pi-ai` và được nối vào các trình hướng dẫn/lệnh.

### Anthropic (Claude Pro/Max) setup-token

Dạng luồng:

1. chạy `claude setup-token`
2. dán token vào OpenClaw
3. lưu thành hồ sơ xác thực token (không làm mới)

Đường dẫn trình hướng dẫn là `openclaw onboard` → lựa chọn xác thực `setup-token` (Anthropic).

### OpenAI Codex (ChatGPT OAuth)

Dạng luồng (PKCE):

1. tạo verifier/challenge PKCE + `state` ngẫu nhiên
2. mở `https://auth.openai.com/oauth/authorize?...`
3. cố gắng bắt callback tại `http://127.0.0.1:1455/auth/callback`
4. nếu callback không bind được (hoặc bạn ở môi trường remote/headless), dán URL chuyển hướng/mã
5. trao đổi tại `https://auth.openai.com/oauth/token`
6. trích xuất `accountId` từ access token và lưu `{ access, refresh, expires, accountId }`

Đường dẫn trình hướng dẫn là `openclaw onboard` → lựa chọn xác thực `openai-codex`.

## Làm mới + hết hạn

Các hồ sơ lưu dấu thời gian `expires`.

Khi chạy:

- nếu `expires` ở tương lai → dùng access token đã lưu
- nếu đã hết hạn → làm mới (dưới khóa tệp) và ghi đè thông tin xác thực đã lưu

Luồng làm mới là tự động; nhìn chung bạn không cần quản lý token thủ công.

## Nhiều tài khoản (hồ sơ) + định tuyến

Hai mô hình:

### 1) Ưu tiên: tách tác tử

Nếu bạn muốn “cá nhân” và “công việc” không bao giờ tương tác, hãy dùng các tác tử cô lập (phiên + thông tin xác thực + workspace riêng):

```bash
openclaw agents add work
openclaw agents add personal
```

Sau đó cấu hình xác thực theo từng tác tử (trình hướng dẫn) và định tuyến chat tới đúng tác tử.

### 2) Nâng cao: nhiều hồ sơ trong một tác tử

`auth-profiles.json` hỗ trợ nhiều ID hồ sơ cho cùng một nhà cung cấp.

Chọn hồ sơ được dùng:

- toàn cục qua thứ tự cấu hình (`auth.order`)
- theo từng phiên qua `/model ...@<profileId>`

Ví dụ (ghi đè theo phiên):

- `/model Opus@anthropic:work`

Cách xem các ID hồ sơ hiện có:

- `openclaw channels list --json` (hiển thị `auth[]`)

Tài liệu liên quan:

- [/concepts/model-failover](/concepts/model-failover) (quy tắc xoay vòng + thời gian hồi)
- [/tools/slash-commands](/tools/slash-commands) (bề mặt lệnh)
