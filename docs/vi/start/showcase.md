---
title: "Trình diễn"
description: "Real-world OpenClaw projects from the community"
summary: "Các dự án và tích hợp do cộng đồng xây dựng, được vận hành bởi OpenClaw"
x-i18n:
  source_path: start/showcase.md
  source_hash: b3460f6a7b994879
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:09:01Z
---

# Trình diễn

Các dự án thực tế từ cộng đồng. Xem mọi người đang xây dựng gì với OpenClaw.

<Info>
**Muốn được giới thiệu?** Chia sẻ dự án của bạn trong [#showcase trên Discord](https://discord.gg/clawd) hoặc [gắn thẻ @openclaw trên X](https://x.com/openclaw).
</Info>

## 🎥 OpenClaw trong thực tế

Hướng dẫn thiết lập đầy đủ (28 phút) bởi VelvetShark.

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/SaWSPZoPX34"
    title="OpenClaw: The self-hosted AI that Siri should have been (Full setup)"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[Xem trên YouTube](https://www.youtube.com/watch?v=SaWSPZoPX34)

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/mMSKQvlmFuQ"
    title="OpenClaw showcase video"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[Xem trên YouTube](https://www.youtube.com/watch?v=mMSKQvlmFuQ)

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/5kkIJNUGFho"
    title="OpenClaw community showcase"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[Xem trên YouTube](https://www.youtube.com/watch?v=5kkIJNUGFho)

## 🆕 Mới nhất từ Discord

<CardGroup cols={2}>

<Card title="PR Review → Phản hồi Telegram" icon="code-pull-request" href="https://x.com/i/status/2010878524543131691">
  **@bangnokia** • `review` `github` `telegram`

OpenCode hoàn tất thay đổi → mở PR → OpenClaw rà soát diff và phản hồi trong Telegram với “gợi ý nhỏ” kèm phán quyết merge rõ ràng (bao gồm các bản sửa quan trọng cần áp dụng trước).

  <img src="/assets/showcase/pr-review-telegram.jpg" alt="Phản hồi review PR của OpenClaw được gửi qua Telegram" />
</Card>

<Card title="Skill hầm rượu trong vài phút" icon="wine-glass" href="https://x.com/i/status/2010916352454791216">
  **@prades_maxime** • `skills` `local` `csv`

Yêu cầu “Robby” (@openclaw) tạo skill hầm rượu cục bộ. Nó yêu cầu một bản xuất CSV mẫu + nơi lưu trữ, rồi xây dựng/kiểm thử skill rất nhanh (ví dụ 962 chai).

  <img src="/assets/showcase/wine-cellar-skill.jpg" alt="OpenClaw xây dựng skill hầm rượu cục bộ từ CSV" />
</Card>

<Card title="Tesco Shop Autopilot" icon="cart-shopping" href="https://x.com/i/status/2009724862470689131">
  **@marchattonhere** • `automation` `browser` `shopping`

Kế hoạch bữa ăn hàng tuần → mặt hàng thường mua → đặt khung giao hàng → xác nhận đơn. Không dùng API, chỉ điều khiển trình duyệt.

  <img src="/assets/showcase/tesco-shop.jpg" alt="Tự động hóa mua sắm Tesco qua chat" />
</Card>

<Card title="SNAG Screenshot-to-Markdown" icon="scissors" href="https://github.com/am-will/snag">
  **@am-will** • `devtools` `screenshots` `markdown`

Gán phím tắt cho vùng màn hình → Gemini vision → Markdown tức thì trong clipboard.

  <img src="/assets/showcase/snag.png" alt="Công cụ SNAG screenshot-to-markdown" />
</Card>

<Card title="Agents UI" icon="window-maximize" href="https://releaseflow.net/kitze/agents-ui">
  **@kitze** • `ui` `skills` `sync`

Ứng dụng desktop để quản lý skills/lệnh trên nhiều Agents, Claude, Codex và OpenClaw.

  <img src="/assets/showcase/agents-ui.jpg" alt="Ứng dụng Agents UI" />
</Card>

<Card title="Ghi chú giọng nói Telegram (papla.media)" icon="microphone" href="https://papla.media/docs">
  **Community** • `voice` `tts` `telegram`

Bao bọc TTS của papla.media và gửi kết quả dưới dạng ghi chú giọng nói Telegram (không tự phát khó chịu).

  <img src="/assets/showcase/papla-tts.jpg" alt="Đầu ra ghi chú giọng nói Telegram từ TTS" />
</Card>

<Card title="CodexMonitor" icon="eye" href="https://clawhub.com/odrobnik/codexmonitor">
  **@odrobnik** • `devtools` `codex` `brew`

Công cụ cài qua Homebrew để liệt kê/kiểm tra/theo dõi các phiên OpenAI Codex cục bộ (CLI + VS Code).

  <img src="/assets/showcase/codexmonitor.png" alt="CodexMonitor trên ClawHub" />
</Card>

<Card title="Điều khiển máy in 3D Bambu" icon="print" href="https://clawhub.com/tobiasbischoff/bambu-cli">
  **@tobiasbischoff** • `hardware` `3d-printing` `skill`

Điều khiển và xử lý sự cố máy in BambuLab: trạng thái, tác vụ, camera, AMS, hiệu chuẩn, và nhiều hơn nữa.

  <img src="/assets/showcase/bambu-cli.png" alt="Skill Bambu CLI trên ClawHub" />
</Card>

<Card title="Giao thông Vienna (Wiener Linien)" icon="train" href="https://clawhub.com/hjanuschka/wienerlinien">
  **@hjanuschka** • `travel` `transport` `skill`

Giờ khởi hành thời gian thực, gián đoạn, trạng thái thang máy và định tuyến cho giao thông công cộng Vienna.

  <img src="/assets/showcase/wienerlinien.png" alt="Skill Wiener Linien trên ClawHub" />
</Card>

<Card title="Bữa ăn học đường ParentPay" icon="utensils" href="#">
  **@George5562** • `automation` `browser` `parenting`

Tự động đặt bữa ăn học đường tại Vương quốc Anh qua ParentPay. Dùng tọa độ chuột để click ô bảng một cách tin cậy.
</Card>

<Card title="R2 Upload (Send Me My Files)" icon="cloud-arrow-up" href="https://clawhub.com/skills/r2-upload">
  **@julianengel** • `files` `r2` `presigned-urls`

Tải lên Cloudflare R2/S3 và tạo liên kết tải xuống presigned an toàn. Rất phù hợp cho các instance OpenClaw từ xa.
</Card>

<Card title="Ứng dụng iOS qua Telegram" icon="mobile" href="#">
  **@coard** • `ios` `xcode` `testflight`

Xây dựng một ứng dụng iOS hoàn chỉnh với bản đồ và ghi âm giọng nói, triển khai lên TestFlight hoàn toàn qua chat Telegram.

  <img src="/assets/showcase/ios-testflight.jpg" alt="Ứng dụng iOS trên TestFlight" />
</Card>

<Card title="Trợ lý sức khỏe Oura Ring" icon="heart-pulse" href="#">
  **@AS** • `health` `oura` `calendar`

Trợ lý sức khỏe AI cá nhân tích hợp dữ liệu Oura ring với lịch, cuộc hẹn và lịch tập gym.

  <img src="/assets/showcase/oura-health.png" alt="Trợ lý sức khỏe Oura ring" />
</Card>
<Card title="Đội hình trong mơ của Kev (14+ Agents)" icon="robot" href="https://github.com/adam91holt/orchestrated-ai-articles">
  **@adam91holt** • `multi-agent` `orchestration` `architecture` `manifesto`

Hơn 14 agents dưới một gateway với bộ điều phối Opus 4.5 phân công cho các Codex worker. Bài viết kỹ thuật chi tiết [technical write-up](https://github.com/adam91holt/orchestrated-ai-articles) bao quát danh sách Dream Team, lựa chọn mô hình, sandboxing, webhook, heartbeat và luồng phân công. [Clawdspace](https://github.com/adam91holt/clawdspace) cho agent sandboxing. [Bài blog](https://adams-ai-journey.ghost.io/2026-the-year-of-the-orchestrator/).
</Card>

<Card title="Linear CLI" icon="terminal" href="https://github.com/Finesssee/linear-cli">
  **@NessZerra** • `devtools` `linear` `cli` `issues`

CLI cho Linear tích hợp với các quy trình agentic (Claude Code, OpenClaw). Quản lý issue, dự án và workflow ngay từ terminal. PR bên ngoài đầu tiên đã được merge!
</Card>

<Card title="Beeper CLI" icon="message" href="https://github.com/blqke/beepcli">
  **@jules** • `messaging` `beeper` `cli` `automation`

Đọc, gửi và lưu trữ tin nhắn qua Beeper Desktop. Dùng Beeper local MCP API để agents quản lý tất cả chat của bạn (iMessage, WhatsApp, v.v.) ở một nơi.
</Card>

</CardGroup>

## 🤖 Tự động hóa & Quy trình

<CardGroup cols={2}>

<Card title="Điều khiển máy lọc không khí Winix" icon="wind" href="https://x.com/antonplex/status/2010518442471006253">
  **@antonplex** • `automation` `hardware` `air-quality`

Claude Code phát hiện và xác nhận các điều khiển của máy lọc, sau đó OpenClaw tiếp quản để quản lý chất lượng không khí trong phòng.

  <img src="/assets/showcase/winix-air-purifier.jpg" alt="Điều khiển máy lọc không khí Winix qua OpenClaw" />
</Card>

<Card title="Ảnh bầu trời đẹp" icon="camera" href="https://x.com/signalgaining/status/2010523120604746151">
  **@signalgaining** • `automation` `camera` `skill` `images`

Kích hoạt bởi camera mái nhà: yêu cầu OpenClaw chụp ảnh bầu trời mỗi khi trông đẹp — nó đã thiết kế một skill và chụp ảnh.

  <img src="/assets/showcase/roof-camera-sky.jpg" alt="Ảnh bầu trời từ camera mái nhà do OpenClaw chụp" />
</Card>

<Card title="Cảnh báo buổi sáng trực quan" icon="robot" href="https://x.com/buddyhadry/status/2010005331925954739">
  **@buddyhadry** • `automation` `briefing` `images` `telegram`

Một prompt theo lịch tạo ra một ảnh “cảnh” duy nhất mỗi sáng (thời tiết, việc cần làm, ngày, bài đăng/trích dẫn yêu thích) qua một persona OpenClaw.
</Card>

<Card title="Đặt sân Padel" icon="calendar-check" href="https://github.com/joshp123/padel-cli">
  **@joshp123** • `automation` `booking` `cli`
  
  Trình kiểm tra tình trạng Playtomic + CLI đặt sân. Không bao giờ bỏ lỡ sân trống nữa.
  
  <img src="/assets/showcase/padel-screenshot.jpg" alt="Ảnh chụp padel-cli" />
</Card>

<Card title="Tiếp nhận kế toán" icon="file-invoice-dollar">
  **Community** • `automation` `email` `pdf`
  
  Thu thập PDF từ email, chuẩn bị tài liệu cho tư vấn thuế. Kế toán hàng tháng chạy tự động.
</Card>

<Card title="Chế độ dev nằm sofa" icon="couch" href="https://davekiss.com">
  **@davekiss** • `telegram` `website` `migration` `astro`

Xây lại toàn bộ website cá nhân qua Telegram trong lúc xem Netflix — Notion → Astro, chuyển 18 bài viết, DNS sang Cloudflare. Không hề mở laptop.
</Card>

<Card title="Agent tìm việc" icon="briefcase">
  **@attol8** • `automation` `api` `skill`

Tìm kiếm tin tuyển dụng, đối chiếu với từ khóa CV và trả về cơ hội phù hợp kèm liên kết. Xây dựng trong 30 phút bằng JSearch API.
</Card>

<Card title="Trình tạo Jira Skill" icon="diagram-project" href="https://x.com/jdrhyne/status/2008336434827002232">
  **@jdrhyne** • `automation` `jira` `skill` `devtools`

OpenClaw kết nối Jira, rồi tạo một skill mới ngay lập tức (trước khi nó tồn tại trên ClawHub).
</Card>

<Card title="Todoist Skill qua Telegram" icon="list-check" href="https://x.com/iamsubhrajyoti/status/2009949389884920153">
  **@iamsubhrajyoti** • `automation` `todoist` `skill` `telegram`

Tự động hóa tác vụ Todoist và để OpenClaw tạo skill trực tiếp trong chat Telegram.
</Card>

<Card title="Phân tích TradingView" icon="chart-line">
  **@bheem1798** • `finance` `browser` `automation`

Đăng nhập TradingView bằng tự động hóa trình duyệt, chụp ảnh biểu đồ và thực hiện phân tích kỹ thuật theo yêu cầu. Không cần API—chỉ điều khiển trình duyệt.
</Card>

<Card title="Hỗ trợ tự động trên Slack" icon="slack">
  **@henrymascot** • `slack` `automation` `support`

Theo dõi kênh Slack của công ty, phản hồi hữu ích và chuyển tiếp thông báo sang Telegram. Tự động sửa một lỗi production trong ứng dụng đang triển khai mà không cần được yêu cầu.
</Card>

</CardGroup>

## 🧠 Tri thức & Bộ nhớ

<CardGroup cols={2}>

<Card title="xuezh học tiếng Trung" icon="language" href="https://github.com/joshp123/xuezh">
  **@joshp123** • `learning` `voice` `skill`
  
  Công cụ học tiếng Trung với phản hồi phát âm và luồng học qua OpenClaw.
  
  <img src="/assets/showcase/xuezh-pronunciation.jpeg" alt="Phản hồi phát âm xuezh" />
</Card>

<Card title="Kho bộ nhớ WhatsApp" icon="vault">
  **Community** • `memory` `transcription` `indexing`
  
  Nhập toàn bộ bản xuất WhatsApp, chuyển giọng nói hơn 1.000 ghi chú, đối chiếu với git logs, xuất báo cáo markdown có liên kết.
</Card>

<Card title="Tìm kiếm ngữ nghĩa Karakeep" icon="magnifying-glass" href="https://github.com/jamesbrooksco/karakeep-semantic-search">
  **@jamesbrooksco** • `search` `vector` `bookmarks`
  
  Thêm tìm kiếm vector cho bookmark Karakeep bằng Qdrant + embedding OpenAI/Ollama.
</Card>

<Card title="Bộ nhớ Inside-Out-2" icon="brain">
  **Community** • `memory` `beliefs` `self-model`
  
  Trình quản lý bộ nhớ riêng biệt biến file phiên thành ký ức → niềm tin → mô hình bản thân tiến hóa.
</Card>

</CardGroup>

## 🎙️ Giọng nói & Điện thoại

<CardGroup cols={2}>

<Card title="Clawdia Phone Bridge" icon="phone" href="https://github.com/alejandroOPI/clawdia-bridge">
  **@alejandroOPI** • `voice` `vapi` `bridge`
  
  Cầu nối HTTP giữa trợ lý giọng nói Vapi ↔ OpenClaw. Gọi điện gần thời gian thực với agent của bạn.
</Card>

<Card title="Phiên âm OpenRouter" icon="microphone" href="https://clawhub.com/obviyus/openrouter-transcribe">
  **@obviyus** • `transcription` `multilingual` `skill`

Phiên âm âm thanh đa ngôn ngữ qua OpenRouter (Gemini, v.v.). Có sẵn trên ClawHub.
</Card>

</CardGroup>

## 🏗️ Hạ tầng & Triển khai

<CardGroup cols={2}>

<Card title="Home Assistant Add-on" icon="home" href="https://github.com/ngutman/openclaw-ha-addon">
  **@ngutman** • `homeassistant` `docker` `raspberry-pi`
  
  Gateway OpenClaw chạy trên Home Assistant OS với hỗ trợ đường hầm SSH và trạng thái bền vững.
</Card>

<Card title="Home Assistant Skill" icon="toggle-on" href="https://clawhub.com/skills/homeassistant">
  **ClawHub** • `homeassistant` `skill` `automation`
  
  Điều khiển và tự động hóa thiết bị Home Assistant bằng ngôn ngữ tự nhiên.
</Card>

<Card title="Đóng gói Nix" icon="snowflake" href="https://github.com/openclaw/nix-openclaw">
  **@openclaw** • `nix` `packaging` `deployment`
  
  Cấu hình OpenClaw nixified đầy đủ pin cho triển khai tái lập.
</Card>

<Card title="Lịch CalDAV" icon="calendar" href="https://clawhub.com/skills/caldav-calendar">
  **ClawHub** • `calendar` `caldav` `skill`
  
  Skill lịch dùng khal/vdirsyncer. Tích hợp lịch tự lưu trữ.
</Card>

</CardGroup>

## 🏠 Nhà & Phần cứng

<CardGroup cols={2}>

<Card title="GoHome Automation" icon="house-signal" href="https://github.com/joshp123/gohome">
  **@joshp123** • `home` `nix` `grafana`
  
  Tự động hóa nhà theo chuẩn Nix với OpenClaw làm giao diện, kèm dashboard Grafana đẹp mắt.
  
  <img src="/assets/showcase/gohome-grafana.png" alt="Dashboard Grafana GoHome" />
</Card>

<Card title="Robot hút bụi Roborock" icon="robot" href="https://github.com/joshp123/gohome/tree/main/plugins/roborock">
  **@joshp123** • `vacuum` `iot` `plugin`
  
  Điều khiển robot hút bụi Roborock của bạn bằng hội thoại tự nhiên.
  
  <img src="/assets/showcase/roborock-screenshot.jpg" alt="Trạng thái Roborock" />
</Card>

</CardGroup>

## 🌟 Dự án cộng đồng

<CardGroup cols={2}>

<Card title="Chợ StarSwap" icon="star" href="https://star-swap.com/">
  **Community** • `marketplace` `astronomy` `webapp`
  
  Sàn giao dịch thiết bị thiên văn hoàn chỉnh. Được xây dựng cùng/xung quanh hệ sinh thái OpenClaw.
</Card>

</CardGroup>

---

## Gửi dự án của bạn

Có điều gì muốn chia sẻ? Chúng tôi rất muốn giới thiệu!

<Steps>
  <Step title="Chia sẻ">
    Đăng trong [#showcase trên Discord](https://discord.gg/clawd) hoặc [tweet @openclaw](https://x.com/openclaw)
  </Step>
  <Step title="Bao gồm chi tiết">
    Cho chúng tôi biết nó làm gì, liên kết repo/demo, chia sẻ ảnh chụp màn hình nếu có
  </Step>
  <Step title="Được giới thiệu">
    Chúng tôi sẽ thêm các dự án nổi bật vào trang này
  </Step>
</Steps>
