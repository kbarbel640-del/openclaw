---
summary: "Plugin/extension OpenClaw: khám phá, cấu hình và an toàn"
read_when:
  - Thêm hoặc sửa đổi plugin/extension
  - Tài liệu hóa quy tắc cài đặt hoặc tải plugin
title: "Plugin"
x-i18n:
  source_path: plugin.md
  source_hash: b36ca6b90ca03eaa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:30Z
---

# Plugin (Extension)

## Khởi động nhanh (mới với plugin?)

Một plugin chỉ là **một mô-đun mã nhỏ** mở rộng OpenClaw với các
tính năng bổ sung (lệnh, công cụ và Gateway RPC).

Hầu hết thời gian, bạn sẽ dùng plugin khi muốn một tính năng chưa có
trong OpenClaw cốt lõi (hoặc bạn muốn giữ các tính năng tùy chọn ngoài
bản cài đặt chính).

Lộ trình nhanh:

1. Xem những gì đang được tải:

```bash
openclaw plugins list
```

2. Cài một plugin chính thức (ví dụ: Voice Call):

```bash
openclaw plugins install @openclaw/voice-call
```

3. Khởi động lại Gateway, rồi cấu hình trong `plugins.entries.<id>.config`.

Xem [Voice Call](/plugins/voice-call) để có một ví dụ plugin cụ thể.

## Plugin khả dụng (chính thức)

- Microsoft Teams chỉ có dạng plugin tính đến 2026.1.15; cài `@openclaw/msteams` nếu bạn dùng Teams.
- Memory (Core) — plugin tìm kiếm bộ nhớ đi kèm (bật mặc định qua `plugins.slots.memory`)
- Memory (LanceDB) — plugin bộ nhớ dài hạn đi kèm (tự động recall/capture; đặt `plugins.slots.memory = "memory-lancedb"`)
- [Voice Call](/plugins/voice-call) — `@openclaw/voice-call`
- [Zalo Personal](/plugins/zalouser) — `@openclaw/zalouser`
- [Matrix](/channels/matrix) — `@openclaw/matrix`
- [Nostr](/channels/nostr) — `@openclaw/nostr`
- [Zalo](/channels/zalo) — `@openclaw/zalo`
- [Microsoft Teams](/channels/msteams) — `@openclaw/msteams`
- Google Antigravity OAuth (xác thực nhà cung cấp) — đi kèm dưới dạng `google-antigravity-auth` (tắt mặc định)
- Gemini CLI OAuth (xác thực nhà cung cấp) — đi kèm dưới dạng `google-gemini-cli-auth` (tắt mặc định)
- Qwen OAuth (xác thực nhà cung cấp) — đi kèm dưới dạng `qwen-portal-auth` (tắt mặc định)
- Copilot Proxy (xác thực nhà cung cấp) — cầu nối VS Code Copilot Proxy cục bộ; khác với đăng nhập thiết bị `github-copilot` tích hợp (đi kèm, tắt mặc định)

Plugin OpenClaw là **mô-đun TypeScript** được tải lúc chạy qua jiti. **Xác thực cấu hình
không thực thi mã plugin**; thay vào đó dùng manifest plugin và JSON
Schema. Xem [Plugin manifest](/plugins/manifest).

Plugin có thể đăng ký:

- Phương thức Gateway RPC
- Trình xử lý Gateway HTTP
- Công cụ agent
- Lệnh CLI
- Dịch vụ nền
- Xác thực cấu hình tùy chọn
- **Skills** (bằng cách liệt kê các thư mục `skills` trong manifest plugin)
- **Lệnh auto-reply** (thực thi mà không gọi agent AI)

Plugin chạy **trong cùng tiến trình** với Gateway, vì vậy hãy coi chúng là mã đáng tin cậy.
Hướng dẫn viết tool: [Plugin agent tools](/plugins/agent-tools).

## Trợ giúp runtime

Plugin có thể truy cập một số helper cốt lõi qua `api.runtime`. Với TTS cho thoại:

```ts
const result = await api.runtime.tts.textToSpeechTelephony({
  text: "Hello from OpenClaw",
  cfg: api.config,
});
```

