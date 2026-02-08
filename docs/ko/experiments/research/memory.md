---
summary: "연구 노트: Clawd 워크스페이스용 오프라인 메모리 시스템(마크다운 단일 소스 오브 트루스 + 파생 인덱스)"
read_when:
  - 일일 마크다운 로그를 넘어서는 워크스페이스 메모리(~/.openclaw/workspace) 설계 시
  - 결정 시: 독립형 CLI vs OpenClaw 심층 통합
  - 오프라인 회상 + 성찰(유지/회상/성찰) 추가 시
title: "워크스페이스 메모리 연구"
x-i18n:
  source_path: experiments/research/memory.md
  source_hash: 1753c8ee6284999f
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:42Z
---

# 워크스페이스 메모리 v2(오프라인): 연구 노트

대상: Clawd 스타일 워크스페이스(`agents.defaults.workspace`, 기본값 `~/.openclaw/workspace`)로, "메모리"가 하루당 하나의 마크다운 파일(`memory/YYYY-MM-DD.md`)과 소수의 안정적인 파일 세트(예: `memory.md`, `SOUL.md`)에 저장됩니다.

이 문서는 마크다운을 검토 가능한 정본(단일 소스 오브 트루스)으로 유지하되, 파생 인덱스를 통해 **구조화된 회상**(검색, 엔티티 요약, 신뢰도 업데이트)을 추가하는 **오프라인 우선** 메모리 아키텍처를 제안합니다.

## 왜 바꾸나요?

현재 설정(하루당 한 파일)은 다음에 매우 훌륭합니다:

- "append-only" 저널링
- 사람의 편집
- git 기반의 내구성 + 감사 가능성
- 낮은 마찰의 캡처("그냥 적어두기")

다음에는 약합니다:

- 높은 회상률의 검색("X에 대해 무엇을 결정했지?", "지난번에 Y를 시도했을 때는?")
- 많은 파일을 다시 읽지 않고도 가능한 엔티티 중심 답변("Alice / The Castle / warelay에 대해 말해줘")
- 의견/선호의 안정성(그리고 변경 시의 근거)
- 시간 제약("2025년 11월에는 무엇이 사실이었지?")과 충돌 해결

## 설계 목표

- **오프라인**: 네트워크 없이 동작하며, 노트북/Castle에서 실행 가능하고, 클라우드 의존성이 없습니다.
- **설명 가능**: 검색된 항목은 출처(파일 + 위치)를 통해 귀속 가능해야 하며, 추론과 분리 가능해야 합니다.
- **낮은 의식 절차**: 일일 로깅은 마크다운으로 유지하고, 무거운 스키마 작업을 요구하지 않습니다.
- **점진적**: v1은 FTS만으로도 유용해야 하며, 시맨틱/벡터 및 그래프는 선택적 업그레이드입니다.
- **에이전트 친화적**: "토큰 예산 내에서 회상"을 쉽게 만듭니다(작은 사실 묶음으로 반환).

## 노스 스타 모델(Hindsight × Letta)

블렌딩할 두 가지 요소:

1. **Letta/MemGPT 스타일 제어 루프**

- 작은 "core"를 항상 컨텍스트에 유지합니다(페르소나 + 핵심 사용자 사실)
- 나머지는 모두 컨텍스트 밖에 두고 도구로 검색합니다
- 메모리 쓰기는 명시적 도구 호출(append/replace/insert)이며, 영속화한 뒤 다음 턴에 다시 주입합니다

2. **Hindsight 스타일 메모리 기판**

- 관측된 것 vs 믿는 것 vs 요약된 것을 분리합니다
- 유지/회상/성찰을 지원합니다
- 근거에 따라 진화할 수 있는 신뢰도 보유 의견
- 엔티티 인지 검색 + 시간 질의(완전한 지식 그래프가 없어도)

## 제안 아키텍처(마크다운 정본 + 파생 인덱스)

### 정본 저장소(git 친화적)

정본의 사람이 읽을 수 있는 메모리로 `~/.openclaw/workspace`를 유지합니다.

권장 워크스페이스 레이아웃:

