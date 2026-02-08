---
summary: "Tổng quan về logging: log tệp, đầu ra console, theo dõi bằng CLI, và Control UI"
read_when:
  - Bạn cần một tổng quan logging thân thiện cho người mới
  - Bạn muốn cấu hình mức log hoặc định dạng
  - Bạn đang xử lý sự cố và cần tìm log nhanh
title: "Logging"
x-i18n:
  source_path: logging.md
  source_hash: 884fcf4a906adff3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:53Z
---

# Logging

OpenClaw ghi log ở hai nơi:

- **Log tệp** (JSON lines) do Gateway ghi.
- **Đầu ra console** hiển thị trong terminal và Control UI.

Trang này giải thích log nằm ở đâu, cách đọc chúng, và cách cấu hình mức log
cũng như định dạng.

## Vị trí lưu log

Theo mặc định, Gateway ghi một tệp log cuộn tại:

`/tmp/openclaw/openclaw-YYYY-MM-DD.log`

Ngày tháng sử dụng múi giờ địa phương của máy chủ gateway.

Bạn có thể ghi đè điều này trong `~/.openclaw/openclaw.json`:

```json
{
  "logging": {
    "file": "/path/to/openclaw.log"
  }
}
```

## Cách đọc log

### CLI: theo dõi trực tiếp (khuyến nghị)

Dùng CLI để tail tệp log của gateway qua RPC:

```bash
openclaw logs --follow
```

Các chế độ đầu ra:

- **Phiên TTY**: dòng log có cấu trúc, đẹp, có màu.
- **Phiên không TTY**: văn bản thuần.
- `--json`: JSON phân dòng (mỗi dòng là một sự kiện log).
- `--plain`: ép văn bản thuần trong phiên TTY.
- `--no-color`: tắt màu ANSI.

Ở chế độ JSON, CLI phát ra các đối tượng được gắn thẻ `type`:

- `meta`: siêu dữ liệu luồng (tệp, con trỏ, kích thước)
- `log`: mục log đã được phân tích
- `notice`: gợi ý cắt ngắn / xoay vòng
- `raw`: dòng log chưa được phân tích

Nếu Gateway không thể truy cập, CLI sẽ in ra một gợi ý ngắn để chạy:

```bash
openclaw doctor
```

### Control UI (web)

Tab **Logs** của Control UI theo dõi cùng một tệp bằng `logs.tail`.
Xem [/web/control-ui](/web/control-ui) để biết cách mở.

### Log theo kênh

Để lọc hoạt động theo kênh (WhatsApp/Telegram/etc), dùng:

```bash
openclaw channels logs --channel whatsapp
```

## Định dạng log

### Log tệp (JSONL)

Mỗi dòng trong tệp log là một đối tượng JSON. CLI và Control UI phân tích các
mục này để hiển thị đầu ra có cấu trúc (thời gian, mức, phân hệ, thông điệp).

### Đầu ra console

Log console **nhận biết TTY** và được định dạng để dễ đọc:

- Tiền tố phân hệ (ví dụ: `gateway/channels/whatsapp`)
- Tô màu theo mức (info/warn/error)
- Chế độ gọn hoặc JSON tùy chọn

Định dạng console được điều khiển bởi `logging.consoleStyle`.

## Cấu hình logging

Tất cả cấu hình logging nằm dưới `logging` trong `~/.openclaw/openclaw.json`.

```json
{
  "logging": {
    "level": "info",
    "file": "/tmp/openclaw/openclaw-YYYY-MM-DD.log",
    "consoleLevel": "info",
    "consoleStyle": "pretty",
    "redactSensitive": "tools",
    "redactPatterns": ["sk-.*"]
  }
}
```

### Mức log

- `logging.level`: mức cho **log tệp** (JSONL).
- `logging.consoleLevel`: mức độ chi tiết của **console**.

`--verbose` chỉ ảnh hưởng đến đầu ra console; không thay đổi mức log của tệp.

### Kiểu console

`logging.consoleStyle`:

- `pretty`: thân thiện với con người, có màu, kèm dấu thời gian.
- `compact`: đầu ra gọn hơn (tốt cho phiên dài).
- `json`: mỗi dòng một JSON (cho bộ xử lý log).

### Che thông tin nhạy cảm

Tóm tắt công cụ có thể che token nhạy cảm trước khi hiển thị ra console:

- `logging.redactSensitive`: `off` | `tools` (mặc định: `tools`)
- `logging.redactPatterns`: danh sách chuỗi regex để ghi đè tập mặc định

Che thông tin chỉ ảnh hưởng đến **đầu ra console** và không thay đổi log tệp.

## Chẩn đoán + OpenTelemetry