Ghi chú:

- Dùng cấu hình `messages.tts` cốt lõi (OpenAI hoặc ElevenLabs).
- Trả về buffer âm thanh PCM + sample rate. Plugin phải tự resample/encode cho nhà cung cấp.
- Edge TTS không được hỗ trợ cho thoại.

## Khám phá & độ ưu tiên

OpenClaw quét theo thứ tự:

1. Đường dẫn cấu hình

- `plugins.load.paths` (tệp hoặc thư mục)

2. Extension trong workspace

- `<workspace>/.openclaw/extensions/*.ts`
- `<workspace>/.openclaw/extensions/*/index.ts`

3. Extension toàn cục

- `~/.openclaw/extensions/*.ts`
- `~/.openclaw/extensions/*/index.ts`

4. Extension đi kèm (phát hành cùng OpenClaw, **tắt mặc định**)

- `<openclaw>/extensions/*`

Plugin đi kèm phải được bật rõ ràng qua `plugins.entries.<id>.enabled`
hoặc `openclaw plugins enable <id>`. Plugin đã cài được bật mặc định,
nhưng có thể tắt theo cách tương tự.

Mỗi plugin phải có một tệp `openclaw.plugin.json` ở thư mục gốc. Nếu một đường dẫn
trỏ tới tệp, thư mục gốc plugin là thư mục chứa tệp đó và phải có
manifest.

Nếu nhiều plugin trùng cùng id, bản khớp đầu tiên theo thứ tự trên
được dùng và các bản có độ ưu tiên thấp hơn sẽ bị bỏ qua.

### Gói package

Một thư mục plugin có thể chứa `package.json` với `openclaw.extensions`:

```json
{
  "name": "my-pack",
  "openclaw": {
    "extensions": ["./src/safety.ts", "./src/tools.ts"]
  }
}
```

Mỗi mục trở thành một plugin. Nếu gói liệt kê nhiều extension, id plugin
trở thành `name/<fileBase>`.

Nếu plugin của bạn import phụ thuộc npm, hãy cài chúng trong thư mục đó để
`node_modules` khả dụng (`npm install` / `pnpm install`).

### Metadata danh mục kênh

Plugin kênh có thể quảng bá metadata onboarding qua `openclaw.channel` và
gợi ý cài đặt qua `openclaw.install`. Điều này giúp dữ liệu danh mục cốt lõi
không chứa dữ liệu.

Ví dụ:

```json
{
  "name": "@openclaw/nextcloud-talk",
  "openclaw": {
    "extensions": ["./index.ts"],
    "channel": {
      "id": "nextcloud-talk",
      "label": "Nextcloud Talk",
      "selectionLabel": "Nextcloud Talk (self-hosted)",
      "docsPath": "/channels/nextcloud-talk",
      "docsLabel": "nextcloud-talk",
      "blurb": "Self-hosted chat via Nextcloud Talk webhook bots.",
      "order": 65,
      "aliases": ["nc-talk", "nc"]
    },
    "install": {
      "npmSpec": "@openclaw/nextcloud-talk",
      "localPath": "extensions/nextcloud-talk",
      "defaultChoice": "npm"
    }
  }
}
```

OpenClaw cũng có thể gộp **danh mục kênh bên ngoài** (ví dụ: xuất registry MPM).
Đặt một tệp JSON tại một trong các vị trí:

- `~/.openclaw/mpm/plugins.json`
- `~/.openclaw/mpm/catalog.json`
- `~/.openclaw/plugins/catalog.json`

Hoặc trỏ `OPENCLAW_PLUGIN_CATALOG_PATHS` (hoặc `OPENCLAW_MPM_CATALOG_PATHS`) tới
một hoặc nhiều tệp JSON (phân tách bằng dấu phẩy/chấm phẩy/`PATH`). Mỗi tệp
nên chứa `{ "entries": [ { "name": "@scope/pkg", "openclaw": { "channel": {...}, "install": {...} } } ] }`.

## ID plugin

ID plugin mặc định:

- Gói package: `package.json` `name`
- Tệp độc lập: tên cơ sở của tệp (`~/.../voice-call.ts` → `voice-call`)

