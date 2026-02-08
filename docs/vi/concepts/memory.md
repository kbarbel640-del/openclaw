---
summary: "Cách bộ nhớ OpenClaw hoạt động (các tệp workspace + xả bộ nhớ tự động)"
read_when:
  - Bạn muốn bố cục và quy trình tệp bộ nhớ
  - Bạn muốn tinh chỉnh xả bộ nhớ tự động trước khi nén
x-i18n:
  source_path: concepts/memory.md
  source_hash: 5fe705d89fb30998
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:24Z
---

# Bộ nhớ

Bộ nhớ OpenClaw là **Markdown thuần trong workspace của tác tử**. Các tệp là
nguồn chân lý; mô hình chỉ “nhớ” những gì được ghi xuống đĩa.

Các công cụ tìm kiếm bộ nhớ được cung cấp bởi plugin bộ nhớ đang hoạt động (mặc định:
`memory-core`). Tắt plugin bộ nhớ bằng `plugins.slots.memory = "none"`.

## Các tệp bộ nhớ (Markdown)

Bố cục workspace mặc định dùng hai lớp bộ nhớ:

- `memory/YYYY-MM-DD.md`
  - Nhật ký hằng ngày (chỉ ghi thêm).
  - Đọc hôm nay + hôm qua khi bắt đầu phiên.
- `MEMORY.md` (tùy chọn)
  - Bộ nhớ dài hạn được tuyển chọn.
  - **Chỉ tải trong phiên chính, riêng tư** (không bao giờ trong bối cảnh nhóm).

Các tệp này nằm dưới workspace (`agents.defaults.workspace`, mặc định
`~/.openclaw/workspace`). Xem [Agent workspace](/concepts/agent-workspace) để biết bố cục đầy đủ.

## Khi nào nên ghi bộ nhớ

- Quyết định, sở thích và sự thật bền vững ghi vào `MEMORY.md`.
- Ghi chú hằng ngày và ngữ cảnh đang chạy ghi vào `memory/YYYY-MM-DD.md`.
- Nếu ai đó nói “hãy nhớ điều này”, hãy ghi lại (đừng giữ trong RAM).
- Khu vực này vẫn đang phát triển. Việc nhắc mô hình lưu bộ nhớ là hữu ích; nó sẽ biết phải làm gì.
- Nếu bạn muốn điều gì đó tồn tại lâu dài, **hãy yêu cầu bot ghi nó** vào bộ nhớ.

## Xả bộ nhớ tự động (ping trước khi nén)

Khi một phiên **gần đến lúc tự động nén**, OpenClaw kích hoạt một **lượt tác tử im lặng**
để nhắc mô hình ghi bộ nhớ bền vững **trước khi** ngữ cảnh bị nén. Các prompt mặc định
nói rõ mô hình _có thể trả lời_, nhưng thường `NO_REPLY` là phản hồi đúng để người
dùng không bao giờ thấy lượt này.

Việc này được điều khiển bởi `agents.defaults.compaction.memoryFlush`:

```json5
{
  agents: {
    defaults: {
      compaction: {
        reserveTokensFloor: 20000,
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 4000,
          systemPrompt: "Session nearing compaction. Store durable memories now.",
          prompt: "Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store.",
        },
      },
    },
  },
}
```

Chi tiết:

- **Ngưỡng mềm**: xả được kích hoạt khi ước tính token của phiên vượt
  `contextWindow - reserveTokensFloor - softThresholdTokens`.
- **Im lặng** theo mặc định: prompt bao gồm `NO_REPLY` nên không có gì được gửi ra.
- **Hai prompt**: một prompt người dùng cộng với một prompt hệ thống thêm lời nhắc.
- **Một lần xả cho mỗi chu kỳ nén** (được theo dõi trong `sessions.json`).
- **Workspace phải ghi được**: nếu phiên chạy trong sandbox với
  `workspaceAccess: "ro"` hoặc `"none"`, việc xả sẽ bị bỏ qua.

Để biết toàn bộ vòng đời nén, xem
[Session management + compaction](/reference/session-management-compaction).

## Tìm kiếm bộ nhớ vector

OpenClaw có thể xây dựng một chỉ mục vector nhỏ trên `MEMORY.md` và `memory/*.md` để
các truy vấn ngữ nghĩa có thể tìm ghi chú liên quan ngay cả khi cách diễn đạt khác nhau.

Mặc định:

