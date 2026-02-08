---
summary: "Danh sách kiểm tra phát hành từng bước cho npm + ứng dụng macOS"
read_when:
  - Cắt một bản phát hành npm mới
  - Cắt một bản phát hành ứng dụng macOS mới
  - Xác minh metadata trước khi phát hành
x-i18n:
  source_path: reference/RELEASING.md
  source_hash: 54cb2b822bfa3c0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:26Z
---

# Danh sách kiểm tra phát hành (npm + macOS)

Sử dụng `pnpm` (Node 22+) từ thư mục gốc repo. Giữ cây làm việc sạch trước khi gắn thẻ/phát hành.

## Kích hoạt bởi người vận hành

Khi người vận hành nói “release”, hãy thực hiện ngay phần kiểm tra trước (không hỏi thêm trừ khi bị chặn):

- Đọc tài liệu này và `docs/platforms/mac/release.md`.
- Tải env từ `~/.profile` và xác nhận `SPARKLE_PRIVATE_KEY_FILE` + các biến App Store Connect đã được đặt (SPARKLE_PRIVATE_KEY_FILE nên nằm trong `~/.profile`).
- Dùng các khóa Sparkle từ `~/Library/CloudStorage/Dropbox/Backup/Sparkle` nếu cần.

1. **Phiên bản & metadata**

