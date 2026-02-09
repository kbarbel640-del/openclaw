# Node-RED Tool Extension

Node-RED 플로우를 프로그래밍 방식으로 관리하고 생성하기 위한 OpenClaw 확장입니다.

## 설치 및 설정

```yaml
# openclaw/config.yaml
plugins:
  node-red-tool:
    baseUrl: "http://localhost:1880" # Node-RED 서버 URL
    token: "your-token" # adminAuth 사용 시 토큰
    deploymentType: "flows" # full, nodes, flows, reload
    readOnly: false # true면 조회만 허용
```

---

## 🗣️ 사용 예시 질문

AI 에이전트에게 이렇게 요청하면 Node-RED Tool이 자동으로 호출됩니다:

### 플로우 조회/관리

```
"Node-RED에 있는 현재 플로우를 보여줘"
"지금 배포된 플로우 목록 확인해줘"
"Node-RED 상태 확인해줘"
"플로우 상태가 어떻게 되어있어?"
```

### 플로우 생성 (패턴 사용)

```
"Node-RED에 간단한 테스트 플로우 만들어줘"
"/api/users GET 엔드포인트 만들어줘"
"HTTP POST API 하나 만들어줘, URL은 /api/data"
"에러 핸들러 플로우 추가해줘"
"조건 분기 플로우 만들어줘, success/error/pending 세 가지로 나눠줘"
"배열 병렬 처리하는 플로우 만들어줘"
```

### 템플릿 활용

```
"Node-RED 템플릿 목록 보여줘"
"MQTT 메시지 처리 템플릿 적용해줘"
"타이머 작업 템플릿으로 플로우 만들어줘"
"웹훅 핸들러 템플릿 적용해줘"
```

### 노드 정보 조회

```
"Node-RED에서 사용할 수 있는 노드 타입 알려줘"
"HTTP 관련 노드 찾아줘"
"function 노드 사용법 알려줘"
"split 노드가 뭐야?"
"파일 관련 노드 있어?"
```

### 수동 플로우 구성

```
"새 플로우 탭 만들어줘, 이름은 'Data Processor'"
"inject 노드 하나 만들어줘"
"debug 노드 추가해줘"
"두 노드 연결해줘"
"만든 플로우 배포해줘"
```

### 플로우 검증/분석

```
"이 플로우 문법 검사해줘"
"현재 플로우 분석해줘"
"플로우에 HTTP 엔드포인트가 있어?"
"어떤 노드 타입들이 사용되고 있어?"
```

### 노드 설치

```
"node-red-contrib-mongodb 노드 설치해줘"
"설치된 노드 목록 보여줘"
```

---

## Actions 개요

| 카테고리        | Action            | 설명                       |
| --------------- | ----------------- | -------------------------- |
| **API 관리**    | `flows_get`       | 전체 플로우 조회           |
|                 | `flows_deploy`    | 플로우 배포                |
|                 | `flows_state_get` | 플로우 상태 조회           |
| **플로우 관리** | `flow_add`        | 새 플로우 탭 추가 (서버)   |
|                 | `flow_update`     | 플로우 업데이트 (서버)     |
|                 | `flow_create`     | 플로우 탭 생성 (로컬)      |
| **노드 관리**   | `nodes_list`      | 설치된 노드 목록           |
|                 | `nodes_install`   | 노드 모듈 설치             |
|                 | `node_create`     | 노드 생성 (로컬)           |
|                 | `nodes_connect`   | 노드 연결 (로컬)           |
| **패턴**        | `pattern_build`   | 플로우 패턴 빌드           |
|                 | `node_types`      | 사용 가능한 노드 타입 조회 |
| **템플릿**      | `templates_list`  | 템플릿 목록 조회           |
|                 | `template_apply`  | 템플릿 적용                |
| **도우미**      | `catalog_search`  | 노드 카탈로그 검색         |
|                 | `catalog_info`    | 노드 상세 정보             |
|                 | `flow_validate`   | 플로우 검증                |
|                 | `flow_analyze`    | 플로우 분석                |