- Bật theo mặc định.
- Theo dõi thay đổi của tệp bộ nhớ (có debounce).
- Mặc định dùng embedding từ xa. Nếu `memorySearch.provider` chưa được đặt, OpenClaw tự chọn:
  1. `local` nếu một `memorySearch.local.modelPath` được cấu hình và tệp tồn tại.
  2. `openai` nếu có thể phân giải khóa OpenAI.
  3. `gemini` nếu có thể phân giải khóa Gemini.
  4. Nếu không, tìm kiếm bộ nhớ sẽ bị tắt cho đến khi được cấu hình.
- Chế độ local dùng node-llama-cpp và có thể cần `pnpm approve-builds`.
- Dùng sqlite-vec (khi khả dụng) để tăng tốc tìm kiếm vector trong SQLite.

Embedding từ xa **yêu cầu** khóa API cho nhà cung cấp embedding. OpenClaw
phân giải khóa từ hồ sơ xác thực, `models.providers.*.apiKey`, hoặc
biến môi trường. Codex OAuth chỉ bao phủ chat/completions và **không** đáp ứng
embedding cho tìm kiếm bộ nhớ. Với Gemini, dùng `GEMINI_API_KEY` hoặc
`models.providers.google.apiKey`. Khi dùng endpoint OpenAI-compatible tùy chỉnh,
đặt `memorySearch.remote.apiKey` (và tùy chọn `memorySearch.remote.headers`).

### Backend QMD (thử nghiệm)

