---
summary: "슬래시 명령어: 텍스트 vs 네이티브, 설정, 지원되는 명령어"
read_when:
  - 채팅 명령어를 사용하거나 설정할 때
  - 명령 라우팅 또는 권한을 디버깅할 때
title: "슬래시 명령어"
x-i18n:
  source_path: tools/slash-commands.md
  source_hash: ca0deebf89518e8c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:38:15Z
---

# 슬래시 명령어

명령은 Gateway(게이트웨이)에서 처리됩니다. 대부분의 명령은 `/` 로 시작하는 **독립적인** 메시지로 전송되어야 합니다.
호스트 전용 bash 채팅 명령은 `! <cmd>` 를 사용하며(`/bash <cmd>` 를 별칭으로 사용합니다).

서로 연관된 두 가지 시스템이 있습니다:

- **Commands**: 독립적인 `/...` 메시지입니다.
- **Directives**: `/think`, `/verbose`, `/reasoning`, `/elevated`, `/exec`, `/model`, `/queue` 입니다.
  - Directives 는 모델이 메시지를 보기 전에 제거됩니다.
  - 일반 채팅 메시지(지시자만 있는 메시지가 아닌 경우)에서는 ‘인라인 힌트’로 처리되며 세션 설정을 **유지하지 않습니다**.
  - 지시자만 있는 메시지(메시지에 지시자만 포함된 경우)에서는 세션에 유지되며 확인 응답을 반환합니다.
  - Directives 는 **권한이 있는 발신자**(채널 허용 목록/페어링 + `commands.useAccessGroups`)에게만 적용됩니다.
    권한이 없는 발신자는 지시자가 일반 텍스트로 처리됩니다.

또한 몇 가지 **인라인 단축키**가 있습니다(허용 목록에 있는/권한 있는 발신자만): `/help`, `/commands`, `/status`, `/whoami` (`/id`).
이들은 즉시 실행되며, 모델이 메시지를 보기 전에 제거되고, 남은 텍스트는 일반 흐름을 계속 따릅니다.

## 설정

```json5
{
  commands: {
    native: "auto",
    nativeSkills: "auto",
    text: true,
    bash: false,
    bashForegroundMs: 2000,
    config: false,
    debug: false,
    restart: false,
    useAccessGroups: true,
  },
}
```

- `commands.text` (기본값 `true`)은 채팅 메시지에서 `/...` 파싱을 활성화합니다.
  - 네이티브 명령을 지원하지 않는 환경(WhatsApp/WebChat/Signal/iMessage/Google Chat/MS Teams)에서는 이를 `false` 로 설정하더라도 텍스트 명령은 계속 작동합니다.
- `commands.native` (기본값 `"auto"`)은 네이티브 명령을 등록합니다.
  - Auto: Discord/Telegram 에서는 켜짐; Slack 에서는 꺼짐(슬래시 명령을 추가할 때까지); 네이티브 지원이 없는 프로바이더에서는 무시됩니다.
  - 프로바이더별로 재정의하려면 `channels.discord.commands.native`, `channels.telegram.commands.native`, 또는 `channels.slack.commands.native` 를 설정합니다(bool 또는 `"auto"`).
  - `false` 은 시작 시 Discord/Telegram 에서 이전에 등록된 명령을 지웁니다. Slack 명령은 Slack 앱에서 관리되며 자동으로 제거되지 않습니다.
- `commands.nativeSkills` (기본값 `"auto"`)은 지원되는 경우 **skill** 명령을 네이티브로 등록합니다.
  - Auto: Discord/Telegram 에서는 켜짐; Slack 에서는 꺼짐(Slack 은 스킬마다 슬래시 명령을 생성해야 합니다).
  - 프로바이더별로 재정의하려면 `channels.discord.commands.nativeSkills`, `channels.telegram.commands.nativeSkills`, 또는 `channels.slack.commands.nativeSkills` 를 설정합니다(bool 또는 `"auto"`).
- `commands.bash` (기본값 `false`)은 `! <cmd>` 이 호스트 셸 명령을 실행하도록 활성화합니다(`/bash <cmd>` 은 별칭이며, `tools.elevated` 허용 목록이 필요합니다).
- `commands.bashForegroundMs` (기본값 `2000`)은 bash 가 백그라운드 모드로 전환하기 전까지 대기하는 시간을 제어합니다(`0` 는 즉시 백그라운드로 전환합니다).
- `commands.config` (기본값 `false`)은 `/config` 을 활성화합니다(`openclaw.json` 를 읽고/씁니다).
- `commands.debug` (기본값 `false`)은 `/debug` 를 활성화합니다(런타임 전용 재정의).
- `commands.useAccessGroups` (기본값 `true`)은 명령에 대한 허용 목록/정책을 강제합니다.

## 명령 목록

텍스트 + 네이티브(활성화된 경우):