```
~/.openclaw/workspace/
  memory.md                    # small: durable facts + preferences (core-ish)
  memory/
    YYYY-MM-DD.md              # daily log (append; narrative)
  bank/                        # “typed” memory pages (stable, reviewable)
    world.md                   # objective facts about the world
    experience.md              # what the agent did (first-person)
    opinions.md                # subjective prefs/judgments + confidence + evidence pointers
    entities/
      Peter.md
      The-Castle.md
      warelay.md
      ...
```

노트:

- **일일 로그는 일일 로그로 유지합니다**. 이를 JSON으로 바꿀 필요가 없습니다.
- `bank/` 파일은 **큐레이션된** 결과물로, 성찰 작업이 생성하며, 여전히 손으로 편집할 수 있습니다.
- `memory.md`는 "작고 + core에 가까운" 상태로 유지합니다. 즉, 매 세션마다 Clawd가 보기를 원하는 것들입니다.

### 파생 저장소(머신 회상)

워크스페이스 아래에(반드시 git 추적일 필요는 없음) 파생 인덱스를 추가합니다:

```
~/.openclaw/workspace/.memory/index.sqlite
```

구성 요소:

- 사실 + 엔티티 링크 + 의견 메타데이터를 위한 SQLite 스키마
- 어휘 기반 회상(빠르고, 작고, 오프라인)을 위한 SQLite **FTS5**
- 시맨틱 회상(여전히 오프라인)을 위한 선택적 임베딩 테이블

이 인덱스는 항상 **마크다운으로부터 재빌드 가능**합니다.

## 유지 / 회상 / 성찰(운영 루프)

### 유지: 일일 로그를 "사실"로 정규화

여기서 중요한 Hindsight의 핵심 통찰: 작은 스니펫이 아니라 **서사적이며 자체 포함적인 사실**을 저장합니다.

`memory/YYYY-MM-DD.md`에 대한 실용 규칙:

- 하루의 끝(또는 도중)에 `## Retain` 섹션을 2–5개 불릿으로 추가하며, 각 불릿은:
  - 서사적이어야 합니다(턴 간 컨텍스트 보존)
  - 자체 포함적이어야 합니다(나중에 단독으로 읽어도 의미가 통함)
  - 유형 + 엔티티 멘션으로 태깅되어야 합니다

예시:

```
## Retain
- W @Peter: Currently in Marrakech (Nov 27–Dec 1, 2025) for Andy’s birthday.
- B @warelay: I fixed the Baileys WS crash by wrapping connection.update handlers in try/catch (see memory/2025-11-27.md).
- O(c=0.95) @Peter: Prefers concise replies (&lt;1500 chars) on WhatsApp; long content goes into files.
```

최소 파싱:

- 유형 접두사: `W`(world), `B`(experience/biographical), `O`(opinion), `S`(observation/summary; 보통 생성됨)
- 엔티티: `@Peter`, `@warelay` 등(슬러그가 `bank/entities/*.md`에 매핑)
- 의견 신뢰도: `O(c=0.0..1.0)` 선택 사항

작성자가 이를 신경 쓰지 않게 하려면: 성찰 작업이 로그의 나머지 부분에서 이러한 불릿을 추론할 수 있습니다. 하지만 명시적인 `## Retain` 섹션을 두는 것이 가장 쉬운 "품질 레버"입니다.

### 회상: 파생 인덱스에 대한 질의

회상은 다음을 지원해야 합니다:

- **어휘 기반**: "정확한 용어/이름/명령 찾기"(FTS5)
- **엔티티**: "X에 대해 말해줘"(엔티티 페이지 + 엔티티 연결 사실)
- **시간 기반**: "11월 27일 무렵에 무슨 일이 있었지?" / "지난주 이후로"
- **의견**: "Peter는 무엇을 선호하지?"(신뢰도 + 근거 포함)

반환 형식은 에이전트 친화적이어야 하며 출처를 인용해야 합니다:

- `kind`(`world|experience|opinion|observation`)
- `timestamp`(source day, 또는 존재한다면 추출된 시간 범위)
- `entities`(`["Peter","warelay"]`)
- `content`(서사적 사실)
- `source`(`memory/2025-11-27.md#L12` 등)

### 성찰: 안정 페이지 생성 + 신념 업데이트

성찰은 스케줄된 작업(일일 또는 하트비트 `ultrathink`)으로, 다음을 수행합니다:

- 최근 사실로부터 `bank/entities/*.md`를 업데이트합니다(엔티티 요약)
- 강화/모순에 따라 `bank/opinions.md` 신뢰도를 업데이트합니다
- 선택적으로 `memory.md`("core에 가까운" 지속 사실)에 대한 편집을 제안합니다

