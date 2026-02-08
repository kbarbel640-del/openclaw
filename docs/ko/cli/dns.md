---
summary: "wide-area 디바이스 검색을 위한 `openclaw dns` CLI 참조 (Tailscale + CoreDNS)"
read_when:
  - Tailscale + CoreDNS를 통해 wide-area 디바이스 검색(DNS-SD)을 사용하려는 경우
  - 사용자 지정 디바이스 검색 도메인(예: openclaw.internal)을 위한 분할 DNS를 설정하는 경우
title: "dns"
x-i18n:
  source_path: cli/dns.md
  source_hash: d2011e41982ffb4b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:29Z
---

# `openclaw dns`

wide-area 디바이스 검색을 위한 DNS 도우미(Tailscale + CoreDNS)입니다. 현재는 macOS + Homebrew CoreDNS에 중점을 둡니다.

관련:

- Gateway(게이트웨이) 디바이스 검색: [Discovery](/gateway/discovery)
- wide-area 디바이스 검색 설정: [Configuration](/gateway/configuration)

## 설정

```bash
openclaw dns setup
openclaw dns setup --apply
```