---

## 플로우 패턴 (pattern_build)

6가지 내장 패턴으로 빠르게 플로우를 생성할 수 있습니다.

### simple - 기본 플로우

**질문 예시:**

- "간단한 테스트 플로우 만들어줘"
- "inject → function → debug 플로우 만들어줘"
- "60초마다 실행되는 플로우 만들어줘"

```
inject → function → debug
```

**파라미터:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `patternType` | ✓ | `"simple"` |
| `label` | | 플로우 이름 |
| `handlerFunc` | | JavaScript 처리 함수 |
| `interval` | | 반복 주기 (초) |

```json
{
  "action": "pattern_build",
  "patternType": "simple",
  "label": "My Simple Flow",
  "handlerFunc": "msg.payload = msg.payload.toUpperCase();\nreturn msg;",
  "interval": "60"
}
```

### http-api - HTTP API 엔드포인트

**질문 예시:**

- "/api/users GET 엔드포인트 만들어줘"
- "POST /api/data API 만들어줘"
- "REST API 하나 만들어줘"

```
http in → handler → http response
```

**파라미터:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `patternType` | ✓ | `"http-api"` |
| `baseUrl` | ✓ | URL 경로 (예: `/api/users`) |
| `method` | | HTTP 메서드 (기본: `get`) |
| `label` | | 플로우 이름 |
| `handlerFunc` | | 핸들러 함수 |

```json
{
  "action": "pattern_build",
  "patternType": "http-api",
  "label": "User API",
  "baseUrl": "/api/users",
  "method": "get",
  "handlerFunc": "msg.payload = { users: ['alice', 'bob'] };\nreturn msg;"
}
```

**HTTP 메서드 옵션:** `get`, `post`, `put`, `delete`, `patch`

### switch - 조건 분기

**질문 예시:**

- "조건 분기 플로우 만들어줘"
- "success/error 두 가지로 분기하는 플로우"
- "payload.type 값에 따라 분기해줘"

```
input → switch → [output1, output2, ..., else]
```

**파라미터:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `patternType` | ✓ | `"switch"` |
| `conditions` | | 분기 조건 배열 |
| `properties.property` | | 분기 기준 속성 (기본: `payload`) |
| `label` | | 플로우 이름 |

```json
{
  "action": "pattern_build",
  "patternType": "switch",
  "label": "Status Router",
  "properties": { "property": "payload.status" },
  "conditions": [
    { "value": "success" },
    { "value": "error" },
    { "value": "pending" }
  ]
}
```

### error-handler - 에러 처리

**질문 예시:**

- "에러 핸들러 플로우 만들어줘"
- "에러 캐치하는 플로우 추가해줘"
- "예외 처리 플로우 만들어줘"

```
catch → handler → debug
```

**파라미터:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `patternType` | ✓ | `"error-handler"` |
| `label` | | 플로우 이름 |
| `handlerFunc` | | 에러 처리 함수 |

```json
{
  "action": "pattern_build",
  "patternType": "error-handler",
  "label": "Error Handler",
  "handlerFunc": "msg.payload = {\n  error: msg.error.message,\n  timestamp: new Date().toISOString(),\n  source: msg.error.source.type\n};\nreturn msg;"
}
```

### transform - 변환 파이프라인

**질문 예시:**

- "데이터 변환 파이프라인 만들어줘"
- "JSON 파싱 → 필터 → 포맷 순서로 처리하는 플로우"
- "여러 단계로 데이터 처리하는 플로우 만들어줘"

```
inject → transform1 → transform2 → ... → debug
```

**파라미터:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `patternType` | ✓ | `"transform"` |
| `transforms` | ✓ | 변환 함수 배열 |
| `label` | | 플로우 이름 |

```json
{
  "action": "pattern_build",
  "patternType": "transform",
  "label": "Data Pipeline",
  "transforms": [
    {
      "name": "Parse",
      "func": "msg.payload = JSON.parse(msg.payload);\nreturn msg;"
    },
    {
      "name": "Filter",
      "func": "msg.payload = msg.payload.filter(x => x.active);\nreturn msg;"
    },
    {
      "name": "Format",
      "func": "msg.payload = {\n  count: msg.payload.length,\n  data: msg.payload\n};\nreturn msg;"
    }
  ]
}
```

