---
summary: "Quy trinh huong dan chay lan dau cho OpenClaw (ung dung macOS)"
read_when:
  - Thiet ke tro ly huong dan ban dau tren macOS
  - Trien khai xac thuc hoac thiet lap danh tinh
title: "Onboarding (Ung dung macOS)"
sidebarTitle: "Onboarding: macOS App"
x-i18n:
  source_path: start/onboarding.md
  source_hash: 45f912067527158f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:32Z
---

# Onboarding (Ung dung macOS)

Tai lieu nay mo ta luong huong dan chay lan dau **hien tai**. Muc tieu la mang den
trai nghiem “ngay 0” muot ma: chon noi Gateway chay, ket noi xac thuc, chay trinh huong dan,
va de tac tu tu khoi tao.

<Steps>
<Step title="Chap thuan canh bao macOS">
<Frame>
<img src="/assets/macos-onboarding/01-macos-warning.jpeg" alt="" />
</Frame>
</Step>
<Step title="Chap thuan tim mang cuc bo">
<Frame>
<img src="/assets/macos-onboarding/02-local-networks.jpeg" alt="" />
</Frame>
</Step>
<Step title="Chao mung va thong bao bao mat">
<Frame caption="Doc thong bao bao mat duoc hien thi va quyet dinh tuong ung">
<img src="/assets/macos-onboarding/03-security-notice.png" alt="" />
</Frame>
</Step>
<Step title="Local hay Remote">
<Frame>
<img src="/assets/macos-onboarding/04-choose-gateway.png" alt="" />
</Frame>

**Gateway** chay o dau?

- **May Mac nay (Chi local):** huong dan co the chay cac luong OAuth va ghi thong tin xac thuc
  cuc bo.
- **Remote (qua SSH/Tailnet):** huong dan **khong** chay OAuth cuc bo;
  thong tin xac thuc phai ton tai tren may chu gateway.
- **Cau hinh sau:** bo qua thiet lap va de ung dung chua duoc cau hinh.

<Tip>
**Meo xac thuc Gateway:**
- Trinh huong dan hien tao **token** ke ca cho loopback, vi vay cac client WS cuc bo phai xac thuc.
- Neu tat xac thuc, bat ky tien trinh cuc bo nao cung co the ket noi; chi dung tren cac may hoan toan dang tin cay.
- Dung **token** cho truy cap nhieu may hoac khi bind khong phai loopback.
</Tip>
</Step>
<Step title="Quyen">
<Frame caption="Chon cac quyen ban muon cap cho OpenClaw">
<img src="/assets/macos-onboarding/05-permissions.png" alt="" />
</Frame>

Huong dan yeu cau cac quyen TCC can thiet cho:

- Tu dong hoa (AppleScript)
- Thong bao
- Kha nang truy cap
- Ghi man hinh
- Micro
- Nhan dang giong noi
- Camera
- Vi tri

</Step>
<Step title="CLI">
  <Info>Buoc nay la tuy chon</Info>
  Ung dung co the cai dat CLI toan cuc `openclaw` qua npm/pnpm de cac
  quy trinh lam viec trong terminal va tac vu launchd hoat dong san sang.
</Step>
<Step title="Onboarding Chat (phien rieng)">
  Sau khi thiet lap, ung dung mo mot phien chat onboarding rieng de tac tu
  tu gioi thieu va huong dan cac buoc tiep theo. Cach nay giu huong dan lan dau tach biet
  khoi cuoc tro chuyen thong thuong cua ban. Xem [Bootstrapping](/start/bootstrapping) de biet
  dieu gi xay ra tren may chu gateway trong lan chay tac tu dau tien.
</Step>
</Steps>