Chẩn đoán là các sự kiện có cấu trúc, có thể đọc bằng máy cho các lần chạy mô hình **và**
telemetry luồng thông điệp (webhook, xếp hàng, trạng thái phiên). Chúng **không**
thay thế log; chúng tồn tại để cung cấp số liệu, trace và các exporter khác.

Sự kiện chẩn đoán được phát trong tiến trình, nhưng exporter chỉ gắn khi
chẩn đoán + plugin exporter được bật.

### OpenTelemetry vs OTLP

- **OpenTelemetry (OTel)**: mô hình dữ liệu + SDK cho trace, metric và log.
- **OTLP**: giao thức truyền dùng để xuất dữ liệu OTel tới collector/backend.
- OpenClaw hiện xuất qua **OTLP/HTTP (protobuf)**.

### Các tín hiệu được xuất

- **Metrics**: counter + histogram (mức sử dụng token, luồng thông điệp, xếp hàng).
- **Traces**: span cho việc dùng mô hình + xử lý webhook/thông điệp.
- **Logs**: xuất qua OTLP khi `diagnostics.otel.logs` được bật. Lượng log
  có thể cao; lưu ý `logging.level` và bộ lọc exporter.

### Danh mục sự kiện chẩn đoán

Sử dụng mô hình:

- `model.usage`: token, chi phí, thời lượng, ngữ cảnh, nhà cung cấp/mô hình/kênh, id phiên.

Luồng thông điệp:

- `webhook.received`: webhook vào theo kênh.
- `webhook.processed`: webhook được xử lý + thời lượng.
- `webhook.error`: lỗi trình xử lý webhook.
- `message.queued`: thông điệp được xếp hàng để xử lý.
- `message.processed`: kết quả + thời lượng + lỗi tùy chọn.

Hàng đợi + phiên:

- `queue.lane.enqueue`: enqueue lane hàng đợi lệnh + độ sâu.
- `queue.lane.dequeue`: dequeue lane hàng đợi lệnh + thời gian chờ.
- `session.state`: chuyển trạng thái phiên + lý do.
- `session.stuck`: cảnh báo phiên bị kẹt + tuổi.
- `run.attempt`: siêu dữ liệu thử lại/lần chạy.
- `diagnostic.heartbeat`: bộ đếm tổng hợp (webhook/hàng đợi/phiên).

### Bật chẩn đoán (không exporter)

Dùng khi bạn muốn sự kiện chẩn đoán sẵn sàng cho plugin hoặc sink tùy chỉnh:

```json
{
  "diagnostics": {
    "enabled": true
  }
}
```

### Cờ chẩn đoán (log có mục tiêu)

Dùng cờ để bật thêm log debug có mục tiêu mà không tăng `logging.level`.
Cờ không phân biệt hoa thường và hỗ trợ wildcard (ví dụ: `telegram.*` hoặc `*`).

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

Ghi đè bằng biến môi trường (một lần):