- `/help`
- `/commands`
- `/skill <name> [input]` (이름으로 skill 실행)
- `/status` (현재 상태 표시; 가능한 경우 현재 모델 프로바이더의 프로바이더 사용량/쿼터 포함)
- `/allowlist` (허용 목록 항목 나열/추가/제거)
- `/approve <id> allow-once|allow-always|deny` (exec 승인 프롬프트 해결)
- `/context [list|detail|json]` (‘context’ 설명; `detail` 는 파일별 + 도구별 + skill 별 + 시스템 프롬프트 크기를 표시)
- `/whoami` (발신자 id 표시; 별칭: `/id`)
- `/subagents list|stop|log|info|send` (현재 세션에 대한 하위 에이전트 실행을 검사, 중지, 로그 조회 또는 메시지 전송)
- `/config show|get|set|unset` (구성을 디스크에 저장, 소유자 전용; `commands.config: true` 필요)
- `/debug show|set|unset|reset` (런타임 재정의, 소유자 전용; `commands.debug: true` 필요)
- `/usage off|tokens|full|cost` (응답별 사용량 푸터 또는 로컬 비용 요약)
- `/tts off|always|inbound|tagged|status|provider|limit|summary|audio` (TTS 제어; [/tts](/tts) 참조)
  - Discord: 네이티브 명령은 `/voice` 입니다(Discord 는 `/tts` 를 예약함); 텍스트 `/tts` 는 계속 작동합니다.
- `/stop`
- `/restart`
- `/dock-telegram` (별칭: `/dock_telegram`) (응답을 Telegram 으로 전환)
- `/dock-discord` (별칭: `/dock_discord`) (응답을 Discord 로 전환)
- `/dock-slack` (별칭: `/dock_slack`) (응답을 Slack 으로 전환)
- `/activation mention|always` (그룹 전용)
- `/send on|off|inherit` (소유자 전용)
- `/reset` 또는 `/new [model]` (선택적 모델 힌트; 나머지는 그대로 전달됨)
- `/think <off|minimal|low|medium|high|xhigh>` (모델/프로바이더에 따른 동적 선택; 별칭: `/thinking`, `/t`)
- `/verbose on|full|off` (별칭: `/v`)
- `/reasoning on|off|stream` (별칭: `/reason`; 켜져 있으면 `Reasoning:` 로 시작하는 별도의 메시지를 전송; `stream` = Telegram 초안 전용)
- `/elevated on|off|ask|full` (별칭: `/elev`; `full` 는 exec 승인을 건너뜁니다)
- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>` (`/exec` 를 보내 현재 상태 표시)
- `/model <name>` (별칭: `/models`; 또는 `agents.defaults.models.*.alias` 에서 `/<alias>`)
- `/queue <mode>` (`debounce:2s cap:25 drop:summarize` 와 같은 옵션 포함; `/queue` 를 보내 현재 설정 확인)
- `/bash <command>` (호스트 전용; `! <command>` 의 별칭; `commands.bash: true` + `tools.elevated` 허용 목록 필요)

텍스트 전용:

- `/compact [instructions]` ([/concepts/compaction](/concepts/compaction) 참조)
- `! <command>` (호스트 전용; 한 번에 하나; 장기 실행 작업에는 `!poll` + `!stop` 사용)
- `!poll` (출력/상태 확인; 선택적 `sessionId` 허용; `/bash poll` 도 작동)
- `!stop` (실행 중인 bash 작업 중지; 선택적 `sessionId` 허용; `/bash stop` 도 작동)

참고 사항:

- 명령은 명령과 인수 사이에 선택적 `:` 를 허용합니다(예: `/think: high`, `/send: on`, `/help:`).
- `/new <model>` 는 모델 별칭, `provider/model`, 또는 프로바이더 이름(유사 매칭)을 허용합니다. 일치하지 않으면 텍스트는 메시지 본문으로 처리됩니다.
- 전체 프로바이더 사용량 분해를 보려면 `openclaw status --usage` 를 사용합니다.
- `/allowlist add|remove` 는 `commands.config=true` 가 필요하며 채널 `configWrites` 를 준수합니다.
- `/usage` 는 응답별 사용량 푸터를 제어하며, `/usage cost` 는 OpenClaw 세션 로그에서 로컬 비용 요약을 출력합니다.
- `/restart` 는 기본적으로 비활성화되어 있습니다. 활성화하려면 `commands.restart: true` 를 설정하십시오.
- `/verbose` 는 디버깅과 추가 가시성을 위한 것입니다. 일반 사용에서는 **꺼 두는 것**을 권장합니다.
- `/reasoning` (및 `/verbose`)은 그룹 설정에서 위험할 수 있습니다. 의도하지 않은 내부 추론이나 도구 출력을 노출할 수 있습니다. 특히 그룹 채팅에서는 비활성화하는 것을 권장합니다.
- **빠른 경로:** 허용 목록에 있는 발신자의 명령 전용 메시지는 즉시 처리됩니다(큐 + 모델 우회).
- **그룹 멘션 게이팅:** 허용 목록에 있는 발신자의 명령 전용 메시지는 멘션 요구 사항을 우회합니다.
- **인라인 단축키(허용 목록에 있는 발신자만):** 일부 명령은 일반 메시지에 포함되어도 작동하며, 모델이 나머지 텍스트를 보기 전에 제거됩니다.
  - 예: `hey /status` 는 상태 응답을 트리거하며, 나머지 텍스트는 정상 흐름을 계속 따릅니다.
- 현재: `/help`, `/commands`, `/status`, `/whoami` (`/id`).
- 권한이 없는 명령 전용 메시지는 조용히 무시되며, 인라인 `/...` 토큰은 일반 텍스트로 처리됩니다.
- **Skill 명령:** `user-invocable` skills 는 슬래시 명령으로 노출됩니다. 이름은 `a-z0-9_` 로 정규화되며(최대 32자), 충돌 시 숫자 접미사가 붙습니다(예: `_2`).
  - `/skill <name> [input]` 는 이름으로 skill 을 실행합니다(네이티브 명령 제한으로 스킬별 명령을 만들 수 없을 때 유용).
  - 기본적으로 skill 명령은 일반 요청으로 모델에 전달됩니다.
  - Skills 는 선택적으로 `command-dispatch: tool` 를 선언하여 명령을 도구로 직접 라우팅할 수 있습니다(결정적, 모델 미사용).
  - 예: `/prose` (OpenProse 플러그인) — [OpenProse](/prose) 참조.
- **네이티브 명령 인수:** Discord 는 동적 옵션에 대해 자동 완성을 사용하며(필수 인수를 생략하면 버튼 메뉴 제공), Telegram 과 Slack 은 명령이 선택지를 지원하고 인수를 생략했을 때 버튼 메뉴를 표시합니다.

## 사용 표면(어디에 무엇이 표시되는지)

- **프로바이더 사용량/쿼터**(예: “Claude 80% left”)는 사용량 추적이 활성화되어 있을 때 현재 모델 프로바이더의 `/status` 에 표시됩니다.
- **응답별 토큰/비용**은 `/usage off|tokens|full` 로 제어되며(일반 응답에 추가됨),
- `/model status` 는 사용량이 아니라 **모델/인증/엔드포인트**에 관한 것입니다.

## 모델 선택 (`/model`)

`/model` 는 지시자로 구현되어 있습니다.

예시:

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model opus@anthropic:default
/model status
```

