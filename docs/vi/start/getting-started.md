---
summary: "Cài đặt OpenClaw và chạy cuộc trò chuyện đầu tiên chỉ trong vài phút."
read_when:
  - Thiết lập lần đầu từ con số không
  - Bạn muốn con đường nhanh nhất để có một cuộc trò chuyện hoạt động
title: "Bat Dau"
x-i18n:
  source_path: start/getting-started.md
  source_hash: 27aeeb3d18c49538
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:25Z
---

# Bat Dau

Mục tiêu: đi từ con số không đến cuộc trò chuyện đầu tiên hoạt động với thiết lập tối thiểu.

<Info>
Cách trò chuyện nhanh nhất: mở Control UI (không cần thiết lập kênh). Chạy `openclaw dashboard`
và trò chuyện trong trình duyệt, hoặc mở `http://127.0.0.1:18789/` trên
<Tooltip headline="Gateway host" tip="Máy chạy dịch vụ OpenClaw gateway.">gateway host</Tooltip>.
Tài liệu: [Dashboard](/web/dashboard) và [Control UI](/web/control-ui).
</Info>

## Prereqs

- Node 22 hoặc mới hơn

<Tip>
Kiểm tra phiên bản Node của bạn bằng `node --version` nếu bạn không chắc.
</Tip>

## Khoi dong nhanh (CLI)

<Steps>
  <Step title="Cài đặt OpenClaw (khuyến nghị)">
    <Tabs>
      <Tab title="macOS/Linux">
        ```bash
        curl -fsSL https://openclaw.ai/install.sh | bash
        ```
      </Tab>
      <Tab title="Windows (PowerShell)">
        ```powershell
        iwr -useb https://openclaw.ai/install.ps1 | iex
        ```
      </Tab>
    </Tabs>

    <Note>
    Các phương pháp cài đặt và yêu cầu khác: [Install](/install).
    </Note>

  </Step>
  <Step title="Chạy trình huong dan onboarding">
    ```bash
    openclaw onboard --install-daemon
    ```

    Trình huong dan cấu hình xác thực, cài đặt Gateway và các kênh tùy chọn.
    Xem [Onboarding Wizard](/start/wizard) de biet them chi tiet.

  </Step>
  <Step title="Kiểm tra Gateway">
    Nếu bạn đã cài đặt dịch vụ, nó sẽ đang chạy sẵn:

    ```bash
    openclaw gateway status
    ```

  </Step>
  <Step title="Mở Control UI">
    ```bash
    openclaw dashboard
    ```
  </Step>
</Steps>

<Check>
Nếu Control UI tải được, Gateway của bạn đã sẵn sàng để sử dụng.
</Check>

## Kiểm tra tùy chọn và phần bổ sung

<AccordionGroup>
  <Accordion title="Chạy Gateway ở chế độ foreground">
    Hữu ích cho các thử nghiệm nhanh hoặc xu ly su co.

    ```bash
    openclaw gateway --port 18789
    ```

  </Accordion>
  <Accordion title="Gửi tin nhắn thử">
    Yêu cầu một kênh đã được cấu hình.

    ```bash
    openclaw message send --target +15555550123 --message "Hello from OpenClaw"
    ```

  </Accordion>
</AccordionGroup>

## Đi sâu hơn

<Columns>
  <Card title="Onboarding Wizard (chi tiết)" href="/start/wizard">
    Tài liệu đầy đủ cho trình huong dan CLI và các tùy chọn nâng cao.
  </Card>
  <Card title="Onboarding ứng dụng macOS" href="/start/onboarding">
    Luồng chạy lần đầu cho ứng dụng macOS.
  </Card>
</Columns>

## Những gì bạn sẽ có

- Một Gateway đang chạy
- Xác thực đã được cấu hình
- Quyền truy cập Control UI hoặc một kênh đã kết nối

## Các bước tiếp theo

- An toàn DM và phê duyệt: [Pairing](/start/pairing)
- Kết nối thêm kênh: [Channels](/channels)
- Quy trình nâng cao và chạy từ mã nguồn: [Setup](/start/setup)