Nếu một plugin export `id`, OpenClaw sẽ dùng nó nhưng cảnh báo khi
không khớp với id đã cấu hình.

## Cấu hình

```json5
{
  plugins: {
    enabled: true,
    allow: ["voice-call"],
    deny: ["untrusted-plugin"],
    load: { paths: ["~/Projects/oss/voice-call-extension"] },
    entries: {
      "voice-call": { enabled: true, config: { provider: "twilio" } },
    },
  },
}
```

Các trường:

- `enabled`: công tắc chính (mặc định: true)
- `allow`: allowlist (tùy chọn)
- `deny`: denylist (tùy chọn; deny thắng)
- `load.paths`: tệp/thư mục plugin bổ sung
- `entries.<id>`: bật/tắt theo plugin + cấu hình

Thay đổi cấu hình **yêu cầu khởi động lại gateway**.

Quy tắc xác thực (nghiêm ngặt):

- ID plugin không xác định trong `entries`, `allow`, `deny` hoặc `slots` là **lỗi**.
- Khóa `channels.<id>` không xác định là **lỗi** trừ khi manifest plugin khai báo
  id kênh.
- Cấu hình plugin được xác thực bằng JSON Schema nhúng trong
  `openclaw.plugin.json` (`configSchema`).
- Nếu plugin bị tắt, cấu hình của nó được giữ lại và phát **cảnh báo**.

## Slot plugin (danh mục độc quyền)

Một số danh mục plugin là **độc quyền** (chỉ một plugin hoạt động tại một thời điểm). Dùng
`plugins.slots` để chọn plugin sở hữu slot:

```json5
{
  plugins: {
    slots: {
      memory: "memory-core", // or "none" to disable memory plugins
    },
  },
}
```

Nếu nhiều plugin khai báo `kind: "memory"`, chỉ plugin được chọn sẽ tải. Các plugin khác
bị tắt kèm chẩn đoán.

## Control UI (schema + nhãn)

Control UI dùng `config.schema` (JSON Schema + `uiHints`) để dựng form tốt hơn.

OpenClaw bổ sung `uiHints` lúc chạy dựa trên các plugin được phát hiện:

- Thêm nhãn theo plugin cho `plugins.entries.<id>` / `.enabled` / `.config`
- Gộp gợi ý trường cấu hình do plugin cung cấp dưới:
  `plugins.entries.<id>.config.<field>`

Nếu bạn muốn các trường cấu hình plugin hiển thị nhãn/placeholder tốt (và đánh dấu bí mật là nhạy cảm),
hãy cung cấp `uiHints` cùng với JSON Schema trong manifest plugin.

Ví dụ:

```json
{
  "id": "my-plugin",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "apiKey": { "type": "string" },
      "region": { "type": "string" }
    }
  },
  "uiHints": {
    "apiKey": { "label": "API Key", "sensitive": true },
    "region": { "label": "Region", "placeholder": "us-east-1" }
  }
}
```

## CLI

```bash
openclaw plugins list
openclaw plugins info <id>
openclaw plugins install <path>                 # copy a local file/dir into ~/.openclaw/extensions/<id>
openclaw plugins install ./extensions/voice-call # relative path ok
openclaw plugins install ./plugin.tgz           # install from a local tarball
openclaw plugins install ./plugin.zip           # install from a local zip
openclaw plugins install -l ./extensions/voice-call # link (no copy) for dev
openclaw plugins install @openclaw/voice-call # install from npm
openclaw plugins update <id>
openclaw plugins update --all
openclaw plugins enable <id>
openclaw plugins disable <id>
openclaw plugins doctor
```

`plugins update` chỉ hoạt động cho cài đặt npm được theo dõi dưới `plugins.installs`.

Plugin cũng có thể đăng ký các lệnh cấp cao riêng (ví dụ: `openclaw voicecall`).

## Plugin API (tổng quan)

Plugin export một trong hai:

- Một hàm: `(api) => { ... }`
- Một đối tượng: `{ id, name, configSchema, register(api) { ... } }`

## Hook plugin

Plugin có thể đóng gói hook và đăng ký chúng lúc chạy. Điều này cho phép plugin
đóng gói tự động hóa theo sự kiện mà không cần cài một gói hook riêng.