Đặt `memory.backend = "qmd"` để thay bộ lập chỉ mục SQLite tích hợp bằng
[QMD](https://github.com/tobi/qmd): một sidecar tìm kiếm local-first kết hợp
BM25 + vector + reranking. Markdown vẫn là nguồn chân lý; OpenClaw gọi QMD để
truy xuất. Điểm chính:

**Yêu cầu trước**

- Tắt theo mặc định. Chọn tham gia theo từng cấu hình (`memory.backend = "qmd"`).
- Cài QMD CLI riêng (`bun install -g github.com/tobi/qmd` hoặc tải
  bản phát hành) và đảm bảo binary `qmd` nằm trong `PATH` của gateway.
- QMD cần bản dựng SQLite cho phép extension (`brew install sqlite` trên
  macOS).
- QMD chạy hoàn toàn local qua Bun + `node-llama-cpp` và tự tải các mô hình GGUF
  từ HuggingFace ở lần dùng đầu (không cần daemon Ollama riêng).
- Gateway chạy QMD trong XDG home tự chứa dưới
  `~/.openclaw/agents/<agentId>/qmd/` bằng cách đặt `XDG_CONFIG_HOME` và
  `XDG_CACHE_HOME`.
- Hỗ trợ hệ điều hành: macOS và Linux hoạt động ngay khi Bun + SQLite được cài.
  Windows được hỗ trợ tốt nhất qua WSL2.

**Cách sidecar chạy**

- Gateway ghi một QMD home tự chứa dưới
  `~/.openclaw/agents/<agentId>/qmd/` (config + cache + DB sqlite).
- Các collection được viết lại từ `memory.qmd.paths` (cộng với các tệp bộ nhớ
  workspace mặc định) vào `index.yml`, sau đó `qmd update` + `qmd embed` chạy khi khởi động và
  theo chu kỳ có thể cấu hình (`memory.qmd.update.interval`, mặc định 5 phút).
- Tìm kiếm chạy qua `qmd query --json`. Nếu QMD lỗi hoặc thiếu binary,
  OpenClaw tự động quay về trình quản lý SQLite tích hợp để các công cụ bộ nhớ
  vẫn hoạt động.
- **Lần tìm kiếm đầu có thể chậm**: QMD có thể tải các mô hình GGUF local (reranker/mở rộng truy vấn)
  ở lần chạy `qmd query` đầu tiên.
  - OpenClaw tự động đặt `XDG_CONFIG_HOME`/`XDG_CACHE_HOME` khi chạy QMD.
  - Nếu muốn tải sẵn mô hình thủ công (và làm ấm cùng chỉ mục OpenClaw dùng),
    hãy chạy một truy vấn một lần với các thư mục XDG của tác tử.

    Trạng thái QMD của OpenClaw nằm dưới **thư mục state** của bạn (mặc định `~/.openclaw`).
    Bạn có thể trỏ `qmd` tới đúng cùng chỉ mục bằng cách export các biến XDG giống như OpenClaw dùng:

    ```bash
    # Pick the same state dir OpenClaw uses
    STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
    if [ -d "$HOME/.moltbot" ] && [ ! -d "$HOME/.openclaw" ] \
      && [ -z "${OPENCLAW_STATE_DIR:-}" ]; then
      STATE_DIR="$HOME/.moltbot"
    fi

    export XDG_CONFIG_HOME="$STATE_DIR/agents/main/qmd/xdg-config"
    export XDG_CACHE_HOME="$STATE_DIR/agents/main/qmd/xdg-cache"

    # (Optional) force an index refresh + embeddings
    qmd update
    qmd embed

    # Warm up / trigger first-time model downloads
    qmd query "test" -c memory-root --json >/dev/null 2>&1
    ```

**Bề mặt cấu hình (`memory.qmd.*`)**

- `command` (mặc định `qmd`): ghi đè đường dẫn executable.
- `includeDefaultMemory` (mặc định `true`): tự động lập chỉ mục `MEMORY.md` + `memory/**/*.md`.
- `paths[]`: thêm thư mục/tệp bổ sung (`path`, tùy chọn `pattern`, tùy chọn
  ổn định `name`).
- `sessions`: chọn tham gia lập chỉ mục JSONL của phiên (`enabled`, `retentionDays`,
  `exportDir`).
- `update`: điều khiển nhịp làm mới (`interval`, `debounceMs`, `onBoot`, `embedInterval`).
- `limits`: giới hạn payload thu hồi (`maxResults`, `maxSnippetChars`,
  `maxInjectedChars`, `timeoutMs`).
- `scope`: cùng schema với [`session.sendPolicy`](/gateway/configuration#session).
  Mặc định chỉ DM (`deny` tất cả, `allow` chat trực tiếp); nới lỏng để hiển thị kết quả QMD
  trong nhóm/kênh.
- Các snippet lấy từ ngoài workspace sẽ hiển thị là
  `qmd/<collection>/<relative-path>` trong kết quả `memory_search`; `memory_get`
  hiểu tiền tố đó và đọc từ root collection QMD đã cấu hình.
- Khi `memory.qmd.sessions.enabled = true`, OpenClaw xuất transcript phiên đã làm sạch
  (lượt User/Assistant) vào một collection QMD riêng dưới
  `~/.openclaw/agents/<id>/qmd/sessions/`, để `memory_search` có thể gọi lại các
  cuộc hội thoại gần đây mà không chạm tới chỉ mục SQLite tích hợp.
- Các snippet `memory_search` giờ bao gồm footer `Source: <path#line>` khi
  `memory.citations` là `auto`/`on`; đặt `memory.citations = "off"` để giữ
  metadata đường dẫn ở nội bộ (tác tử vẫn nhận đường dẫn cho
  `memory_get`, nhưng văn bản snippet bỏ footer và system prompt
  cảnh báo tác tử không trích dẫn nó).

**Ví dụ**

```json5
memory: {
  backend: "qmd",
  citations: "auto",
  qmd: {
    includeDefaultMemory: true,
    update: { interval: "5m", debounceMs: 15000 },
    limits: { maxResults: 6, timeoutMs: 4000 },
    scope: {
      default: "deny",
      rules: [{ action: "allow", match: { chatType: "direct" } }]
    },
    paths: [
      { name: "docs", path: "~/notes", pattern: "**/*.md" }
    ]
  }
}
```

**Trích dẫn & fallback**

- `memory.citations` áp dụng bất kể backend (`auto`/`on`/`off`).
- Khi `qmd` chạy, chúng tôi gắn thẻ `status().backend = "qmd"` để chẩn đoán cho biết
  engine nào phục vụ kết quả. Nếu tiến trình con QMD thoát hoặc không phân tích được
  JSON, trình quản lý tìm kiếm ghi cảnh báo và trả về nhà cung cấp tích hợp
  (embedding Markdown hiện có) cho đến khi QMD phục hồi.

### Đường dẫn bộ nhớ bổ sung

Nếu bạn muốn lập chỉ mục các tệp Markdown ngoài bố cục workspace mặc định, hãy thêm
các đường dẫn tường minh:

```json5
agents: {
  defaults: {
    memorySearch: {
      extraPaths: ["../team-docs", "/srv/shared-notes/overview.md"]
    }
  }
}
```

Ghi chú:

- Đường dẫn có thể là tuyệt đối hoặc tương đối theo workspace.
- Thư mục được quét đệ quy cho các tệp `.md`.
- Chỉ các tệp Markdown được lập chỉ mục.
- Bỏ qua symlink (tệp hoặc thư mục).

### Embedding Gemini (gốc)

Đặt nhà cung cấp thành `gemini` để dùng trực tiếp API embedding của Gemini:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "gemini",
      model: "gemini-embedding-001",
      remote: {
        apiKey: "YOUR_GEMINI_API_KEY"
      }
    }
  }
}
```

Ghi chú:

- `remote.baseUrl` là tùy chọn (mặc định là URL cơ sở của API Gemini).
- `remote.headers` cho phép thêm header bổ sung nếu cần.
- Mô hình mặc định: `gemini-embedding-001`.

Nếu bạn muốn dùng **endpoint OpenAI-compatible tùy chỉnh** (OpenRouter, vLLM, hoặc proxy),
bạn có thể dùng cấu hình `remote` với nhà cung cấp OpenAI:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_OPENAI_COMPAT_API_KEY",
        headers: { "X-Custom-Header": "value" }
      }
    }
  }
}
```

