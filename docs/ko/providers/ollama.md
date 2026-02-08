---
summary: "Ollama(로컬 LLM 런타임)로 OpenClaw 실행"
read_when:
  - Ollama를 통해 로컬 모델로 OpenClaw를 실행하고자 할 때
  - Ollama 설정 및 구성 가이드가 필요할 때
title: "Ollama"
x-i18n:
  source_path: providers/ollama.md
  source_hash: 2992dd0a456d19c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:30Z
---

# Ollama

Ollama는 오픈 소스 모델을 로컬 머신에서 쉽게 실행할 수 있게 해주는 로컬 LLM 런타임입니다. OpenClaw는 Ollama의 OpenAI 호환 API와 통합되며, `OLLAMA_API_KEY` (또는 인증 프로파일)을 설정하고 명시적인 `models.providers.ollama` 항목을 정의하지 않으면 **도구 사용이 가능한 모델을 자동으로 발견**할 수 있습니다.

## 빠른 시작

1. Ollama 설치: https://ollama.ai

2. 모델 다운로드:

```bash
ollama pull gpt-oss:20b
# or
ollama pull llama3.3
# or
ollama pull qwen2.5-coder:32b
# or
ollama pull deepseek-r1:32b
```

3. OpenClaw에서 Ollama 활성화(어떤 값이든 가능하며, Ollama는 실제 키를 요구하지 않습니다):

```bash
# Set environment variable
export OLLAMA_API_KEY="ollama-local"

# Or configure in your config file
openclaw config set models.providers.ollama.apiKey "ollama-local"
```

4. Ollama 모델 사용:

```json5
{
  agents: {
    defaults: {
      model: { primary: "ollama/gpt-oss:20b" },
    },
  },
}
```

## 모델 디바이스 검색(암묵적 프로바이더)

`OLLAMA_API_KEY` (또는 인증 프로파일)을 설정하고 `models.providers.ollama`를 정의하지 **않으면**, OpenClaw는 `http://127.0.0.1:11434`에 있는 로컬 Ollama 인스턴스에서 모델을 발견합니다:

- `/api/tags` 및 `/api/show`를 조회합니다
- `tools` 기능을 보고하는 모델만 유지합니다
- 모델이 `thinking`를 보고하면 `reasoning`로 표시합니다
- 사용 가능한 경우 `model_info["<arch>.context_length"]`에서 `contextWindow`을(를) 읽습니다
- `maxTokens`를 컨텍스트 윈도우의 10배로 설정합니다
- 모든 비용을 `0`로 설정합니다

이를 통해 수동 모델 항목을 작성하지 않고도 Ollama의 기능과 일치하는 카탈로그를 유지할 수 있습니다.

사용 가능한 모델을 확인하려면 다음을 실행합니다:

```bash
ollama list
openclaw models list
```

새 모델을 추가하려면 Ollama로 다운로드하기만 하면 됩니다:

```bash
ollama pull mistral
```

새 모델은 자동으로 발견되어 즉시 사용할 수 있습니다.

`models.providers.ollama`를 명시적으로 설정하면 자동 디바이스 검색이 건너뛰어지며, 아래와 같이 모델을 수동으로 정의해야 합니다.

## 구성

### 기본 설정(암묵적 디바이스 검색)

Ollama를 활성화하는 가장 간단한 방법은 환경 변수를 사용하는 것입니다:

```bash
export OLLAMA_API_KEY="ollama-local"
```

### 명시적 설정(수동 모델)

다음과 같은 경우에는 명시적 구성을 사용합니다:

- Ollama가 다른 호스트 또는 포트에서 실행 중인 경우
- 특정 컨텍스트 윈도우나 모델 목록을 강제로 지정하고 싶은 경우
- 도구 지원을 보고하지 않는 모델을 포함하고 싶은 경우

```json5
{
  models: {
    providers: {
      ollama: {
        // Use a host that includes /v1 for OpenAI-compatible APIs
        baseUrl: "http://ollama-host:11434/v1",
        apiKey: "ollama-local",
        api: "openai-completions",
        models: [
          {
            id: "gpt-oss:20b",
            name: "GPT-OSS 20B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192,
            maxTokens: 8192 * 10
          }
        ]
      }
    }
  }
}
```

`OLLAMA_API_KEY`이 설정된 경우, 프로바이더 항목에서 `apiKey`를 생략할 수 있으며 OpenClaw가 가용성 확인을 위해 이를 자동으로 채웁니다.

### 사용자 정의 기본 URL(명시적 구성)

Ollama가 다른 호스트나 포트에서 실행 중인 경우(명시적 구성은 자동 디바이스 검색을 비활성화하므로 모델을 수동으로 정의해야 합니다):