### parallel - 병렬 처리

**질문 예시:**

- "배열 병렬 처리 플로우 만들어줘"
- "split/join 패턴 플로우 만들어줘"
- "배열 각 요소에 함수 적용하는 플로우"

```
inject → split → process → join → debug
```

**파라미터:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `patternType` | ✓ | `"parallel"` |
| `label` | | 플로우 이름 |
| `handlerFunc` | | 각 요소 처리 함수 |

```json
{
  "action": "pattern_build",
  "patternType": "parallel",
  "label": "Parallel Processor",
  "handlerFunc": "msg.payload = msg.payload * 2;\nreturn msg;"
}
```

---

## NodeFactory 노드 타입

`node_create` 또는 `node_types`로 사용 가능한 40+ 기본 노드 타입:

### Common (공통)

| 타입        | 설명               | 질문 예시                   |
| ----------- | ------------------ | --------------------------- |
| `inject`    | 메시지 주입/타이머 | "inject 노드 만들어줘"      |
| `debug`     | 디버그 출력        | "debug 노드 추가해줘"       |
| `complete`  | 노드 완료 감지     | "완료 감지 노드 필요해"     |
| `catch`     | 에러 캐치          | "에러 캐치 노드 추가"       |
| `status`    | 노드 상태 감지     | "상태 감지 노드 만들어줘"   |
| `link_in`   | 링크 입력          | "link in 노드 만들어줘"     |
| `link_out`  | 링크 출력          | "link out 노드 추가"        |
| `link_call` | 링크 호출          | "다른 플로우 호출하는 노드" |
| `comment`   | 주석               | "주석 노드 추가해줘"        |
| `junction`  | 연결점             | "junction 노드 필요해"      |

### Function (함수)

| 타입       | 설명             | 질문 예시                     |
| ---------- | ---------------- | ----------------------------- |
| `function` | JavaScript 함수  | "function 노드로 데이터 처리" |
| `change`   | 속성 설정/변경   | "payload 값 바꾸는 노드"      |
| `switch`   | 조건 분기        | "조건에 따라 분기하는 노드"   |
| `range`    | 값 범위 변환     | "0-100을 0-1로 변환"          |
| `template` | Mustache 템플릿  | "템플릿으로 HTML 생성"        |
| `delay`    | 지연/속도 제한   | "5초 딜레이 추가"             |
| `trigger`  | 트리거           | "메시지 트리거 노드"          |
| `exec`     | 시스템 명령 실행 | "시스템 명령 실행하는 노드"   |
| `rbe`      | 중복 제거        | "중복 메시지 필터링"          |

### Network (네트워크)

| 타입                              | 설명            | 질문 예시                      |
| --------------------------------- | --------------- | ------------------------------ |
| `httpIn`                          | HTTP 엔드포인트 | "HTTP GET 엔드포인트 만들어줘" |
| `httpResponse`                    | HTTP 응답       | "HTTP 응답 노드 추가"          |
| `httpRequest`                     | HTTP 클라이언트 | "외부 API 호출하는 노드"       |
| `websocketIn` / `websocketOut`    | WebSocket       | "웹소켓 연결"                  |
| `tcpIn` / `tcpOut` / `tcpRequest` | TCP             | "TCP 서버 노드"                |
| `udpIn` / `udpOut`                | UDP             | "UDP 메시지 수신"              |
| `mqttIn` / `mqttOut`              | MQTT            | "MQTT 토픽 구독"               |

### Sequence (시퀀스)

| 타입    | 설명             | 질문 예시                |
| ------- | ---------------- | ------------------------ |
| `split` | 배열/문자열 분할 | "배열을 개별 메시지로"   |
| `join`  | 메시지 결합      | "메시지들을 배열로 합쳐" |
| `sort`  | 정렬             | "메시지 정렬"            |
| `batch` | 배치 처리        | "10개씩 묶어서 처리"     |