Nếu bạn không muốn đặt khóa API, hãy dùng `memorySearch.provider = "local"` hoặc đặt
`memorySearch.fallback = "none"`.

Fallback:

- `memorySearch.fallback` có thể là `openai`, `gemini`, `local`, hoặc `none`.
- Nhà cung cấp fallback chỉ được dùng khi nhà cung cấp embedding chính thất bại.

Lập chỉ mục theo lô (OpenAI + Gemini):

- Bật theo mặc định cho embedding OpenAI và Gemini. Đặt `agents.defaults.memorySearch.remote.batch.enabled = false` để tắt.
- Hành vi mặc định chờ hoàn tất lô; tinh chỉnh `remote.batch.wait`, `remote.batch.pollIntervalMs`, và `remote.batch.timeoutMinutes` nếu cần.
- Đặt `remote.batch.concurrency` để kiểm soát số job lô gửi song song (mặc định: 2).
- Chế độ lô áp dụng khi `memorySearch.provider = "openai"` hoặc `"gemini"` và dùng khóa API tương ứng.
- Các job lô Gemini dùng endpoint batch embedding bất đồng bộ và yêu cầu Gemini Batch API khả dụng.

Vì sao batch OpenAI nhanh + rẻ:

- Với backfill lớn, OpenAI thường là lựa chọn nhanh nhất vì có thể gửi nhiều yêu cầu embedding trong một job lô và để OpenAI xử lý bất đồng bộ.
- OpenAI có giá ưu đãi cho khối lượng Batch API, nên các đợt lập chỉ mục lớn thường rẻ hơn so với gửi đồng bộ.
- Xem tài liệu và giá Batch API của OpenAI để biết chi tiết:
  - https://platform.openai.com/docs/api-reference/batch
  - https://platform.openai.com/pricing

