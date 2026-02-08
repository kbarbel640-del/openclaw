---
summary: "OpenClaw trên Oracle Cloud (ARM Always Free)"
read_when:
  - Thiết lập OpenClaw trên Oracle Cloud
  - Tìm dịch vụ VPS chi phí thấp cho OpenClaw
  - Muốn chạy OpenClaw 24/7 trên một máy chủ nhỏ
title: "Oracle Cloud"
x-i18n:
  source_path: platforms/oracle.md
  source_hash: 8ec927ab5055c915
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:08Z
---

# OpenClaw trên Oracle Cloud (OCI)

## Mục tiêu

Chạy một OpenClaw Gateway liên tục trên tầng ARM **Always Free** của Oracle Cloud.

Tầng miễn phí của Oracle có thể rất phù hợp cho OpenClaw (đặc biệt nếu bạn đã có tài khoản OCI), nhưng đi kèm một số đánh đổi:

- Kiến trúc ARM (đa số thứ đều hoạt động, nhưng một số binary có thể chỉ hỗ trợ x86)
- Dung lượng và quá trình đăng ký đôi khi không ổn định

## So sánh chi phí (2026)

| Nhà cung cấp | Gói             | Cấu hình                | Giá/tháng | Ghi chú                  |
| ------------ | --------------- | ----------------------- | --------- | ------------------------ |
| Oracle Cloud | Always Free ARM | tối đa 4 OCPU, 24GB RAM | $0        | ARM, dung lượng hạn chế  |
| Hetzner      | CX22            | 2 vCPU, 4GB RAM         | ~ $4      | Lựa chọn trả phí rẻ nhất |
| DigitalOcean | Basic           | 1 vCPU, 1GB RAM         | $6        | UI dễ dùng, tài liệu tốt |
| Vultr        | Cloud Compute   | 1 vCPU, 1GB RAM         | $6        | Nhiều khu vực            |
| Linode       | Nanode          | 1 vCPU, 1GB RAM         | $5        | Hiện thuộc Akamai        |

---

## Điều kiện tiên quyết