### Parser (파서)

| 타입   | 설명      | 질문 예시              |
| ------ | --------- | ---------------------- |
| `json` | JSON 변환 | "JSON 파싱 노드"       |
| `csv`  | CSV 변환  | "CSV를 JSON으로 변환"  |
| `html` | HTML 파싱 | "HTML에서 데이터 추출" |
| `xml`  | XML 변환  | "XML 파싱"             |
| `yaml` | YAML 변환 | "YAML로 변환"          |

### Storage (저장소)

| 타입     | 설명      | 질문 예시          |
| -------- | --------- | ------------------ |
| `file`   | 파일 쓰기 | "파일에 로그 저장" |
| `fileIn` | 파일 읽기 | "파일 읽기 노드"   |
| `watch`  | 파일 감시 | "파일 변경 감지"   |

---

## 템플릿 (10개)

`templates_list`와 `template_apply`로 사용:

| ID                | 이름          | 설명                | 질문 예시                     |
| ----------------- | ------------- | ------------------- | ----------------------------- |
| `http-api`        | HTTP REST API | 기본 HTTP 요청/응답 | "HTTP API 템플릿 적용해줘"    |
| `http-api-crud`   | CRUD API      | 완전한 CRUD 패턴    | "CRUD API 만들어줘"           |
| `mqtt-processor`  | MQTT 처리기   | MQTT 메시지 처리    | "MQTT 메시지 처리 템플릿"     |
| `timer-task`      | 타이머 작업   | 주기적 자동화       | "타이머 작업 템플릿"          |
| `webhook-handler` | 웹훅 핸들러   | 웹훅 분기 처리      | "웹훅 핸들러 만들어줘"        |
| `error-handler`   | 에러 핸들러   | 에러 캐치/로깅      | "에러 핸들러 템플릿"          |
| `http-proxy`      | HTTP 프록시   | 외부 API 프록시     | "API 프록시 만들어줘"         |
| `mqtt-to-http`    | MQTT→HTTP     | 프로토콜 브릿지     | "MQTT를 HTTP로 브릿지"        |
| `data-logger`     | 데이터 로거   | 파일 저장           | "데이터 로깅 플로우 만들어줘" |
| `rate-limiter`    | 속도 제한     | 메시지 제한         | "속도 제한 플로우 추가해줘"   |

---

## 상세 사용 워크플로우

### 워크플로우 1: 패턴으로 빠른 API 생성

**사용자:** "Node-RED에 /api/users GET API 만들어줘"

**AI가 수행하는 작업:**

```
1. pattern_build({
     patternType: "http-api",
     baseUrl: "/api/users",
     method: "get"
   })
   → flows 배열 반환

2. flows_deploy({ flows: [...] })
   → Node-RED에 배포
```

### 워크플로우 2: 템플릿 적용

**사용자:** "MQTT 메시지 처리하는 플로우 만들어줘"

**AI가 수행하는 작업:**

```
1. templates_list()
   → 사용 가능한 템플릿 목록 확인

2. template_apply({
     templateId: "mqtt-processor",
     mqttTopic: "sensors/#"
   })
   → flows 배열 반환

3. flows_deploy({ flows: [...] })
   → Node-RED에 배포
```

### 워크플로우 3: 수동 플로우 구성

**사용자:** "inject → function → mqtt out 플로우 만들어줘"

**AI가 수행하는 작업:**

```
1. flow_create({ label: "MQTT Publisher" })
   → tab 객체 반환

2. node_create({
     nodeType: "inject",
     flowId: "tab-id",
     position: { x: 100, y: 100 }
   })
   → inject 노드 반환

3. node_create({
     nodeType: "function",
     flowId: "tab-id",
     position: { x: 300, y: 100 },
     properties: { func: "msg.payload = { temp: 25 };\nreturn msg;" }
   })
   → function 노드 반환

4. node_create({
     nodeType: "mqttOut",
     flowId: "tab-id",
     position: { x: 500, y: 100 }
   })
   → mqtt out 노드 반환

5. nodes_connect({ sourceId: "inject-id", targetId: "function-id" })
   nodes_connect({ sourceId: "function-id", targetId: "mqtt-id" })
   → 연결 완료

6. flows_deploy({ flows: [tab, inject, function, mqtt] })
   → 배포
```

