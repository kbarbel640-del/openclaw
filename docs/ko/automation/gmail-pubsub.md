---
summary: "gogcli를 통해 OpenClaw 웹훅에 연결된 Gmail Pub/Sub 푸시"
read_when:
  - Gmail 받은편지함 트리거를 OpenClaw에 연결할 때
  - 에이전트 깨우기를 위한 Pub/Sub 푸시 설정
title: "Gmail PubSub"
x-i18n:
  source_path: automation/gmail-pubsub.md
  source_hash: dfb92133b69177e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:09Z
---

# Gmail Pub/Sub -> OpenClaw

목표: Gmail watch -> Pub/Sub push -> `gog gmail watch serve` -> OpenClaw 웹훅.

## Prereqs

- `gcloud` 설치 및 로그인 ([설치 가이드](https://docs.cloud.google.com/sdk/docs/install-sdk)).
- `gog` (gogcli) 설치 및 Gmail 계정에 대한 인증 완료 ([gogcli.sh](https://gogcli.sh/)).
- OpenClaw hooks 활성화 ([Webhooks](/automation/webhook) 참고).
- `tailscale` 로그인 완료 ([tailscale.com](https://tailscale.com/)). 지원되는 설정은 공개 HTTPS 엔드포인트를 위해 Tailscale Funnel 을 사용합니다.
  다른 터널 서비스도 사용할 수 있지만 DIY/미지원이며 수동 연결이 필요합니다.
  현재로서는 Tailscale 만 지원합니다.

예시 hook 설정 (Gmail 프리셋 매핑 활성화):

```json5
{
  hooks: {
    enabled: true,
    token: "OPENCLAW_HOOK_TOKEN",
    path: "/hooks",
    presets: ["gmail"],
  },
}
```

Gmail 요약을 채팅 표면으로 전달하려면,
`deliver` + 선택적 `channel`/`to` 를 설정하는 매핑으로
프리셋을 오버라이드합니다:

```json5
{
  hooks: {
    enabled: true,
    token: "OPENCLAW_HOOK_TOKEN",
    presets: ["gmail"],
    mappings: [
      {
        match: { path: "gmail" },
        action: "agent",
        wakeMode: "now",
        name: "Gmail",
        sessionKey: "hook:gmail:{{messages[0].id}}",
        messageTemplate: "New email from {{messages[0].from}}\nSubject: {{messages[0].subject}}\n{{messages[0].snippet}}\n{{messages[0].body}}",
        model: "openai/gpt-5.2-mini",
        deliver: true,
        channel: "last",
        // to: "+15551234567"
      },
    ],
  },
}
```

고정 채널을 사용하려면 `channel` + `to` 를 설정합니다. 그렇지 않으면
`channel: "last"` 가 마지막 전달 경로를 사용합니다 (WhatsApp 으로 폴백).

Gmail 실행에 더 저렴한 모델을 강제하려면 매핑에 `model` 를 설정합니다
(`provider/model` 또는 별칭). `agents.defaults.models` 를 강제하는 경우 여기에 포함하세요.

Gmail hooks 전용 기본 모델과 thinking 수준을 설정하려면,
설정에 `hooks.gmail.model` / `hooks.gmail.thinking` 를 추가합니다:

```json5
{
  hooks: {
    gmail: {
      model: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
      thinking: "off",
    },
  },
}
```

참고 사항:

- 매핑의 hook 별 `model`/`thinking` 는 여전히 이 기본값을 오버라이드합니다.
- 폴백 순서: `hooks.gmail.model` → `agents.defaults.model.fallbacks` → 기본 (인증/속도 제한/타임아웃).
- `agents.defaults.models` 가 설정된 경우, Gmail 모델은 allowlist 에 있어야 합니다.
- Gmail hook 콘텐츠는 기본적으로 외부 콘텐츠 안전 경계로 감싸집니다.
  비활성화하려면 (위험), `hooks.gmail.allowUnsafeExternalContent: true` 를 설정합니다.

페이로드 처리를 추가로 커스터마이즈하려면 `hooks.mappings` 또는
`hooks.transformsDir` 아래에 JS/TS 변환 모듈을 추가합니다
([Webhooks](/automation/webhook) 참고).

## Wizard (권장)

OpenClaw 헬퍼를 사용해 모든 것을 한 번에 연결합니다 (macOS 에서는 brew 로 의존성 설치):

```bash
openclaw webhooks gmail setup \
  --account openclaw@gmail.com
```

기본값:

- 공개 푸시 엔드포인트로 Tailscale Funnel 사용.
- `openclaw webhooks gmail run` 를 위한 `hooks.gmail` 설정 작성.
- Gmail hook 프리셋 활성화 (`hooks.presets: ["gmail"]`).

경로 참고: `tailscale.mode` 가 활성화되면 OpenClaw 는 자동으로
`hooks.gmail.serve.path` 를 `/` 로 설정하고,
공개 경로를 `hooks.gmail.tailscale.path` (기본값 `/gmail-pubsub`) 로 유지합니다. 이는 Tailscale 이
프록시 전에 set-path 접두사를 제거하기 때문입니다.
백엔드가 접두사가 포함된 경로를 수신해야 한다면,
`hooks.gmail.tailscale.target` (또는 `--tailscale-target`) 를
`http://127.0.0.1:8788/gmail-pubsub` 와 같은 전체 URL 로 설정하고
`hooks.gmail.serve.path` 를 일치시키세요.

커스텀 엔드포인트가 필요하신가요? `--push-endpoint <url>` 또는 `--tailscale off` 를 사용하세요.

플랫폼 참고: macOS 에서는 마법사가 Homebrew 를 통해
`gcloud`, `gogcli`, `tailscale` 를 설치합니다.
Linux 에서는 먼저 수동으로 설치하세요.

Gateway 자동 시작 (권장):

- `hooks.enabled=true` 및 `hooks.gmail.account` 가 설정되면, Gateway 는 부팅 시
  `gog gmail watch serve` 를 시작하고 watch 를 자동 갱신합니다.
- 옵트아웃하려면 `OPENCLAW_SKIP_GMAIL_WATCHER=1` 를 설정합니다 (데몬을 직접 실행하는 경우 유용).
- 수동 데몬을 동시에 실행하지 마세요. 그렇지 않으면
  `listen tcp 127.0.0.1:8788: bind: address already in use` 가 발생합니다.

수동 데몬 (`gog gmail watch serve` 시작 + 자동 갱신):

```bash
openclaw webhooks gmail run
```

## One-time setup

1. `gog` 에서 사용하는 **OAuth 클라이언트를 소유한** GCP 프로젝트를 선택합니다.

```bash
gcloud auth login
gcloud config set project <project-id>
```

참고: Gmail watch 는 Pub/Sub 토픽이 OAuth 클라이언트와 동일한 프로젝트에 있어야 합니다.

2. API 활성화:

```bash
gcloud services enable gmail.googleapis.com pubsub.googleapis.com
```

3. 토픽 생성:

```bash
gcloud pubsub topics create gog-gmail-watch
```

4. Gmail 푸시 게시 권한 허용:

```bash
gcloud pubsub topics add-iam-policy-binding gog-gmail-watch \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

## Start the watch

```bash
gog gmail watch start \
  --account openclaw@gmail.com \
  --label INBOX \
  --topic projects/<project-id>/topics/gog-gmail-watch
```

출력에서 `history_id` 를 저장하세요 (디버깅용).

## Run the push handler

로컬 예제 (공유 토큰 인증):

```bash
gog gmail watch serve \
  --account openclaw@gmail.com \
  --bind 127.0.0.1 \
  --port 8788 \
  --path /gmail-pubsub \
  --token <shared> \
  --hook-url http://127.0.0.1:18789/hooks/gmail \
  --hook-token OPENCLAW_HOOK_TOKEN \
  --include-body \
  --max-bytes 20000
```

참고 사항:

- `--token` 는 푸시 엔드포인트를 보호합니다 (`x-gog-token` 또는 `?token=`).
- `--hook-url` 는 OpenClaw `/hooks/gmail` 를 가리킵니다 (매핑됨; 격리 실행 + 메인으로 요약).
- `--include-body` 및 `--max-bytes` 는 OpenClaw 로 전송되는 본문 스니펫을 제어합니다.

권장: `openclaw webhooks gmail run` 는 동일한 흐름을 감싸고 watch 를 자동 갱신합니다.

## Expose the handler (고급, 미지원)

Tailscale 이 아닌 터널이 필요하다면 수동으로 연결하고,
푸시 구독에 공개 URL 을 사용하세요 (미지원, 가드레일 없음):

```bash
cloudflared tunnel --url http://127.0.0.1:8788 --no-autoupdate
```

생성된 URL 을 푸시 엔드포인트로 사용합니다:

```bash
gcloud pubsub subscriptions create gog-gmail-watch-push \
  --topic gog-gmail-watch \
  --push-endpoint "https://<public-url>/gmail-pubsub?token=<shared>"
```

프로덕션: 안정적인 HTTPS 엔드포인트를 사용하고 Pub/Sub OIDC JWT 를 구성한 다음 실행하세요:

```bash
gog gmail watch serve --verify-oidc --oidc-email <svc@...>
```

## Test

감시 중인 받은편지함으로 메시지를 전송합니다:

```bash
gog gmail send \
  --account openclaw@gmail.com \
  --to openclaw@gmail.com \
  --subject "watch test" \
  --body "ping"
```

watch 상태와 히스토리를 확인합니다:

```bash
gog gmail watch status --account openclaw@gmail.com
gog gmail history --account openclaw@gmail.com --since <historyId>
```

## Troubleshooting

- `Invalid topicName`: 프로젝트 불일치 (토픽이 OAuth 클라이언트 프로젝트에 없음).
- `User not authorized`: 토픽에 `roles/pubsub.publisher` 누락.
- 빈 메시지: Gmail 푸시는 `historyId` 만 제공합니다. `gog gmail history` 를 통해 가져오세요.

## Cleanup

```bash
gog gmail watch stop --account openclaw@gmail.com
gcloud pubsub subscriptions delete gog-gmail-watch-push
gcloud pubsub topics delete gog-gmail-watch
```