- Tài khoản Oracle Cloud ([đăng ký](https://www.oracle.com/cloud/free/)) — xem [hướng dẫn đăng ký cộng đồng](https://gist.github.com/rssnyder/51e3cfedd730e7dd5f4a816143b25dbd) nếu gặp vấn đề
- Tài khoản Tailscale (miễn phí tại [tailscale.com](https://tailscale.com))
- ~30 phút

## 1) Tạo một OCI Instance

1. Đăng nhập vào [Oracle Cloud Console](https://cloud.oracle.com/)
2. Điều hướng đến **Compute → Instances → Create Instance**
3. Cấu hình:
   - **Name:** `openclaw`
   - **Image:** Ubuntu 24.04 (aarch64)
   - **Shape:** `VM.Standard.A1.Flex` (Ampere ARM)
   - **OCPUs:** 2 (hoặc tối đa 4)
   - **Memory:** 12 GB (hoặc tối đa 24 GB)
   - **Boot volume:** 50 GB (tối đa 200 GB miễn phí)
   - **SSH key:** Thêm public key của bạn
4. Nhấn **Create**
5. Ghi lại địa chỉ IP public

**Mẹo:** Nếu việc tạo instance thất bại với lỗi "Out of capacity", hãy thử availability domain khác hoặc thử lại sau. Dung lượng tầng miễn phí có hạn.

## 2) Kết nối và cập nhật

```bash
# Connect via public IP
ssh ubuntu@YOUR_PUBLIC_IP

# Update system
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential
```

**Lưu ý:** `build-essential` là cần thiết để biên dịch ARM cho một số dependency.

## 3) Cấu hình user và hostname

```bash
# Set hostname
sudo hostnamectl set-hostname openclaw

# Set password for ubuntu user
sudo passwd ubuntu

# Enable lingering (keeps user services running after logout)
sudo loginctl enable-linger ubuntu
```

## 4) Cài đặt Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh --hostname=openclaw
```

Bước này bật Tailscale SSH, cho phép bạn kết nối qua `ssh openclaw` từ bất kỳ thiết bị nào trong tailnet — không cần IP public.

Xác minh:

```bash
tailscale status
```

**Từ bây giờ, hãy kết nối qua Tailscale:** `ssh ubuntu@openclaw` (hoặc dùng IP Tailscale).

## 5) Cài đặt OpenClaw

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
source ~/.bashrc
```

Khi được hỏi "How do you want to hatch your bot?", hãy chọn **"Do this later"**.

> Lưu ý: Nếu gặp vấn đề build native trên ARM, hãy bắt đầu với các package hệ thống (ví dụ: `sudo apt install -y build-essential`) trước khi dùng Homebrew.

## 6) Cấu hình Gateway (loopback + token auth) và bật Tailscale Serve

Sử dụng token auth làm mặc định. Cách này ổn định và tránh cần các cờ “insecure auth” trong Control UI.

```bash
# Keep the Gateway private on the VM
openclaw config set gateway.bind loopback

# Require auth for the Gateway + Control UI
openclaw config set gateway.auth.mode token
openclaw doctor --generate-gateway-token

# Expose over Tailscale Serve (HTTPS + tailnet access)
openclaw config set gateway.tailscale.mode serve
openclaw config set gateway.trustedProxies '["127.0.0.1"]'

systemctl --user restart openclaw-gateway
```

## 7) Xác minh

```bash
# Check version
openclaw --version

# Check daemon status
systemctl --user status openclaw-gateway

# Check Tailscale Serve
tailscale serve status

# Test local response
curl http://localhost:18789
```

## 8) Khóa bảo mật VCN

Khi mọi thứ đã hoạt động, hãy khóa VCN để chặn toàn bộ traffic ngoại trừ Tailscale. Virtual Cloud Network của OCI hoạt động như một firewall ở rìa mạng — traffic sẽ bị chặn trước khi tới instance của bạn.

1. Vào **Networking → Virtual Cloud Networks** trong OCI Console
2. Chọn VCN của bạn → **Security Lists** → Default Security List
3. **Xóa** tất cả ingress rules ngoại trừ:
   - `0.0.0.0/0 UDP 41641` (Tailscale)
4. Giữ nguyên egress rules mặc định (cho phép toàn bộ outbound)

Việc này sẽ chặn SSH cổng 22, HTTP, HTTPS và mọi thứ khác ở rìa mạng. Từ đây, bạn chỉ có thể kết nối qua Tailscale.

---

## Truy cập Control UI

Từ bất kỳ thiết bị nào trong mạng Tailscale của bạn:

```
https://openclaw.<tailnet-name>.ts.net/
```

Thay `<tailnet-name>` bằng tên tailnet của bạn (hiển thị trong `tailscale status`).

Không cần SSH tunnel. Tailscale cung cấp:

- Mã hóa HTTPS (chứng chỉ tự động)
- Xác thực qua danh tính Tailscale
- Truy cập từ mọi thiết bị trong tailnet (laptop, điện thoại, v.v.)

---

## Bảo mật: VCN + Tailscale (mốc khuyến nghị)

Với VCN đã được khóa (chỉ mở UDP 41641) và Gateway bind vào loopback, bạn có phòng thủ nhiều lớp mạnh mẽ: traffic public bị chặn ở rìa mạng, và quyền quản trị được thực hiện qua tailnet của bạn.

Thiết lập này thường loại bỏ _nhu cầu_ phải thêm firewall trên host chỉ để ngăn brute force SSH trên Internet — nhưng bạn vẫn nên giữ hệ điều hành luôn cập nhật, chạy `openclaw security audit`, và kiểm tra để đảm bảo không vô tình lắng nghe trên các interface public.

### Những gì đã được bảo vệ

| Bước truyền thống | Cần không?   | Vì sao                                                                   |
| ----------------- | ------------ | ------------------------------------------------------------------------ |
| UFW firewall      | Không        | VCN chặn traffic trước khi tới instance                                  |
| fail2ban          | Không        | Không có brute force nếu cổng 22 bị chặn ở VCN                           |
| sshd hardening    | Không        | Tailscale SSH không dùng sshd                                            |
| Tắt root login    | Không        | Tailscale dùng danh tính Tailscale, không dùng user hệ thống             |
| Chỉ dùng SSH key  | Không        | Tailscale xác thực qua tailnet của bạn                                   |
| Hardening IPv6    | Thường không | Phụ thuộc cấu hình VCN/subnet; hãy kiểm tra những gì thực sự được gán/mở |

### Vẫn nên làm

- **Quyền credential:** `chmod 700 ~/.openclaw`
- **Audit bảo mật:** `openclaw security audit`
- **Cập nhật hệ thống:** chạy `sudo apt update && sudo apt upgrade` thường xuyên
- **Theo dõi Tailscale:** xem lại thiết bị trong [Tailscale admin console](https://login.tailscale.com/admin)

### Xác minh trạng thái bảo mật

```bash
# Confirm no public ports listening
sudo ss -tlnp | grep -v '127.0.0.1\|::1'

# Verify Tailscale SSH is active
tailscale status | grep -q 'offers: ssh' && echo "Tailscale SSH active"

# Optional: disable sshd entirely
sudo systemctl disable --now ssh
```

---

## Phương án dự phòng: SSH Tunnel

Nếu Tailscale Serve không hoạt động, hãy dùng SSH tunnel:

```bash
# From your local machine (via Tailscale)
ssh -L 18789:127.0.0.1:18789 ubuntu@openclaw
```

Sau đó mở `http://localhost:18789`.

---

## Troubleshooting

### Tạo instance thất bại ("Out of capacity")

Instance ARM tầng miễn phí rất phổ biến. Hãy thử:

- Availability domain khác
- Thử lại vào giờ thấp điểm (sáng sớm)
- Dùng bộ lọc "Always Free" khi chọn shape

### Tailscale không kết nối được

```bash
# Check status
sudo tailscale status

# Re-authenticate
sudo tailscale up --ssh --hostname=openclaw --reset
```

### Gateway không khởi động

```bash
openclaw gateway status
openclaw doctor --non-interactive
journalctl --user -u openclaw-gateway -n 50
```

### Không truy cập được Control UI

```bash
# Verify Tailscale Serve is running
tailscale serve status

# Check gateway is listening
curl http://localhost:18789

# Restart if needed
systemctl --user restart openclaw-gateway
```

### Vấn đề binary ARM

Một số công cụ có thể chưa có bản build ARM. Kiểm tra:

```bash
uname -m  # Should show aarch64
```

Hầu hết package npm hoạt động tốt. Với binary, hãy tìm các bản phát hành `linux-arm64` hoặc `aarch64`.

---

## Tính bền vững (Persistence)

Toàn bộ trạng thái nằm trong:

- `~/.openclaw/` — cấu hình, credential, dữ liệu session
- `~/.openclaw/workspace/` — workspace (SOUL.md, bộ nhớ, artifact)

Sao lưu định kỳ:

```bash
tar -czvf openclaw-backup.tar.gz ~/.openclaw ~/.openclaw/workspace
```

---

## Xem thêm

- [Gateway remote access](/gateway/remote) — các mô hình truy cập từ xa khác
- [Tailscale integration](/gateway/tailscale) — tài liệu Tailscale đầy đủ
- [Gateway configuration](/gateway/configuration) — mọi tùy chọn cấu hình
- [DigitalOcean guide](/platforms/digitalocean) — nếu bạn muốn trả phí + đăng ký dễ hơn
- [Hetzner guide](/install/hetzner) — phương án thay thế dựa trên Docker
