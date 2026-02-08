---
summary: "OpenClaw trên Raspberry Pi (thiết lập tự lưu trữ tiết kiệm)"
read_when:
  - Thiết lập OpenClaw trên Raspberry Pi
  - Chạy OpenClaw trên thiết bị ARM
  - Xây dựng AI cá nhân luôn bật với chi phí thấp
title: "Raspberry Pi"
x-i18n:
  source_path: platforms/raspberry-pi.md
  source_hash: 90b143a2877a4cea
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:09Z
---

# OpenClaw trên Raspberry Pi

## Mục tiêu

Chạy một OpenClaw Gateway liên tục, luôn bật trên Raspberry Pi với chi phí một lần **~$35-80** (không có phí hàng tháng).

Phù hợp cho:

- Trợ lý AI cá nhân 24/7
- Trung tâm tự động hóa gia đình
- Bot Telegram/WhatsApp tiêu thụ điện năng thấp, luôn sẵn sàng

## Yêu cầu phần cứng

| Mẫu Pi          | RAM     | Hoạt động?  | Ghi chú                                  |
| --------------- | ------- | ----------- | ---------------------------------------- |
| **Pi 5**        | 4GB/8GB | ✅ Tốt nhất | Nhanh nhất, khuyến nghị                  |
| **Pi 4**        | 4GB     | ✅ Tốt      | Lựa chọn cân bằng cho đa số người dùng   |
| **Pi 4**        | 2GB     | ✅ Ổn       | Hoạt động, nên thêm swap                 |
| **Pi 4**        | 1GB     | ⚠️ Hạn chế  | Có thể chạy với swap, cấu hình tối thiểu |
| **Pi 3B+**      | 1GB     | ⚠️ Chậm     | Chạy được nhưng ì ạch                    |
| **Pi Zero 2 W** | 512MB   | ❌          | Không khuyến nghị                        |

**Cấu hình tối thiểu:** 1GB RAM, 1 nhân, 500MB dung lượng  
**Khuyến nghị:** 2GB+ RAM, hệ điều hành 64-bit, thẻ SD 16GB+ (hoặc USB SSD)

## Những thứ bạn cần

- Raspberry Pi 4 hoặc 5 (khuyến nghị 2GB+)
- Thẻ MicroSD (16GB+) hoặc USB SSD (hiệu năng tốt hơn)
- Nguồn điện (khuyến nghị PSU chính hãng của Pi)
- Kết nối mạng (Ethernet hoặc WiFi)
- ~30 phút

## 1) Ghi hệ điều hành

Dùng **Raspberry Pi OS Lite (64-bit)** — không cần giao diện desktop cho máy chủ headless.

1. Tải [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Chọn OS: **Raspberry Pi OS Lite (64-bit)**
3. Bấm biểu tượng bánh răng (⚙️) để cấu hình trước:
   - Đặt hostname: `gateway-host`
   - Bật SSH
   - Đặt tên người dùng/mật khẩu
   - Cấu hình WiFi (nếu không dùng Ethernet)
4. Ghi vào thẻ SD / ổ USB
5. Lắp vào và khởi động Pi

## 2) Kết nối qua SSH

```bash
ssh user@gateway-host
# or use the IP address
ssh user@192.168.x.x
```

## 3) Thiết lập hệ thống

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y git curl build-essential

# Set timezone (important for cron/reminders)
sudo timedatectl set-timezone America/Chicago  # Change to your timezone
```

## 4) Cài Node.js 22 (ARM64)

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should show v22.x.x
npm --version
```

## 5) Thêm Swap (Quan trọng với 2GB hoặc ít hơn)

Swap giúp tránh lỗi hết bộ nhớ:

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize for low RAM (reduce swappiness)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 6) Cài OpenClaw

### Tùy chọn A: Cài đặt tiêu chuẩn (Khuyến nghị)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

### Tùy chọn B: Cài đặt có thể chỉnh sửa (Dành cho vọc vạch)

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
npm install
npm run build
npm link
```

Bản cài đặt có thể chỉnh sửa cho bạn truy cập trực tiếp vào log và mã nguồn — hữu ích để gỡ lỗi các vấn đề riêng của ARM.

## 7) Chạy Onboarding

```bash
openclaw onboard --install-daemon
```

Làm theo trình hướng dẫn:

1. **Chế độ Gateway:** Local
2. **Xác thực:** Khuyến nghị dùng API keys (OAuth có thể rắc rối trên Pi headless)
3. **Kênh:** Telegram là dễ bắt đầu nhất
4. **Daemon:** Có (systemd)

## 8) Xác minh cài đặt

```bash
# Check status
openclaw status

# Check service
sudo systemctl status openclaw

# View logs
journalctl -u openclaw -f
```

## 9) Truy cập Dashboard

Vì Pi là headless, hãy dùng SSH tunnel:

```bash
# From your laptop/desktop
ssh -L 18789:localhost:18789 user@gateway-host