Ví dụ cấu hình:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      fallback: "openai",
      remote: {
        batch: { enabled: true, concurrency: 2 }
      },
      sync: { watch: true }
    }
  }
}
```

Công cụ:

- `memory_search` — trả về snippet kèm tệp + khoảng dòng.
- `memory_get` — đọc nội dung tệp bộ nhớ theo đường dẫn.

Chế độ local:

- Đặt `agents.defaults.memorySearch.provider = "local"`.
- Cung cấp `agents.defaults.memorySearch.local.modelPath` (GGUF hoặc URI `hf:`).
- Tùy chọn: đặt `agents.defaults.memorySearch.fallback = "none"` để tránh fallback từ xa.

### Cách các công cụ bộ nhớ hoạt động

- `memory_search` tìm kiếm ngữ nghĩa các khối Markdown (~mục tiêu 400 token, chồng lấp 80 token) từ `MEMORY.md` + `memory/**/*.md`. Nó trả về văn bản snippet (giới hạn ~700 ký tự), đường dẫn tệp, khoảng dòng, điểm số, nhà cung cấp/mô hình, và liệu có fallback từ local → remote embedding hay không. Không trả về payload toàn bộ tệp.
- `memory_get` đọc một tệp Markdown bộ nhớ cụ thể (tương đối theo workspace), tùy chọn từ dòng bắt đầu và trong N dòng. Các đường dẫn ngoài `MEMORY.md` / `memory/` sẽ bị từ chối.
- Cả hai công cụ chỉ được bật khi `memorySearch.enabled` phân giải là true cho tác tử.

### Những gì được lập chỉ mục (và khi nào)

- Loại tệp: chỉ Markdown (`MEMORY.md`, `memory/**/*.md`).
- Lưu trữ chỉ mục: SQLite theo tác tử tại `~/.openclaw/memory/<agentId>.sqlite` (có thể cấu hình qua `agents.defaults.memorySearch.store.path`, hỗ trợ token `{agentId}`).
- Độ mới: watcher trên `MEMORY.md` + `memory/` đánh dấu chỉ mục là bẩn (debounce 1,5s). Đồng bộ được lên lịch khi bắt đầu phiên, khi tìm kiếm, hoặc theo chu kỳ và chạy bất đồng bộ. Transcript phiên dùng ngưỡng delta để kích hoạt đồng bộ nền.
- Kích hoạt lập chỉ mục lại: chỉ mục lưu **nhà cung cấp/mô hình embedding + fingerprint endpoint + tham số chia khối**. Nếu bất kỳ thứ nào thay đổi, OpenClaw tự động reset và lập chỉ mục lại toàn bộ kho.

### Tìm kiếm lai (BM25 + vector)

Khi bật, OpenClaw kết hợp:

- **Độ tương đồng vector** (khớp ngữ nghĩa, cách diễn đạt có thể khác)
- **Độ liên quan từ khóa BM25** (token chính xác như ID, biến môi trường, ký hiệu mã)

Nếu tìm kiếm toàn văn không khả dụng trên nền tảng của bạn, OpenClaw sẽ fallback sang tìm kiếm chỉ vector.

#### Vì sao dùng lai?

Tìm kiếm vector rất giỏi với “ý nghĩa giống nhau”:

- “Mac Studio gateway host” vs “máy chạy gateway”
- “debounce file updates” vs “tránh lập chỉ mục mỗi lần ghi”

Nhưng nó yếu với các token chính xác, tín hiệu cao:

- ID (`a828e60`, `b3b9895a…`)
- ký hiệu mã (`memorySearch.query.hybrid`)
- chuỗi lỗi (“sqlite-vec unavailable”)

BM25 (toàn văn) thì ngược lại: mạnh với token chính xác, yếu với diễn giải lại.
Tìm kiếm lai là điểm cân bằng thực dụng: **dùng cả hai tín hiệu truy xuất** để có
kết quả tốt cho cả truy vấn “ngôn ngữ tự nhiên” và truy vấn “tìm kim trong đống rơm”.

#### Cách chúng tôi gộp kết quả (thiết kế hiện tại)

Phác thảo triển khai:

1. Lấy một tập ứng viên từ cả hai phía:

- **Vector**: top `maxResults * candidateMultiplier` theo độ tương đồng cosine.
- **BM25**: top `maxResults * candidateMultiplier` theo thứ hạng FTS5 BM25 (càng thấp càng tốt).

2. Chuyển thứ hạng BM25 thành điểm ~0..1:

- `textScore = 1 / (1 + max(0, bm25Rank))`

3. Hợp nhất ứng viên theo chunk id và tính điểm có trọng số:

- `finalScore = vectorWeight * vectorScore + textWeight * textScore`

Ghi chú:

- `vectorWeight` + `textWeight` được chuẩn hóa về 1,0 khi phân giải cấu hình, nên trọng số hoạt động như phần trăm.
- Nếu embedding không khả dụng (hoặc nhà cung cấp trả về vector 0), chúng tôi vẫn chạy BM25 và trả về khớp từ khóa.
- Nếu không tạo được FTS5, chúng tôi giữ tìm kiếm chỉ vector (không lỗi cứng).

Điều này không “hoàn hảo theo lý thuyết IR”, nhưng đơn giản, nhanh và thường cải thiện recall/precision trên ghi chú thực tế.
Nếu muốn nâng cấp sau này, các bước tiếp theo phổ biến là Reciprocal Rank Fusion (RRF) hoặc chuẩn hóa điểm
(min/max hoặc z-score) trước khi trộn.

Cấu hình:

```json5
agents: {
  defaults: {
    memorySearch: {
      query: {
        hybrid: {
          enabled: true,
          vectorWeight: 0.7,
          textWeight: 0.3,
          candidateMultiplier: 4
        }
      }
    }
  }
}
```

### Cache embedding

OpenClaw có thể cache **embedding theo khối** trong SQLite để việc lập chỉ mục lại và cập nhật thường xuyên (đặc biệt là transcript phiên) không phải embed lại văn bản không đổi.

Cấu hình:

```json5
agents: {
  defaults: {
    memorySearch: {
      cache: {
        enabled: true,
        maxEntries: 50000
      }
    }
  }
}
```

### Tìm kiếm bộ nhớ phiên (thử nghiệm)

Bạn có thể tùy chọn lập chỉ mục **transcript phiên** và hiển thị chúng qua `memory_search`.
Tính năng này được khóa sau cờ thử nghiệm.

```json5
agents: {
  defaults: {
    memorySearch: {
      experimental: { sessionMemory: true },
      sources: ["memory", "sessions"]
    }
  }
}
```

Ghi chú:

- Lập chỉ mục phiên là **chọn tham gia** (tắt theo mặc định).
- Cập nhật phiên được debounce và **lập chỉ mục bất đồng bộ** khi vượt ngưỡng delta (best-effort).
- `memory_search` không bao giờ chặn chờ lập chỉ mục; kết quả có thể hơi cũ cho đến khi đồng bộ nền hoàn tất.
- Kết quả vẫn chỉ gồm snippet; `memory_get` vẫn giới hạn cho các tệp bộ nhớ.
- Lập chỉ mục phiên được cô lập theo tác tử (chỉ log phiên của tác tử đó được lập chỉ mục).
- Log phiên nằm trên đĩa (`~/.openclaw/agents/<agentId>/sessions/*.jsonl`). Bất kỳ tiến trình/người dùng nào có quyền truy cập hệ thống tệp đều có thể đọc, vì vậy hãy coi truy cập đĩa là ranh giới tin cậy. Để cô lập chặt chẽ hơn, hãy chạy tác tử dưới các người dùng hệ điều hành hoặc host riêng.

Ngưỡng delta (mặc định hiển thị):

```json5
agents: {
  defaults: {
    memorySearch: {
      sync: {
        sessions: {
          deltaBytes: 100000,   // ~100 KB
          deltaMessages: 50     // JSONL lines
        }
      }
    }
  }
}
```

### Tăng tốc vector SQLite (sqlite-vec)

Khi extension sqlite-vec khả dụng, OpenClaw lưu embedding trong một
bảng ảo SQLite (`vec0`) và thực hiện truy vấn khoảng cách vector ngay trong
cơ sở dữ liệu. Điều này giữ tìm kiếm nhanh mà không phải tải mọi embedding vào JS.

Cấu hình (tùy chọn):

```json5
agents: {
  defaults: {
    memorySearch: {
      store: {
        vector: {
          enabled: true,
          extensionPath: "/path/to/sqlite-vec"
        }
      }
    }
  }
}
```

Ghi chú:

- `enabled` mặc định là true; khi tắt, tìm kiếm fallback sang
  cosine similarity trong tiến trình trên các embedding đã lưu.
- Nếu extension sqlite-vec thiếu hoặc không tải được, OpenClaw ghi log
  lỗi và tiếp tục với fallback JS (không có bảng vector).
- `extensionPath` ghi đè đường dẫn sqlite-vec đi kèm (hữu ích cho bản dựng tùy chỉnh
  hoặc vị trí cài đặt không chuẩn).

### Tự động tải embedding local

- Mô hình embedding local mặc định: `hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf` (~0,6 GB).
- Khi `memorySearch.provider = "local"`, `node-llama-cpp` phân giải `modelPath`; nếu GGUF thiếu nó sẽ **tự tải** vào cache (hoặc `local.modelCacheDir` nếu đặt), rồi nạp. Tải tiếp tục khi thử lại.
- Yêu cầu build native: chạy `pnpm approve-builds`, chọn `node-llama-cpp`, rồi `pnpm rebuild node-llama-cpp`.
- Fallback: nếu thiết lập local thất bại và `memorySearch.fallback = "openai"`, chúng tôi tự động chuyển sang embedding từ xa (`openai/text-embedding-3-small` trừ khi bị ghi đè) và ghi lại lý do.

### Ví dụ endpoint OpenAI-compatible tùy chỉnh

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_REMOTE_API_KEY",
        headers: {
          "X-Organization": "org-id",
          "X-Project": "project-id"
        }
      }
    }
  }
}
```

Ghi chú:

- `remote.*` ưu tiên hơn `models.providers.openai.*`.
- `remote.headers` được trộn với header OpenAI; phía remote thắng khi xung đột khóa. Bỏ `remote.headers` để dùng mặc định của OpenAI.