### Ví dụ

```
import { registerPluginHooksFromDir } from "openclaw/plugin-sdk";

export default function register(api) {
  registerPluginHooksFromDir(api, "./hooks");
}
```

Ghi chú:

- Thư mục hook tuân theo cấu trúc hook thông thường (`HOOK.md` + `handler.ts`).
- Quy tắc đủ điều kiện hook vẫn áp dụng (OS/bins/env/cấu hình).
- Hook do plugin quản lý hiển thị trong `openclaw hooks list` với `plugin:<id>`.
- Bạn không thể bật/tắt hook do plugin quản lý qua `openclaw hooks`; hãy bật/tắt plugin thay thế.

## Plugin nhà cung cấp (xác thực mô hình)

Plugin có thể đăng ký **luồng xác thực nhà cung cấp mô hình** để người dùng chạy OAuth hoặc
thiết lập API-key ngay trong OpenClaw (không cần script bên ngoài).

Đăng ký nhà cung cấp qua `api.registerProvider(...)`. Mỗi nhà cung cấp cung cấp một
hoặc nhiều phương thức xác thực (OAuth, API key, device code, v.v.). Các phương thức này cung cấp cho:

- `openclaw models auth login --provider <id> [--method <id>]`

Ví dụ:

```ts
api.registerProvider({
  id: "acme",
  label: "AcmeAI",
  auth: [
    {
      id: "oauth",
      label: "OAuth",
      kind: "oauth",
      run: async (ctx) => {
        // Run OAuth flow and return auth profiles.
        return {
          profiles: [
            {
              profileId: "acme:default",
              credential: {
                type: "oauth",
                provider: "acme",
                access: "...",
                refresh: "...",
                expires: Date.now() + 3600 * 1000,
              },
            },
          ],
          defaultModel: "acme/opus-1",
        };
      },
    },
  ],
});
```

Ghi chú:

- `run` nhận một `ProviderAuthContext` với các helper `prompter`, `runtime`,
  `openUrl` và `oauth.createVpsAwareHandlers`.
- Trả về `configPatch` khi bạn cần thêm mô hình mặc định hoặc cấu hình nhà cung cấp.
- Trả về `defaultModel` để `--set-default` có thể cập nhật mặc định agent.

### Đăng ký kênh nhắn tin

Plugin có thể đăng ký **plugin kênh** hoạt động như các kênh tích hợp
(WhatsApp, Telegram, v.v.). Cấu hình kênh nằm dưới `channels.<id>` và được
xác thực bởi mã plugin kênh của bạn.

```ts
const myChannel = {
  id: "acmechat",
  meta: {
    id: "acmechat",
    label: "AcmeChat",
    selectionLabel: "AcmeChat (API)",
    docsPath: "/channels/acmechat",
    blurb: "demo channel plugin.",
    aliases: ["acme"],
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.acmechat?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.acmechat?.accounts?.[accountId ?? "default"] ?? {
        accountId,
      },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async () => ({ ok: true }),
  },
};

export default function (api) {
  api.registerChannel({ plugin: myChannel });
}
```

Ghi chú:

- Đặt cấu hình dưới `channels.<id>` (không phải `plugins.entries`).
- `meta.label` dùng cho nhãn trong danh sách CLI/UI.
- `meta.aliases` thêm id thay thế để chuẩn hóa và nhập CLI.
- `meta.preferOver` liệt kê id kênh để bỏ qua tự động bật khi cả hai đều được cấu hình.
- `meta.detailLabel` và `meta.systemImage` cho phép UI hiển thị nhãn/icon phong phú hơn.

### Viết kênh nhắn tin mới (từng bước)

Dùng khi bạn muốn một **bề mặt chat mới** (một “kênh nhắn tin”), không phải nhà cung cấp mô hình.
Tài liệu nhà cung cấp mô hình nằm dưới `/providers/*`.

1. Chọn id + dạng cấu hình

- Tất cả cấu hình kênh nằm dưới `channels.<id>`.
- Ưu tiên `channels.<id>.accounts.<accountId>` cho thiết lập nhiều tài khoản.