```json5
{
  models: {
    providers: {
      ollama: {
        apiKey: "ollama-local",
        baseUrl: "http://ollama-host:11434/v1",
      },
    },
  },
}
```

### 모델 선택

구성이 완료되면 모든 Ollama 모델을 사용할 수 있습니다:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/gpt-oss:20b",
        fallbacks: ["ollama/llama3.3", "ollama/qwen2.5-coder:32b"],
      },
    },
  },
}
```

## 고급

### 추론 모델

OpenClaw는 Ollama가 `/api/show`에서 `thinking`을(를) 보고할 때 모델을 추론 가능 모델로 표시합니다:

```bash
ollama pull deepseek-r1:32b
```

### 모델 비용

Ollama는 무료이며 로컬에서 실행되므로 모든 모델 비용은 $0으로 설정됩니다.

### 스트리밍 구성

Ollama의 응답 형식과 관련된 기본 SDK의 [알려진 문제](https://github.com/badlogic/pi-mono/issues/1205)로 인해, Ollama 모델에 대해서는 **스트리밍이 기본적으로 비활성화**되어 있습니다. 이는 도구 사용이 가능한 모델을 사용할 때 응답이 손상되는 것을 방지합니다.

스트리밍이 비활성화되면 응답은 한 번에 전달되며(비스트리밍 모드), 콘텐츠/추론 델타가 섞이면서 출력이 깨지는 문제를 피할 수 있습니다.

#### 스트리밍 다시 활성화(고급)

Ollama에 대해 스트리밍을 다시 활성화하려는 경우(도구 사용이 가능한 모델에서는 문제가 발생할 수 있음):

```json5
{
  agents: {
    defaults: {
      models: {
        "ollama/gpt-oss:20b": {
          streaming: true,
        },
      },
    },
  },
}
```

#### 다른 프로바이더에 대한 스트리밍 비활성화

필요한 경우 어떤 프로바이더에 대해서든 스트리밍을 비활성화할 수 있습니다:

```json5
{
  agents: {
    defaults: {
      models: {
        "openai/gpt-4": {
          streaming: false,
        },
      },
    },
  },
}
```

### 컨텍스트 윈도우

자동으로 발견된 모델의 경우, OpenClaw는 가능하면 Ollama가 보고한 컨텍스트 윈도우를 사용하고, 그렇지 않으면 기본값으로 `8192`를 사용합니다. 명시적 프로바이더 구성에서는 `contextWindow` 및 `maxTokens`을 재정의할 수 있습니다.

## 문제 해결

### Ollama가 감지되지 않음

Ollama가 실행 중인지 확인하고, `OLLAMA_API_KEY` (또는 인증 프로파일)을 설정했으며, 명시적인 `models.providers.ollama` 항목을 정의하지 **않았는지** 확인합니다:

```bash
ollama serve
```

또한 API에 접근 가능한지 확인합니다:

```bash
curl http://localhost:11434/api/tags
```

### 사용 가능한 모델이 없음

OpenClaw는 도구 지원을 보고하는 모델만 자동으로 발견합니다. 모델이 목록에 나타나지 않는 경우 다음 중 하나를 선택합니다:

- 도구 사용이 가능한 모델을 다운로드하거나
- `models.providers.ollama`에서 모델을 명시적으로 정의합니다.

모델을 추가하려면 다음을 실행합니다:

```bash
ollama list  # See what's installed
ollama pull gpt-oss:20b  # Pull a tool-capable model
ollama pull llama3.3     # Or another model
```

### 연결 거부

Ollama가 올바른 포트에서 실행 중인지 확인합니다:

```bash
# Check if Ollama is running
ps aux | grep ollama

# Or restart Ollama
ollama serve
```

### 응답 손상 또는 출력에 도구 이름 표시

Ollama 모델 사용 시 `sessions_send`, `memory_get`와 같은 도구 이름이 포함된 깨진 응답이나 텍스트가 조각난 형태로 표시된다면, 이는 스트리밍 응답과 관련된 업스트림 SDK 문제 때문입니다. **최신 OpenClaw 버전에서는 Ollama 모델에 대해 스트리밍을 비활성화하여 기본적으로 이 문제가 해결되었습니다.**

스트리밍을 수동으로 활성화했고 이 문제가 발생한다면 다음 중 하나를 수행합니다:

1. Ollama 모델 항목에서 `streaming: true` 구성을 제거하거나
2. Ollama 모델에 대해 `streaming: false`를 명시적으로 설정합니다([스트리밍 구성](#streaming-configuration) 참조)

## 참고 자료

- [모델 프로바이더](/concepts/model-providers) - 모든 프로바이더 개요
- [모델 선택](/concepts/models) - 모델 선택 방법
- [구성](/gateway/configuration) - 전체 구성 참조
