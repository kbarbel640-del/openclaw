---
summary: "Hỗ trợ Windows (WSL2) + trạng thái ứng dụng đồng hành"
read_when:
  - Cài đặt OpenClaw trên Windows
  - Tìm trạng thái ứng dụng đồng hành cho Windows
title: "Windows (WSL2)"
x-i18n:
  source_path: platforms/windows.md
  source_hash: c93d2263b4e5b60c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:01Z
---

# Windows (WSL2)

Khuyến nghị chạy OpenClaw trên Windows **qua WSL2** (đề xuất Ubuntu). The
CLI + Gateway chạy bên trong Linux, giúp môi trường runtime nhất quán và làm
công cụ tương thích hơn nhiều (Node/Bun/pnpm, Linux binaries, skills). Native
Windows có thể phức tạp hơn. WSL2 mang lại trải nghiệm Linux đầy đủ — cài đặt chỉ
bằng một lệnh: `wsl --install`.

Ứng dụng đồng hành native cho Windows đang được lên kế hoạch.

## Cài đặt (WSL2)

- [Bat Dau](/start/getting-started) (dùng bên trong WSL)
- [Cài đặt & cập nhật](/install/updating)
- Hướng dẫn WSL2 chính thức (Microsoft): https://learn.microsoft.com/windows/wsl/install

## Gateway

- [Gateway runbook](/gateway)
- [Cấu hình](/gateway/configuration)

## Cài đặt dịch vụ Gateway (CLI)

Bên trong WSL2:

```
openclaw onboard --install-daemon
```

Hoặc:

```
openclaw gateway install
```

Hoặc:

```
openclaw configure
```

Chọn **Gateway service** khi được nhắc.

Sửa chữa/di chuyển:

```
openclaw doctor
```

## Nâng cao: mở dịch vụ WSL ra LAN (portproxy)

WSL có mạng ảo riêng. Nếu một máy khác cần truy cập dịch vụ
chạy **bên trong WSL** (SSH, máy chủ TTS cục bộ, hoặc Gateway), bạn phải
chuyển tiếp một cổng Windows tới IP WSL hiện tại. IP WSL thay đổi sau khi khởi động lại,
vì vậy bạn có thể cần làm mới quy tắc chuyển tiếp.

Ví dụ (PowerShell **chạy với quyền Administrator**):

```powershell
$Distro = "Ubuntu-24.04"
$ListenPort = 2222
$TargetPort = 22

$WslIp = (wsl -d $Distro -- hostname -I).Trim().Split(" ")[0]
if (-not $WslIp) { throw "WSL IP not found." }

netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$ListenPort `
  connectaddress=$WslIp connectport=$TargetPort
```

Cho phép cổng qua Windows Firewall (một lần):

```powershell
New-NetFirewallRule -DisplayName "WSL SSH $ListenPort" -Direction Inbound `
  -Protocol TCP -LocalPort $ListenPort -Action Allow
```

Làm mới portproxy sau khi WSL khởi động lại:

```powershell
netsh interface portproxy delete v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 | Out-Null
netsh interface portproxy add v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 `
  connectaddress=$WslIp connectport=$TargetPort | Out-Null
```

Ghi chú:

- SSH từ máy khác sẽ nhắm tới **IP của máy Windows host** (ví dụ: `ssh user@windows-host -p 2222`).
- Các node từ xa phải trỏ tới URL Gateway **có thể truy cập được** (không phải `127.0.0.1`); dùng
  `openclaw status --all` để xác nhận.
- Dùng `listenaddress=0.0.0.0` để truy cập LAN; `127.0.0.1` chỉ giữ truy cập cục bộ.
- Nếu muốn tự động, hãy đăng ký một Scheduled Task để chạy bước làm mới
  khi đăng nhập.

## Cài đặt WSL2 từng bước

### 1) Cài đặt WSL2 + Ubuntu

Mở PowerShell (Admin):

```powershell
wsl --install
# Or pick a distro explicitly:
wsl --list --online
wsl --install -d Ubuntu-24.04
```

Khởi động lại nếu Windows yêu cầu.

### 2) Bật systemd (bắt buộc cho cài đặt Gateway)

Trong terminal WSL của bạn:

```bash
sudo tee /etc/wsl.conf >/dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Sau đó từ PowerShell:

```powershell
wsl --shutdown
```

Mở lại Ubuntu, rồi xác minh:

```bash
systemctl --user status
```

### 3) Cài đặt OpenClaw (bên trong WSL)

Thực hiện luồng Bat Dau cho Linux bên trong WSL:

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard
```

Hướng dẫn đầy đủ: [Bat Dau](/start/getting-started)

## Ứng dụng đồng hành cho Windows

Hiện chưa có ứng dụng đồng hành cho Windows. Chúng tôi hoan nghênh đóng góp nếu bạn muốn
tham gia xây dựng để hiện thực hóa điều này.
