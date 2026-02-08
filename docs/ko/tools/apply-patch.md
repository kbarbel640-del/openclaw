---
summary: "apply_patch 도구로 여러 파일에 걸친 패치를 적용합니다"
read_when:
  - 여러 파일에 걸친 구조화된 파일 편집이 필요할 때
  - 패치 기반 편집을 문서화하거나 디버그하고 싶을 때
title: "apply_patch 도구"
x-i18n:
  source_path: tools/apply-patch.md
  source_hash: 8cec2b4ee3afa910
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:39Z
---

# apply_patch 도구

구조화된 패치 형식을 사용하여 파일 변경을 적용합니다. 이는 단일 `edit` 호출로는 취약해질 수 있는 여러 파일 또는 여러 hunk 편집에 이상적입니다.

이 도구는 하나 이상의 파일 작업을 감싸는 단일 `input` 문자열을 허용합니다:

```
*** Begin Patch
*** Add File: path/to/file.txt
+line 1
+line 2
*** Update File: src/app.ts
@@
-old line
+new line
*** Delete File: obsolete.txt
*** End Patch
```

## 매개변수

- `input` (필수): `*** Begin Patch` 및 `*** End Patch`를 포함한 전체 패치 내용.

## 참고 사항

- 경로는 작업공간 루트를 기준으로 해석됩니다.
- 파일 이름을 변경하려면 `*** Update File:` hunk 내에서 `*** Move to:`를 사용합니다.
- 필요 시 `*** End of File`는 EOF 전용 삽입을 표시합니다.
- 실험적이며 기본적으로 비활성화되어 있습니다. `tools.exec.applyPatch.enabled`로 활성화합니다.
- OpenAI 전용(OpenAI Codex 포함)입니다. 선택적으로 모델별로
  `tools.exec.applyPatch.allowModels`를 통해 게이팅할 수 있습니다.
- 설정은 `tools.exec` 하위에만 있습니다.

## 예시

```json
{
  "tool": "apply_patch",
  "input": "*** Begin Patch\n*** Update File: src/index.ts\n@@\n-const foo = 1\n+const foo = 2\n*** End Patch"
}
```