# Then open in browser
open http://localhost:18789
```

Hoặc dùng Tailscale để truy cập luôn bật:

```bash
# On the Pi
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Update config
openclaw config set gateway.bind tailnet
sudo systemctl restart openclaw
```

---

## Tối ưu hiệu năng

### Dùng USB SSD (Cải thiện rất lớn)

Thẻ SD chậm và nhanh hao mòn. USB SSD cải thiện hiệu năng đáng kể:

```bash
# Check if booting from USB
lsblk
```

Xem [hướng dẫn boot USB cho Pi](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#usb-mass-storage-boot) để thiết lập.

### Giảm sử dụng bộ nhớ

```bash
# Disable GPU memory allocation (headless)
echo 'gpu_mem=16' | sudo tee -a /boot/config.txt

# Disable Bluetooth if not needed
sudo systemctl disable bluetooth
```

### Giám sát tài nguyên

```bash
# Check memory
free -h

# Check CPU temperature
vcgencmd measure_temp

# Live monitoring
htop
```

---

## Ghi chú riêng cho ARM

### Tương thích nhị phân

Hầu hết tính năng OpenClaw hoạt động trên ARM64, nhưng một số binary bên ngoài có thể cần bản dựng cho ARM:

| Công cụ            | Trạng thái ARM64 | Ghi chú                             |
| ------------------ | ---------------- | ----------------------------------- |
| Node.js            | ✅               | Hoạt động rất tốt                   |
| WhatsApp (Baileys) | ✅               | Thuần JS, không vấn đề              |
| Telegram           | ✅               | Thuần JS, không vấn đề              |
| gog (Gmail CLI)    | ⚠️               | Kiểm tra bản phát hành cho ARM      |
| Chromium (browser) | ✅               | `sudo apt install chromium-browser` |

Nếu một skill lỗi, hãy kiểm tra xem binary của nó có bản dựng ARM hay không. Nhiều công cụ Go/Rust có; một số thì không.

### 32-bit vs 64-bit

**Luôn dùng hệ điều hành 64-bit.** Node.js và nhiều công cụ hiện đại yêu cầu điều này. Kiểm tra bằng:

```bash
uname -m
# Should show: aarch64 (64-bit) not armv7l (32-bit)
```

---

## Thiết lập model khuyến nghị

Vì Pi chỉ là Gateway (model chạy trên cloud), hãy dùng các model qua API:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-20250514",
        "fallbacks": ["openai/gpt-4o-mini"]
      }
    }
  }
}
```

**Đừng cố chạy LLM cục bộ trên Pi** — ngay cả model nhỏ cũng quá chậm. Hãy để Claude/GPT xử lý phần nặng.

---

## Tự khởi động khi boot

Trình onboarding đã thiết lập sẵn, nhưng để kiểm tra:

```bash
# Check service is enabled
sudo systemctl is-enabled openclaw

# Enable if not
sudo systemctl enable openclaw

# Start on boot
sudo systemctl start openclaw
```

---

## Xử lý sự cố

### Hết bộ nhớ (OOM)

```bash
# Check memory
free -h

# Add more swap (see Step 5)
# Or reduce services running on the Pi
```

### Hiệu năng chậm

- Dùng USB SSD thay vì thẻ SD
- Tắt các dịch vụ không dùng: `sudo systemctl disable cups bluetooth avahi-daemon`
- Kiểm tra throttling CPU: `vcgencmd get_throttled` (nên trả về `0x0`)

### Dịch vụ không khởi động

```bash
# Check logs
journalctl -u openclaw --no-pager -n 100

# Common fix: rebuild
cd ~/openclaw  # if using hackable install
npm run build
sudo systemctl restart openclaw
```

### Vấn đề binary ARM

Nếu một skill lỗi với “exec format error”:

1. Kiểm tra xem binary có bản dựng ARM64 không
2. Thử build từ source
3. Hoặc dùng container Docker có hỗ trợ ARM

### WiFi hay rớt

Với Pi headless dùng WiFi:

```bash
# Disable WiFi power management
sudo iwconfig wlan0 power off

# Make permanent
echo 'wireless-power off' | sudo tee -a /etc/network/interfaces
```

---

## So sánh chi phí

| Thiết lập      | Chi phí một lần | Chi phí hàng tháng | Ghi chú               |
| -------------- | --------------- | ------------------ | --------------------- |
| **Pi 4 (2GB)** | ~$45            | $0                 | + điện (~$5/năm)      |
| **Pi 4 (4GB)** | ~$55            | $0                 | Khuyến nghị           |
| **Pi 5 (4GB)** | ~$60            | $0                 | Hiệu năng tốt nhất    |
| **Pi 5 (8GB)** | ~$80            | $0                 | Dư thừa nhưng bền lâu |
| DigitalOcean   | $0              | $6/tháng           | $72/năm               |
| Hetzner        | $0              | €3.79/tháng        | ~$50/năm              |

**Điểm hòa vốn:** Một Pi tự hoàn vốn sau ~6–12 tháng so với VPS cloud.

---

## Xem thêm

- [Hướng dẫn Linux](/platforms/linux) — thiết lập Linux chung
- [Hướng dẫn DigitalOcean](/platforms/digitalocean) — lựa chọn cloud
- [Hướng dẫn Hetzner](/install/hetzner) — thiết lập Docker
- [Tailscale](/gateway/tailscale) — truy cập từ xa
- [Nodes](/nodes) — ghép laptop/điện thoại của bạn với gateway Pi