의견의 진화(단순하고, 설명 가능):

- 각 의견은 다음을 가집니다:
  - 진술
  - 신뢰도 `c ∈ [0,1]`
  - last_updated
  - 근거 링크(지지 + 반박 사실 ID)
- 새 사실이 도착하면:
  - 엔티티 겹침 + 유사도로 후보 의견을 찾습니다(먼저 FTS, 나중에 임베딩)
  - 작은 델타로 신뢰도를 업데이트합니다. 큰 점프에는 강한 모순 + 반복된 근거가 필요합니다

## CLI 통합: 독립형 vs 심층 통합

권장: **OpenClaw에 심층 통합**하되, 분리 가능한 코어 라이브러리를 유지합니다.

### 왜 OpenClaw에 통합하나요?

- OpenClaw는 이미 다음을 알고 있습니다:
  - 워크스페이스 경로(`agents.defaults.workspace`)
  - 세션 모델 + 하트비트
  - 로깅 + 문제 해결 패턴
- 에이전트 자체가 도구를 호출하길 원합니다:
  - `openclaw memory recall "…" --k 25 --since 30d`
  - `openclaw memory reflect --since 7d`

### 왜 라이브러리는 여전히 분리하나요?

- gateway/runtime 없이도 메모리 로직을 테스트 가능하게 유지합니다
- 다른 컨텍스트(로컬 스크립트, 미래의 데스크톱 앱 등)에서 재사용합니다

형태:
메모리 도구는 작은 CLI + 라이브러리 레이어를 의도하지만, 이는 탐색적 단계일 뿐입니다.

## "S-Collide" / SuCo: 언제 사용하나(연구)

"S-Collide"가 **SuCo(Subspace Collision)**를 의미한다면, 이는 서브스페이스에서 학습/구조화된 충돌을 사용하여 강한 회상률/지연시간 트레이드오프를 겨냥하는 ANN 검색 접근입니다(논문: arXiv 2411.14754, 2024).

`~/.openclaw/workspace`에 대한 실용적 견해:

- SuCo로 **시작하지 마십시오**.
- SQLite FTS + (선택적) 단순 임베딩으로 시작하면, 대부분의 UX 개선을 즉시 얻을 수 있습니다.
- 다음 조건을 만족할 때에만 SuCo/HNSW/ScaNN 계열 솔루션을 고려하십시오:
  - 코퍼스가 큽니다(수만/수십만 개의 청크)
  - 브루트포스 임베딩 검색이 너무 느려집니다
  - 회상 품질이 어휘 검색으로 인해 의미 있게 병목됩니다

오프라인 친화적 대안(복잡도 증가 순):

- SQLite FTS5 + 메타데이터 필터(ML 0)
- 임베딩 + 브루트포스(청크 수가 적으면 놀랄 만큼 멀리 갑니다)
- HNSW 인덱스(흔하고 견고함; 라이브러리 바인딩 필요)
- SuCo(리서치급; 임베드 가능한 탄탄한 구현이 있다면 매력적)

열린 질문:

- 여러분의 머신(노트북 + 데스크톱)에서 "개인 비서 메모리"에 가장 적합한 오프라인 임베딩 모델은 무엇인가요?
  - 이미 Ollama가 있다면: 로컬 모델로 임베딩하십시오. 그렇지 않다면 툴체인에 작은 임베딩 모델을 포함해 배포하십시오.

## 가장 작은 유용한 파일럿

최소이면서도 여전히 유용한 버전을 원한다면:

- `bank/` 엔티티 페이지와 일일 로그의 `## Retain` 섹션을 추가합니다.
- 출처 인용(경로 + 라인 번호)과 함께 SQLite FTS로 회상을 제공합니다.
- 회상 품질이나 규모가 요구할 때에만 임베딩을 추가합니다.

## 참고 자료

- Letta / MemGPT 개념: "core memory blocks" + "archival memory" + 도구 주도 자기 편집 메모리.
- Hindsight Technical Report: "retain / recall / reflect", four-network memory, 서사적 사실 추출, 의견 신뢰도 진화.
- SuCo: arXiv 2411.14754 (2024): "Subspace Collision" 근사 최근접 이웃 검색.