### 워크플로우 4: 노드 정보 조회

**사용자:** "HTTP 관련 노드 뭐가 있어?"

**AI가 수행하는 작업:**

```
1. catalog_search({ query: "http" })
   → http in, http response, http request 등 반환

2. catalog_info({ nodeType: "http in" })
   → 상세 정보 (입력/출력 수, 속성, 사용법) 반환
```

### 워크플로우 5: 현재 플로우 분석

**사용자:** "현재 Node-RED 플로우 분석해줘"

**AI가 수행하는 작업:**

```
1. flows_get()
   → 전체 플로우 조회

2. flow_analyze({ flows: currentFlows })
   → 분석 결과 반환:
     - 탭 수, 노드 수
     - HTTP 엔드포인트 유무
     - MQTT 사용 여부
     - 사용된 노드 타입 목록
```

---

## node_create 상세 옵션

각 노드 타입별 주요 옵션:

### inject 노드

```json
{
  "action": "node_create",
  "nodeType": "inject",
  "flowId": "flow-id",
  "properties": {
    "payload": "Hello",
    "payloadType": "str",
    "topic": "test",
    "repeat": "60",
    "once": true
  }
}
```

**payloadType 옵션:** `date`, `str`, `num`, `bool`, `json`, `flow`, `global`, `env`

### function 노드

```json
{
  "action": "node_create",
  "nodeType": "function",
  "flowId": "flow-id",
  "label": "Data Processor",
  "properties": {
    "func": "msg.payload = msg.payload * 2;\nreturn msg;",
    "outputs": 1,
    "initialize": "// 초기화 코드",
    "finalize": "// 종료 코드"
  }
}
```

### httpIn 노드

```json
{
  "action": "node_create",
  "nodeType": "httpIn",
  "flowId": "flow-id",
  "properties": {
    "url": "/api/data",
    "method": "post",
    "upload": false
  }
}
```

**method 옵션:** `get`, `post`, `put`, `delete`, `patch`, `options`

### switch 노드

```json
{
  "action": "node_create",
  "nodeType": "switch",
  "flowId": "flow-id",
  "properties": {
    "property": "payload.type",
    "rules": [
      { "t": "eq", "v": "A", "vt": "str" },
      { "t": "eq", "v": "B", "vt": "str" },
      { "t": "else" }
    ]
  }
}
```

**규칙 타입(t):** `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `btwn`, `cont`, `regex`, `true`, `false`, `null`, `nnull`, `empty`, `nempty`, `istype`, `else`

### delay 노드

```json
{
  "action": "node_create",
  "nodeType": "delay",
  "flowId": "flow-id",
  "properties": {
    "pauseType": "delay",
    "timeout": "5",
    "timeoutUnits": "seconds"
  }
}
```

**pauseType 옵션:** `delay`, `delayv`, `rate`, `timed`, `queue`, `random`

---

## 에러 처리

| 에러 코드           | 원인             | 해결 방법                                   |
| ------------------- | ---------------- | ------------------------------------------- |
| **401**             | 인증 실패        | 설정의 `token` 값 확인                      |
| **409**             | 리비전 충돌      | `flows_get`으로 최신 `rev` 가져온 후 재시도 |
| **readOnly 모드**   | 쓰기 작업 차단됨 | 설정의 `readOnly: false`로 변경             |
| **Node-RED 미실행** | 서버 연결 불가   | Node-RED 서버 실행 확인                     |

---

## 관련 링크

- [Node-RED Admin API](https://nodered.org/docs/api/admin/)
- [Node-RED 노드 개발](https://nodered.org/docs/creating-nodes/)
- [Node-RED 공식 문서](https://nodered.org/docs/)