- [ ] Tăng phiên bản `package.json` (ví dụ: `2026.1.29`).
- [ ] Chạy `pnpm plugins:sync` để đồng bộ phiên bản gói extension + changelog.
- [ ] Cập nhật chuỗi CLI/phiên bản: [`src/cli/program.ts`](https://github.com/openclaw/openclaw/blob/main/src/cli/program.ts) và user agent Baileys trong [`src/provider-web.ts`](https://github.com/openclaw/openclaw/blob/main/src/provider-web.ts).
- [ ] Xác nhận metadata gói (tên, mô tả, repository, từ khóa, license) và ánh xạ `bin` trỏ tới [`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs) cho `openclaw`.
- [ ] Nếu dependency thay đổi, chạy `pnpm install` để `pnpm-lock.yaml` được cập nhật.

2. **Build & hiện vật**

- [ ] Nếu đầu vào A2UI thay đổi, chạy `pnpm canvas:a2ui:bundle` và commit mọi [`src/canvas-host/a2ui/a2ui.bundle.js`](https://github.com/openclaw/openclaw/blob/main/src/canvas-host/a2ui/a2ui.bundle.js) được cập nhật.
- [ ] `pnpm run build` (tạo lại `dist/`).
- [ ] Xác minh gói npm `files` bao gồm đầy đủ các thư mục `dist/*` cần thiết (đặc biệt `dist/node-host/**` và `dist/acp/**` cho headless node + ACP CLI).
- [ ] Xác nhận `dist/build-info.json` tồn tại và bao gồm hash `commit` mong đợi (banner CLI dùng giá trị này cho cài đặt npm).
- [ ] Tùy chọn: `npm pack --pack-destination /tmp` sau khi build; kiểm tra nội dung tarball và giữ lại cho GitHub release (không **commit**).

3. **Changelog & tài liệu**

- [ ] Cập nhật `CHANGELOG.md` với các điểm nổi bật hướng người dùng (tạo file nếu thiếu); giữ thứ tự mục giảm dần theo phiên bản.
- [ ] Đảm bảo ví dụ/flag trong README khớp với hành vi CLI hiện tại (đặc biệt lệnh hoặc tùy chọn mới).

4. **Xác thực**

- [ ] `pnpm build`
- [ ] `pnpm check`
- [ ] `pnpm test` (hoặc `pnpm test:coverage` nếu cần báo cáo coverage)
- [ ] `pnpm release:check` (xác minh nội dung npm pack)
- [ ] `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke` (kiểm tra khói cài đặt Docker, đường nhanh; bắt buộc trước khi phát hành)
  - Nếu bản phát hành npm ngay trước đó được biết là lỗi, đặt `OPENCLAW_INSTALL_SMOKE_PREVIOUS=<last-good-version>` hoặc `OPENCLAW_INSTALL_SMOKE_SKIP_PREVIOUS=1` cho bước preinstall.
- [ ] (Tùy chọn) Kiểm tra khói trình cài đặt đầy đủ (thêm coverage non-root + CLI): `pnpm test:install:smoke`
- [ ] (Tùy chọn) E2E trình cài đặt (Docker, chạy `curl -fsSL https://openclaw.ai/install.sh | bash`, onboarding, rồi gọi công cụ thực):
  - `pnpm test:install:e2e:openai` (yêu cầu `OPENAI_API_KEY`)
  - `pnpm test:install:e2e:anthropic` (yêu cầu `ANTHROPIC_API_KEY`)
  - `pnpm test:install:e2e` (yêu cầu cả hai khóa; chạy cả hai provider)
- [ ] (Tùy chọn) Kiểm tra nhanh web gateway nếu thay đổi của bạn ảnh hưởng đường gửi/nhận.

5. **Ứng dụng macOS (Sparkle)**

- [ ] Build + ký ứng dụng macOS, sau đó zip để phân phối.
- [ ] Tạo appcast Sparkle (ghi chú HTML qua [`scripts/make_appcast.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/make_appcast.sh)) và cập nhật `appcast.xml`.
- [ ] Giữ sẵn file zip ứng dụng (và zip dSYM tùy chọn) để đính kèm GitHub release.
- [ ] Làm theo [macOS release](/platforms/mac/release) để biết lệnh chính xác và các biến env cần thiết.
  - `APP_BUILD` phải là số + tăng đơn điệu (không `-beta`) để Sparkle so sánh phiên bản chính xác.
  - Nếu notarize, dùng profile keychain `openclaw-notary` được tạo từ các biến env App Store Connect API (xem [macOS release](/platforms/mac/release)).

6. **Phát hành (npm)**

- [ ] Xác nhận trạng thái git sạch; commit và push nếu cần.
- [ ] `npm login` (xác minh 2FA) nếu cần.
- [ ] `npm publish --access public` (dùng `--tag beta` cho bản pre-release).
- [ ] Xác minh registry: `npm view openclaw version`, `npm view openclaw dist-tags`, và `npx -y openclaw@X.Y.Z --version` (hoặc `--help`).

### Xử lý sự cố (ghi chú từ bản phát hành 2.0.0-beta2)

- **npm pack/publish bị treo hoặc tạo tarball rất lớn**: bundle ứng dụng macOS trong `dist/OpenClaw.app` (và các zip phát hành) bị cuốn vào gói. Khắc phục bằng cách whitelist nội dung phát hành qua `package.json` `files` (bao gồm các thư mục con dist, docs, skills; loại trừ bundle ứng dụng). Xác nhận bằng `npm pack --dry-run` rằng `dist/OpenClaw.app` không xuất hiện.
- **Vòng lặp xác thực web npm cho dist-tags**: dùng xác thực legacy để nhận OTP:
  - `NPM_CONFIG_AUTH_TYPE=legacy npm dist-tag add openclaw@X.Y.Z latest`
- **Xác minh `npx` thất bại với `ECOMPROMISED: Lock compromised`**: thử lại với cache mới:
  - `NPM_CONFIG_CACHE=/tmp/npm-cache-$(date +%s) npx -y openclaw@X.Y.Z --version`
- **Cần trỏ lại tag sau một bản sửa muộn**: ép cập nhật và push tag, sau đó đảm bảo các hiện vật GitHub release vẫn khớp:
  - `git tag -f vX.Y.Z && git push -f origin vX.Y.Z`

7. **GitHub release + appcast**

- [ ] Gắn thẻ và push: `git tag vX.Y.Z && git push origin vX.Y.Z` (hoặc `git push --tags`).
- [ ] Tạo/làm mới GitHub release cho `vX.Y.Z` với **tiêu đề `openclaw X.Y.Z`** (không chỉ là tag); phần nội dung phải bao gồm **toàn bộ** mục changelog cho phiên bản đó (Highlights + Changes + Fixes), chèn trực tiếp (không dùng link trần), và **không được lặp lại tiêu đề trong nội dung**.
- [ ] Đính kèm hiện vật: tarball `npm pack` (tùy chọn), `OpenClaw-X.Y.Z.zip`, và `OpenClaw-X.Y.Z.dSYM.zip` (nếu tạo).
- [ ] Commit `appcast.xml` đã cập nhật và push (Sparkle lấy feed từ main).
- [ ] Từ một thư mục tạm sạch (không có `package.json`), chạy `npx -y openclaw@X.Y.Z send --help` để xác nhận cài đặt/điểm vào CLI hoạt động.
- [ ] Thông báo/chia sẻ ghi chú phát hành.

## Phạm vi phát hành plugin (npm)

Chúng tôi chỉ phát hành **các plugin npm hiện có** dưới scope `@openclaw/*`. Các plugin
được bundle nhưng không có trên npm sẽ **chỉ tồn tại trong cây thư mục** (vẫn được ship trong
`extensions/**`).

Quy trình để suy ra danh sách:

1. `npm search @openclaw --json` và ghi lại tên gói.
2. So sánh với tên trong `extensions/*/package.json`.
3. Chỉ phát hành **phần giao nhau** (đã có trên npm).

Danh sách plugin npm hiện tại (cập nhật khi cần):

- @openclaw/bluebubbles
- @openclaw/diagnostics-otel
- @openclaw/discord
- @openclaw/feishu
- @openclaw/lobster
- @openclaw/matrix
- @openclaw/msteams
- @openclaw/nextcloud-talk
- @openclaw/nostr
- @openclaw/voice-call
- @openclaw/zalo
- @openclaw/zalouser

Ghi chú phát hành cũng phải nêu rõ **các plugin bundle tùy chọn mới** **không bật mặc định**
(ví dụ: `tlon`).
