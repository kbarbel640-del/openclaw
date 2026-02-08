---
summary: "Hướng dẫn ClawHub: kho đăng ký Skills công khai + quy trình làm việc CLI"
read_when:
  - Giới thiệu ClawHub cho người dùng mới
  - Cài đặt, tìm kiếm hoặc xuất bản skills
  - Giải thích các cờ CLI của ClawHub và hành vi đồng bộ
title: "ClawHub"
x-i18n:
  source_path: tools/clawhub.md
  source_hash: b572473a11246357
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:53Z
---

# ClawHub

ClawHub là **kho đăng ký skill công khai cho OpenClaw**. Đây là dịch vụ miễn phí: tất cả skills đều công khai, mở và hiển thị cho mọi người để chia sẻ và tái sử dụng. Một skill chỉ là một thư mục với tệp `SKILL.md` (kèm các tệp văn bản hỗ trợ). Bạn có thể duyệt skills trên ứng dụng web hoặc dùng CLI để tìm kiếm, cài đặt, cập nhật và xuất bản skills.

Trang web: [clawhub.ai](https://clawhub.ai)

## ClawHub là gì

- Kho đăng ký công khai cho các skills của OpenClaw.
- Nơi lưu trữ có phiên bản cho các gói skill và metadata.
- Bề mặt khám phá cho tìm kiếm, thẻ và tín hiệu sử dụng.

## Cách hoạt động

1. Người dùng xuất bản một gói skill (tệp + metadata).
2. ClawHub lưu trữ gói, phân tích metadata và gán một phiên bản.
3. Kho đăng ký lập chỉ mục skill để tìm kiếm và khám phá.
4. Người dùng duyệt, tải xuống và cài đặt skills trong OpenClaw.

## Bạn có thể làm gì

- Xuất bản skills mới và các phiên bản mới của skills hiện có.
- Khám phá skills theo tên, thẻ hoặc tìm kiếm.
- Tải các gói skill và kiểm tra nội dung tệp.
- Báo cáo các skills mang tính lạm dụng hoặc không an toàn.
- Nếu bạn là người kiểm duyệt, có thể ẩn, bỏ ẩn, xóa hoặc cấm.

## Dành cho ai (thân thiện với người mới)

Nếu bạn muốn thêm năng lực mới cho tác tử OpenClaw của mình, ClawHub là cách dễ nhất để tìm và cài đặt skills. Bạn không cần biết backend hoạt động thế nào. Bạn có thể:

- Tìm skills bằng ngôn ngữ tự nhiên.
- Cài đặt một skill vào workspace của bạn.
- Cập nhật skills sau này chỉ với một lệnh.
- Sao lưu skills của riêng bạn bằng cách xuất bản chúng.

## Khoi dong nhanh (không kỹ thuật)

1. Cài đặt CLI (xem phần tiếp theo).
2. Tìm thứ bạn cần:
   - `clawhub search "calendar"`
3. Cài đặt một skill:
   - `clawhub install <skill-slug>`
4. Bắt đầu một phiên OpenClaw mới để hệ thống nhận skill mới.

## Cài đặt CLI

Chọn một:

```bash
npm i -g clawhub
```

```bash
pnpm add -g clawhub
```

## Cách nó tích hợp với OpenClaw

Theo mặc định, CLI cài đặt skills vào `./skills` trong thư mục làm việc hiện tại của bạn. Nếu đã cấu hình một workspace OpenClaw, `clawhub` sẽ rơi về workspace đó trừ khi bạn ghi đè `--workdir` (hoặc `CLAWHUB_WORKDIR`). OpenClaw tải skills của workspace từ `<workspace>/skills` và sẽ nhận chúng ở **phiên** tiếp theo. Nếu bạn đã dùng `~/.openclaw/skills` hoặc skills được đóng gói sẵn, skills của workspace sẽ được ưu tiên.

Để biết thêm chi tiết về cách skills được tải, chia sẻ và kiểm soát, xem
[Skills](/tools/skills).

## Tổng quan hệ thống skill

Một skill là một gói tệp có phiên bản, dạy OpenClaw cách thực hiện một tác vụ
cụ thể. Mỗi lần xuất bản tạo ra một phiên bản mới, và kho đăng ký giữ lịch sử
các phiên bản để người dùng có thể kiểm tra thay đổi.

Một skill điển hình bao gồm:

- Một tệp `SKILL.md` với mô tả chính và cách sử dụng.
- Các cấu hình, script hoặc tệp hỗ trợ tùy chọn mà skill sử dụng.
- Metadata như thẻ, tóm tắt và yêu cầu cài đặt.

ClawHub sử dụng metadata để hỗ trợ khám phá và phơi bày an toàn các khả năng của skill.
Kho đăng ký cũng theo dõi các tín hiệu sử dụng (như sao và lượt tải) để cải thiện
xếp hạng và khả năng hiển thị.

## Dịch vụ cung cấp những gì (tính năng)

- **Duyệt công khai** skills và nội dung `SKILL.md` của chúng.
- **Tìm kiếm** dựa trên embeddings (tìm kiếm vector), không chỉ từ khóa.
- **Quản lý phiên bản** với semver, changelog và thẻ (bao gồm `latest`).
- **Tải xuống** dưới dạng zip cho từng phiên bản.
- **Sao và bình luận** để phản hồi cộng đồng.
- **Cơ chế kiểm duyệt** cho phê duyệt và kiểm toán.
- **API thân thiện với CLI** cho tự động hóa và scripting.

## Bảo mật và kiểm duyệt

ClawHub mặc định là mở. Bất kỳ ai cũng có thể tải lên skills, nhưng tài khoản GitHub
phải ít nhất một tuần tuổi để xuất bản. Điều này giúp giảm lạm dụng mà không chặn
những người đóng góp hợp lệ.

Báo cáo và kiểm duyệt:

- Bất kỳ người dùng đã đăng nhập nào cũng có thể báo cáo một skill.
- Lý do báo cáo là bắt buộc và được ghi lại.
- Mỗi người dùng có thể có tối đa 20 báo cáo đang hoạt động cùng lúc.
- Skills có hơn 3 báo cáo duy nhất sẽ tự động bị ẩn theo mặc định.
- Người kiểm duyệt có thể xem skills bị ẩn, bỏ ẩn, xóa chúng hoặc cấm người dùng.
- Lạm dụng tính năng báo cáo có thể dẫn đến cấm tài khoản.

Quan tâm đến việc trở thành người kiểm duyệt? Hỏi trong Discord của OpenClaw và liên hệ
một người kiểm duyệt hoặc maintainer.

## Lệnh CLI và tham số

Tùy chọn toàn cục (áp dụng cho mọi lệnh):

- `--workdir <dir>`: Thư mục làm việc (mặc định: thư mục hiện tại; rơi về workspace OpenClaw).
- `--dir <dir>`: Thư mục skills, tương đối so với workdir (mặc định: `skills`).
- `--site <url>`: URL cơ sở của site (đăng nhập qua trình duyệt).
- `--registry <url>`: URL cơ sở của API registry.
- `--no-input`: Tắt prompt (không tương tác).
- `-V, --cli-version`: In phiên bản CLI.

Xác thực:

- `clawhub login` (luồng trình duyệt) hoặc `clawhub login --token <token>`
- `clawhub logout`
- `clawhub whoami`

Tùy chọn:

- `--token <token>`: Dán API token.
- `--label <label>`: Nhãn lưu cho token đăng nhập qua trình duyệt (mặc định: `CLI token`).
- `--no-browser`: Không mở trình duyệt (yêu cầu `--token`).

Tìm kiếm:

- `clawhub search "query"`
- `--limit <n>`: Số kết quả tối đa.

Cài đặt:

- `clawhub install <slug>`
- `--version <version>`: Cài đặt một phiên bản cụ thể.
- `--force`: Ghi đè nếu thư mục đã tồn tại.

Cập nhật:

- `clawhub update <slug>`
- `clawhub update --all`
- `--version <version>`: Cập nhật lên một phiên bản cụ thể (chỉ một slug).
- `--force`: Ghi đè khi tệp cục bộ không khớp với bất kỳ phiên bản đã xuất bản nào.

Liệt kê:

- `clawhub list` (đọc `.clawhub/lock.json`)

Xuất bản:

- `clawhub publish <path>`
- `--slug <slug>`: Slug của skill.
- `--name <name>`: Tên hiển thị.
- `--version <version>`: Phiên bản semver.
- `--changelog <text>`: Văn bản changelog (có thể để trống).
- `--tags <tags>`: Thẻ phân tách bằng dấu phẩy (mặc định: `latest`).

Xóa/bỏ xóa (chỉ owner/admin):

- `clawhub delete <slug> --yes`
- `clawhub undelete <slug> --yes`

Đồng bộ (quét skills cục bộ + xuất bản mới/cập nhật):

- `clawhub sync`
- `--root <dir...>`: Các thư mục gốc quét bổ sung.
- `--all`: Tải lên mọi thứ không cần prompt.
- `--dry-run`: Hiển thị những gì sẽ được tải lên.
- `--bump <type>`: `patch|minor|major` cho cập nhật (mặc định: `patch`).
- `--changelog <text>`: Changelog cho cập nhật không tương tác.
- `--tags <tags>`: Thẻ phân tách bằng dấu phẩy (mặc định: `latest`).
- `--concurrency <n>`: Kiểm tra registry (mặc định: 4).

## Quy trình phổ biến cho tác tử

### Tìm kiếm skills

```bash
clawhub search "postgres backups"
```

### Tải skills mới

```bash
clawhub install my-skill-pack
```

### Cập nhật skills đã cài

```bash
clawhub update --all
```

### Sao lưu skills của bạn (xuất bản hoặc đồng bộ)

Đối với một thư mục skill đơn lẻ:

```bash
clawhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0 --tags latest
```

Để quét và sao lưu nhiều skills cùng lúc:

```bash
clawhub sync --all
```

## Chi tiết nâng cao (kỹ thuật)

### Phiên bản hóa và thẻ

- Mỗi lần xuất bản tạo ra một `SkillVersion` **semver** mới.
- Thẻ (như `latest`) trỏ tới một phiên bản; di chuyển thẻ cho phép bạn rollback.
- Changelog được đính kèm theo từng phiên bản và có thể để trống khi đồng bộ hoặc xuất bản cập nhật.

### Thay đổi cục bộ so với phiên bản trong registry

Cập nhật so sánh nội dung skill cục bộ với các phiên bản trong registry bằng hash nội dung. Nếu các tệp cục bộ không khớp với bất kỳ phiên bản đã xuất bản nào, CLI sẽ hỏi trước khi ghi đè (hoặc yêu cầu `--force` trong các lần chạy không tương tác).

### Quét đồng bộ và các thư mục gốc dự phòng

`clawhub sync` quét workdir hiện tại của bạn trước. Nếu không tìm thấy skills nào, nó sẽ rơi về các vị trí legacy đã biết (ví dụ `~/openclaw/skills` và `~/.openclaw/skills`). Thiết kế này nhằm tìm các cài đặt skill cũ mà không cần cờ bổ sung.

### Lưu trữ và lockfile

- Skills đã cài được ghi lại trong `.clawhub/lock.json` dưới workdir của bạn.
- Token xác thực được lưu trong tệp cấu hình CLI của ClawHub (ghi đè qua `CLAWHUB_CONFIG_PATH`).

### Telemetry (số lượt cài)

Khi bạn chạy `clawhub sync` trong lúc đã đăng nhập, CLI gửi một snapshot tối thiểu để tính số lượt cài. Bạn có thể tắt hoàn toàn:

```bash
export CLAWHUB_DISABLE_TELEMETRY=1
```

## Biến môi trường

- `CLAWHUB_SITE`: Ghi đè URL của site.
- `CLAWHUB_REGISTRY`: Ghi đè URL API của registry.
- `CLAWHUB_CONFIG_PATH`: Ghi đè nơi CLI lưu token/cấu hình.
- `CLAWHUB_WORKDIR`: Ghi đè workdir mặc định.
- `CLAWHUB_DISABLE_TELEMETRY=1`: Tắt telemetry trên `sync`.