```
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

Ghi chú:

- Log theo cờ ghi vào tệp log tiêu chuẩn (giống `logging.file`).
- Đầu ra vẫn được che theo `logging.redactSensitive`.
- Hướng dẫn đầy đủ: [/diagnostics/flags](/diagnostics/flags).

### Xuất sang OpenTelemetry

Chẩn đoán có thể được xuất qua plugin `diagnostics-otel` (OTLP/HTTP). Điều này
hoạt động với bất kỳ collector/backend OpenTelemetry nào chấp nhận OTLP/HTTP.

```json
{
  "plugins": {
    "allow": ["diagnostics-otel"],
    "entries": {
      "diagnostics-otel": {
        "enabled": true
      }
    }
  },
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "endpoint": "http://otel-collector:4318",
      "protocol": "http/protobuf",
      "serviceName": "openclaw-gateway",
      "traces": true,
      "metrics": true,
      "logs": true,
      "sampleRate": 0.2,
      "flushIntervalMs": 60000
    }
  }
}
```

Ghi chú:

- Bạn cũng có thể bật plugin bằng `openclaw plugins enable diagnostics-otel`.
- `protocol` hiện chỉ hỗ trợ `http/protobuf`. `grpc` bị bỏ qua.
- Metrics bao gồm mức sử dụng token, chi phí, kích thước ngữ cảnh, thời lượng chạy, và
  các counter/histogram luồng thông điệp (webhook, xếp hàng, trạng thái phiên, độ sâu/thời gian chờ).
- Trace/metric có thể bật/tắt bằng `traces` / `metrics` (mặc định: bật). Trace
  bao gồm span sử dụng mô hình cùng span xử lý webhook/thông điệp khi được bật.
- Đặt `headers` khi collector của bạn yêu cầu xác thực.
- Biến môi trường được hỗ trợ: `OTEL_EXPORTER_OTLP_ENDPOINT`,
  `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_PROTOCOL`.

### Metrics được xuất (tên + loại)

Sử dụng mô hình:

- `openclaw.tokens` (counter, thuộc tính: `openclaw.token`, `openclaw.channel`,
  `openclaw.provider`, `openclaw.model`)
- `openclaw.cost.usd` (counter, thuộc tính: `openclaw.channel`, `openclaw.provider`,
  `openclaw.model`)
- `openclaw.run.duration_ms` (histogram, thuộc tính: `openclaw.channel`,
  `openclaw.provider`, `openclaw.model`)
- `openclaw.context.tokens` (histogram, thuộc tính: `openclaw.context`,
  `openclaw.channel`, `openclaw.provider`, `openclaw.model`)

Luồng thông điệp:

- `openclaw.webhook.received` (counter, thuộc tính: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.webhook.error` (counter, thuộc tính: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.webhook.duration_ms` (histogram, thuộc tính: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.message.queued` (counter, thuộc tính: `openclaw.channel`,
  `openclaw.source`)
- `openclaw.message.processed` (counter, thuộc tính: `openclaw.channel`,
  `openclaw.outcome`)
- `openclaw.message.duration_ms` (histogram, thuộc tính: `openclaw.channel`,
  `openclaw.outcome`)

Hàng đợi + phiên:

- `openclaw.queue.lane.enqueue` (counter, thuộc tính: `openclaw.lane`)
- `openclaw.queue.lane.dequeue` (counter, thuộc tính: `openclaw.lane`)
- `openclaw.queue.depth` (histogram, thuộc tính: `openclaw.lane` hoặc
  `openclaw.channel=heartbeat`)
- `openclaw.queue.wait_ms` (histogram, thuộc tính: `openclaw.lane`)
- `openclaw.session.state` (counter, thuộc tính: `openclaw.state`, `openclaw.reason`)
- `openclaw.session.stuck` (counter, thuộc tính: `openclaw.state`)
- `openclaw.session.stuck_age_ms` (histogram, thuộc tính: `openclaw.state`)
- `openclaw.run.attempt` (counter, thuộc tính: `openclaw.attempt`)

### Span được xuất (tên + thuộc tính chính)

- `openclaw.model.usage`
  - `openclaw.channel`, `openclaw.provider`, `openclaw.model`
  - `openclaw.sessionKey`, `openclaw.sessionId`
  - `openclaw.tokens.*` (input/output/cache_read/cache_write/total)
- `openclaw.webhook.processed`
  - `openclaw.channel`, `openclaw.webhook`, `openclaw.chatId`
- `openclaw.webhook.error`
  - `openclaw.channel`, `openclaw.webhook`, `openclaw.chatId`,
    `openclaw.error`
- `openclaw.message.processed`
  - `openclaw.channel`, `openclaw.outcome`, `openclaw.chatId`,
    `openclaw.messageId`, `openclaw.sessionKey`, `openclaw.sessionId`,
    `openclaw.reason`
- `openclaw.session.stuck`
  - `openclaw.state`, `openclaw.ageMs`, `openclaw.queueDepth`,
    `openclaw.sessionKey`, `openclaw.sessionId`

### Lấy mẫu + xả

- Lấy mẫu trace: `diagnostics.otel.sampleRate` (0.0–1.0, chỉ span gốc).
- Chu kỳ xuất metric: `diagnostics.otel.flushIntervalMs` (tối thiểu 1000ms).

### Ghi chú giao thức

- Endpoint OTLP/HTTP có thể đặt qua `diagnostics.otel.endpoint` hoặc
  `OTEL_EXPORTER_OTLP_ENDPOINT`.
- Nếu endpoint đã chứa `/v1/traces` hoặc `/v1/metrics`, nó sẽ được dùng nguyên trạng.
- Nếu endpoint đã chứa `/v1/logs`, nó sẽ được dùng nguyên trạng cho log.
- `diagnostics.otel.logs` bật xuất log OTLP cho đầu ra logger chính.

### Hành vi xuất log

- Log OTLP dùng cùng bản ghi có cấu trúc được ghi vào `logging.file`.
- Tuân theo `logging.level` (mức log tệp). Che console **không** áp dụng
  cho log OTLP.
- Triển khai lưu lượng cao nên ưu tiên lấy mẫu/lọc tại collector OTLP.

## Mẹo xử lý sự cố

- **Gateway không truy cập được?** Chạy `openclaw doctor` trước.
- **Log trống?** Kiểm tra Gateway đang chạy và ghi vào đường dẫn tệp
  trong `logging.file`.
- **Cần chi tiết hơn?** Đặt `logging.level` thành `debug` hoặc `trace` rồi thử lại.