참고 사항:

- `/model` 및 `/model list` 는 간결한 번호형 선택기(모델 패밀리 + 사용 가능한 프로바이더)를 표시합니다.
- `/model <#>` 는 해당 선택기에서 선택하며, 가능한 경우 현재 프로바이더를 우선합니다.
- `/model status` 는 구성된 프로바이더 엔드포인트(`baseUrl`)와 API 모드(`api`)를 포함한 상세 보기를 표시합니다(가능한 경우).

## 디버그 재정의

`/debug` 는 **런타임 전용** 설정 재정의(메모리, 디스크 아님)를 설정할 수 있게 합니다. 소유자 전용입니다. 기본적으로 비활성화되어 있으며, `commands.debug: true` 로 활성화합니다.

예시:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug set channels.whatsapp.allowFrom=["+1555","+4477"]
/debug unset messages.responsePrefix
/debug reset
```

참고 사항:

- 재정의는 새로운 설정 읽기에 즉시 적용되지만 `openclaw.json` 에 기록되지는 않습니다.
- 모든 재정의를 지우고 디스크의 설정으로 되돌리려면 `/debug reset` 를 사용하십시오.

## 설정 업데이트

`/config` 는 디스크의 설정(`openclaw.json`)에 기록합니다. 소유자 전용입니다. 기본적으로 비활성화되어 있으며, `commands.config: true` 로 활성화합니다.

예시:

```
/config show
/config show messages.responsePrefix
/config get messages.responsePrefix
/config set messages.responsePrefix="[openclaw]"
/config unset messages.responsePrefix
```

참고 사항:

- 기록 전에 설정이 검증되며, 유효하지 않은 변경은 거부됩니다.
- `/config` 로 업데이트된 설정은 재시작 후에도 유지됩니다.

## 표면 관련 참고

- **텍스트 명령**은 일반 채팅 세션에서 실행됩니다(다이렉트 메시지는 `main` 를 공유하고, 그룹은 자체 세션을 가집니다).
- **네이티브 명령**은 격리된 세션을 사용합니다:
  - Discord: `agent:<agentId>:discord:slash:<userId>`
  - Slack: `agent:<agentId>:slack:slash:<userId>` (`channels.slack.slashCommand.sessionPrefix` 로 접두사 설정 가능)
  - Telegram: `telegram:slash:<userId>` (`CommandTargetSessionKey` 를 통해 채팅 세션을 대상으로 지정)
- **`/stop`** 는 활성 채팅 세션을 대상으로 하여 현재 실행을 중단할 수 있습니다.
- **Slack:** `channels.slack.slashCommand` 는 단일 `/openclaw` 스타일 명령에 대해 여전히 지원됩니다. `commands.native` 를 활성화하면, 내장된 각 명령(`/help` 와 동일한 이름)에 대해 Slack 슬래시 명령을 하나씩 생성해야 합니다. Slack 의 명령 인수 메뉴는 에페메럴 Block Kit 버튼으로 제공됩니다.