2. Định nghĩa metadata kênh

- `meta.label`, `meta.selectionLabel`, `meta.docsPath`, `meta.blurb` điều khiển danh sách CLI/UI.
- `meta.docsPath` nên trỏ tới trang tài liệu như `/channels/<id>`.
- `meta.preferOver` cho phép plugin thay thế kênh khác (tự động bật sẽ ưu tiên).
- `meta.detailLabel` và `meta.systemImage` được UI dùng cho mô tả/icon.

3. Cài đặt các adapter bắt buộc

- `config.listAccountIds` + `config.resolveAccount`
- `capabilities` (kiểu chat, media, thread, v.v.)
- `outbound.deliveryMode` + `outbound.sendText` (cho gửi cơ bản)

4. Thêm adapter tùy chọn khi cần

- `setup` (wizard), `security` (chính sách DM), `status` (health/chẩn đoán)
- `gateway` (start/stop/login), `mentions`, `threading`, `streaming`
- `actions` (hành động tin nhắn), `commands` (hành vi lệnh gốc)

5. Đăng ký kênh trong plugin của bạn

- `api.registerChannel({ plugin })`

Ví dụ cấu hình tối thiểu:

```json5
{
  channels: {
    acmechat: {
      accounts: {
        default: { token: "ACME_TOKEN", enabled: true },
      },
    },
  },
}
```

Plugin kênh tối thiểu (chỉ outbound):

```ts
const plugin = {
  id: "acmechat",
  meta: {
    id: "acmechat",
    label: "AcmeChat",
    selectionLabel: "AcmeChat (API)",
    docsPath: "/channels/acmechat",
    blurb: "AcmeChat messaging channel.",
    aliases: ["acme"],
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.acmechat?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.acmechat?.accounts?.[accountId ?? "default"] ?? {
        accountId,
      },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ text }) => {
      // deliver `text` to your channel here
      return { ok: true };
    },
  },
};

export default function (api) {
  api.registerChannel({ plugin });
}
```

Tải plugin (thư mục extension hoặc `plugins.load.paths`), khởi động lại gateway,
sau đó cấu hình `channels.<id>` trong cấu hình của bạn.

### Công cụ agent

Xem hướng dẫn chuyên biệt: [Plugin agent tools](/plugins/agent-tools).

### Đăng ký phương thức gateway RPC

```ts
export default function (api) {
  api.registerGatewayMethod("myplugin.status", ({ respond }) => {
    respond(true, { ok: true });
  });
}
```

### Đăng ký lệnh CLI

```ts
export default function (api) {
  api.registerCli(
    ({ program }) => {
      program.command("mycmd").action(() => {
        console.log("Hello");
      });
    },
    { commands: ["mycmd"] },
  );
}
```

### Đăng ký lệnh auto-reply

Plugin có thể đăng ký các lệnh slash tùy chỉnh thực thi **không gọi agent AI**. Điều này hữu ích cho
lệnh bật/tắt, kiểm tra trạng thái, hoặc hành động nhanh
không cần xử lý LLM.

```ts
export default function (api) {
  api.registerCommand({
    name: "mystatus",
    description: "Show plugin status",
    handler: (ctx) => ({
      text: `Plugin is running! Channel: ${ctx.channel}`,
    }),
  });
}
```

Ngữ cảnh handler lệnh:

- `senderId`: ID người gửi (nếu có)
- `channel`: Kênh nơi lệnh được gửi
- `isAuthorizedSender`: Người gửi có được ủy quyền hay không
- `args`: Tham số truyền sau lệnh (nếu `acceptsArgs: true`)
- `commandBody`: Toàn bộ văn bản lệnh
- `config`: Cấu hình OpenClaw hiện tại

Tùy chọn lệnh:

- `name`: Tên lệnh (không gồm tiền tố `/`)
- `description`: Văn bản trợ giúp hiển thị trong danh sách lệnh
- `acceptsArgs`: Lệnh có nhận tham số hay không (mặc định: false). Nếu false mà có tham số, lệnh sẽ không khớp và thông điệp rơi sang handler khác
- `requireAuth`: Có yêu cầu người gửi được ủy quyền hay không (mặc định: true)
- `handler`: Hàm trả về `{ text: string }` (có thể async)

Ví dụ có ủy quyền và tham số:

```ts
api.registerCommand({
  name: "setmode",
  description: "Set plugin mode",
  acceptsArgs: true,
  requireAuth: true,
  handler: async (ctx) => {
    const mode = ctx.args?.trim() || "default";
    await saveMode(mode);
    return { text: `Mode set to: ${mode}` };
  },
});
```

Ghi chú:

- Lệnh plugin được xử lý **trước** lệnh tích hợp và agent AI
- Lệnh được đăng ký toàn cục và hoạt động trên mọi kênh
- Tên lệnh không phân biệt hoa/thường (`/MyStatus` khớp `/mystatus`)
- Tên lệnh phải bắt đầu bằng chữ cái và chỉ chứa chữ cái, số, dấu gạch nối và gạch dưới
- Tên lệnh dành riêng (như `help`, `status`, `reset`, v.v.) không thể bị plugin ghi đè
- Đăng ký trùng lệnh giữa các plugin sẽ thất bại với lỗi chẩn đoán

### Đăng ký dịch vụ nền

```ts
export default function (api) {
  api.registerService({
    id: "my-service",
    start: () => api.logger.info("ready"),
    stop: () => api.logger.info("bye"),
  });
}
```

## Quy ước đặt tên

- Phương thức Gateway: `pluginId.action` (ví dụ: `voicecall.status`)
- Công cụ: `snake_case` (ví dụ: `voice_call`)
- Lệnh CLI: kebab hoặc camel, nhưng tránh trùng với lệnh cốt lõi

## Skills

Plugin có thể đóng gói một skill trong repo (`skills/<name>/SKILL.md`).
Bật bằng `plugins.entries.<id>.enabled` (hoặc các cổng cấu hình khác) và đảm bảo
nó có mặt trong workspace/vị trí skills được quản lý.

## Phân phối (npm)

Đóng gói khuyến nghị:

- Gói chính: `openclaw` (repo này)
- Plugin: các gói npm riêng dưới `@openclaw/*` (ví dụ: `@openclaw/voice-call`)

Hợp đồng phát hành:

- `package.json` của plugin phải bao gồm `openclaw.extensions` với một hoặc nhiều tệp entry.
- Tệp entry có thể là `.js` hoặc `.ts` (jiti tải TS lúc chạy).
- `openclaw plugins install <npm-spec>` dùng `npm pack`, giải nén vào `~/.openclaw/extensions/<id>/`, và bật trong cấu hình.
- Độ ổn định khóa cấu hình: gói có scope được chuẩn hóa về id **không scope** cho `plugins.entries.*`.

## Ví dụ plugin: Voice Call

Repo này bao gồm một plugin gọi thoại (Twilio hoặc fallback ghi log):

- Nguồn: `extensions/voice-call`
- Skill: `skills/voice-call`
- CLI: `openclaw voicecall start|status`
- Công cụ: `voice_call`
- RPC: `voicecall.start`, `voicecall.status`
- Cấu hình (twilio): `provider: "twilio"` + `twilio.accountSid/authToken/from` (tùy chọn `statusCallbackUrl`, `twimlUrl`)
- Cấu hình (dev): `provider: "log"` (không mạng)

Xem [Voice Call](/plugins/voice-call) và `extensions/voice-call/README.md` để biết thiết lập và cách dùng.

## Ghi chú an toàn

Plugin chạy trong cùng tiến trình với Gateway. Hãy coi chúng là mã đáng tin cậy:

- Chỉ cài plugin bạn tin tưởng.
- Ưu tiên allowlist `plugins.allow`.
- Khởi động lại Gateway sau thay đổi.

## Kiểm thử plugin

Plugin có thể (và nên) kèm theo test:

- Plugin trong repo có thể đặt test Vitest dưới `src/**` (ví dụ: `src/plugins/voice-call.plugin.test.ts`).
- Plugin phát hành riêng nên chạy CI riêng (lint/build/test) và xác thực `openclaw.extensions` trỏ tới entrypoint đã build (`dist/index.js`).
